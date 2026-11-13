// Authorised next ten learners; prepare another100. One existing IP, learned penalties retained.
'use strict';
const fs=require('fs'),os=require('os');
const RUN='vg-completion-20261104-overnight6000',ID=RUN+':next10-20261105';
process.env.VG_COMPLETION_RUN=RUN;process.env.VG_EGRESS_ID='20.193.151.140';
process.env.VG_REQUEST_GAP_MS='7500';process.env.VG_ADMIN_GAP_MS='2000';process.env.VG_LEARNER_GAP_MS='60000';
const root=process.cwd(),assert=(x,m)=>{if(!x)throw Error(m);};
async function main(){
 assert(os.hostname()==='migrator','wrong_host');
 const env=require(root+'/runtime/node_modules/dotenv').parse(fs.readFileSync(root+'/.env.development'));
 assert(/^mongodb(?:\+srv)?:\/\/[^/]+\/vidyagramdb(?:\?|$)/.test(env.MONGO_URI||''),'wrong_tenant');
 const {MongoClient,ObjectId}=require(root+'/runtime/node_modules/mongodb'),p=require('./vidyagram-completion-pilot.cjs');
 const c=new MongoClient(env.MONGO_URI,{minPoolSize:0,maxPoolSize:3,readPreference:'primary',serverSelectionTimeoutMS:15000});
 try{
  await c.connect();const db=c.db('vidyagramdb'),runs=db.collection(p.COL.runs),jobs=db.collection(p.COL.jobs),batches=db.collection('apx_vg_completion_batches');
  const run=await runs.findOne({_id:RUN}),global=await db.collection('apx_vg_request_limits').findOne({_id:'org:2177599:all'}),ip=await db.collection('apx_vg_request_limits').findOne({_id:'ip:20.193.151.140'});
  assert(run?.stopped&&run.status==='experiment_throttled'&&run.readOnlyRecovery,'unexpected_run');
  assert(global?.maxConcurrent===1&&!global.blocked&&!ip?.blocked,'route_not_ready');
  assert([global,ip].every(x=>!x?.cooldownUntil||new Date(x.cooldownUntil)<=new Date()),'cooldown_active');
  assert(await db.collection(p.COL.workers).countDocuments({runId:RUN,state:'running',heartbeatAt:{$gte:new Date(Date.now()-600000)}})===0,'workers_active');
  assert(await jobs.countDocuments({runId:RUN,state:{$in:['reading','read_retry','read_failed','token_ready','acquiring','waiting_session']}})===0,'pending_work');
  const recovered=await db.collection('apx_vg_completion_diagnostics').findOne({_id:RUN+':held-pending-recovery-20261105'});assert(recovered?.state==='finished'&&recovered?.learners===4,'recovery_not_passed');
  const queued=await jobs.find({runId:RUN,state:'queued',otpAttemptedAt:{$exists:false}}).sort({priority:1}).limit(110).toArray();assert(queued.length===110,'insufficient_queue');
  const current=queued.slice(0,10),next=queued.slice(10),ceiling=current[9].priority+1;
  assert(await jobs.countDocuments({runId:RUN,state:'queued',priority:{$lt:ceiling}})===10,'ceiling_mismatch');
  const pacing={requestGapMs:7500,adminGapMs:2000,learnerGapMs:60000,maxConcurrent:1,primaryPenalty:ip.penalty||1,effectivePrimaryGapMs:7500*(ip.penalty||1),sharedPenalty:global.penalty};
  console.log(JSON.stringify({event:'next-batch-preview',trialLearners:10,preparedNextLearners:100,...pacing,commit:process.argv.includes('--commit')}));
  if(!process.argv.includes('--commit'))return;
  try{await batches.insertOne({_id:ID,runId:RUN,state:'prepared',at:new Date(),beforeRun:run,pacing,trialJobIds:current.map(x=>x._id),nextJobIds:next.map(x=>x._id),nextBatchState:'prepared_only',ceiling});}catch(e){if(e.code===11000)throw Error('batch_already_prepared');throw e;}
  // One pre-OTP identity GET; no session refresh or OTP replay.
  try{await p.adminUser(db,current[0].apxUserId);}catch(e){await batches.updateOne({_id:ID},{$set:{state:'preflight_failed',error:e.code||e.name,http:e.http??null,at:new Date()}});throw e;}
  const expiry=new Date(Date.now()+90*60000);
  const activated=await runs.updateOne({_id:RUN,stopped:true,status:'experiment_throttled',otpReservations:run.otpReservations},{$set:{stopped:false,readOnlyRecovery:false,status:'running',expiresAt:expiry,acquireCeiling:ceiling,plannedAcquisitionWorkers:1,plannedReaders:1,currentLearnerGapMs:60000,requestConcurrency:1,conservativePhase:'next10_single_primary_15s',nextBatchId:ID},$unset:{finishedAt:''}});
  assert(activated.modifiedCount===1,'activation_raced');
  await batches.updateOne({_id:ID},{$set:{state:'running',startedAt:new Date(),expiresAt:expiry}});
  console.log(JSON.stringify({event:'next-batch-started',trialLearners:10,preparedNextLearners:100,expiresAt:expiry,...pacing}));
  await p.worker(c,db,'both',ObjectId);
  const final=await runs.findOne({_id:RUN});
  const states=await jobs.aggregate([{$match:{_id:{$in:current.map(x=>x._id)}}},{$group:{_id:'$state',n:{$sum:1}}}]).toArray();
  await batches.updateOne({_id:ID},{$set:{state:'finished',finishedAt:new Date(),runStatus:final.status,states}});
  console.log(JSON.stringify({event:'next-batch-ended',status:final.status,stopped:final.stopped,states,nextBatchStarted:false}));
 }finally{await c.close();}
}
main().catch(e=>{console.error(JSON.stringify({event:'next-batch-aborted',error:/^[a-z_]+$/.test(e.code||e.message)?e.code||e.message:e.name,http:e.http??null}));process.exitCode=1;});
