'use strict';
// Vidyagram completion cohort controller (from fleet800-cohort-20261109/controller-retain-penalty.cjs on migrator).
// Run from ~/vidyagram-completion-azure-20261103 with VG_COMPLETION_RUN set to a cohort in COHORTS:
//   node <kit>/controller.cjs preview | commit   open the queued_prepared cohort now (predecessor must be complete)
//   node <kit>/controller.cjs handoff            wait for the predecessor to finish + the standby roster, open, then guard
//   node <kit>/controller.cjs guard              watch an open cohort: canary, 4xx stop, restore the gate when it stops
// Changes from the 20261109 copy: cohort table, roster >= 16 standbys incl. >= 10 acquire (was all 22 within 30 s),
// gate penalty 6 or 8 (4 overloads AppX, 11-11), and open() sets resumedAt so standby.cjs releases.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const {setTimeout: wait} = require('node:timers/promises');
const COHORTS = {
  'vg-completion-20261109-next10000': {previousRun: 'vg-completion-20261108-next10000', marker: 'fleet800-cohort-20261109'},
  'vg-completion-20261112-next10000': {previousRun: 'vg-completion-20261109-next10000', marker: 'fleet800-cohort-20261112'},
  'vg-completion-20261113-next10000': {previousRun: 'vg-completion-20261112-next10000', marker: 'fleet800-cohort-20261113'},
};
const runId = process.env.VG_COMPLETION_RUN;
assert(COHORTS[runId], 'unknown_cohort');
const {previousRun, marker} = COHORTS[runId];
const gateId = 'org:2177599:all';
const baseline = 3750;
const trialGap = 400;
const ceiling = 10000;
const noDeadline = new Date('9999-12-31T00:00:00.000Z');
const activeTrial = {_id: runId, vgDispatchTrial: marker};
const ownedGate = {_id: gateId, vgDispatchTrial: marker, dispatchGapMs: trialGap};
const fleetHosts=['migrator',...Array.from({length:11},(_,i)=>'migrator'+(i+2)),'phonetics','testing-server-selectionway'];
const expectedStandbys=fleetHosts.flatMap((host,index)=>(index<8?['acquire','read']:['acquire']).map(role=>runId+':standby:'+host+':'+role));

const not429 = {httpStatus:{$ne:429}, apiStatus:{$ne:429}};
const appx4xx = {$or: [
  {httpStatus: {$gte: 400, $lt: 500}},
  {apiStatus: {$gte: 400, $lt: 500}},
]};
const log = value => console.log(JSON.stringify(value));
const transaction = {readConcern: {level: 'snapshot'}, writeConcern: {w: 'majority'}};

async function open(client, db, commit) {
  const runs = db.collection('apx_vg_completion_pilots');
  const gates = db.collection('apx_vg_request_limits');
  const jobs = db.collection('apx_vg_completion_jobs');
  const session = client.startSession();
  try {
    return await session.withTransaction(async () => {
      const now = new Date();
      const options = {session};
      const scope={_id:runId,tenant:'vidyagram',orgId:'2177599',sourceOnly:true,stopped:true,status:'queued_prepared',predecessorRun:previousRun,handoffArmedAt:{$type:'date'},
       acquireCeiling:0,otpReservations:0,otpSent:0,finishedAt:{$exists:false},expiresAt:new Date(0)};
      const run=await runs.findOne(scope,options);
      assert(run&&Number.isSafeInteger(run.maxUsers)&&run.maxUsers>0&&run.maxUsers<=ceiling,'new_cohort_not_prepared');
      const predecessor={_id:previousRun,stopped:true,status:{$in:['capture_complete','capture_complete_with_exceptions']},finishedAt:{$type:'date'}};
      assert(await runs.findOne(predecessor,options),'prior_cohort_not_complete');
      assert.equal(await jobs.countDocuments({runId:previousRun,state:{$in:['queued','waiting_session','acquiring','token_ready','reading','read_retry']}},options),0,'prior_jobs_not_drained');
      const workers=db.collection('apx_vg_completion_workers');
      const fresh={_id:{$in:expectedStandbys},runId,state:'standby',heartbeatAt:{$gte:new Date(+now-60000)}};
      const ready=await workers.countDocuments(fresh,options);
      const readyAcquire=await workers.countDocuments({...fresh,role:'acquire'},options);
      assert(ready>=16&&readyAcquire>=10,'standby_roster_not_ready');
      assert.equal(await runs.countDocuments({stopped:{$ne:true},expiresAt:{$gt:now},finishedAt:{$exists:false}},options),0,'other_run_active');
      assert.equal(await db.collection('apx_vg_completion_workers').countDocuments({runId:{$in:[runId,previousRun]},state:'running',heartbeatAt:{$gte:new Date(+now-600000)}},options),0,'workers_active');
      const holds={$or:[{leaseUntil:{$gt:now}},{cooldownUntil:{$gt:now}},{blocked:true},{rateLimitedHold:true}]};
      assert.equal(await gates.countDocuments(holds,options),0,'source_gate_held');
      assert(!await db.collection('distributedlocks').findOne({key:'apx-rate-limit-pause',expiresAt:{$gt:now}},options),'shared_pause');
      assert(await db.collection('apxsessions').findOne({orgId:'2177599',isActive:{$ne:false}},{...options,projection:{_id:1}}),'admin_session_missing');
      const gate={_id:gateId,vgDispatchTrial:{$exists:false},dispatchGapMs:baseline,maxConcurrent:2,dispatchPenaltyBaseline:4,penalty:{$in:[6,8]},
        blocked:{$ne:true},rateLimitedHold:{$ne:true},cooldownUntil:{$lte:now},leaseUntil:{$lte:now}};
      assert(await gates.findOne(gate,options),'restored_gate_changed');
      const queued=await jobs.countDocuments({runId,orgId:'2177599',state:'queued',otpAttemptedAt:{$exists:false}},options);
      assert.equal(queued,run.maxUsers,'untouched_queue_changed');
      assert.equal(await jobs.countDocuments({runId},options),queued,'cohort_size_changed');
      if(commit){
        assert.equal((await gates.updateOne(gate,{$set:{dispatchGapMs:trialGap,vgDispatchTrial:marker}},options)).modifiedCount,1,'gate_changed');
        const fields={stopped:false,status:'running',vgDispatchTrial:marker,trialStartedAt:now,resumedAt:now,expiresAt:noDeadline,acquireCeiling:ceiling,
         requestConcurrency:2,throttleIsolation:false,throttleCooldown:true,accountFailureGuard:true,deferAccountAuth:true,failureWindowMs:60000,
         acquisitionFailureEvents:[],acquisitionOutcomes:[],otpTimeoutAutoRecovery:true,otpRecovery:{phase:'cooling',since:now,retryAt:now}};
        assert.equal((await runs.updateOne(scope,{$set:fields},options)).modifiedCount,1,'run_changed');
      }
      return {event:commit?'opened':'preview',queued,canarySize:Math.min(12,queued),wallClockCutoff:false,dispatchGapMs:trialGap,maxConcurrent:2};
    }, transaction);
  } finally {
    await session.endSession();
  }
}

async function advanceOtpRecovery(db, scope, gateScope, now=new Date()) {
  const runs=db.collection('apx_vg_completion_pilots');
  const gates=db.collection('apx_vg_request_limits');
  const jobs=db.collection('apx_vg_completion_jobs');
  const metrics=db.collection('apx_vg_request_metrics');
  const run=await runs.findOne({...scope,stopped:false});
  const recovery=run?.otpRecovery;
  if(!recovery||recovery.phase==='review')return;
  const match={...scope,stopped:false,'otpRecovery.phase':recovery.phase,'otpRecovery.since':recovery.since};
  const runId=run._id;
  async function review(reason) {
    const result=await runs.updateOne(match,{$set:{otpRecovery:{phase:'review',since:now,reason}}});
    if(result.modifiedCount)return {event:'otp_acquisition_review',reason};
  }
  if(recovery.phase==='cooling'){
    if(recovery.retryAt>now||await jobs.countDocuments({runId,state:'acquiring'}))return;
    if(!await gates.findOne(gateScope))throw Error('recovery_gate_changed');
    if(await gates.countDocuments({$or:[{blocked:true},{rateLimitedHold:true},{cooldownUntil:{$gt:now}}]}))return;
    if(await db.collection('distributedlocks').findOne({key:'apx-rate-limit-pause',expiresAt:{$gt:now}}))return;
    const queue={runId,state:{$in:['queued','waiting_session']}};
    if(await jobs.countDocuments({...queue,otpAttemptedAt:{$exists:true}}))return review('reserved_learner_in_queue');
    const sample=await jobs.find(queue,{projection:{_id:0,priority:1}}).sort({priority:1}).limit(12).toArray();
    if(!sample.length)return;
    const ceiling=sample.at(-1).priority+1;
    assert(Number.isSafeInteger(ceiling),'invalid_canary_ceiling');
    const next={phase:'canary',since:now,deadline:new Date(+now+300000),ceiling,size:sample.length};
    const result=await runs.updateOne(match,{$set:{otpRecovery:next}});
    if(result.modifiedCount)return {event:'otp_canary_opened',size:sample.length};
    return;
  }
  const otpRequests={runId,at:{$gte:recovery.since},endpoint:{$in:['otp_send','otp_verify']}};
  const bad=await metrics.findOne({...otpRequests,$or:[{httpStatus:{$ne:200}},{apiStatus:{$ne:200}}]},{projection:{_id:1}});
  if(bad)return review('canary_otp_failure');
  if(recovery.deadline<=now)return review('canary_deadline');
  const sample={runId,priority:{$lt:recovery.ceiling}};
  const pending=await jobs.countDocuments({...sample,state:{$in:['queued','waiting_session','acquiring']}});
  if(pending)return;
  if(await metrics.findOne({...otpRequests,$or:[{httpStatus:{$ne:200}},{apiStatus:{$ne:200}}]},{projection:{_id:1}}))return review('canary_otp_failure');
  const attempted={...sample,otpAttemptedAt:{$gte:recovery.since}};
  const saved=await jobs.countDocuments({...attempted,tokenSource:'minted',tokenSavedAt:{$gte:recovery.since}});
  if(saved!==await jobs.countDocuments(attempted))return review('canary_token_acquisition_failed');
  const verifies=await metrics.countDocuments({...otpRequests,endpoint:'otp_verify',httpStatus:200,apiStatus:200});
  if(Math.min(saved,verifies)<Math.min(6,recovery.size))return review('insufficient_successful_verifications');
  if(!await gates.findOne(gateScope))throw Error('recovery_gate_changed');
  if(await gates.countDocuments({$or:[{blocked:true},{rateLimitedHold:true},{cooldownUntil:{$gt:now}}]}))return;
  const result=await runs.updateOne(match,{$set:{otpRecoveredAt:now},$unset:{otpRecovery:''}});
  if(result.modifiedCount)return {event:'otp_acquisition_resumed',verifies};
}

async function guard(db) {
  const runs = db.collection('apx_vg_completion_pilots');
  const gates = db.collection('apx_vg_request_limits');
  const metrics = db.collection('apx_vg_request_metrics');
  const waitUntil = Date.now()+180000;
  let observed = false;
  let errors = 0;
  await db.command({ping:1});
  log({event:'guard_ready'});
  for (;;) {
    try {
      const run = await runs.findOne(activeTrial, {projection:{stopped:1, status:1, expiresAt:1, trialStartedAt:1, finishedAt:1, otpRecovery:1, throttleCooldown:1}});
      if (!run) {
        if (observed || Date.now()>=waitUntil) return;
      } else {
        observed = true;
        if (!run.stopped) {
          // throttleCooldown: a 429 cools down one IP (the pilot stops the run on a second IP); any other 4xx still stops it here.
          const clientError = await metrics.findOne({runId, at:{$gte:run.trialStartedAt}, ...appx4xx, ...(run.throttleCooldown===true?not429:{})}, {projection:{_id:1}});
          const status = clientError?'trial_appx_4xx':run.finishedAt?run.status:errors?'trial_controller_recovered':null;
          if (status) await runs.updateOne({...activeTrial, stopped:false}, {$set:{stopped:true,status,stoppedAt:new Date()}});
          else if(run.otpRecovery) {
            const result=await advanceOtpRecovery(db,activeTrial,ownedGate);
            if(result)log(result);
          }
        } else {
          const now = new Date();
          await gates.updateOne({...ownedGate, leaseUntil:{$lte:now}}, {$set:{dispatchGapMs:baseline}, $unset:{vgDispatchTrial:''}});
          const gate = await gates.findOne({_id:gateId}, {projection:{dispatchGapMs:1,vgDispatchTrial:1}});
          if (gate?.dispatchGapMs===baseline && gate.vgDispatchTrial===undefined) {
            log({event:'closed', status:run.status, gapRestored:baseline});
            return;
          }
          assert.equal(gate?.vgDispatchTrial,marker,'trial_gate_ownership_changed');
        }
      }
    } catch (error) {
      errors++;
      log({event:'guard_retry', type:error.name, code:Number.isInteger(error.code)?error.code:null});
    }
    await wait(1000);
  }
}

async function handoff(client,db) {
 const runs=db.collection('apx_vg_completion_pilots');
 const prepared={_id:runId,status:'queued_prepared',stopped:true,acquireCeiling:0,otpReservations:0,otpSent:0,
  $or:[{predecessorRun:{$exists:false}},{predecessorRun:previousRun}]};
 const successor=await runs.findOne({_id:runId});
 assert(successor,'new_cohort_missing');
 if(successor.vgDispatchTrial===marker){await guard(db);return;}
 const armed=await runs.updateOne(prepared,{$set:{predecessorRun:previousRun},$min:{handoffArmedAt:new Date()}});
 assert.equal(armed.matchedCount,1,'new_cohort_not_prepared');
 log({event:'handoff_armed',previousRun,runId,expectedStandbys:expectedStandbys.length});
 let lastReason;
 for(;;){
  try{
   const run=await runs.findOne({_id:runId},{projection:{status:1,vgDispatchTrial:1}});
   if(run?.vgDispatchTrial===marker){await guard(db);return;}
   if(run?.status!=='queued_prepared')throw Error('new_cohort_not_prepared');
   const prior=await runs.findOne({_id:previousRun},{projection:{status:1,stopped:1,finishedAt:1}});
   if(prior?.stopped&&prior.finishedAt&&['capture_complete','capture_complete_with_exceptions'].includes(prior.status)){
    log(await open(client,db,true));
    await guard(db);
    return;
   }
   lastReason=undefined;
  }catch(error){
   const reason=error.message?.split('\n')[0];
   if(reason!==lastReason){
    log({event:'handoff_wait',reason:/^[a-z_]+$/.test(reason)?reason:error.name});
    lastReason=reason;
   }
  }
  await wait(10000);
 }
}

async function main() {
  assert.equal(os.hostname(),'migrator','wrong_host');
  const mode = process.argv[2];
  assert(['preview','commit','guard','handoff'].includes(mode),'invalid_mode');
  const resolve = name => require(require.resolve(name,{paths:[process.cwd()+'/runtime']}));
  const uri = resolve('dotenv').parse(fs.readFileSync('.env.development')).MONGO_URI;
  assert(/^mongodb(?:\+srv)?:\/\/[^/]+\/vidyagramdb(?:\?|$)/.test(uri||''),'wrong_tenant');
  const client = new (resolve('mongodb').MongoClient)(uri,{serverSelectionTimeoutMS:8000,readPreference:'primary'});
  try {
    const db = client.db('vidyagramdb');
    if (mode==='guard') await guard(db);
    else if(mode==='handoff')await handoff(client,db);
    else log(await open(client,db,mode==='commit'));
  } finally {
    await client.close();
  }
}
module.exports={advanceOtpRecovery,open};
if(require.main===module)main().catch(error => {
  log({event:'controller_failed',reason:/^[a-z_]+$/.test(error.message)?error.message:error.name,
    code:Number.isInteger(error.code)?error.code:null});
  process.exitCode=1;
});
