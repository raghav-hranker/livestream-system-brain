// READ-ONLY, aggregate only. Hit rate of one completion run: learners read, learners with flags, flags per learner, failures.
// Run on an Azure migrator: VG_APP_ROOT=$dir/runtime VG_ENV_PATH=$dir/.env.development node - <runId> < this file
'use strict';
const path=require('path');
const root=process.env.VG_APP_ROOT||process.cwd();
const req=n=>require(require.resolve(n,{paths:[root]}));
const env=req('dotenv').parse(require('fs').readFileSync(process.env.VG_ENV_PATH||path.join(root,'.env.development')));
const {MongoClient}=req('mongodb');
const RUN=process.argv[2];if(!RUN)throw Error('run id required');
(async()=>{
 const client=new MongoClient(env.MONGO_URI,{minPoolSize:0,maxPoolSize:2,serverSelectionTimeoutMS:15000});
 await client.connect();
 try{
  const db=client.db('vidyagramdb');
  const run=await db.collection('apx_vg_completion_pilots').findOne({_id:RUN},{projection:{status:1,stopped:1,otpSent:1,otpReservations:1,tokenFailures:1,finishedAt:1,expiresAt:1}});
  const jobs=await db.collection('apx_vg_completion_jobs').find({runId:RUN},{projection:{state:1,lastError:1,lastHttp:1,apxUserId:1,tokenSavedAt:1,capturedAt:1,acquisitionHost:1,readerHost:1,otpAttemptedAt:1}}).toArray();
  const states={},errors={},hosts={};
  for(const j of jobs){states[j.state]=(states[j.state]||0)+1;if(j.lastError)errors[`${j.lastError} ${j.lastHttp??''}`]=(errors[`${j.lastError} ${j.lastHttp??''}`]||0)+1;if(j.acquisitionHost)hosts[j.acquisitionHost]=(hosts[j.acquisitionHost]||0)+1;}
  const caps=await db.collection('apx_vg_completion_captures').find({runId:RUN},{projection:{apxUserId:1,completedCount:1,mapped:1,unmatched:1,invalidCount:1,flags:1,state:1}}).toArray();
  const per=new Map();let courses=0,withFlagCourses=0,seenFlags=0;
  for(const c of caps){courses++;const u=per.get(String(c.apxUserId))||per.set(String(c.apxUserId),{flags:0,mapped:0,un:0}).get(String(c.apxUserId));u.flags+=c.completedCount||0;u.mapped+=(c.mapped||[]).length;u.un+=(c.unmatched||[]).length;if(c.completedCount>0)withFlagCourses++;if(Object.keys(c.flags||{}).length)seenFlags++;}
  const vals=[...per.values()],hit=vals.filter(v=>v.flags>0),sorted=hit.map(v=>v.flags).sort((a,b)=>a-b);
  const sum=(k)=>vals.reduce((a,v)=>a+v[k],0);
  const metric=await db.collection('apx_vg_request_metrics').aggregate([{$match:{runId:RUN}},{$group:{_id:{e:'$endpoint',h:'$httpStatus',a:'$apiStatus'},n:{$sum:1}}}]).toArray();
  const ts=jobs.map(j=>j.tokenSavedAt).filter(Boolean).sort((a,b)=>a-b),cap=jobs.map(j=>j.capturedAt).filter(Boolean).sort((a,b)=>a-b);
  console.log(JSON.stringify({now:new Date().toISOString(),run,states,errors,hosts,learnersRead:vals.length,learnersWithFlags:hit.length,hitRatePct:vals.length?Math.round(hit.length/vals.length*1000)/10:null,totalFlags:sum('flags'),mapped:sum('mapped'),unmatched:sum('un'),medianFlagsAmongHits:sorted.length?sorted[Math.floor(sorted.length/2)]:0,maxFlags:sorted[sorted.length-1]||0,coursePairsRead:courses,coursePairsWithFlags:withFlagCourses,coursePairsWithAnyFlagKey:seenFlags,firstToken:ts[0]||null,lastCaptured:cap[cap.length-1]||null,requests:metric.map(m=>`${m._id.e} ${m._id.h}/${m._id.a} x${m.n}`)}));
 }finally{await client.close();}
})().catch(e=>{console.error(String(e.message).replace(/mongodb(\+srv)?:\/\/\S+/g,'<uri>'));process.exit(1);});
