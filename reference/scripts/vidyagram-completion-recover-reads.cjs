// One bounded recovery of existing saved tokens; never sends OTPs.
'use strict';
const fs=require('fs'),path=require('path');
const root=process.env.VG_APP_ROOT,req=n=>require(require.resolve(n,{paths:[root]}));
const env=req('dotenv').parse(fs.readFileSync(process.env.VG_ENV_PATH||path.join(root,'.env.development')));
if(!/^mongodb(?:\+srv)?:\/\/[^/]+\/vidyagramdb(?:\?|$)/.test(env.MONGO_URI||''))throw Error('wrong_tenant_database');
const {MongoClient}=req('mongodb'),runId=process.env.VG_COMPLETION_RUN||'vg-completion-20261103-fleet500';
if(!['vg-completion-20261103-fleet500','vg-completion-20261104-fleet2000','vg-completion-20261104-overnight6000'].includes(runId))throw Error('unsupported_recovery_run');
const finalRead=process.argv.includes('--final-read'),networkStop=process.argv.includes('--network-stop'),otpStop=process.argv.includes('--otp-stop'),authDeferralStop=process.argv.includes('--auth-deferral-stop'),sessionStop=process.argv.includes('--session-stop'),timeoutStop=process.argv.includes('--timeout-stop'),rateStop=process.argv.includes('--rate-stop');
if(rateStop&&(!networkStop||finalRead||otpStop||authDeferralStop||sessionStop||timeoutStop||!runId.endsWith('-overnight6000')))throw Error('rate_recovery_scope_mismatch');
if(timeoutStop&&(!networkStop||otpStop||authDeferralStop||sessionStop||!runId.endsWith('-overnight6000')))throw Error('timeout_recovery_scope_mismatch');
if(sessionStop&&(!networkStop||otpStop||authDeferralStop||!runId.endsWith('-overnight6000')))throw Error('session_recovery_scope_mismatch');
if(authDeferralStop&&(!networkStop||otpStop||!runId.endsWith('-overnight6000')))throw Error('auth_deferral_recovery_scope_mismatch');
if(otpStop&&(!networkStop||!runId.endsWith('-overnight6000')))throw Error('otp_recovery_scope_mismatch');
if(runId.endsWith('-overnight6000')&&!networkStop||networkStop&&!runId.endsWith('-overnight6000'))throw Error('network_recovery_scope_mismatch');
if(finalRead&&runId!=='vg-completion-20261104-fleet2000')throw Error('unsupported_final_recovery');
const recoveryId=runId+':saved-token-recovery-'+(rateStop?'rate-stop-1':timeoutStop?'timeout-stop-1':sessionStop?'session-stop-1':authDeferralStop?'auth-deferral-stop-1':otpStop?'otp-stop-1':networkStop?'network-stop-1':finalRead?'final500':runId.endsWith('-fleet2000')?'stage2':'1');
(async()=>{const client=new MongoClient(env.MONGO_URI,{minPoolSize:0,maxPoolSize:3,readPreference:'primary'});try{
 await client.connect();const db=client.db('vidyagramdb');
 if(await db.collection('apx_vg_completion_recoveries').findOne({_id:recoveryId}))throw Error('recovery_already_prepared');
 const run=await db.collection('apx_vg_completion_pilots').findOne({_id:runId});
 if(rateStop){
  if(run?.tokenFailures!==25||run?.acquireCeiling!==6000||run?.requestConcurrency!==1||+run?.stoppedAt!==+new Date('2026-11-04T15:02:38.788Z'))throw Error('unexpected_rate_stop');
  const rate=await db.collection('apx_vg_request_limits').findOne({_id:'org:2177599:all'});
  if(rate?.maxConcurrent!==1||rate.cooldownUntil>new Date()||rate.blocked)throw Error('source_cooldown_active');
  if(await db.collection('apx_vg_request_limits').countDocuments({cooldownUntil:{$gt:new Date()}}))throw Error('source_cooldown_active');
 }
 if(timeoutStop&&(run?.tokenFailures!==21||run?.acquireCeiling!==6000||run?.requestConcurrency!==2||run?.plannedReaders!==8||+run?.stoppedAt!==+new Date('2026-11-04T13:30:11.789Z')))throw Error('unexpected_timeout_stop');
 if(sessionStop&&(run?.tokenFailures!==12||run?.acquireCeiling!==6000||run?.requestConcurrency!==2||run?.accountFailureGuard!==true||+run?.stoppedAt!==+new Date('2026-11-04T09:05:05.563Z')))throw Error('unexpected_session_stop');
 if(authDeferralStop&&(run?.tokenFailures!==12||run?.acquireCeiling!==6000||run?.deferAccountAuth!==true))throw Error('unexpected_auth_deferral_stop');
 if(otpStop&&(run?.tokenFailures!==6||run?.acquireCeiling!==709))throw Error('unexpected_otp_stop');
 if(finalRead){if(run?.acquireCeiling!==2000||run.status!=='capture_complete_with_exceptions'||!run.finishedAt)throw Error('unexpected_final_read_state');}
 else{if(runId.endsWith('-fleet2000')&&run?.acquireCeiling!==400)throw Error('unexpected_recovery_checkpoint');
 if(!run?.stopped||run.status!==(rateStop?'experiment_throttled':sessionStop?'admin_session_review':'token_failures_stop'))throw Error('unexpected_run_state');}
 if(await db.collection('apx_vg_completion_workers').countDocuments({runId,state:'running',heartbeatAt:{$gte:new Date(Date.now()-90000)}}))throw Error('worker_still_active');
 const selected=[],failedCourses=new Map();
 for await(const job of db.collection('apx_vg_completion_jobs').find({runId,state:{$in:sessionStop||timeoutStop||rateStop?['token_ready','read_failed']:['token_ready','read_failed','token_failed']}})){
  if((sessionStop||timeoutStop||rateStop)&&job.state==='read_failed'&&job.lastError!=='pilot_stopped')continue;
  if(finalRead&&(job.state!=='read_failed'||job.lastError!=='completion_access_rejected'||![500,502,503,504].includes(job.lastHttp)))continue;
  if(job.state==='token_failed'&&job.lastError!=='pilot_stopped')continue;
  if(job.recoveryReadAttempts)continue;
  const token=await db.collection('apxtestusertokens').findOne({orgId:'2177599',apxUserId:job.apxUserId},{projection:{token:1,mintedAt:1}});
  if(!token?.token||job.otpAttemptedAt&&token.mintedAt<job.otpAttemptedAt)continue;
  if(finalRead){const done=await db.collection('apx_vg_completion_captures').find({runId,apxUserId:job.apxUserId},{projection:{apxCourseId:1}}).toArray();const ids=new Set(done.map(c=>String(c.apxCourseId)));const first=job.courses.find(c=>!ids.has(String(c.apxCourseId)));if(!first||!/^\d+$/.test(String(first.apxCourseId)))throw Error('unresolved_failed_course');failedCourses.set(job._id,String(first.apxCourseId));}
  selected.push(job);
 }
 console.log(JSON.stringify({event:'read-recovery-preview',learners:selected.length,otpSends:0,commit:process.argv.includes('--commit')}));
 if(sessionStop&&selected.length!==85)throw Error('unexpected_session_recovery_count');
 if(timeoutStop&&selected.length!==5)throw Error('unexpected_timeout_recovery_count');
 if(rateStop&&selected.length!==5)throw Error('unexpected_rate_recovery_count');
 if(!process.argv.includes('--commit'))return;
 if(!selected.length)throw Error('no_saved_tokens_to_read');
 const session=client.startSession();try{await session.withTransaction(async()=>{
  await db.collection('apx_vg_completion_recoveries').insertOne({_id:recoveryId,runId,at:new Date(),beforeRun:run,beforeJobs:selected},{session});
  const changed=await db.collection('apx_vg_completion_pilots').updateOne({_id:runId,stopped:run.stopped,status:run.status,tokenFailures:run.tokenFailures},{$set:{stopped:false,readOnlyRecovery:true,status:'recovering_saved_tokens',expiresAt:new Date(Date.now()+1800000)},$unset:{finishedAt:''}},{session});
  if(changed.modifiedCount!==1)throw Error('run_changed');
  for(const job of selected){const result=await db.collection('apx_vg_completion_jobs').updateOne({_id:job._id,runId,state:job.state,updatedAt:job.updatedAt},{$set:{state:'read_retry',leaseUntil:new Date(0),updatedAt:new Date(),recoveryId,tokenSavedAt:job.tokenSavedAt||new Date(),...(finalRead?{['completionReadAttempts.'+failedCourses.get(job._id)]:Math.max(1,job.completionReadAttempts?.[failedCourses.get(job._id)]||0)}:{})},$inc:{recoveryReadAttempts:1}},{session});if(result.modifiedCount!==1)throw Error('job_changed');}
 },{readConcern:{level:'snapshot'},writeConcern:{w:'majority'}});}finally{await session.endSession();}
 console.log(JSON.stringify({event:'read-recovery-prepared',learners:selected.length,otpSends:0}));
}finally{await client.close();}})().catch(e=>{console.error(JSON.stringify({event:'read-recovery-failed',error:e.name,code:/^[a-z_]+$/.test(e.message||'')?e.message:undefined}));process.exitCode=1;});
