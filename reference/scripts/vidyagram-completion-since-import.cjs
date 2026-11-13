// READ-ONLY, aggregate only. What VG completion runs captured since the last ClassProgress import batch, all run ids.
// Run on an Azure migrator: VG_APP_ROOT=$dir/runtime VG_ENV_PATH=$dir/.env.development node - < this file
'use strict';
const fs=require('fs'),path=require('path');
const root=process.env.VG_APP_ROOT||process.cwd();
const req=n=>require(require.resolve(n,{paths:[root]}));
const env=req('dotenv').parse(fs.readFileSync(process.env.VG_ENV_PATH||path.join(root,'.env.development')));
if(!/^mongodb(?:\+srv)?:\/\/[^/]+\/vidyagramdb(?:\?|$)/.test(env.MONGO_URI||''))throw Error('VG database guard');
const {MongoClient}=req('mongodb');
const ORG='2177599';
const chunks=(a,n)=>{const out=[];for(let i=0;i<a.length;i+=n)out.push(a.slice(i,i+n));return out;};
(async()=>{
 const client=new MongoClient(env.MONGO_URI,{minPoolSize:0,maxPoolSize:2,serverSelectionTimeoutMS:15000});
 await client.connect();
 try{
  const db=client.db('vidyagramdb');
  const batches=await db.collection('apx_vg_progress_import_batches').find({},{projection:{at:1,state:1,inserted:1,finishedAt:1,undoneAt:1}}).sort({at:1}).toArray();
  const done=batches.filter(b=>b.state==='done');
  const last=done[done.length-1];if(!last)throw Error('no finished import batch');
  const cutoff=last.finishedAt;
  const imported=await db.collection('classprogresses').aggregate([{$match:{'apxCompletionImport.batch':{$exists:true}}},{$group:{_id:'$userId',n:{$sum:1}}}]).toArray();
  const importedUsers=new Set(imported.map(r=>String(r._id)));
  const perBatch=await db.collection('classprogresses').aggregate([{$match:{'apxCompletionImport.batch':{$exists:true}}},{$group:{_id:{batch:'$apxCompletionImport.batch',match:'$apxCompletionImport.match'},n:{$sum:1}}}]).toArray();
  const duplicateKeys=await db.collection('classprogresses').aggregate([{$group:{_id:{u:'$userId',cl:'$classId',co:'$courseId',a:'$apxMigrated'},n:{$sum:1}}},{$match:{n:{$gt:1}}},{$count:'keys'}],{allowDiskUse:true}).toArray();
  const totalRows=await db.collection('classprogresses').countDocuments({}),untaggedRows=await db.collection('classprogresses').countDocuments({'apxCompletionImport.batch':{$exists:false}});
  const caps=await db.collection('apx_vg_completion_captures').find({orgId:ORG},{projection:{runId:1,userId:1,courseId:1,mapped:1,unmatched:1,completedCount:1,fetchedAt:1}}).toArray();
  const perRun={},wanted=new Map(),since=new Set(),sinceFlagged=new Set(),everRead=new Set(),everMapped=new Set();
  for(const c of caps){
   const u=String(c.userId);everRead.add(u);
   for(const m of c.mapped||[]){everMapped.add(u);wanted.set(`${u}|${m.classId}|${c.courseId}`,u);}
   const isNew=c.fetchedAt&&c.fetchedAt>cutoff;
   const r=perRun[c.runId]||={captures:0,capturesSince:0,learnersSince:new Set(),flagsSince:0,mappedSince:0,unmatchedSince:0};
   r.captures++;
   if(!isNew)continue;
   r.capturesSince++;r.learnersSince.add(u);r.flagsSince+=c.completedCount||0;r.mappedSince+=(c.mapped||[]).length;r.unmatchedSince+=(c.unmatched||[]).length;
   since.add(u);if((c.completedCount||0)>0)sinceFlagged.add(u);
  }
  const existing=new Set();
  for(const ids of chunks([...new Set(wanted.values())],200))for(const r of await db.collection('classprogresses').find({userId:{$in:ids}},{projection:{userId:1,classId:1,courseId:1}}).toArray())existing.add(`${r.userId}|${r.classId}|${r.courseId}`);
  const pendingUsers=new Set();let pending=0;
  for(const [k,u] of wanted)if(!existing.has(k)){pending++;pendingUsers.add(u);}
  console.log(JSON.stringify({now:new Date().toISOString(),batches,cutoff,
   totalRows,untaggedRows,duplicateKeys:duplicateKeys[0]?.keys||0,perBatch:perBatch.map(b=>`${b._id.batch} ${b._id.match} x${b.n}`),
   importedRows:imported.reduce((a,r)=>a+r.n,0),importedLearners:importedUsers.size,
   learnersReadEver:everRead.size,learnersWithMappedFlagsEver:everMapped.size,
   learnersReadSince:since.size,learnersWithFlagsSince:sinceFlagged.size,
   learnersMappedNotYetImported:[...everMapped].filter(u=>!importedUsers.has(u)).length,
   pendingExactIdRows:pending,pendingExactIdLearners:pendingUsers.size,
   perRun:Object.fromEntries(Object.entries(perRun).map(([k,r])=>[k,{...r,learnersSince:r.learnersSince.size}]))},null,1));
 }finally{await client.close();}
})().catch(e=>{console.error(String(e.message).replace(/mongodb(\+srv)?:\/\/\S+/g,'<uri>'));process.exit(1);});
