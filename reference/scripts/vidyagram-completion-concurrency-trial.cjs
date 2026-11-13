// One bounded, user-authorised VG two-slot qualification. No OTP requests here.
'use strict';
const fs=require('fs'),path=require('path');
const root=process.env.VG_APP_ROOT,req=n=>require(require.resolve(n,{paths:[root]}));
const env=req('dotenv').parse(fs.readFileSync(process.env.VG_ENV_PATH||path.join(root,'.env.development')));
if(!/^mongodb(?:\+srv)?:\/\/[^/]+\/vidyagramdb(?:\?|$)/.test(env.MONGO_URI||''))throw Error('wrong_tenant_database');
const {MongoClient}=req('mongodb'),runId='vg-completion-20261104-overnight6000';
if(process.env.VG_COMPLETION_RUN!==runId)throw Error('wrong_run');
const {accountFailureLimitReached}=require('./vidyagram-completion-pilot.cjs');
(async()=>{const client=new MongoClient(env.MONGO_URI,{minPoolSize:0,maxPoolSize:3,readPreference:'primary'});try{
 await client.connect();const db=client.db('vidyagramdb'),session=client.startSession();let preview;
 try{await session.withTransaction(async()=>{
  const runs=db.collection('apx_vg_completion_pilots'),jobs=db.collection('apx_vg_completion_jobs'),changes=db.collection('apx_vg_completion_recoveries'),limits=db.collection('apx_vg_request_limits');
  const run=await runs.findOne({_id:runId},{session}),id=runId+':concurrency2-trial50';
  if(await changes.findOne({_id:id},{session}))throw Error('trial_already_prepared');
  if(run?.status!=='read_recovery_complete'||!run.finishedAt||!run.readOnlyRecovery||run.tokenFailures!==12||run.authDeferred!==9||run.acquireCeiling!==6000)throw Error('unexpected_run_state');
  if(await db.collection('apx_vg_completion_workers').countDocuments({runId,state:'running',heartbeatAt:{$gte:new Date(Date.now()-90000)}},{session}))throw Error('worker_still_active');
  if(await jobs.countDocuments({runId,state:{$in:['token_ready','reading','read_retry','read_failed','acquiring']}},{session}))throw Error('backlog_not_drained');
  const beforeLimit=await limits.findOne({_id:'org:2177599:all'},{session});
  if(beforeLimit?.blocked||beforeLimit?.cooldownUntil>new Date()||![undefined,1].includes(beforeLimit?.maxConcurrent))throw Error('shared_limit_guard');
  if(await limits.countDocuments({leaseUntil:{$gt:new Date()}},{session}))throw Error('request_in_flight');
  const recovery=await changes.findOne({_id:runId+':saved-token-recovery-auth-deferral-stop-1'},{session});
  const expiresAt=recovery?.beforeRun?.expiresAt;if(!expiresAt||expiresAt<=new Date()||+expiresAt!==+new Date('2026-11-04T18:29:59Z'))throw Error('expiry_guard');
  const first=await jobs.find({runId,state:'queued'},{session}).sort({priority:1}).limit(1).next();
  if(first?.priority!==484)throw Error('cohort_guard');const ceiling=first.priority+50;
  if(await jobs.countDocuments({runId,state:'queued',priority:{$gte:first.priority,$lt:ceiling}},{session})!==50)throw Error('trial_size_guard');
  const history=await jobs.find({runId,$or:[{tokenSavedAt:{$gte:run.policyResumedAt}},{authDeferredAt:{$gte:run.policyResumedAt}}]},{session,projection:{tokenSavedAt:1,authDeferredAt:1}}).toArray();
  const outcomes=history.map(j=>j.tokenSavedAt>=run.policyResumedAt?{at:j.tokenSavedAt,kind:'success'}:{at:j.authDeferredAt,kind:'account'}).sort((a,b)=>a.at-b.at).slice(-50);
  if(accountFailureLimitReached({deferAccountAuth:true,accountFailureGuard:true,acquisitionOutcomes:outcomes}))throw Error('account_history_guard');
  preview={event:'concurrency-trial-prepared',learners:50,startPriority:first.priority,acquireCeiling:ceiling,maxConcurrent:2,historySamples:outcomes.length,historyAccountFailures:outcomes.filter(e=>e.kind==='account').length,otpReplays:0,commit:process.argv.includes('--commit')};
  if(!process.argv.includes('--commit'))return;
  await changes.insertOne({_id:id,runId,at:new Date(),action:'concurrency2_trial50',beforeRun:run,beforeLimit},{session});
  const changed=await runs.updateOne({_id:runId,status:'read_recovery_complete',finishedAt:run.finishedAt,tokenFailures:12},{$set:{status:'prepared',stopped:false,accountFailureGuard:true,acquisitionOutcomes:outcomes,requestConcurrency:2,concurrencyStartedAt:new Date(),concurrencyCheckpointStart:first.priority,concurrencyCheckpointSize:50,acquireCeiling:ceiling,expiresAt},$unset:{finishedAt:'',stoppedAt:'',readOnlyRecovery:''}},{session});if(changed.modifiedCount!==1)throw Error('run_changed');
  const rate=await limits.updateOne({_id:'org:2177599:all',leaseUntil:{$lte:new Date()},cooldownUntil:{$lte:new Date()},blocked:{$ne:true},$or:[{maxConcurrent:{$exists:false}},{maxConcurrent:1}]},{$set:{maxConcurrent:2,concurrencyChangedAt:new Date()}},{session});if(rate.modifiedCount!==1)throw Error('shared_limit_changed');
 },{readConcern:{level:'snapshot'},writeConcern:{w:'majority'}});}finally{await session.endSession();}
 console.log(JSON.stringify(preview));
}finally{await client.close();}})().catch(e=>{console.error(JSON.stringify({event:'concurrency-trial-failed',error:e.name,code:/^[a-z_]+$/.test(e.message||'')?e.message:undefined}));process.exitCode=1;});
