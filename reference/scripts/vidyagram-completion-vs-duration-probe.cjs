// READ-ONLY. For learners already captured by vidyagram-completion-pilot.cjs, compares AppX manual
// completion flags with the saved cumulative watch seconds (apx_user_course_test_detail), to see how
// far the saved durations can stand in for flags without an OTP. Aggregate output only.
// Run: VG_APP_ROOT=<vg backend checkout> node vidyagram-completion-vs-duration-probe.cjs
'use strict';
const fs=require('fs'),path=require('path');
const root=process.env.VG_APP_ROOT||process.cwd();const req=n=>require(require.resolve(n,{paths:[root]}));
const env=req('dotenv').parse(fs.readFileSync(process.env.VG_ENV_PATH||path.join(root,'.env.development')));
if(!/^mongodb(?:\+srv)?:\/\/[^/]+\/vidyagramdb(?:\?|$)/.test(env.MONGO_URI||''))throw Error('VG database guard');
const {MongoClient,ObjectId}=req('mongoose').mongo;
const client=new MongoClient(env.MONGO_URI,{minPoolSize:0,maxPoolSize:2,readPreference:'secondaryPreferred',serverSelectionTimeoutMS:15000});
const norm=s=>String(s||'').trim().replace(/\s+/g,' ').toLowerCase();
const BANDS=[['0',r=>r===0],['0-50%',r=>r>0&&r<.5],['50-90%',r=>r>=.5&&r<.9],['90%+',r=>r>=.9]];
const band=r=>BANDS.find(([,f])=>f(r))[0];
const tally=()=>Object.fromEntries(BANDS.map(([k])=>[k,0]));
(async()=>{
 await client.connect();const db=client.db('vidyagramdb');
 const caps=await db.collection('apx_vg_completion_captures').find({},{projection:{apxUserId:1,courseId:1,apxCourseId:1,mapped:1}}).toArray();
 const out={learners:new Set(),coursePairs:caps.length,flaggedMapped:0,flaggedByDuration:tally(),flaggedNoHistoryRow:0,flaggedUnknownLength:0,
  unflaggedByDuration:tally(),unflaggedUnknownLength:0,ambiguousTitleRows:0,unmatchedTitleRows:0,learnersWithAnyDuration:0,learnersWithFlags:new Set()};
 const courseCache=new Map();
 const courseIndex=async id=>{
  if(courseCache.has(id))return courseCache.get(id);
  const placements=await db.collection('courseclasses').find({course:new ObjectId(id)},{projection:{class:1,title:1,apxTitle:1}}).toArray();
  const classes=await db.collection('classes').find({_id:{$in:placements.map(p=>p.class)}},{projection:{title:1,duration:1,apxDurationSeconds:1}}).toArray();
  const byId=new Map(classes.map(c=>[String(c._id),c]));
  const byTitle=new Map();
  for(const p of placements){const c=byId.get(String(p.class));const t=norm(p.title||p.apxTitle||c?.title);if(!t)continue;if(!byTitle.has(t))byTitle.set(t,new Set());byTitle.get(t).add(String(p.class));}
  const entry={byId,byTitle};courseCache.set(id,entry);return entry;
 };
 const seenWatched=new Set();
 for(const cap of caps){
  out.learners.add(cap.apxUserId);
  const raw=await db.collection('apx_user_course_test_detail').findOne({apxId:{$in:[cap.apxUserId,Number(cap.apxUserId)]}},{projection:{courses:1}});
  const items=(raw?.courses||[]).filter(c=>String(c.courseId)===String(cap.apxCourseId)).flatMap(c=>c.data?.merged_courses||[]);
  const idx=await courseIndex(cap.courseId);
  const seconds=new Map();
  for(const e of items){
   const ids=idx.byTitle.get(norm(e.title));
   if(!ids){out.unmatchedTitleRows++;continue;}
   if(ids.size>1){out.ambiguousTitleRows++;continue;}
   const id=[...ids][0];seconds.set(id,Math.max(seconds.get(id)||0,Number(e.video_duration_total)||0));
  }
  if([...seconds.values()].some(s=>s>0))seenWatched.add(cap.apxUserId);
  const flagged=new Set((cap.mapped||[]).map(m=>m.classId));
  if(flagged.size)out.learnersWithFlags.add(cap.apxUserId);
  const lengthOf=id=>{const c=idx.byId.get(id);return Number(c?.duration)||Number(c?.apxDurationSeconds)||0;};
  for(const id of flagged){
   out.flaggedMapped++;
   if(!seconds.has(id)){out.flaggedNoHistoryRow++;continue;}
   const len=lengthOf(id);if(!len){out.flaggedUnknownLength++;continue;}
   out.flaggedByDuration[band(seconds.get(id)/len)]++;
  }
  for(const[id,s]of seconds){
   if(flagged.has(id)||s<=0)continue;
   const len=lengthOf(id);if(!len){out.unflaggedUnknownLength++;continue;}
   out.unflaggedByDuration[band(s/len)]++;
  }
 }
 console.log(JSON.stringify({event:'flags-vs-duration',at:new Date().toISOString(),productionWrites:0,...out,learners:out.learners.size,learnersWithFlags:out.learnersWithFlags.size,learnersWithAnyDuration:seenWatched.size},null,1));
})().catch(e=>{console.error(JSON.stringify({event:'probe-failed',name:e.name,message:String(e.message).slice(0,200)}));process.exitCode=1;}).finally(()=>client.close());
