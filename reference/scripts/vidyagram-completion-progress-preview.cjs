// Read-only preview of turning staged VG completion captures into ClassProgress manual-completion markers.
// No writes. Run on an Azure migrator: VG_APP_ROOT=$dir/runtime VG_ENV_PATH=$dir/.env.development node - < this file
'use strict';
const path=require('path');
const root=process.env.VG_APP_ROOT||process.cwd();
const req=n=>require(require.resolve(n,{paths:[root]}));
const env=req('dotenv').parse(require('fs').readFileSync(process.env.VG_ENV_PATH||path.join(root,'.env.development')));
const {MongoClient,ObjectId}=req('mongodb');
const ORG='2177599',RUNS=/^vg-completion-20261103-/;
const bump=(o,k,n=1)=>{o[k]=(o[k]||0)+n;};
const oid=x=>{try{return new ObjectId(String(x));}catch{return null;}};
const chunks=(a,n)=>{const out=[];for(let i=0;i<a.length;i+=n)out.push(a.slice(i,i+n));return out;};
(async()=>{
 const client=new MongoClient(env.MONGO_URI,{minPoolSize:0,maxPoolSize:2,serverSelectionTimeoutMS:15000});
 await client.connect();
 try{
  const db=client.db('vidyagramdb');
  if(db.databaseName!=='vidyagramdb')throw new Error('wrong tenant');
  const caps=await db.collection('apx_vg_completion_captures').find({orgId:ORG,runId:RUNS},{projection:{runId:1,userId:1,apxUserId:1,courseId:1,apxCourseId:1,state:1,mapped:1,unmatched:1,invalidCount:1,completedCount:1,mappingVersion:1,classProgressWrites:1,fetchedAt:1}}).toArray();
  const perRun={},versions={},keys=new Map();const flagged=new Set(),learners=new Set();let flags=0,unmatched=0,invalid=0;const badClassIds=[];
  for(const c of caps){
   const r=perRun[c.runId]||={captures:0,learners:new Set(),flags:0,mapped:0,unmatched:0,invalid:0,writesRecorded:0};
   r.captures++;r.learners.add(String(c.userId));r.flags+=c.completedCount||0;r.mapped+=(c.mapped||[]).length;r.unmatched+=(c.unmatched||[]).length;r.invalid+=c.invalidCount||0;r.writesRecorded+=c.classProgressWrites||0;
   bump(versions,c.mappingVersion||'none');learners.add(String(c.userId));flags+=c.completedCount||0;unmatched+=(c.unmatched||[]).length;invalid+=c.invalidCount||0;
   if((c.mapped||[]).length)flagged.add(String(c.userId));
   for(const m of c.mapped||[]){
    if(!oid(m.classId)||!oid(c.courseId)){badClassIds.push(String(m.classId));continue;}
    keys.set(`${c.userId}|${m.classId}|${c.courseId}`,{userId:String(c.userId),classId:String(m.classId),courseId:String(c.courseId)});
   }
  }
  const list=[...keys.values()];
  const users=[...new Set(list.map(k=>k.userId))],classes=[...new Set(list.map(k=>k.classId))],courses=[...new Set(list.map(k=>k.courseId))];
  const known=async(col,ids)=>{const out=new Set();for(const c of chunks(ids,500))for(const d of await db.collection(col).find({_id:{$in:c.map(oid).filter(Boolean)}},{projection:{_id:1}}).toArray())out.add(String(d._id));return out;};
  const knownUsers=await known('users',users),knownClasses=await known('classes',classes),knownCourses=await known('courses',courses);
  const placements=new Set();
  for(const c of chunks(courses,200))for(const p of await db.collection('courseclasses').find({course:{$in:c.map(oid)}},{projection:{course:1,class:1}}).toArray())placements.add(`${p.course}|${p.class}`);
  const rows=new Map();const rowTypes={};
  for(const c of chunks(users,200))for(const p of await db.collection('classprogresses').find({userId:{$in:c}},{projection:{userId:1,classId:1,courseId:1,manualCompleted:1,apxMigrated:1}}).toArray()){
   const k=`${p.userId}|${p.classId}|${p.courseId}`;(rows.get(k)||rows.set(k,[]).get(k)).push(p);
   bump(rowTypes,p.apxMigrated?(p.manualCompleted?'apx_manual':'apx_seconds_only'):(p.manualCompleted?'native_manual':'native_session'));
  }
  const plan={};const invalidKeys={user:0,class:0,course:0,placement:0};const perLearner={};
  for(const [k,v] of keys){
   let bad=false;
   if(!knownUsers.has(v.userId)){invalidKeys.user++;bad=true;}
   if(!knownClasses.has(v.classId)){invalidKeys.class++;bad=true;}
   if(!knownCourses.has(v.courseId)){invalidKeys.course++;bad=true;}
   if(!placements.has(`${v.courseId}|${v.classId}`)){invalidKeys.placement++;bad=true;}
   if(bad){bump(plan,'reject_invalid');continue;}
   const ex=rows.get(k)||[];
   if(ex.some(r=>r.manualCompleted===true))bump(plan,'skip_already_manual');
   else if(ex.some(r=>r.apxMigrated===true)){bump(plan,'set_flag_on_apx_row');bump(perLearner,v.userId);}
   else if(ex.length){bump(plan,'insert_marker_beside_native_session');bump(perLearner,v.userId);}
   else{bump(plan,'insert_marker');bump(perLearner,v.userId);}
  }
  const counts=Object.values(perLearner).sort((a,b)=>a-b);
  console.log(JSON.stringify({now:new Date().toISOString(),perRun:Object.fromEntries(Object.entries(perRun).map(([k,r])=>[k,{...r,learners:r.learners.size}])),versions,captures:caps.length,learners:learners.size,learnersWithMappedFlags:flagged.size,flags,distinctKeys:keys.size,unmatched,invalid,badIds:badClassIds.length,invalidKeys,plan,existingRowsForTheseUsers:rowTypes,distinctClasses:classes.length,distinctCourses:courses.length,writesPerLearner:{learners:counts.length,median:counts[Math.floor(counts.length/2)]??0,max:counts[counts.length-1]??0},totalClassProgressRows:await db.collection('classprogresses').estimatedDocumentCount()},null,1));
 }finally{await client.close();}
})().catch(e=>{console.error(e.message.replace(/mongodb(\+srv)?:\/\/\S+/g,'<uri>'));process.exit(1);});
