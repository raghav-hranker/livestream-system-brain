// READ-ONLY on the database. Buckets every paid VG student by saved watch history, and keeps a mode-600 list of
// no-history apx ids on the machine it runs on. Aggregates only on stdout. Resumes from VG_CENSUS_DIR/progress.json.
// Run on an Azure migrator: VG_APP_ROOT=$dir/runtime VG_ENV_PATH=$dir/.env.development VG_CENSUS_DIR=$dir/nohistory MAX_SECONDS=540 node - < this file
'use strict';
const fs=require('fs'),path=require('path');
const root=process.env.VG_APP_ROOT||process.cwd();
const req=n=>require(require.resolve(n,{paths:[root]}));
const env=req('dotenv').parse(fs.readFileSync(process.env.VG_ENV_PATH||path.join(root,'.env.development')));
if(!/^mongodb(?:\+srv)?:\/\/[^/]+\/vidyagramdb(?:\?|$)/.test(env.MONGO_URI||''))throw Error('VG database guard');
const {MongoClient,ObjectId}=req('mongodb');
const DIR=process.env.VG_CENSUS_DIR;if(!DIR)throw Error('VG_CENSUS_DIR required');
const MAX_MS=Number(process.env.MAX_SECONDS||540)*1000,BATCH=200,PAUSE_MS=100,STARTED=Date.now();
process.umask(0o077);fs.mkdirSync(DIR,{recursive:true,mode:0o700});
const COHORT=path.join(DIR,'cohort.tsv'),LIST=path.join(DIR,'no-history.tsv'),PROGRESS=path.join(DIR,'progress.json');
const arr=x=>x==null?[]:Array.isArray(x)?x:[x];
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const bump=(o,k,n=1)=>{o[k]=(o[k]||0)+n;};
const save=p=>{fs.writeFileSync(PROGRESS+'.tmp',JSON.stringify(p));fs.renameSync(PROGRESS+'.tmp',PROGRESS);};
async function courseMaps(db){
 const courses=await db.collection('courses').find({apxCourseId:{$exists:true}},{projection:{apxCourseId:1}}).toArray();
 const vid=new Set((await db.collection('courseclasses').distinct('course')).map(String));
 const cm=new Map(courses.filter(c=>c.apxCourseId&&vid.has(String(c._id))).map(c=>[String(c._id),String(c.apxCourseId)]));
 const pm=new Map((await db.collection('plans').find({},{projection:{course:1}}).toArray()).map(p=>[String(p._id),arr(p.course).map(String)]));
 return {cm,pm};
}
async function buildCohort(db,cm,pm){
 const active={orderStatus:'success',status:{$ne:0},grandTotal:{$gt:0},$or:[{expireDate:{$exists:false}},{expireDate:null},{expireDate:{$gte:new Date()}}]};
 const users=new Map();let orders=0;
 for await(const o of db.collection('orders').find(active,{projection:{userId:1,courseId:1,latestCourseId:1,planId:1,build:1}}).batchSize(1000)){
  orders++;const uid=String(o.userId);
  const set=users.get(uid)||users.set(uid,new Set()).get(uid);
  for(const c of [...arr(o.courseId),...arr(o.latestCourseId),...arr(o.planId).flatMap(p=>pm.get(String(p))||[]),...(o.build?.courseId?[o.build.courseId]:[])])if(cm.has(String(c)))set.add(String(c));
 }
 const lines=[...users].sort((a,b)=>a[0]<b[0]?-1:1).map(([u,s])=>`${u}\t${[...s].join(',')}`);
 fs.writeFileSync(COHORT,lines.join('\n')+'\n',{mode:0o600});
 return {orders,users:lines.length};
}
(async()=>{
 const client=new MongoClient(env.MONGO_URI,{minPoolSize:0,maxPoolSize:2,readPreference:'secondary',serverSelectionTimeoutMS:15000});
 await client.connect();
 try{
  const db=client.db('vidyagramdb');
  const {cm,pm}=await courseMaps(db);
  let p=fs.existsSync(PROGRESS)?JSON.parse(fs.readFileSync(PROGRESS)):null;
  if(!p||!fs.existsSync(COHORT)){
   const c=await buildCohort(db,cm,pm);
   p={orders:c.orders,total:c.users,next:0,buckets:{},noHistorySub:{},eligibleVideoCompletion:{},nonEligibleWithCompletion:0,done:false};save(p);
   if(fs.existsSync(LIST))fs.unlinkSync(LIST);
  }
  const lines=fs.readFileSync(COHORT,'utf8').split('\n').filter(Boolean);
  while(p.next<lines.length&&Date.now()-STARTED<MAX_MS){
   const slice=lines.slice(p.next,p.next+BATCH).map(l=>{const [u,c]=l.split('\t');return {uid:u,local:c?c.split(','):[]};});
   const docs=await db.collection('users').find({_id:{$in:slice.map(s=>ObjectId.isValid(s.uid)?new ObjectId(s.uid):null).filter(Boolean)}},{projection:{usersApxId:1,customer_id:1,status:1}}).toArray();
   const byId=new Map(docs.map(d=>[String(d._id),d]));
   const apxOf=new Map();
   for(const s of slice){const d=byId.get(s.uid);if(d&&d.status!==0&&Number(d.customer_id)===781&&d.usersApxId!=null&&/^\d+$/.test(String(d.usersApxId)))apxOf.set(s.uid,String(d.usersApxId));}
   const apx=[...apxOf.values()];
   const details=await db.collection('apx_user_course_test_detail').find({apxId:{$in:[...apx,...apx.map(Number)]}},{projection:{apxId:1,'courses.courseId':1,'courses.data.video_completion':1,'courses.data.merged_courses.video_duration_total':1}}).toArray();
   const detail=new Map(details.map(d=>[String(d.apxId),d]));
   const out=[];
   for(const s of slice){
    const a=apxOf.get(s.uid);
    if(!a){bump(p.buckets,'notCountable (missing, disabled, other tenant or no apx id)');continue;}
    if(!s.local.length){bump(p.buckets,'noVideoCourse');continue;}
    const owned=new Set(s.local.map(c=>cm.get(c)));
    const d=detail.get(a),courses=arr(d?.courses);
    let rows=0,ownedPositive=false,otherPositive=false,vc=0;
    for(const c of courses){
     const rs=arr(c.data?.merged_courses);rows+=rs.length;
     const positive=rs.some(e=>Number(e.video_duration_total)>0),own=owned.has(String(c.courseId));
     if(positive){if(own)ownedPositive=true;else otherPositive=true;}
     if(own)vc=Math.max(vc,Number(c.data?.video_completion)||0);
    }
    if(ownedPositive){bump(p.buckets,'eligibleHasHistory');bump(p.eligibleVideoCompletion,vc<=0?'zero':vc<5?'under5':vc<10?'5to10':'10plus');continue;}
    const sub=!d?'noSavedDoc':!rows?'docNoRows':otherPositive?'positiveOnlyOnCourseNotOwned':'rowsNoPositiveSeconds';
    bump(p.buckets,'noHistory');bump(p.noHistorySub,sub);if(vc>0)p.nonEligibleWithCompletion++;
    out.push(`${a}\t${sub}`);
   }
   if(out.length)fs.appendFileSync(LIST,out.join('\n')+'\n',{mode:0o600});
   p.next+=slice.length;save(p);
   await wait(PAUSE_MS);
  }
  p.done=p.next>=lines.length;save(p);
  console.log(JSON.stringify({now:new Date().toISOString(),...p,pct:Math.round(p.next/p.total*1000)/10}));
 }finally{await client.close();}
})().catch(e=>{console.error(String(e.message).replace(/mongodb(\+srv)?:\/\/\S+/g,'<uri>'));process.exit(1);});
