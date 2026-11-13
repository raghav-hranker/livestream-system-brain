'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
process.env.VG_EGRESS_ID='192.0.2.1';
process.env.VG_REQUEST_GAP_MS='250';process.env.VG_ADMIN_GAP_MS='250';process.env.VG_REQUEST_JITTER_MS='0';
process.env.VG_SHARED_PAUSE_MAX_WAIT_MS='1500';process.env.VG_SHARED_PAUSE_SPREAD_MS='0';
const p=require('./vidyagram-completion-pilot.cjs');
const root='/Users/raghav/Projects/worktrees/vg-backend';
const {MongoMemoryReplSet}=require(root+'/node_modules/mongodb-memory-server');
const {MongoClient,ObjectId}=require(root+'/node_modules/mongoose').mongo;
let rs,client,db;
test.before(async()=>{rs=await MongoMemoryReplSet.create({binary:{version:'7.0.14'},replSet:{count:1},instanceOpts:[{port:0}]});client=new MongoClient(rs.getUri());await client.connect();db=client.db('vidyagramdb');});
test.after(async()=>{await client?.close();await rs?.stop();});
test.beforeEach(async()=>{await db.dropDatabase();await db.collection(p.COL.runs).insertOne({_id:p.RUN,otpReservations:0,expiresAt:new Date(Date.now()+60000),stopped:false});});
test('normalizes only explicit binary flags; rejects malformed maps',()=>{
 assert.deepEqual(p.normalizeFlags({'1':1,'2':'1','3':0,'4':'0','5':true,'6':{status:1}}),{flags:{'1':1,'2':1,'3':0,'4':0},invalidCount:2,completedIds:['1','2']});
 assert.throws(()=>p.normalizeFlags([]));assert.throws(()=>p.normalizeFlags(undefined));assert.equal(p.normalizeFlags(null).completedIds.length,0);
});
test('Azure experiment uses ten baseline learners before thirty-second spacing, without changing other runs',()=>{
 for(let i=0;i<10;i++)assert.deepEqual(p.pacingFor({priority:i},60000,'vg-completion-20261103-azure50'),{experimentPhase:'baseline_60s',learnerGapMs:60000});
 for(let i=10;i<50;i++)assert.deepEqual(p.pacingFor({priority:i},60000,'vg-completion-20261103-azure50'),{experimentPhase:'accelerated_30s',learnerGapMs:30000});
 assert.deepEqual(p.pacingFor({priority:49},60000,'vg-completion-20261103-horizontal50'),{experimentPhase:'steady',learnerGapMs:60000});
 assert.throws(()=>p.pacingFor({priority:50},60000,'vg-completion-20261103-azure50'));
});
test('fleet run has an explicit 500-user ceiling and eight-hour expiry; other runs stay at fifty',()=>{
 assert.deepEqual(p.runSpec('vg-completion-20261103-fleet500'),{maxUsers:500,hours:8});
 assert.deepEqual(p.runSpec('vg-completion-20261103-azure50'),{maxUsers:50,hours:4});
 assert.throws(()=>p.runSpec('vg-completion-unbounded'));
 assert.equal(p.stopsOnThrottle('vg-completion-20261103-fleet500'),true);
 assert.deepEqual(p.pacingFor({priority:499},30000,'vg-completion-20261103-fleet500'),{experimentPhase:'fleet_30s',learnerGapMs:30000});
 assert.deepEqual(p.pacingFor({priority:499},60000,'vg-completion-20261103-fleet500'),{experimentPhase:'fleet_60s',learnerGapMs:60000});
});
test('no-history run stays at fifty and stops on throttling, without changing other runs',()=>{
 assert.deepEqual(p.runSpec('vg-completion-20261103-nohistory50'),{maxUsers:50,hours:4});
 assert.equal(p.stopsOnThrottle('vg-completion-20261103-nohistory50'),true);
 assert.equal(p.stopsOnThrottle('vg-completion-20261103-horizontal50'),false);
 assert.deepEqual(p.pacingFor({priority:49},60000,'vg-completion-20261103-nohistory50'),{experimentPhase:'steady',learnerGapMs:60000});
 assert.deepEqual(p.runSpec('vg-completion-20261103-fleet500'),{maxUsers:500,hours:8});
});
test('next fleet has a finite 2000-user budget and retains throttle stops',()=>{
 assert.deepEqual(p.runSpec('vg-completion-20261104-fleet2000'),{maxUsers:2000,hours:12});
 assert.equal(p.stopsOnThrottle('vg-completion-20261104-fleet2000'),true);
 assert.equal(p.pacingFor({priority:1999},30000,'vg-completion-20261104-fleet2000').learnerGapMs,30000);
});
test('checkpoint ceiling prevents acquiring later learners while readers can drain',async()=>{
 await db.collection(p.COL.runs).updateOne({_id:p.RUN},{$set:{acquireCeiling:1}});
 await db.collection(p.COL.jobs).insertMany([{_id:'later',runId:p.RUN,priority:1,state:'queued'},{_id:'ready',runId:p.RUN,priority:0,state:'token_ready'}]);
 assert.equal(await p.claim(db,'acquire','a'),null);
 assert.equal((await p.claim(db,'read','reader'))._id,'ready');
});
test('read-only recovery rejects acquisition and OTP reservation despite an open run',async()=>{
 await db.collection(p.COL.runs).updateOne({_id:p.RUN},{$set:{readOnlyRecovery:true}});
 const job={_id:'recovery',runId:p.RUN,priority:0,state:'acquiring',owner:'a'};
 await db.collection(p.COL.jobs).insertOne(job);
 assert.equal(await p.claim(db,'acquire','a'),null);
 await assert.rejects(p.reserveOtp(client,db,job,'a'),/pilot_budget_or_stop/);
 assert.equal((await db.collection(p.COL.runs).findOne({_id:p.RUN})).otpReservations,0);
});
test('OTP cooling and review keep saved-token reads available and bound the canary queue',async()=>{
 const runs=db.collection(p.COL.runs),jobs=db.collection(p.COL.jobs);
 const untouched={_id:'untouched',runId:p.RUN,state:'queued',priority:10};
 await jobs.insertMany([untouched,{_id:'later',runId:p.RUN,state:'queued',priority:20},
  {_id:'saved',runId:p.RUN,state:'token_ready',priority:0}]);
 for(const phase of ['cooling','review']){
  await runs.updateOne({_id:p.RUN},{$set:{otpRecovery:{phase}}});
  assert.equal(await p.claim(db,'acquire','acquirer'),null);
  await assert.rejects(p.reserveOtp(client,db,untouched,'acquirer'),/otp_acquisition_paused/);
 }
 assert.equal((await p.claim(db,'read','reader'))._id,'saved');
 await runs.updateOne({_id:p.RUN},{$set:{otpRecovery:{phase:'canary',ceiling:11,deadline:new Date(Date.now()+60000)}}});
 const claimed=await p.claim(db,'acquire','acquirer');
 assert.equal(claimed._id,'untouched');
 assert.equal(await p.reserveOtp(client,db,claimed,'acquirer'),true);
 assert.equal(await p.claim(db,'acquire','acquirer'),null);
 assert.equal((await runs.findOne({_id:p.RUN})).otpReservations,1);
});
test('an OTP timeout burst pauses acquisition while the worker finishes a saved-token read',async()=>{
 const runs=db.collection(p.COL.runs),jobs=db.collection(p.COL.jobs);
 const failure={at:new Date(),code:'TimeoutError',otpTimeout:true};
 await runs.updateOne({_id:p.RUN},{$set:{otpTimeoutAutoRecovery:true,failureWindowMs:60000,
  acquisitionFailureEvents:[failure,failure],acquisitionOutcomes:[]}});
 await db.collection('apxsessions').insertOne({orgId:'2177599',isActive:true,session_id:'fixture'});
 const learner={_id:p.jobId('91'),runId:p.RUN,apxUserId:'91',priority:0,state:'queued'};
 await jobs.insertMany([learner,{_id:'next',runId:p.RUN,priority:1,state:'queued'}]);
 const originalFetch=global.fetch,paths=[];
 global.fetch=async input=>{
  paths.push(input.pathname);
  if(input.pathname.endsWith('get_userdt_by_id'))return response(200,{status:200,userdt:{id:'91',phone:'9999999999'}});
  if(input.pathname.endsWith('sendotp'))throw new DOMException('fixture timeout','TimeoutError');
  return response(200,{status:200,data:{}});
 };
 const done=p.worker(client,db,'both',ObjectId);
 const waitFor=async check=>{
  for(let attempt=0;attempt<120;attempt++){
   if(await check())return;
   await new Promise(resolve=>setTimeout(resolve,50));
  }
  assert.fail('worker did not reach expected state');
 };
 try{
  await waitFor(async()=>Boolean(await runs.findOne({_id:p.RUN,stopped:false,'otpRecovery.phase':'cooling'})));
  const saved={_id:p.jobId('92'),runId:p.RUN,apxUserId:'92',priority:2,state:'token_ready',courses:[{courseId:String(new ObjectId()),apxCourseId:'12'}]};
  await db.collection('apxtestusertokens').insertOne({orgId:'2177599',apxUserId:'92',token:'fixture'});
  await jobs.insertOne(saved);
  await waitFor(async()=>Boolean(await jobs.findOne({_id:saved._id,state:'captured'})));
  assert.equal((await jobs.findOne({_id:'next'})).state,'queued');
  assert.ok((await jobs.findOne({_id:learner._id})).otpAttemptedAt);
  assert.equal(paths.filter(path=>path.endsWith('sendotp')).length,1);
  assert.ok(paths.some(path=>path.endsWith('getVideoCompletion')));
 }finally{
  await runs.updateOne({_id:p.RUN},{$set:{stopped:true}});
  try{await done;}finally{global.fetch=originalFetch;}
 }
});
test('no-history selection takes only unclaimed, untokened, paid learners who still have no watch seconds on an owned course',async()=>{
 const course=new ObjectId(),other=new ObjectId(),cls=new ObjectId();
 await db.collection('courses').insertMany([{_id:course,apxCourseId:'11'},{_id:other,apxCourseId:'22'}]);
 await db.collection('courseclasses').insertMany([{course,class:cls},{course:other,class:cls}]);
 const add=async(apx,detail,extra={})=>{const _id=new ObjectId();await db.collection('users').insertOne({_id,usersApxId:apx,customer_id:781,status:1,...extra});await db.collection('orders').insertOne({userId:String(_id),courseId:[String(course)],orderStatus:'success',status:1,grandTotal:100});if(detail)await db.collection('apx_user_course_test_detail').insertOne({apxId:apx,courses:detail});return _id;};
 const history=(c,s)=>[{courseId:c,data:{merged_courses:[{video_duration_total:s}]}}];
 await add('1',null);
 await add('2',history('11','0'));
 await add('3',history('22','500'));
 await add('4',history('11','500'));
 await add('5',null);
 await add('6',null);
 await add('7',null,{customer_id:472});
 await add('8',null,{status:0});
 await db.collection(p.COL.jobs).insertOne({_id:'x',orgId:p.ORG||'2177599',apxUserId:'5'});
 await db.collection('apxtestusertokens').insertOne({orgId:'2177599',apxUserId:'6',token:'t'});
 const r=await p.noHistoryCandidates(db,ObjectId,['1','2','3','4','5','6','7','8','9','1']);
 assert.deepEqual(r.jobs.map(j=>j.apxUserId).sort(),['1','2','3']);
 assert.deepEqual(r.jobs.map(j=>j.priority).sort(),[0,1,2]);
 assert.deepEqual(r.jobs[0].courses,[{courseId:String(course),apxCourseId:'11'}]);
 assert.ok(r.jobs.every(j=>j.state==='queued'&&j.runId===p.RUN));
 assert.equal((await p.noHistoryCandidates(db,ObjectId,['1','2','3'],2)).jobs.length,2);
});
test('acceleration requires all ten real-token baseline reads and no rate limit responses',async()=>{
 const runId='vg-completion-20261103-azure50';
 await db.collection(p.COL.jobs).insertMany(Array.from({length:9},(_,i)=>({_id:'azure-'+i,runId,priority:i,state:'captured',tokenSource:'minted'})));
 await assert.rejects(p.ensureBaseline(db,runId),/experiment_baseline_not_ready/);
 await db.collection(p.COL.jobs).insertOne({_id:'azure-9',runId,priority:9,state:'mapping_exception',tokenSource:'minted'});
 await p.ensureBaseline(db,runId);
 await db.collection('apx_vg_request_metrics').insertOne({runId,httpStatus:200,apiStatus:429});
 await assert.rejects(p.ensureBaseline(db,runId),/experiment_baseline_not_ready/);
});
test('video IDs are course-scoped and conflicting class mappings are rejected',()=>{
 const m=p.buildMapping([{course:'a',class:'c1',apxClassId:'7',apxDisplayPlacements:[{apxClassId:'8'}]},{course:'a',class:'c2',apxClassId:'7'},{course:'b',class:'c3',apxClassId:'8'}],'a');
 assert.equal(m.unique.get('8'),'c1');assert.equal(m.unique.has('7'),false);assert.equal(m.conflicts.has('7'),true);
});
test('catalogue ledger restores original source IDs only for classes still placed in the exact course',()=>{
 const m=p.buildMapping([{course:'a',class:'c1'},{course:'a',class:'c2'}],'a',[
  {classId:'c1',placements:[{apxCourseId:'10',rowId:'99'},{apxCourseId:'11',rowId:'100'}]},
  {classId:'removed',placements:[{apxCourseId:'10',rowId:'101'}]},
  {classId:'c2',placements:[{apxCourseId:'10',rowId:'102'}]},
 ],'10');
 assert.equal(m.unique.get('99'),'c1');assert.equal(m.unique.get('102'),'c2');assert.equal(m.unique.has('100'),false);assert.equal(m.unique.has('101'),false);
});
test('two workers cannot acquire the same learner and an uncertain OTP is never reserved twice',async()=>{
 const job={_id:p.jobId('11'),runId:p.RUN,state:'queued',priority:0};await db.collection(p.COL.jobs).insertOne(job);
 const [a,b]=await Promise.all([p.claim(db,'acquire','a'),p.claim(db,'acquire','b')]);assert.equal([a,b].filter(Boolean).length,1);
 const j=a||b;await p.reserveOtp(client,db,j,j.owner);
 await assert.rejects(p.reserveOtp(client,db,j,j.owner),/otp_already_reserved/);
 assert.equal((await db.collection(p.COL.runs).findOne({_id:p.RUN})).otpReservations,1);
});
test('OTP budget is atomic across workers and rolls back the losing reservation',async()=>{
 await db.collection(p.COL.runs).updateOne({_id:p.RUN},{$set:{otpReservations:p.MAX_USERS-1}});
 const jobs=[1,2].map(x=>({_id:p.jobId(String(x)),runId:p.RUN,state:'acquiring',owner:String(x)}));await db.collection(p.COL.jobs).insertMany(jobs);
 const result=await Promise.allSettled(jobs.map(j=>p.reserveOtp(client,db,j,j.owner)));
 assert.equal(result.filter(r=>r.status==='fulfilled').length,1);
 assert.equal((await db.collection(p.COL.runs).findOne({_id:p.RUN})).otpReservations,p.MAX_USERS);
 assert.equal(await db.collection(p.COL.jobs).countDocuments({otpAttemptedAt:{$exists:true}}),1);
});
test('inactive admin session sends no source request or OTP',async()=>{
 let calls=0;const old=global.fetch;global.fetch=async()=>{calls++;throw Error('must not call');};
 try{await assert.rejects(p.adminUser(db,'1'),/admin_session_required/);assert.equal(calls,0);}finally{global.fetch=old;}
});
test('cached token is reused without an OTP or admin call',async()=>{
 const j={_id:p.jobId('1'),runId:p.RUN,state:'acquiring',owner:'a',apxUserId:'1'};await db.collection(p.COL.jobs).insertOne(j);await db.collection('apxtestusertokens').insertOne({orgId:'2177599',apxUserId:'1',token:'fixture'});
 const old=global.fetch;global.fetch=async()=>{throw Error('must not call');};
 try{await p.acquire(client,db,j,'a');assert.equal((await db.collection(p.COL.jobs).findOne({_id:j._id})).state,'token_ready');assert.equal((await db.collection(p.COL.runs).findOne({_id:p.RUN})).otpReservations,0);}finally{global.fetch=old;}
});
test('capture persists completed flags and exceptions, leaves native progress untouched, and rerun makes no source calls',async()=>{
 const cid=new ObjectId(),cl=new ObjectId();const j={_id:p.jobId('1'),runId:p.RUN,state:'reading',owner:'a',apxUserId:'1',userId:String(new ObjectId()),priority:0,courses:[{courseId:String(cid),apxCourseId:'10'}]};
 await db.collection(p.COL.jobs).insertOne(j);await db.collection('apxtestusertokens').insertOne({orgId:'2177599',apxUserId:'1',token:'fixture'});
 await db.collection('courseclasses').insertOne({course:cid,class:cl,apxClassId:'7'});
 const native={_id:new ObjectId(),userId:j.userId,classId:String(cl),courseId:cid,manualCompleted:false,duration:10};await db.collection('classprogresses').insertOne(native);
 const old=global.fetch;let calls=0;global.fetch=async()=>{calls++;return{status:200,json:async()=>({status:200,data:{'7':'1','9':1}})};};
 try{await p.readCourses(db,j,'a',ObjectId);await p.readCourses(db,j,'a',ObjectId);
  assert.equal(calls,1);const c=await db.collection(p.COL.courses).findOne({runId:p.RUN});assert.equal(c.completedCount,2);assert.equal(c.mappedCount,1);assert.deepEqual(c.unmatched,['9']);assert.equal(c.classProgressWrites,0);
  assert.deepEqual(await db.collection('classprogresses').findOne({_id:native._id}),native);
 }finally{global.fetch=old;}
});

async function acquisitionFixture(){
 const j={_id:p.jobId('91'),runId:p.RUN,state:'acquiring',owner:'fixture',apxUserId:'91',priority:0};
 await db.collection(p.COL.jobs).insertOne(j);await db.collection('apxsessions').insertOne({orgId:'2177599',isActive:true,session_id:'FIXTURE'});return j;
}
const response=(status,body)=>({status,json:async()=>body});
for(const mode of ['recover','recoverNetwork','persistentNetwork','repeated_redirect','identity_mismatch','stop_during_retry']){
 test('post-OTP read handling: '+mode+' never sends OTP twice',async()=>{
  const j=await acquisitionFixture(),old=global.fetch;let admin=0,sends=0,verifies=0;
  global.fetch=async input=>{const u=new URL(input);
   if(u.pathname.endsWith('get_userdt_by_id')){admin++;if(admin===1)return response(200,{status:200,userdt:{id:'91',phone:'9999999999'}});
    if((mode==='recoverNetwork'&&admin===2)||(mode==='persistentNetwork'&&admin>=2))throw new TypeError('fixture admin transport interruption');
    if(mode==='identity_mismatch')return response(200,{status:200,userdt:{id:'92',otp:'123456'}});
    if(admin===2||mode==='repeated_redirect'){if(mode==='stop_during_retry')await db.collection(p.COL.runs).updateOne({_id:p.RUN},{$set:{stopped:true}});return response(307,null);}
    return response(200,{status:200,userdt:{id:'91',otp:'123456'}});
   }
   if(u.pathname.endsWith('sendotp')){sends++;return response(200,{status:200});}
   if(u.pathname.endsWith('otpverify')){verifies++;return response(200,{status:200,user:{userid:'91',token:'FIXTURE-TOKEN'}});}
   throw Error('unexpected endpoint');
  };
  try{
   const execute=()=>require('./vidyagram-apx-request-client.cjs').runJob(j,j.owner,'acquire',()=>p.acquire(client,db,j,j.owner));
   if(['recover','recoverNetwork'].includes(mode)){await execute();assert.equal(verifies,1);assert.equal(admin,3);assert.equal((await db.collection(p.COL.jobs).findOne({_id:j._id})).state,'token_ready');}
   else{await assert.rejects(execute(),mode==='stop_during_retry'?/pilot_stopped/:mode==='persistentNetwork'?/fixture admin transport/:/admin_session_or_identity_rejected/);assert.equal(verifies,0);assert.equal(admin,mode==='persistentNetwork'?4:mode==='repeated_redirect'?3:2);}
   assert.equal(sends,1);assert.equal((await db.collection(p.COL.runs).findOne({_id:p.RUN})).otpReservations,1);
  }finally{global.fetch=old;}
 });
}
test('reviewed stages preserve historical failures while enforcing three new failures',()=>{
 assert.equal(p.failureLimitReached({tokenFailures:3}),true);
 assert.equal(p.failureLimitReached({tokenFailures:3,tokenFailureBaseline:3}),false);
 assert.equal(p.failureLimitReached({tokenFailures:6,tokenFailureBaseline:3}),true);
 assert.equal(p.failureLimitReached({tokenFailures:3,tokenFailureBaseline:4}),true);
});
test('overnight continuation is finite and retains source throttle stops',()=>{
 assert.deepEqual(p.runSpec('vg-completion-20261104-overnight6000'),{maxUsers:6000,hours:8});
 assert.equal(p.stopsOnThrottle('vg-completion-20261104-overnight6000'),true);
 assert.deepEqual(p.pacingFor({priority:5999},30000,'vg-completion-20261104-overnight6000'),{experimentPhase:'overnight_fixed_30s',learnerGapMs:30000});
});
for(const mode of ['recover500','persistent500','recoverNetwork','blocked403','limited429','stopAfter500']){
 test('completion GET recovery: '+mode+' stays bounded and never invokes OTP endpoints',async()=>{
  const course=new ObjectId(),cls=new ObjectId();const j={_id:p.jobId('777'),runId:p.RUN,state:'reading',owner:'reader',apxUserId:'777',userId:String(new ObjectId()),priority:0,courses:[{courseId:String(course),apxCourseId:'12'}]};
  await db.collection(p.COL.jobs).insertOne(j);await db.collection('apxtestusertokens').insertOne({orgId:'2177599',apxUserId:'777',token:'FIXTURE'});await db.collection('courseclasses').insertOne({course,class:cls,apxClassId:'9'});
  const old=global.fetch;let calls=0;global.fetch=async input=>{assert.equal(new URL(input).pathname,'/get/getVideoCompletion');calls++;
   if(mode==='recoverNetwork'&&calls===1)throw new TypeError('fixture network interruption');
   if(mode==='blocked403')return response(403,null);if(mode==='limited429')return response(429,{status:429});
   if(mode==='persistent500'||calls===1&&mode!=='recoverNetwork'){if(mode==='stopAfter500')await db.collection(p.COL.runs).updateOne({_id:p.RUN},{$set:{stopped:true}});return response(500,null);}
   return response(200,{status:200,data:{'9':1}});
  };
  try{
   const run=()=>require('./vidyagram-apx-request-client.cjs').runJob(j,j.owner,'read',()=>p.readCourses(db,j,j.owner,ObjectId));
   if(['recover500','recoverNetwork'].includes(mode)){await run();assert.equal(calls,2);assert.equal((await db.collection(p.COL.jobs).findOne({_id:j._id})).state,'captured');}
   else{await assert.rejects(run());assert.equal(calls,mode==='persistent500'?3:1);if(mode==='persistent500'){await assert.rejects(run(),/completion_read_budget_exhausted/);assert.equal(calls,3);}}
   assert.equal(await db.collection('classprogresses').countDocuments({}),0);assert.equal((await db.collection(p.COL.runs).findOne({_id:p.RUN})).otpReservations,0);
  }finally{global.fetch=old;}
 });
}
for(const mode of ['staleThenFresh','missingThenFresh','persistentMissing','persistentStale','stopDuringPoll']){
 test('OTP readiness: '+mode+' polls only reads and sends/verifies at most once',async()=>{
  const j=await acquisitionFixture(),old=global.fetch;let admins=0,sends=0,verifies=0;
  const initial=mode==='missingThenFresh'||mode==='persistentMissing'?'':'111111';
  global.fetch=async input=>{const u=new URL(input);
   if(u.pathname.endsWith('get_userdt_by_id')){admins++;let otp=initial;if(admins>=3&&['staleThenFresh','missingThenFresh'].includes(mode))otp='222222';if(mode==='stopDuringPoll'&&admins===2)await db.collection(p.COL.runs).updateOne({_id:p.RUN},{$set:{stopped:true}});return response(200,{status:200,userdt:{id:'91',phone:'9999999999',otp}});}
   if(u.pathname.endsWith('sendotp')){sends++;return response(200,{status:200});}
   if(u.pathname.endsWith('otpverify')){verifies++;assert.equal(u.searchParams.get('otp'),'222222');return response(200,{status:200,user:{userid:'91',token:'fixture'}});}
   throw Error('unexpected endpoint');
  };
  try{const execute=()=>require('./vidyagram-apx-request-client.cjs').runJob(j,j.owner,'acquire',()=>p.acquire(client,db,j,j.owner));
   if(['staleThenFresh','missingThenFresh'].includes(mode)){await execute();assert.equal(verifies,1);assert.equal(admins,3);}
   else{await assert.rejects(execute(),mode==='stopDuringPoll'?/pilot_stopped/:mode==='persistentStale'?/otp_not_fresh/:/otp_not_available/);assert.equal(verifies,0);assert.equal(admins,mode==='stopDuringPoll'?2:5);}
   assert.equal(sends,1);assert.equal((await db.collection(p.COL.runs).findOne({_id:p.RUN})).otpReservations,1);
   const doc=await db.collection(p.COL.jobs).findOne({_id:j._id});const encoded=JSON.stringify(doc);for(const secret of ['111111','222222','9999999999'])assert.ok(!encoded.includes(secret));
  }finally{global.fetch=old;}
 });
}
test('large-batch safety keeps historical failures but stops a three-failure burst',()=>{
 const now=Date.now(),event=age=>({at:new Date(now-age),code:'otp_not_available'});
 assert.equal(p.failureLimitReached({tokenFailures:99,failureWindowMs:60000,acquisitionFailureEvents:[event(120000),event(30000),event(1000)]},now),false);
 assert.equal(p.failureLimitReached({tokenFailures:99,failureWindowMs:60000,acquisitionFailureEvents:[event(59000),event(30000),event(1000)]},now),true);
 assert.equal(p.failureLimitReached({tokenFailures:99,failureWindowMs:60000,acquisitionFailureEvents:[{at:'invalid'}]},now),true);
 assert.equal(p.failureLimitReached({tokenFailures:99,failureWindowMs:5000,acquisitionFailureEvents:[]},now),true);
 assert.equal(p.failureLimitReached({tokenFailures:99,failureWindowMs:60000},now),true);
});
test('OTP verification rejection records only a safe category and never replays verification',async()=>{
 const j=await acquisitionFixture(),old=global.fetch;let admins=0,sends=0,verifies=0;
 global.fetch=async input=>{const u=new URL(input);if(u.pathname.endsWith('get_userdt_by_id')){admins++;return response(200,{status:200,userdt:{id:'91',phone:'9999999999',otp:admins===1?'111111':'222222'}});}if(u.pathname.endsWith('sendotp')){sends++;return response(200,{status:200});}if(u.pathname.endsWith('otpverify')){verifies++;return response(203,{status:203,message:'Invalid OTP 222222 for 9999999999 SECRET'});}throw Error('unexpected endpoint');};
 try{await assert.rejects(require('./vidyagram-apx-request-client.cjs').runJob(j,j.owner,'acquire',()=>p.acquire(client,db,j,j.owner)),/otp_verify_or_identity_rejected/);assert.equal(sends,1);assert.equal(verifies,1);const doc=await db.collection(p.COL.jobs).findOne({_id:j._id});assert.equal(doc.verificationResult.category,'invalid_code');assert.equal(doc.verificationResult.http,203);for(const secret of ['111111','222222','9999999999','SECRET'])assert.ok(!JSON.stringify(doc).includes(secret));}finally{global.fetch=old;}
});
test('account auth deferral is opt-in and cannot swallow throttling, session or identity failures',async()=>{
 const policy={deferAccountAuth:true};
 for(const code of ['otp_not_available','otp_not_fresh','no_usable_contact'])assert.equal(p.deferAccountAuth(policy,code),true);
 assert.equal(p.deferAccountAuth(policy,'otp_verify_or_identity_rejected',203),true);
 for(const [code,http] of [['otp_verify_or_identity_rejected',200],['otp_verify_or_identity_rejected',403],['otp_verify_or_identity_rejected',429],['source_rate_limited',429],['admin_session_or_identity_rejected',307],['TypeError',undefined],['pilot_stopped',undefined]])assert.equal(p.deferAccountAuth(policy,code,http),false);
 assert.equal(p.deferAccountAuth({},'otp_not_available'),false);
 await db.collection(p.COL.jobs).insertMany([{_id:'deferred',runId:p.RUN,priority:0,state:'auth_deferred',otpAttemptedAt:new Date()},{_id:'next',runId:p.RUN,priority:1,state:'queued'}]);
 assert.equal((await p.claim(db,'acquire','a'))._id,'next');
 assert.equal(await p.claim(db,'read','r'),null);
 const now=Date.now(),event=age=>({at:new Date(now-age),code:'otp_not_available'});
 assert.equal(p.failureLimitReached({...policy,failureWindowMs:60000,acquisitionFailureEvents:[event(70000),event(1000),event(0)]},now),false);
 assert.equal(p.failureLimitReached({...policy,failureWindowMs:60000,acquisitionFailureEvents:[event(50000),event(1000),event(0)]},now),true);
});
test('worker skips an account auth failure, advances the queue, and still stops on a subsequent 403',async()=>{
 await db.collection(p.COL.runs).updateOne({_id:p.RUN},{$set:{deferAccountAuth:true,failureWindowMs:60000,acquisitionFailureEvents:[],tokenFailures:9}});
 await db.collection('apxsessions').insertOne({orgId:'2177599',isActive:true,session_id:'fixture'});
 await db.collection(p.COL.jobs).insertMany([{_id:p.jobId('91'),runId:p.RUN,apxUserId:'91',priority:0,state:'queued'},{_id:p.jobId('92'),runId:p.RUN,apxUserId:'92',priority:1,state:'queued'}]);
 const old=global.fetch;let calls=0;const cfg=require('./vidyagram-apx-request-client.cjs').clientFor(db).config,priorGap=cfg.learnerGapMs;cfg.learnerGapMs=1000;
 global.fetch=async input=>{const u=new URL(input);assert.ok(u.pathname.endsWith('get_userdt_by_id'));calls++;return u.searchParams.get('user_id')==='91'?response(200,{status:200,userdt:{id:'91'}}):response(403,{status:403});};
 try{await p.worker(client,db,'acquire',ObjectId);
  const a=await db.collection(p.COL.jobs).findOne({_id:p.jobId('91')}),b=await db.collection(p.COL.jobs).findOne({_id:p.jobId('92')}),run=await db.collection(p.COL.runs).findOne({_id:p.RUN});
  assert.equal(a.state,'auth_deferred');assert.equal(a.authDeferredReason,'no_usable_contact');assert.equal(a.otpAttemptedAt,undefined);assert.equal(b.state,'source_route_blocked');assert.equal(run.tokenFailures,10);assert.equal(run.authDeferred,1);assert.equal(run.stopped,true);assert.equal(run.status,'experiment_route_blocked');assert.equal(calls,2);
 }finally{global.fetch=old;cfg.learnerGapMs=priorGap;}
});
test('account guard separates isolated deferrals from service clusters and stops on an account failure spike',()=>{
 const now=Date.now(),outcome=kind=>({at:new Date(now),kind}),account={at:new Date(now),code:'otp_not_available'},service={at:new Date(now),code:'TypeError'};
 const policy={deferAccountAuth:true,accountFailureGuard:true,failureWindowMs:60000,tokenFailures:100,acquisitionOutcomes:Array.from({length:20},()=>outcome('success'))};
 assert.equal(p.failureLimitReached({...policy,acquisitionFailureEvents:[account,account,account]},now),false);
 assert.equal(p.failureLimitReached({...policy,acquisitionFailureEvents:[service,service,service]},now),true);
 assert.equal(p.accountFailureLimitReached({...policy,acquisitionOutcomes:Array.from({length:10},()=>outcome('account'))}),true);
 assert.equal(p.accountFailureLimitReached({...policy,acquisitionOutcomes:[...Array.from({length:14},()=>outcome('success')),...Array.from({length:6},()=>outcome('account'))]}),true);
 assert.equal(p.accountFailureLimitReached({...policy,acquisitionOutcomes:[...Array.from({length:15},()=>outcome('success')),...Array.from({length:5},()=>outcome('account'))]}),false);
 assert.equal(p.accountFailureLimitReached({...policy,acquisitionOutcomes:undefined}),true);
 assert.equal(p.accountFailureLimitReached({...policy,acquisitionOutcomes:[{at:'bad',kind:'success'}]}),true);
 assert.equal(p.accountFailureLimitReached({...policy,deferAccountAuth:false}),true);
});
for(const scenario of ['isolated','outage','degraded'])test('exhausted admin 307 handles '+scenario,async()=>{
 const outage=scenario!=='isolated';
 const runId=p.RUN, now=Date.now();
 await db.collection(p.COL.runs).updateOne({_id:runId},{$set:{
  deferAccountAuth:true,accountFailureGuard:true,acquisitionOutcomes:[],
  failureWindowMs:60000,acquisitionFailureEvents:[],acquireCeiling:2,
 }});
 await db.collection('apxsessions').insertOne({orgId:'2177599',isActive:true,session_id:'fixture'});
 await db.collection(p.COL.jobs).insertMany([
  {_id:p.jobId('91'),runId,apxUserId:'91',priority:0,state:'queued'},
  {_id:p.jobId('92'),runId,apxUserId:'92',priority:1,state:'queued'},
 ]);
 const requestClient=require('./vidyagram-apx-request-client.cjs');
 await db.collection(requestClient.METRICS).insertMany(['fixture-a','fixture-b','fixture-c'].map(workerHost=>({
  runId,workerHost,endpoint:'admin_user',httpStatus:307,at:new Date(now-70000),
 })));
 if(scenario==='degraded'){
  const recent=[40000,12000].flatMap(age=>[307,307,307,200].map((httpStatus,i)=>({
   runId,workerHost:'fixture-'+i,endpoint:'admin_user',httpStatus,apiStatus:httpStatus,at:new Date(now-age),
  })));
  await db.collection(requestClient.METRICS).insertMany(recent);
 }
 const old=global.fetch,cfg=requestClient.clientFor(db).config,priorGap=cfg.learnerGapMs;
 cfg.learnerGapMs=1000;
 let sends=0,verifies=0;
 global.fetch=async input=>{
  const u=new URL(input);
  if(u.pathname.endsWith('get_userdt_by_id')){
   const id=u.searchParams.get('user_id');
   if(id==='92')return response(200,{status:200,userdt:{id}});
   if(outage||sends)return response(307,null);
   return response(200,{status:200,userdt:{id,phone:'9999999999',otp:'111111'}});
  }
  if(u.pathname.endsWith('sendotp')){sends++;return response(200,{status:200});}
  if(u.pathname.endsWith('otpverify'))verifies++;
  throw Error('unexpected endpoint');
 };
 try{
  await p.worker(client,db,'acquire',ObjectId);
  const run=await db.collection(p.COL.runs).findOne({_id:runId});
  const affected=await db.collection(p.COL.jobs).findOne({_id:p.jobId('91')});
  const next=await db.collection(p.COL.jobs).findOne({_id:p.jobId('92')});
  assert.equal(run.status,outage?'admin_session_review':'checkpoint_review');
  assert.equal(affected.state,'auth_deferred');
  assert.equal(Boolean(affected.otpAttemptedAt),!outage);
  assert.equal(next.state,outage?'queued':'auth_deferred');
  assert.equal(sends,outage?0:1);
  assert.equal(verifies,0);
 }finally{global.fetch=old;cfg.learnerGapMs=priorGap;}
});
test('an in-flight successful acquisition cannot overwrite another worker stop status',async()=>{
 await db.collection('apxsessions').insertOne({orgId:'2177599',isActive:true,session_id:'fixture'});
 await db.collection(p.COL.jobs).insertOne({_id:p.jobId('91'),runId:p.RUN,apxUserId:'91',priority:0,state:'queued'});
 const old=global.fetch;let admins=0;
 global.fetch=async input=>{const u=new URL(input);
  if(u.pathname.endsWith('get_userdt_by_id'))return response(200,{status:200,userdt:{id:'91',phone:'9999999999',otp:++admins===1?'111111':'222222'}});
  if(u.pathname.endsWith('sendotp'))return response(200,{status:200});
  if(u.pathname.endsWith('otpverify')){await db.collection(p.COL.runs).updateOne({_id:p.RUN},{$set:{stopped:true,status:'experiment_throttled'}});return response(200,{status:200,user:{userid:'91',token:'fixture'}});}
  throw Error('unexpected endpoint');
 };
 try{await p.worker(client,db,'acquire',ObjectId);const run=await db.collection(p.COL.runs).findOne({_id:p.RUN});assert.equal(run.stopped,true);assert.equal(run.status,'experiment_throttled');assert.equal((await db.collection(p.COL.jobs).findOne({_id:p.jobId('91')})).state,'token_ready');}finally{global.fetch=old;}
});
for(const mode of ['recover','persistent','stopDuringRetry','identityMismatch','blocked403','limited429']){
 test('pre-OTP redirect: '+mode+' stays bounded without replaying OTP endpoints',async()=>{
  const j=await acquisitionFixture(),old=global.fetch;let admins=0,sends=0,verifies=0;
  global.fetch=async input=>{const u=new URL(input);
   if(u.pathname.endsWith('get_userdt_by_id')){admins++;
    if(mode==='blocked403')return response(403,{status:403});if(mode==='limited429')return response(429,{status:429});
    if(mode==='identityMismatch')return response(200,{status:200,userdt:{id:'92'}});
    if(mode==='persistent'||admins===1){if(mode==='stopDuringRetry')await db.collection(p.COL.runs).updateOne({_id:p.RUN},{$set:{stopped:true}});return response(307,null);}
    return response(200,{status:200,userdt:{id:'91',phone:'9999999999',otp:sends?'222222':'111111'}});
   }
   if(u.pathname.endsWith('sendotp')){sends++;return response(200,{status:200});}
   if(u.pathname.endsWith('otpverify')){verifies++;assert.equal(u.searchParams.get('otp'),'222222');return response(200,{status:200,user:{userid:'91',token:'fixture'}});}
   throw Error('unexpected endpoint');
  };
  try{const execute=()=>require('./vidyagram-apx-request-client.cjs').runJob(j,j.owner,'acquire',()=>p.acquire(client,db,j,j.owner));
   if(mode==='recover'){await execute();assert.equal(admins,3);assert.equal(sends,1);assert.equal(verifies,1);const saved=await db.collection(p.COL.jobs).findOne({_id:j._id});assert.equal(saved.preOtpAdminReadRetries,1);assert.ok(saved.preOtpAdminReadRecoveredAt);}
   else{await assert.rejects(execute());assert.equal(sends,0);assert.equal(verifies,0);assert.equal(admins,mode==='persistent'?3:1);assert.equal((await db.collection(p.COL.jobs).findOne({_id:j._id})).otpAttemptedAt,undefined);}
  }finally{global.fetch=old;}
 });
}
test('concurrent lower-priority stops cannot hide 429; 403 can supersede it',async()=>{
 await Promise.all([p.stopRun(db,'experiment_throttled',{code:'source_rate_limited',http:429}),p.stopRun(db,'admin_session_review',{code:'admin_session_required'})]);
 let r=await db.collection(p.COL.runs).findOne({_id:p.RUN});assert.equal(r.status,'experiment_throttled');assert.equal(r.stopCause.http,429);const at=+r.stoppedAt;
 await p.stopRun(db,'token_failures_stop',{code:'TimeoutError'});await p.stopRun(db,'admin_session_review',{code:'admin_shared_pause'});r=await db.collection(p.COL.runs).findOne({_id:p.RUN});assert.equal(r.status,'experiment_throttled');assert.equal(+r.stoppedAt,at);
 await p.stopRun(db,'experiment_route_blocked',{code:'source_access_denied',http:403});await p.stopRun(db,'experiment_throttled',{code:'source_rate_limited',http:429});r=await db.collection(p.COL.runs).findOne({_id:p.RUN});assert.equal(r.status,'experiment_route_blocked');assert.equal(r.stopCause.http,403);
});
test('shared admin pause that outlasts the max wait stops as throttling, without a session failure or new OTP',async()=>{
 await db.collection(p.COL.runs).updateOne({_id:p.RUN},{$set:{deferAccountAuth:true,failureWindowMs:60000,acquisitionFailureEvents:[],tokenFailures:0}});
 await db.collection('apxsessions').insertOne({orgId:'2177599',isActive:true,session_id:'fixture'});await db.collection('distributedlocks').insertOne({key:'apx-rate-limit-pause',expiresAt:new Date(Date.now()+60000)});
 await db.collection(p.COL.jobs).insertOne({_id:p.jobId('91'),runId:p.RUN,apxUserId:'91',priority:0,state:'queued'});
 const old=global.fetch;let calls=0;global.fetch=async()=>{calls++;throw Error('unexpected source call')};
 try{await p.worker(client,db,'acquire',ObjectId);const r=await db.collection(p.COL.runs).findOne({_id:p.RUN}),j=await db.collection(p.COL.jobs).findOne({_id:p.jobId('91')});assert.equal(r.status,'experiment_throttled');assert.equal(r.tokenFailures,0);assert.equal(j.state,'waiting_session');assert.equal(j.otpAttemptedAt,undefined);assert.equal(calls,0);}finally{global.fetch=old;}
});
test('admin lookup waits out a short shared pause, then reads once without stopping the run',async()=>{
 await db.collection('apxsessions').insertOne({orgId:'2177599',isActive:true,session_id:'fixture'});
 await db.collection('distributedlocks').insertOne({key:'apx-rate-limit-pause',expiresAt:new Date(Date.now()+700)});
 const old=global.fetch;let calls=0;global.fetch=async input=>{assert.equal(new URL(input).pathname,'/users/get_userdt_by_id');calls++;return response(200,{status:200,userdt:{id:'91',phone:'9999999999'}})};
 const started=Date.now();
 try{const user=await p.adminUser(db,'91');assert.equal(user.id,'91');assert.equal(calls,1);assert(Date.now()-started>=650,'did not wait for the pause');
  const r=await db.collection(p.COL.runs).findOne({_id:p.RUN});assert.equal(r.stopped,false);assert.equal(r.status,undefined);}finally{global.fetch=old;}
});
test('a shared pause that keeps renewing past the max wait raises admin_shared_pause without a source call',async()=>{
 await db.collection('apxsessions').insertOne({orgId:'2177599',isActive:true,session_id:'fixture'});
 await db.collection('distributedlocks').insertOne({key:'apx-rate-limit-pause',expiresAt:new Date(Date.now()+60000)});
 const old=global.fetch;let calls=0;global.fetch=async()=>{calls++;throw Error('must not call')};const started=Date.now();
 try{await assert.rejects(p.waitOutSharedPause(db),/admin_shared_pause/);assert.equal(calls,0);assert(Date.now()-started>=1400);}finally{global.fetch=old;}
});
test('a run stopped during a shared pause ends the wait as pilot_stopped',async()=>{
 await db.collection('distributedlocks').insertOne({key:'apx-rate-limit-pause',expiresAt:new Date(Date.now()+60000)});
 await db.collection(p.COL.runs).updateOne({_id:p.RUN},{$set:{stopped:true,status:'operator_stopped'}});
 await assert.rejects(p.waitOutSharedPause(db),/pilot_stopped/);
});
test('worker rides through a short shared pause: no throttle stop, job continues to its own outcome',async()=>{
 await db.collection(p.COL.runs).updateOne({_id:p.RUN},{$set:{deferAccountAuth:true,failureWindowMs:60000,acquisitionFailureEvents:[],tokenFailures:0}});
 await db.collection('apxsessions').insertOne({orgId:'2177599',isActive:true,session_id:'fixture'});
 await db.collection('distributedlocks').insertOne({key:'apx-rate-limit-pause',expiresAt:new Date(Date.now()+700)});
 await db.collection(p.COL.jobs).insertOne({_id:p.jobId('91'),runId:p.RUN,apxUserId:'91',priority:0,state:'queued'});
 const old=global.fetch;let calls=0;global.fetch=async input=>{assert.equal(new URL(input).pathname,'/users/get_userdt_by_id');calls++;return response(200,{status:200,userdt:{id:'91',phone:'',email:''}})};
 try{await p.worker(client,db,'acquire',ObjectId);const r=await db.collection(p.COL.runs).findOne({_id:p.RUN}),j=await db.collection(p.COL.jobs).findOne({_id:p.jobId('91')});
  assert.notEqual(r.status,'experiment_throttled');assert.equal(r.stopCause,undefined);assert.equal(j.state,'auth_deferred');assert.equal(j.lastError,'no_usable_contact');assert.equal(j.otpAttemptedAt,undefined);assert.equal(calls,1);}finally{global.fetch=old;}
});
test('a completion429 preserves throttle cause and cached read retry without OTP replay',async()=>{
 await db.collection(p.COL.runs).updateOne({_id:p.RUN},{$set:{deferAccountAuth:true}});const course=new ObjectId();
 await db.collection(p.COL.jobs).insertOne({_id:p.jobId('91'),runId:p.RUN,apxUserId:'91',priority:0,state:'token_ready',courses:[{courseId:String(course),apxCourseId:'12'}]});await db.collection('apxtestusertokens').insertOne({orgId:'2177599',apxUserId:'91',token:'fixture'});
 const old=global.fetch;let calls=0;global.fetch=async input=>{assert.equal(new URL(input).pathname,'/get/getVideoCompletion');calls++;return response(429,{status:429})};
 try{await p.worker(client,db,'read',ObjectId);const r=await db.collection(p.COL.runs).findOne({_id:p.RUN}),j=await db.collection(p.COL.jobs).findOne({_id:p.jobId('91')});assert.equal(r.status,'experiment_throttled');assert.equal(r.stopCause.http,429);assert.equal(j.state,'read_retry');assert.equal(j.lastError,'source_rate_limited');assert.equal(calls,1);await p.stopRun(db,'admin_session_review',{code:'admin_shared_pause'});assert.equal((await db.collection(p.COL.runs).findOne({_id:p.RUN})).status,'experiment_throttled');}finally{global.fetch=old;}
});
for(const secondRoute of [false,true])test('host-first429 defers the affected job without rerouting; shared trip='+secondRoute,async()=>{
 await db.collection(p.COL.runs).updateOne({_id:p.RUN},{$set:{throttleIsolation:true,deferAccountAuth:true,isolated429Events:secondRoute?[{at:new Date(),egressIp:'192.0.2.2'}]:[]}});
 const course=new ObjectId();await db.collection(p.COL.jobs).insertOne({_id:p.jobId('91'),runId:p.RUN,apxUserId:'91',priority:0,state:'token_ready',courses:[{courseId:String(course),apxCourseId:'12'}]});
 await db.collection('apxtestusertokens').insertOne({orgId:'2177599',apxUserId:'91',token:'fixture'});
 const old=global.fetch;let calls=0;global.fetch=async()=>{calls++;return response(429,{status:429});};
 try{await p.worker(client,db,'read',ObjectId);const run=await db.collection(p.COL.runs).findOne({_id:p.RUN}),job=await db.collection(p.COL.jobs).findOne({_id:p.jobId('91')});assert.equal(run.stopped,secondRoute);assert.equal(job.state,'read_rate_deferred');assert.equal(calls,1);assert.equal(await p.claim(db,'read','another-server'),null);if(secondRoute)assert.equal(run.stopCause.code,'multiple_routes_rate_limited');}finally{global.fetch=old;}
});
for(const secondRoute of [false,true])test('throttleCooldown: a 429 cools down only that IP and the run goes on; second IP in 30 min stops='+secondRoute,async()=>{
 process.env.VG_ROUTE_COOLDOWN_POLL_MS='50';
 await db.collection(p.COL.runs).updateOne({_id:p.RUN},{$set:{throttleCooldown:true,deferAccountAuth:true,route429Events:secondRoute?[{at:new Date(),egressIp:'192.0.2.2'}]:[]}});
 const course=new ObjectId();await db.collection(p.COL.jobs).insertOne({_id:p.jobId('91'),runId:p.RUN,apxUserId:'91',priority:0,state:'token_ready',courses:[{courseId:String(course),apxCourseId:'12'}]});
 await db.collection('apxtestusertokens').insertOne({orgId:'2177599',apxUserId:'91',token:'fixture'});
 const old=global.fetch;let calls=0;global.fetch=async()=>{calls++;return response(429,{status:429});};
 try{
  const w=p.worker(client,db,'read',ObjectId);
  for(let i=0;i<100&&(await db.collection(p.COL.jobs).findOne({_id:p.jobId('91')})).state!=='read_retry';i++)await new Promise(r=>setTimeout(r,50));
  await new Promise(r=>setTimeout(r,300));
  const run=await db.collection(p.COL.runs).findOne({_id:p.RUN}),job=await db.collection(p.COL.jobs).findOne({_id:p.jobId('91')});
  assert.equal(job.state,'read_retry');assert.equal(calls,1);assert.equal(run.stopped,secondRoute);
  if(secondRoute)assert.equal(run.stopCause.code,'multiple_routes_rate_limited');
  else{assert.equal(run.route429Events.length,1);assert.equal((await db.collection(p.COL.workers).findOne({host:require('node:os').hostname(),role:'read'})).state,'route_cooldown');}
  const ip=await db.collection('apx_vg_request_limits').findOne({_id:'ip:192.0.2.1'}),org=await db.collection('apx_vg_request_limits').findOne({_id:'org:2177599:all'});
  assert.ok(+ip.cooldownUntil>=Date.now()+14*60000);assert.notEqual(ip.rateLimitedHold,true);
  assert.ok(!org?.cooldownUntil||+org.cooldownUntil<=Date.now());assert.ok(!org?.last429At);
  assert.equal(await db.collection('distributedlocks').countDocuments({key:'apx-rate-limit-pause'}),0);
  await db.collection(p.COL.runs).updateOne({_id:p.RUN},{$set:{stopped:true}});await w;
 }finally{global.fetch=old;delete process.env.VG_ROUTE_COOLDOWN_POLL_MS;}
});
test('learner gap override applies only within 15-60 s, else the configured gap',()=>{
 assert.equal(p.effectiveLearnerGap({learnerGapOverrideMs:20000},30000),20000);
 for(const o of [undefined,null,14999,60001,'20000',20000.5])assert.equal(p.effectiveLearnerGap({learnerGapOverrideMs:o},30000),30000,String(o));
 assert.equal(p.effectiveLearnerGap(null,30000),30000);
});
