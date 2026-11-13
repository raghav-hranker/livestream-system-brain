// DB-driven overnight handoffs; no source traffic outside the existing bounded worker.
'use strict';
const fs=require('fs'),os=require('os');
const FRESH=process.argv.includes('--fresh-follow');
const TWO_SLOT=FRESH&&process.argv.includes('--two-slot');
const SKIP_NON_4XX=TWO_SLOT&&process.argv.includes('--skip-non-4xx');
const FOLLOW=FRESH||process.argv.includes('--follow'),PREVIOUS='vg-completion-20261104-overnight6000';
const RUN=FOLLOW?'vg-completion-20261105-follow1000':PREVIOUS;
const ID=RUN+(FRESH?':fresh-launch-20261105':':night-20261105');
// The worker schema requires a BSON date. This sentinel represents a run bounded by its cohort and safety stops.
const CUTOFF=FRESH?new Date('9999-12-31T23:59:59Z'):new Date('2026-11-05T03:30:00Z');
const HOSTS={migrator:'20.193.151.140',migrator2:'20.193.132.31',migrator3:'20.193.139.89',migrator4:'20.193.253.251'};
const CANARY_HOSTS=Object.keys(HOSTS);
if(FRESH)Object.assign(HOSTS,{
 migrator5:'4.240.100.64',migrator6:'40.81.225.65',migrator7:'20.193.138.160',migrator8:'20.40.44.181',
 migrator9:'4.240.96.214',migrator10:'4.240.103.74',migrator11:'20.193.154.220',migrator12:'57.159.31.41',
 phonetics:'34.126.210.209','testing-server-selectionway':'34.131.242.233',
});
const root=process.cwd(),mode=process.argv[2],assert=(x,m)=>{if(!x)throw Error(m);},sleep=ms=>new Promise(r=>setTimeout(r,ms));
process.env.VG_COMPLETION_RUN=RUN;
async function main(){
 const host=os.hostname();assert(HOSTS[host],'unapproved_host');process.env.VG_EGRESS_ID=HOSTS[host];
 const resolve=name=>require(require.resolve(name,{paths:[process.env.VG_APP_ROOT||root+'/runtime']}));
 const env=resolve('dotenv').parse(fs.readFileSync(root+'/.env.development'));
 assert(/^mongodb(?:\+srv)?:\/\/[^/]+\/vidyagramdb(?:\?|$)/.test(env.MONGO_URI||''),'wrong_tenant');
 const {MongoClient,ObjectId}=resolve('mongodb'),p=require('./vidyagram-completion-pilot.cjs');
 const c=new MongoClient(env.MONGO_URI,{minPoolSize:0,maxPoolSize:3,readPreference:'primary',serverSelectionTimeoutMS:15000});
 try{
  await c.connect();const db=c.db('vidyagramdb'),runs=db.collection(p.COL.runs),nights=db.collection('apx_vg_completion_batches'),jobs=db.collection(p.COL.jobs),rate=db.collection('apx_vg_request_limits');
  if(FRESH&&mode==='status'){
   const now=new Date(),since=new Date(+now-900000);
   const [run,night,states,active,traffic,holds]=await Promise.all([
    runs.findOne({_id:RUN},{projection:{_id:0,status:1,stopped:1,finishedAt:1,acquireCeiling:1,otpReservations:1,otpSent:1}}),
    nights.findOne({_id:ID},{projection:{_id:0,state:1,generation:1,reason:1,supervisors:1}}),
    jobs.aggregate([{$match:{runId:RUN}},{$group:{_id:'$state',n:{$sum:1}}}]).toArray(),
    db.collection(p.COL.workers).distinct('host',{runId:RUN,state:'running',heartbeatAt:{$gte:new Date(+now-600000)}}),
    db.collection('apx_vg_request_metrics').aggregate([{$match:{runId:RUN,at:{$gte:since}}},{$group:{_id:{endpoint:'$endpoint',http:'$httpStatus',api:'$apiStatus',error:'$error'},n:{$sum:1},last:{$max:'$at'}}}]).toArray(),
    rate.countDocuments({_id:{$in:[...Object.values(HOSTS).map(ip=>'ip:'+ip),'org:2177599:all']},$or:[{rateLimitedHold:true},{blocked:true},{cooldownUntil:{$gt:now}}]}),
   ]);
   const {supervisors={},...checkpoint}=night||{};
   console.log(JSON.stringify({now,run,checkpoint,states,active,registered:Object.keys(supervisors),traffic,holds,readsLast15m:await jobs.countDocuments({runId:RUN,capturedAt:{$gte:since}})}));
   return;
  }
  if(mode==='resume-two-slot'||mode==='continue-two-slot'||mode==='resume-timeout-stop'){
   assert(TWO_SLOT&&host==='migrator','wrong_resume_scope');
   const continuing=mode==='continue-two-slot';
   const recovering=mode==='resume-timeout-stop';
   const generation=recovering?9:continuing?3:2;
   const stopReason=recovering?'token_failures_stop':'checkpoint_failures';
   const commit=process.argv.includes('--commit');
   const session=c.startSession();
   let result;
   try{
    await session.withTransaction(async()=>{
     const opts={session},now=new Date();
     const run=await runs.findOne({_id:RUN,status:recovering?stopReason:'checkpoint_review',stopped:true,twoSlotDrainAt:{$type:'date'}},opts);
     const checkpoint=await nights.findOne({_id:ID,state:'halted',generation,reason:stopReason,twoSlotTrial:{$exists:continuing||recovering}},opts);
     assert(run&&checkpoint,'checkpoint_not_drained');
     if(recovering){
      assert(SKIP_NON_4XX&&run.acquireCeiling===685&&checkpoint.activeJobIds.length===100&&run.stopCause?.code==='TimeoutError'&&run.stopCause?.task==='acquire','unexpected_timeout_stop');
      assert(run.failureWindowMs===60000&&+now-+run.stoppedAt>=run.failureWindowMs&&!p.failureLimitReached(run,+now),'failure_guard_still_active');
      assert(!await jobs.findOne({runId:RUN,state:{$in:['acquiring','reading','token_ready','read_retry','waiting_session']}},opts),'jobs_still_pending');
     }
     assert(!await db.collection(p.COL.workers).findOne({state:'running',role:{$in:['acquire','read','both']},heartbeatAt:{$gte:new Date(+now-600000)}},opts),'source_workers_active');
     assert(!await rate.findOne({$or:[
      {_id:{$in:[...Object.values(HOSTS).map(ip=>'ip:'+ip),'org:2177599:all','org:2177599:admin']},$or:[{rateLimitedHold:true},{blocked:true},{cooldownUntil:{$gt:now}}]},
      {_id:/^org:2177599:slot:/,leaseUntil:{$gt:now}},
     ]},opts),'request_hold_or_lease_active');
     assert(!await db.collection('distributedlocks').findOne({key:'apx-rate-limit-pause',expiresAt:{$gt:now}},opts),'shared_cooldown_active');
     assert(await db.collection('apxsessions').findOne({orgId:'2177599',isActive:{$ne:false}},opts),'admin_session_missing');
     const gateMatch={_id:'org:2177599:all',maxConcurrent:continuing||recovering?2:1,dispatchGapMs:3750,dispatchPenaltyBaseline:4,penalty:{$gte:4},leaseUntil:{$lte:now}};
     assert(await rate.findOne(gateMatch,opts),'shared_gate_changed');
     const scope={runId:RUN,_id:{$in:checkpoint.activeJobIds}};
     const failures=recovering?{state:'token_failed',lastError:{$in:['TimeoutError','pilot_stopped']}}:{state:'token_failed',lastError:'TimeoutError',otpAttemptedAt:{$exists:true},otpSentAt:{$exists:false}};
     const unattempted={state:'queued',otpAttemptedAt:{$exists:false}};
     assert(!await jobs.findOne({...scope,$nor:[{state:{$in:['captured','mapping_exception','auth_deferred']}},failures,unattempted]},opts),'checkpoint_has_unreviewed_outcomes');
     const failed=await jobs.countDocuments({...scope,...failures},opts);
     if(continuing){
      const completed=await jobs.countDocuments({...scope,state:{$in:['captured','mapping_exception']}},opts);
      assert(checkpoint.activeJobIds.length===20&&completed===19&&failed===1,'unexpected_trial_outcomes');
     }
     const metrics=db.collection('apx_vg_request_metrics');
     const blockedStatus=recovering?{$gte:400,$lt:500}:{$in:[403,429]};
     const bad=await metrics.countDocuments({runId:RUN,at:{$gte:checkpoint.sourceStart},$or:[{httpStatus:blockedStatus},{apiStatus:blockedStatus}]},opts);
     assert(!bad,'checkpoint_rate_or_access_failure');
     const queued=await jobs.countDocuments({runId:RUN,...unattempted},opts);
     assert(queued>=20,'trial_queue_too_small');
     result={event:mode,committed:commit,failed,queued,nextBatchSize:continuing||recovering?100:20,dispatchGapMs:3750};
     if(!commit)return;
     if(!continuing&&!recovering)assert((await rate.updateOne(gateMatch,{$set:{maxConcurrent:2}},opts)).modifiedCount===1,'shared_gate_changed');
     if(recovering)assert((await runs.updateOne({_id:RUN,status:stopReason,stopped:true,stoppedAt:run.stoppedAt},{$set:{status:'checkpoint_review'}},opts)).modifiedCount===1,'run_changed');
     const reviewField=recovering?'timeoutStopReview':continuing?'twoSlotTrialReview':'twoSlotTrial';
     assert((await nights.updateOne({_id:ID,state:'halted',generation},{$set:{
      state:'armed',activeJobIds:[],[reviewField]:{at:now,failed,previousActiveJobIds:checkpoint.activeJobIds,previousOutcomes:checkpoint.outcomes,...(recovering?{stopCause:run.stopCause,stoppedAt:run.stoppedAt}:{})},
     },$unset:{reason:'',finishedAt:'',supervisors:''}},opts)).modifiedCount===1,'checkpoint_changed');
    },{readConcern:{level:'snapshot'},writeConcern:{w:'majority'}});
   }finally{await session.endSession();}
   console.log(JSON.stringify(result));
   return;
  }
  if(mode==='arm-fresh'){
   assert(FRESH&&host==='migrator','wrong_arm_scope');
   const session=c.startSession();
   try{
    await session.withTransaction(async()=>{
     const opts={session};
     const previous=await runs.findOne({_id:PREVIOUS},opts);
     const old=await nights.findOne({_id:RUN+':night-20261105'},opts);
     const run=await runs.findOne({_id:RUN},opts);
     const gate=await rate.findOne({_id:'org:2177599:all'},opts);
     const now=new Date();
     assert(previous?.finishedAt&&['capture_complete','capture_complete_with_exceptions'].includes(previous.status),'predecessor_closeout_missing');
     assert(old?.state==='halted'&&old.reason==='predecessor_failed','unexpected_original_gate');
     assert(run?.stopped&&run.status==='queued_followup'&&run.expiresAt<now&&run.acquireCeiling===0&&run.otpReservations===0&&run.otpSent===0,'follow_run_not_untouched');
     assert(gate?.maxConcurrent===1&&gate.dispatchGapMs===3750&&gate.dispatchPenaltyBaseline===4&&gate.penalty>=4,'shared_gate_changed');
     assert(!gate.blocked&&!gate.rateLimitedHold&&!(gate.cooldownUntil>now),'shared_hold_or_cooldown');
     assert(!await rate.findOne({_id:{$in:CANARY_HOSTS.map(name=>'ip:'+HOSTS[name])},$or:[{rateLimitedHold:true},{blocked:true},{cooldownUntil:{$gt:now}}]},opts),'canary_route_held');
     assert(!await db.collection('distributedlocks').findOne({key:'apx-rate-limit-pause',expiresAt:{$gt:now}},opts),'shared_cooldown_active');
     assert(await db.collection('apxsessions').findOne({orgId:'2177599',isActive:{$ne:false}},opts),'admin_session_missing');
     assert(!await db.collection(p.COL.workers).findOne({state:'running',role:{$in:['acquire','read','both']},heartbeatAt:{$gte:new Date(+now-600000)}},opts),'source_workers_active');
     assert(await jobs.countDocuments({runId:RUN,state:'queued',otpAttemptedAt:{$exists:false}},opts)===1000,'follow_queue_changed');
     if(!process.argv.includes('--commit'))return;
     const updated=await runs.updateOne({_id:RUN,stopped:true,status:'queued_followup',acquireCeiling:0,otpReservations:0},{$set:{status:'checkpoint_review',expiresAt:CUTOFF}},opts);
     assert(updated.modifiedCount===1,'fresh_arm_raced');
     await nights.insertOne({_id:ID,runId:RUN,state:'armed',generation:0,sourceStart:now},opts);
    },{readConcern:{level:'snapshot'},writeConcern:{w:'majority'}});
   }finally{await session.endSession();}
   console.log(JSON.stringify({event:'fresh-arm',committed:process.argv.includes('--commit'),canary:4,queued:1000}));
   return;
  }
  if(mode==='prepare-follow'){
   assert(FOLLOW&&host==='migrator'&&Date.now()<+CUTOFF,'invalid_follow_scope');
   if(await runs.findOne({_id:RUN})){console.log(JSON.stringify({event:'follow-already-prepared',learners:await jobs.countDocuments({runId:RUN})}));return;}
   const predecessor=await nights.findOne({_id:PREVIOUS+':night-20261105'});assert(predecessor&&!['halted','expired'].includes(predecessor.state),'predecessor_not_eligible');
   const selected=await p.candidates(db,ObjectId);assert(selected.jobs.length===1000,'follow_cohort_size_mismatch');
   console.log(JSON.stringify({event:'follow-cohort-preview',learners:selected.jobs.length,coursePairs:selected.jobs.reduce((n,j)=>n+j.courses.length,0),inspected:selected.inspected,commit:process.argv.includes('--commit')}));
   if(!process.argv.includes('--commit'))return;
   const trial=await nights.findOne({_id:PREVIOUS+':next10-20261105'}),first=await jobs.find({_id:{$in:trial.trialJobIds}}).sort({priority:1}).limit(1).next();assert(first,'predecessor_scope_missing');
   const s=c.startSession();try{await s.withTransaction(async()=>{
    await runs.insertOne({_id:RUN,tenant:'vidyagram',orgId:'2177599',maxUsers:1000,otpReservations:0,otpSent:0,tokenFailures:0,authDeferred:0,stopped:true,status:'queued_followup',sourceOnly:true,createdAt:new Date(),expiresAt:CUTOFF,predecessorRun:PREVIOUS,deferAccountAuth:true,accountFailureGuard:true,failureWindowMs:60000,acquisitionFailureEvents:[],acquisitionOutcomes:[],throttleIsolation:true,requestConcurrency:1,acquireCeiling:0},{session:s});
    await jobs.insertMany(selected.jobs,{session:s});
    await nights.insertOne({_id:ID,runId:RUN,state:'armed',generation:0,at:new Date(),cutoff:CUTOFF,hosts:HOSTS,predecessorRun:PREVIOUS,predecessorPriorityFloor:first.priority,predecessorSourceStart:predecessor.sourceStart,sourceStart:new Date(),baselineFullyCaptured:0},{session:s});
   },{readConcern:{level:'snapshot'},writeConcern:{w:'majority'}});}finally{await s.endSession();}
   console.log(JSON.stringify({event:'follow-cohort-prepared',learners:1000,stopped:true,cutoff:CUTOFF}));return;
  }
  if(mode==='arm'){
   assert(host==='migrator'&&Date.now()<+CUTOFF,'wrong_arm_scope');
   const run=await runs.findOne({_id:RUN}),trial=await nights.findOne({_id:RUN+':next10-20261105'});
   assert(trial&&['running','finished'].includes(trial.state),'trial_missing');
   assert(!run.stopped||run.status==='checkpoint_review','run_not_healthy');
   const available=await jobs.countDocuments({runId:RUN,state:'queued',otpAttemptedAt:{$exists:false}});
   console.log(JSON.stringify({event:'night-preview',hosts:Object.keys(HOSTS),queued:available,batchSize:100,cutoff:CUTOFF,globalDispatchGapMs:3750,commit:process.argv.includes('--commit')}));
   if(!process.argv.includes('--commit'))return;
   await nights.insertOne({_id:ID,runId:RUN,state:'armed',at:new Date(),cutoff:CUTOFF,generation:0,hosts:HOSTS,beforeRun:run,baselineFullyCaptured:await jobs.countDocuments({runId:RUN,state:{$in:['captured','mapping_exception']}}),sourceStart:trial.startedAt});
   await runs.updateOne({_id:RUN,nextBatchId:trial._id},{$set:{expiresAt:CUTOFF,overnightBatchId:ID}});
   return;
  }
  if(mode==='controller'){
   assert(host==='migrator','wrong_controller_host');let idle=0;
   console.log(JSON.stringify({event:'night-controller-started',cutoff:CUTOFF,skipNon4xx:SKIP_NON_4XX}));
   while(Date.now()<+CUTOFF){
    const night=await nights.findOne({_id:ID});let run=await runs.findOne({_id:RUN});assert(night,'night_not_armed');
    if(['halted','finished','expired'].includes(night.state))return;
    if(FOLLOW&&!FRESH&&night.generation===0&&run.status==='queued_followup'){
     const before=await runs.findOne({_id:PREVIOUS}),beforeNight=await nights.findOne({_id:PREVIOUS+':night-20261105'}),shared=await rate.findOne({_id:'org:2177599:all'});
     const outcomes=await jobs.aggregate([{$match:{runId:PREVIOUS,priority:{$gte:night.predecessorPriorityFloor}}},{$group:{_id:'$state',n:{$sum:1}}}]).toArray();
     const decision=require('./vidyagram-completion-follow-gate.cjs').followGate({now:Date.now(),cutoff:+CUTOFF,nightState:beforeNight?.state,predecessorFinished:!!before?.finishedAt&&['capture_complete','capture_complete_with_exceptions'].includes(before.status),outcomes:outcomes.map(x=>({state:x._id,n:x.n})),badRequests:await db.collection('apx_vg_request_metrics').countDocuments({runId:PREVIOUS,at:{$gte:night.predecessorSourceStart},$or:[{httpStatus:403},{httpStatus:429},{apiStatus:403},{apiStatus:429}]}),heldRoutes:await rate.countDocuments({_id:{$in:[...Object.values(HOSTS).map(ip=>'ip:'+ip),'org:2177599:all']},$or:[{rateLimitedHold:true},{blocked:true}]}),activeWorkers:await db.collection(p.COL.workers).countDocuments({runId:PREVIOUS,state:'running',heartbeatAt:{$gte:new Date(Date.now()-90000)}}),cooldownUntil:+new Date(shared.cooldownUntil)});
     if(decision==='waiting'){await sleep(15000);continue;}
     if(decision!=='ready'){await nights.updateOne({_id:ID},{$set:{state:'halted',reason:decision,finishedAt:new Date()}});console.log(JSON.stringify({event:'follow-handoff-held',reason:decision}));return;}
     const changed=await runs.updateOne({_id:RUN,stopped:true,status:'queued_followup'},{$set:{status:'checkpoint_review',predecessorQualifiedAt:new Date()}});assert(changed.modifiedCount===1,'follow_handoff_changed');run=await runs.findOne({_id:RUN});
     console.log(JSON.stringify({event:'follow-predecessor-qualified'}));
    }
    const finished=run.finishedAt&&['capture_complete','capture_complete_with_exceptions'].includes(run.status);
    if(finished&&!SKIP_NON_4XX){await nights.updateOne({_id:ID},{$set:{state:'finished',finishedAt:new Date(),reason:run.status}});console.log(JSON.stringify({event:'night-finished',reason:run.status}));return;}
    if(!finished&&run.stopped&&run.status!=='checkpoint_review'){
     await nights.updateOne({_id:ID},{$set:{state:'halted',finishedAt:new Date(),reason:run.status}});console.log(JSON.stringify({event:'night-halted',reason:run.status}));return;
    }
    if(!finished&&!run.stopped){await sleep(15000);continue;}
    // A checkpoint can race the last worker exit; wait before handoff.
    if(await db.collection(p.COL.workers).countDocuments({runId:RUN,state:'running',heartbeatAt:{$gte:new Date(Date.now()-90000)}})){await sleep(3000);if(++idle<35)continue;throw Error('checkpoint_worker_stalled');}idle=0;
    const ids=night.generation===0?(FOLLOW?[]:(await nights.findOne({_id:RUN+':next10-20261105'})).trialJobIds):night.activeJobIds;
    const outcomes=await jobs.aggregate([{$match:{_id:{$in:ids}}},{$group:{_id:'$state',n:{$sum:1}}}]).toArray();
    const allowDeferrals=night.generation>(FRESH?1:0);
    const acceptedStates=['captured','mapping_exception'];
    if(allowDeferrals)acceptedStates.push('auth_deferred');
    if(SKIP_NON_4XX)acceptedStates.push('token_failed','read_failed','otp_outcome_uncertain');
    const clean=outcomes.every(x=>acceptedStates.includes(x._id));
    const blockingStatus=SKIP_NON_4XX?{$gte:400,$lt:500}:{$in:[403,429]};
    const incident=await db.collection('apx_vg_request_metrics').findOne({runId:RUN,at:{$gte:night.sourceStart},$or:[
     {httpStatus:blockingStatus},{apiStatus:blockingStatus},
    ]},{projection:{_id:1}})||SKIP_NON_4XX&&await jobs.findOne({runId:RUN,_id:{$in:ids},lastHttp:blockingStatus},{projection:{_id:1}});
    if(!clean||incident){await nights.updateOne({_id:ID},{$set:{state:'halted',reason:incident?'rate_or_access_review':'checkpoint_failures',outcomes,finishedAt:new Date()}});console.log(JSON.stringify({event:'night-halted',reason:incident?'rate_or_access_review':'checkpoint_failures',outcomes}));return;}
    const batchSize=TWO_SLOT&&night.generation===2?20:FRESH&&night.generation===0?4:100;
    const queued=await jobs.find({runId:RUN,state:'queued',otpAttemptedAt:{$exists:false}}).sort({priority:1}).limit(batchSize).toArray();
    if(!queued.length){await nights.updateOne({_id:ID},{$set:{state:'finished',finishedAt:new Date(),outcomes}});console.log(JSON.stringify({event:'night-finished'}));return;}
    const ceiling=queued.at(-1).priority+1,gen=night.generation+1;
    const session=c.startSession();try{await session.withTransaction(async()=>{
     const changed=await runs.updateOne({_id:RUN,stopped:true,status:'checkpoint_review'},{$set:{stopped:false,readOnlyRecovery:false,status:'running',acquireCeiling:ceiling,expiresAt:CUTOFF,throttleIsolation:true,conservativePhase:'overnight_four_primary_routes',plannedAcquisitionWorkers:4,plannedReaders:4,overnightGeneration:gen,requestConcurrency:1},$unset:{finishedAt:''}},{session});assert(changed.modifiedCount===1,'checkpoint_changed');
     if(FRESH){
      const gate=await rate.findOne({_id:'org:2177599:all',maxConcurrent:TWO_SLOT?2:1,dispatchGapMs:3750,dispatchPenaltyBaseline:4,penalty:{$gte:4},blocked:{$ne:true},rateLimitedHold:{$ne:true},cooldownUntil:{$lte:new Date()}},{session});
      assert(gate,'shared_gate_changed');
     }else{
      const gated=await rate.updateOne({_id:'org:2177599:all',maxConcurrent:1},{$set:{dispatchGapMs:3750,dispatchPenaltyBaseline:4}},{session});assert(gated.matchedCount===1,'shared_gate_changed');
     }
     await nights.updateOne({_id:ID,generation:night.generation},{$set:{state:'running',generation:gen,activeJobIds:queued.map(x=>x._id),phaseStartedAt:new Date(),lastCheckpointOutcomes:outcomes},$push:{phases:{generation:gen,at:new Date(),learners:queued.length,ceiling}}},{session});
    },{readConcern:{level:'snapshot'},writeConcern:{w:'majority'}});}finally{await session.endSession();}
    console.log(JSON.stringify({event:'night-batch-started',generation:gen,learners:queued.length,cutoff:CUTOFF}));
   }
   await nights.updateOne({_id:ID,state:{$nin:['finished','halted']}},{$set:{state:'expired',finishedAt:new Date()}});console.log(JSON.stringify({event:'night-cutoff'}));return;
  }
  if(mode==='worker'){
   let executed=0;
   await nights.updateOne({_id:ID},{$set:{['supervisors.'+host]:{state:'waiting',pid:process.pid,at:new Date()}}});
   console.log(JSON.stringify({event:'night-host-waiting',host,cutoff:CUTOFF}));
   while(Date.now()<+CUTOFF){
    const night=await nights.findOne({_id:ID}),run=await runs.findOne({_id:RUN});assert(night,'night_not_armed');
    if(['halted','finished','expired'].includes(night.state))return;
    const ip=await rate.findOne({_id:'ip:'+HOSTS[host]});if(ip?.rateLimitedHold||ip?.blocked){console.log(JSON.stringify({event:'night-host-held',host}));return;}
    if(!run.stopped&&night.generation>executed&&night.generation>0&&(!FRESH||night.generation>1||CANARY_HOSTS.includes(host))){
     executed=night.generation;
     process.env.VG_REQUEST_GAP_MS=String(Math.ceil(15000/(ip?.penalty||1)));process.env.VG_ADMIN_GAP_MS='2000';process.env.VG_LEARNER_GAP_MS=FRESH?'30000':'60000';
     console.log(JSON.stringify({event:'night-host-started',host,generation:executed,effectiveGapMs:15000}));
     await p.worker(c,db,'both',ObjectId);
    }else await sleep(3000);
   }
  }else throw Error('invalid_mode');
 }finally{await c.close();}
}
main().catch(e=>{console.error(JSON.stringify({event:'night-aborted',error:/^[a-z_]+$/.test(e.message||'')?e.message:e.name}));process.exitCode=1;});
