// READ-ONLY, aggregate output only. Tests whether saved AppX data predicts which learners have completion flags,
// so a learner with no signal could skip the OTP. Truth = captured flags from vg-completion-20261103-* runs.
// Run on an Azure migrator: VG_APP_ROOT=$dir/runtime VG_ENV_PATH=$dir/.env.development node - < this file
'use strict';
const path=require('path');
const root=process.env.VG_APP_ROOT||process.cwd();
const req=n=>require(require.resolve(n,{paths:[root]}));
const env=req('dotenv').parse(require('fs').readFileSync(process.env.VG_ENV_PATH||path.join(root,'.env.development')));
if(!/^mongodb(?:\+srv)?:\/\/[^/]+\/vidyagramdb(?:\?|$)/.test(env.MONGO_URI||''))throw Error('VG database guard');
const {MongoClient}=req('mongodb');
const ORG='2177599',RUNS=/^vg-completion-20261103-/;
// Saved durations are text: "3437m", "4s", "1h 2m", "01:02:03" or plain seconds.
const secs=v=>{if(v==null||v==='')return 0;const s=String(v).trim().toLowerCase();if(s.includes(':'))return s.split(':').reduce((a,x)=>a*60+(Number(x)||0),0);const units=[...s.matchAll(/([\d.]+)\s*(h|m|s)/g)];if(units.length)return units.reduce((a,[,n,u])=>a+Number(n)*({h:3600,m:60,s:1}[u]),0);return Number(s)||0;};
const bandOf=v=>v<=0?'0':v<1?'0-1':v<5?'1-5':v<20?'5-20':v<50?'20-50':'50+';
(async()=>{
 const client=new MongoClient(env.MONGO_URI,{minPoolSize:0,maxPoolSize:2,readPreference:'secondaryPreferred',serverSelectionTimeoutMS:15000});
 await client.connect();
 try{
  const db=client.db('vidyagramdb');
  const caps=await db.collection('apx_vg_completion_captures').find({orgId:ORG,runId:RUNS},{projection:{apxUserId:1,apxCourseId:1,completedCount:1,fetchedAt:1,runId:1}}).toArray();
  const ids=[...new Set(caps.map(c=>String(c.apxUserId)))];
  const saved=new Map();
  for(let i=0;i<ids.length;i+=200){
   for(const d of await db.collection('apx_user_course_test_detail').find({apxId:{$in:ids.slice(i,i+200)}},{projection:{apxId:1,fetchedAt:1,'courses.courseId':1,'courses.fetchedAt':1,'courses.data.video_completion':1,'courses.data.course_completion':1,'courses.data.total_watch_time':1,'courses.data.merged_courses.video_duration_total':1}}).toArray())saved.set(String(d.apxId),d);
  }
  const twtSamples=new Set(),durSamples=new Set(),fetchedMonths={};
  const L=new Map(),pairBand={};
  let pairs=0,pairNoSaved=0;
  for(const c of caps){
   pairs++;
   const u=String(c.apxUserId);
   const l=L.get(u)||L.set(u,{flags:0,vc:0,vcSum:0,cc:0,twt:0,rows:0,dur:0,savedDoc:saved.has(u),savedCourse:0,watched:0,watchedDur:0}).get(u);
   l.flags+=c.completedCount||0;
   const s=(saved.get(u)?.courses||[]).find(x=>String(x.courseId)===String(c.apxCourseId));
   if(!s){pairNoSaved++;continue;}
   l.savedCourse++;
   const m=String(s.fetchedAt?.toISOString?.()||'').slice(0,7);fetchedMonths[m]=(fetchedMonths[m]||0)+1;
   const vc=Number(s.data?.video_completion)||0,cc=Number(s.data?.course_completion)||0,twt=secs(s.data?.total_watch_time);
   if(twtSamples.size<6&&s.data?.total_watch_time)twtSamples.add(String(s.data.total_watch_time));
   const rows=(s.data?.merged_courses||[]);for(const r of rows)if(durSamples.size<6&&r.video_duration_total)durSamples.add(String(r.video_duration_total));const dur=rows.reduce((a,r)=>a+secs(r.video_duration_total),0);
   l.vc=Math.max(l.vc,vc);l.vcSum+=vc;l.cc=Math.max(l.cc,cc);l.twt+=twt;l.rows+=rows.length;l.dur+=dur;
   const b=pairBand[bandOf(vc)]||={pairs:0,withFlags:0,flags:0};b.pairs++;if(c.completedCount>0)b.withFlags++;b.flags+=c.completedCount||0;
  }
  for(let i=0;i<ids.length;i+=200)for(const a of await db.collection('apx_user_analytics').find({apxId:{$in:ids.slice(i,i+200)}},{projection:{apxId:1,'data.result.videos_watched':1,'data.result.videos_watched_duration':1}}).toArray()){const l=L.get(String(a.apxId));if(l){l.watched=Number(a.data?.result?.videos_watched)||0;l.watchedDur=secs(a.data?.result?.videos_watched_duration);}}
  const noSavedWithFlags=caps.filter(c=>c.completedCount>0&&!(saved.get(String(c.apxUserId))?.courses||[]).some(x=>String(x.courseId)===String(c.apxCourseId)));
  const all=[...L.values()],totalFlags=all.reduce((a,l)=>a+l.flags,0),withFlags=all.filter(l=>l.flags>0).length;
  const score=(name,keep)=>{
   const kept=all.filter(keep),skip=all.filter(l=>!keep(l));
   return {rule:name,sendOtp:kept.length,skipOtp:skip.length,skipPct:Math.round(skip.length/all.length*100),skippedLearnersWithFlags:skip.filter(l=>l.flags>0).length,learnersWithFlagsLostPct:withFlags?Math.round(skip.filter(l=>l.flags>0).length/withFlags*100):0,flagsLost:skip.reduce((a,l)=>a+l.flags,0),flagsLostPct:totalFlags?Math.round(skip.reduce((a,l)=>a+l.flags,0)/totalFlags*1000)/10:0,hitRateOfSent:kept.length?Math.round(kept.filter(l=>l.flags>0).length/kept.length*100):0};
  };
  const rules=[
   score('send to all (today)',()=>true),
   score('saved course row exists',l=>l.savedCourse>0),
   score('any lecture history row',l=>l.rows>0),
   score('any saved watch seconds',l=>l.dur>0),
   score('total_watch_time > 0',l=>l.twt>0),
   score('total_watch_time >= 30 min',l=>l.twt>=1800),
   score('total_watch_time >= 1 h',l=>l.twt>=3600),
   score('total_watch_time >= 5 h',l=>l.twt>=18000),
   score('total_watch_time >= 20 h',l=>l.twt>=72000),
   score('video_completion > 0',l=>l.vc>0),
   score('video_completion >= 5',l=>l.vc>=5),
   score('video_completion >= 10',l=>l.vc>=10),
   score('video_completion sum >= 10',l=>l.vcSum>=10),
   score('analytics videos_watched >= 5',l=>l.watched>=5),
   score('analytics videos_watched >= 20',l=>l.watched>=20),
   score('analytics videos_watched >= 50',l=>l.watched>=50),
  ];
  console.log(JSON.stringify({now:new Date().toISOString(),learners:all.length,learnersWithFlags:withFlags,totalFlags,pairs,pairNoSaved,pairNoSavedWithFlags:noSavedWithFlags.length,flagsOnPairsWithNoSaved:noSavedWithFlags.reduce((a,c)=>a+(c.completedCount||0),0),durSamples:[...durSamples],learnersNoSavedDoc:all.filter(l=>!l.savedDoc).length,fetchedMonths,twtSamples:[...twtSamples],videoCompletionBands:pairBand,rules}));
 }finally{await client.close();}
})().catch(e=>{console.error(String(e.message).replace(/mongodb(\+srv)?:\/\/\S+/g,'<uri>'));process.exit(1);});
