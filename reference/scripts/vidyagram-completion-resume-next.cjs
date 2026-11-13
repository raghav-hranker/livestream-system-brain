'use strict';
// Resume vg-completion-20261109-next10000 after an experiment_throttled, checkpoint_review or token_failures_stop stop,
// or an account_auth_failure_spike whose cause is otp_not_fresh / otp_not_available with no HTTP status (stale OTPs, not 4xx).
// VG_COMPLETION_RUN picks the cohort (default the 20261109 one, so the 20261109 kit copy behaves as before).
// node fleet800-cohort-20261109/resume-next.cjs preview  -> prints fingerprint
// node fleet800-cohort-20261109/resume-next.cjs commit '<fingerprint>' && exec ... controller-retain-penalty.cjs guard

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const MARKERS = {'vg-completion-20261109-next10000': 'fleet800-cohort-20261109', 'vg-completion-20261112-next10000': 'fleet800-cohort-20261112', 'vg-completion-20261113-next10000': 'fleet800-cohort-20261113'};
const runId = process.env.VG_COMPLETION_RUN || 'vg-completion-20261109-next10000';
assert(MARKERS[runId], 'unknown_cohort');
const previousMarker = MARKERS[runId];
const marker = MARKERS[runId];
const gateId = 'org:2177599:all';
const baseline = 3750;
const trialGap = 400;
const ceiling = 10000;
const noDeadline = new Date('9999-12-31T00:00:00.000Z');
const activeTrial = {_id: runId, vgDispatchTrial: marker};
const ownedGate = {_id: gateId, vgDispatchTrial: marker, dispatchGapMs: trialGap};
const appx4xx = {$or: [
  {httpStatus: {$gte: 400, $lt: 500}},
  {apiStatus: {$gte: 400, $lt: 500}},
]};
const log = value => console.log(JSON.stringify(value));
const transaction = {readConcern: {level: 'snapshot'}, writeConcern: {w: 'majority'}};

async function open(client, db, commit, expected) {
  const runs = db.collection('apx_vg_completion_pilots');
  const gates = db.collection('apx_vg_request_limits');
  const jobs = db.collection('apx_vg_completion_jobs');
  const session = client.startSession();
  try {
    return await session.withTransaction(async () => {
      const now = new Date();
      const options = {session};
      // Reads the stop it finds. Preview prints its fingerprint; commit needs the same fingerprint back.
      // trial_controller_recovered: the guard lost Mongo for a moment and stopped the run to be safe (no AppX signal; the 4xx check below still applies).
      // account_auth_failure_spike only when AppX stopped issuing fresh OTPs (the nightly ~04:00 IST window), never a 4xx.
      const staleOtpSpike = {status:'account_auth_failure_spike','stopCause.code':{$in:['otp_not_fresh','otp_not_available']},'stopCause.http':null};
      const found = await runs.findOne({_id:runId,stopped:true,stoppedAt:{$type:'date'},$or:[{status:{$in:['experiment_throttled','checkpoint_review','token_failures_stop','trial_controller_recovered']}},staleOtpSpike]}, options);
      assert(found, 'run_not_in_a_resumable_stop');
      const scope = {_id:runId, stopped:true, status:found.status,stoppedAt:found.stoppedAt,'stopCause.code':found.stopCause?.code??{$exists:false}, vgDispatchTrial:previousMarker,
        maxUsers:found.maxUsers, finishedAt:{$exists:false},expiresAt:noDeadline,otpRecovery:{$exists:false},
        otpReservations:found.otpReservations,accountFailureGuard:true,deferAccountAuth:true,throttleIsolation:false,failureWindowMs:60000};
      const run = await runs.findOne(scope, options);
      assert(run, 'expected_stopped_run_changed');
      assert.equal(await runs.countDocuments({_id:{$ne:runId}, stopped:{$ne:true}, expiresAt:{$gt:now}, finishedAt:{$exists:false}}, options), 0, 'other_run_active');
      assert.equal(await jobs.countDocuments({runId,leaseUntil:{$gt:now}},options),0,'job_leases_active');
      assert.equal(await jobs.countDocuments({runId,state:'reading'},options),0,'reading_jobs_active');
      const pendingReads=await jobs.find({runId,state:{$in:['token_ready','read_retry']}},{...options,projection:{_id:0,apxUserId:1,state:1}}).toArray();
                  for(const row of pendingReads){
        assert(await db.collection('apxtestusertokens').findOne({orgId:'2177599',apxUserId:row.apxUserId,token:{$type:'string',$ne:''}},{...options,projection:{_id:1}}),'saved_token_missing');
      }
      assert.equal(await db.collection('apx_vg_completion_workers').countDocuments({runId,state:'running',heartbeatAt:{$gte:new Date(+now-600000)}},options),0,'workers_active');
      assert.equal(await gates.countDocuments({$or:[{leaseUntil:{$gt:now}},{cooldownUntil:{$gt:now}},{blocked:true},{rateLimitedHold:true}]}, options), 0, 'source_gate_held');
      assert(!await db.collection('distributedlocks').findOne({key:'apx-rate-limit-pause',expiresAt:{$gt:now}},options), 'shared_pause');
      // 429s don't block when the run cools down single IPs, or when this commit acknowledges a single-429 stop by its fingerprint.
      const ack429=run.throttleCooldown===true||found.status==='experiment_throttled'&&found.stopCause?.code==='source_rate_limited';
      assert(!await db.collection('apx_vg_request_metrics').findOne({runId,at:{$gte:run.trialStartedAt},...appx4xx,...(ack429?{httpStatus:{$ne:429},apiStatus:{$ne:429}}:{})}, {...options,projection:{_id:1}}), 'cohort_has_appx_client_error');
      assert(await db.collection('apxsessions').findOne({orgId:'2177599',isActive:{$ne:false}},{...options,projection:{_id:1}}),'admin_session_missing');
      const gate={_id:gateId,vgDispatchTrial:{$exists:false},dispatchGapMs:baseline,maxConcurrent:2,dispatchPenaltyBaseline:4,penalty:{$in:[4,6,8]},
        blocked:{$ne:true},rateLimitedHold:{$ne:true},cooldownUntil:{$lte:now},leaseUntil:{$lte:now}};
      assert(await gates.findOne(gate,options), 'restored_gate_changed');
      const remainingQueued=await jobs.countDocuments({runId,state:'queued',otpAttemptedAt:{$exists:false}},options);
      const fingerprint=[found.status,found.stopCause?.code??'none',found.stoppedAt.toISOString(),found.otpReservations,remainingQueued,pendingReads.length,pendingReads.filter(row=>row.state==='read_retry').length].join('|');
      if(commit)assert.equal(expected,fingerprint,'stop_fingerprint_changed');
      assert.equal(await jobs.countDocuments({runId,state:{$in:['queued','waiting_session']}},options),remainingQueued,'queue_changed');
      assert.equal(await jobs.countDocuments({runId,state:'acquiring'},options),0,'acquisition_not_drained');
      if(commit){
        assert.equal((await gates.updateOne(gate,{$set:{dispatchGapMs:trialGap,vgDispatchTrial:marker}},options)).modifiedCount,1,'gate_changed');
        const fields={stopped:false,status:'running',resumedAt:now,acquireCeiling:ceiling,throttleCooldown:true,acquisitionFailureEvents:[],acquisitionOutcomes:[],
          otpRecovery:{phase:'cooling',since:now,retryAt:now}};
        const clear={stopCause:'',stoppedAt:'',stopPriority:''};
        assert.equal((await runs.updateOne(scope,{$set:fields,$unset:clear},options)).modifiedCount,1,'run_changed');
      }
      return {event:commit?'opened':'preview',fingerprint,remainingQueued,savedTokenReads:pendingReads.length,ceiling,wallClockCutoff:false,dispatchGapMs:trialGap,maxConcurrent:2};
    }, transaction);
  } finally {
    await session.endSession();
  }
}

async function main(){
 assert.equal(os.hostname(),'migrator','wrong_host');
 const mode=process.argv[2];
 assert(['preview','commit'].includes(mode),'invalid_mode');
 const resolve=name=>require(require.resolve(name,{paths:[process.cwd()+'/runtime']}));
 const uri=resolve('dotenv').parse(fs.readFileSync('.env.development')).MONGO_URI;
 assert(/^mongodb(?:\+srv)?:\/\/[^/]+\/vidyagramdb(?:\?|$)/.test(uri||''),'wrong_tenant');
 const client=new (resolve('mongodb').MongoClient)(uri,{serverSelectionTimeoutMS:8000,readPreference:'primary'});
 try{
  const db=client.db('vidyagramdb');
  log(await open(client,db,mode==='commit',process.argv[3]));
 }finally{await client.close();}
}
if(require.main===module)main().catch(error=>{
 const reason=error.message?.split('\n')[0];
 log({event:'controller_failed',reason:/^[a-z_]+$/.test(reason)?reason:error.name});
 process.exitCode=1;
});
