// Bounded VG completion capture. Captures source flags; NEVER writes ClassProgress.
// Commands: preview | seed | preflight | worker | status | stop
// worker roles: acquire (OTP only), read (cached-token reads), both.
'use strict';
const fs=require('fs'),path=require('path'),os=require('os'),crypto=require('crypto');
const requests=require('./vidyagram-apx-request-client.cjs');
const ORG='2177599', RUN=process.env.VG_COMPLETION_RUN||'vg-completion-20261103-pilot50';
const FOLLOW_ON_COHORTS=new Set(['vg-completion-20261108-next10000','vg-completion-20261109-next10000','vg-completion-20261112-next10000','vg-completion-20261113-next10000']);
const FRESH_COHORTS=new Set(['vg-completion-20261106-next10000',...FOLLOW_ON_COHORTS]);
const freshCohort=FRESH_COHORTS.has(RUN);
function runSpec(id){
 if(/^vg-completion-20261103-(pilot50|horizontal50|azure50)$/.test(id))return {maxUsers:50,hours:4};
 if(id==='vg-completion-20261103-fleet500')return {maxUsers:500,hours:8};
 if(id==='vg-completion-20261104-fleet2000')return {maxUsers:2000,hours:12};
 if(id==='vg-completion-20261104-overnight6000')return {maxUsers:6000,hours:8};
 if(id==='vg-completion-20261105-follow1000')return {maxUsers:1000,hours:8};
 if(FRESH_COHORTS.has(id))return {maxUsers:10000,hours:0};
 if(id==='vg-completion-20261105-fresh1')return {maxUsers:1,hours:1};
 if(id==='vg-completion-20261103-nohistory50')return {maxUsers:50,hours:4};
 throw new Error('Unapproved VG pilot run');
}
const {maxUsers:MAX_USERS,hours:RUN_HOURS}=runSpec(RUN);
function stopsOnThrottle(id=RUN){return id.endsWith('-azure50')||id.endsWith('-fleet500')||id.endsWith('-nohistory50')||id.endsWith('-fleet2000')||id.endsWith('-overnight6000')||id.endsWith('-follow1000')||id.endsWith('-fresh1')||FRESH_COHORTS.has(id);}
const COL={runs:'apx_vg_completion_pilots',jobs:'apx_vg_completion_jobs',courses:'apx_vg_completion_captures',workers:'apx_vg_completion_workers'};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const arr=x=>x==null?[]:Array.isArray(x)?x:[x];
class PilotError extends Error {constructor(code,http){super(code);this.code=code;this.http=http;}}
function pacingFor(job,configuredGap,runId=RUN){
 if(runId.endsWith('-overnight6000'))return {experimentPhase:'overnight_fixed_30s',learnerGapMs:configuredGap};
 if(runId.endsWith('-fleet500')||runId.endsWith('-fleet2000'))return {experimentPhase:configuredGap===30000?'fleet_30s':'fleet_60s',learnerGapMs:configuredGap};
 if(!runId.endsWith('-azure50'))return {experimentPhase:'steady',learnerGapMs:configuredGap};
 if(!Number.isInteger(job.priority)||job.priority<0||job.priority>=50)throw new PilotError('invalid_experiment_learner');
 return job.priority<10?{experimentPhase:'baseline_60s',learnerGapMs:60000}:{experimentPhase:'accelerated_30s',learnerGapMs:30000};
}
// Learner-gap trial: the rate trial sets learnerGapOverrideMs (15–60 s) on the run doc and its brake removes it; read every loop.
function effectiveLearnerGap(run,configuredGap){const o=run?.learnerGapOverrideMs;return Number.isSafeInteger(o)&&o>=15000&&o<=60000?o:configuredGap;}
async function ensureBaseline(db,runId=RUN){
 const ready=await db.collection(COL.jobs).countDocuments({runId,priority:{$lt:10},state:{$in:['captured','mapping_exception']},tokenSource:'minted'});
 const throttled=await db.collection(requests.METRICS).countDocuments({runId,$or:[{httpStatus:429},{apiStatus:429}]});
 if(ready!==10||throttled)throw new PilotError('experiment_baseline_not_ready');
}
function normalizeFlags(data){
 if(data!==null&&(!data||typeof data!=='object'||Array.isArray(data)))throw new PilotError('invalid_completion_shape');
 const flags={},invalid=[];
 for(const[id,v]of Object.entries(data||{})){
  if(!/^\d+$/.test(id)||![0,1,'0','1'].includes(v)){invalid.push(id);continue;}
  flags[id]=Number(v);
 }
 return {flags,invalidCount:invalid.length,completedIds:Object.keys(flags).filter(k=>flags[k]===1)};
}
function buildMapping(placements,localCourse,ledgerRows=[],apxCourseId=null){
 const m=new Map();
 for(const p of placements){
  if(String(p.course)!==String(localCourse))continue;
  const ids=[p.apxClassId,...arr(p.apxDisplayPlacements).map(x=>x.apxClassId)];
  for(const id of ids){if(id==null||!/^\d+$/.test(String(id)))continue;if(!m.has(String(id)))m.set(String(id),new Set());m.get(String(id)).add(String(p.class));}
 }
 const placed=new Set(placements.filter(p=>String(p.course)===String(localCourse)).map(p=>String(p.class)));
 for(const l of ledgerRows){
  if(!placed.has(String(l.classId)))continue;
  for(const p of arr(l.placements)){
   if(String(p.apxCourseId)!==String(apxCourseId)||!/^\d+$/.test(String(p.rowId)))continue;
   const id=String(p.rowId);if(!m.has(id))m.set(id,new Set());m.get(id).add(String(l.classId));
  }
 }
 return {unique:new Map([...m].filter(([,v])=>v.size===1).map(([k,v])=>[k,[...v][0]])),conflicts:new Set([...m].filter(([,v])=>v.size>1).map(([k])=>k))};
}
function jobId(apx){return `${ORG}:${apx}`;}
async function claim(db,role,owner){
 const now=new Date();
 const run=await db.collection(COL.runs).findOne({_id:RUN});
 if(!run||run.stopped||run.finishedAt||run.expiresAt<=now)return null;
 if(role!=='read'&&(run.readOnlyRecovery||run.otpRecovery&&
  (run.otpRecovery.phase!=='canary'||!(run.otpRecovery.deadline>now))))return null;
 const limit=run.otpRecovery?.phase==='canary'?run.otpRecovery.ceiling:run.acquireCeiling;
 const ceiling=role!=='read'&&Number.isInteger(limit)?{priority:{$lt:limit}}:{};
 const states=role==='read'?['token_ready','read_retry']:['queued','waiting_session'];
 return db.collection(COL.jobs).findOneAndUpdate({runId:RUN,...ceiling,state:{$in:states},$or:[{leaseUntil:{$exists:false}},{leaseUntil:{$lte:now}}]},{$set:{state:role==='read'?'reading':'acquiring',owner,leaseUntil:new Date(Date.now()+600000),updatedAt:now}},{sort:{priority:1,_id:1},returnDocument:'after',includeResultMetadata:false});
}
async function reserveOtp(client,db,job,owner){
 let result=false;const session=client.startSession();
 try{await session.withTransaction(async()=>{
  result=false;
  const now=new Date();
  const gate=await db.collection(COL.runs).updateOne({_id:RUN,stopped:{$ne:true},readOnlyRecovery:{$ne:true},expiresAt:{$gt:now},otpReservations:{$lt:MAX_USERS},
   $or:[{otpRecovery:{$exists:false}},{'otpRecovery.phase':'canary','otpRecovery.deadline':{$gt:now},'otpRecovery.ceiling':{$gt:job.priority??MAX_USERS}}]},
   {$inc:{otpReservations:1}},{session});
  if(!gate.modifiedCount){
   const run=await db.collection(COL.runs).findOne({_id:RUN},{session,projection:{otpRecovery:1}});
   throw new PilotError(run?.otpRecovery?'otp_acquisition_paused':'pilot_budget_or_stop');
  }
  const r=await db.collection(COL.jobs).updateOne({_id:job._id,runId:RUN,owner,state:'acquiring',otpAttemptedAt:{$exists:false}},{$set:{otpAttemptedAt:new Date(),acquisitionHost:owner.split(':')[0],updatedAt:new Date()}},{session});
  if(!r.modifiedCount)throw new PilotError('otp_already_reserved');
  result=true;
 },{readConcern:{level:'snapshot'},writeConcern:{w:'majority'}});}finally{await session.endSession();}
 return result;
}
function runtime(){
 const root=process.env.VG_APP_ROOT||process.cwd();const req=n=>require(require.resolve(n,{paths:[root]}));
 const envPath=process.env.VG_ENV_PATH||path.join(root,'.env.development');
 const env=req('dotenv').parse(fs.readFileSync(envPath));
 const uri=env.MONGO_URI;
 if(!/^mongodb(?:\+srv)?:\/\/[^/]+\/vidyagramdb(?:\?|$)/.test(uri||''))throw new PilotError('wrong_tenant_database');
 let driver;try{driver=req('mongodb');}catch{driver=req('mongoose').mongo;}
 const {MongoClient,ObjectId}=driver;
 return {client:new MongoClient(uri,{minPoolSize:0,maxPoolSize:3,readPreference:'primary',serverSelectionTimeoutMS:15000}),ObjectId};
}
const log=(event,data={})=>console.log(JSON.stringify({at:new Date().toISOString(),event,...data}));
async function getJSON(db,url,headers){return requests.clientFor(db).request(url,headers);}
async function adminRead(db,url,headers){
 for(let attempt=1;attempt<=3;attempt++){
  try{
   const r=await getJSON(db,url,headers);
   if([500,502,503,504].includes(r.http)||[500,502,503,504].includes(Number(r.body?.status)))throw new PilotError('admin_upstream_unavailable',r.http);
   return r;
  }catch(e){
   if(attempt===3||!['TypeError','TimeoutError'].includes(e.name)&&e.code!=='admin_upstream_unavailable')throw e;
   log('admin-read-retry',{attempt,http:e.http??null,error:e.name});
   await wait(attempt*2000);
  }
 }
}
// The VG backend writes apx-rate-limit-pause for 2 min after any AppX 429 and its own callers wait it out.
// Wait the same way (re-check every 5 s, spread the restart) instead of stopping the run. A pause that keeps
// renewing past the max wait (default 8 min, inside the 10 min job lease; 5 min until 11-13) still raises admin_shared_pause.
const SHARED_PAUSE_MAX_WAIT_MS=Number(process.env.VG_SHARED_PAUSE_MAX_WAIT_MS||480000);
const SHARED_PAUSE_SPREAD_MS=Number(process.env.VG_SHARED_PAUSE_SPREAD_MS??10000);
async function waitOutSharedPause(db){
 const started=Date.now();let waited=false;
 for(;;){
  const shared=await db.collection('distributedlocks').findOne({key:'apx-rate-limit-pause'},{projection:{expiresAt:1}});
  const until=shared?.expiresAt?+new Date(shared.expiresAt):0,now=Date.now();
  if(until<=now){
   if(!waited)return;
   waited=false;
   await wait(Math.floor(Math.random()*SHARED_PAUSE_SPREAD_MS));
   const again=await db.collection('distributedlocks').findOne({key:'apx-rate-limit-pause',expiresAt:{$gt:new Date()}},{projection:{_id:1}});
   if(!again){log('shared-pause-cleared',{waitedMs:Date.now()-started});return;}
   continue;
  }
  if(now-started>=SHARED_PAUSE_MAX_WAIT_MS)throw new PilotError('admin_shared_pause');
  if(!waited){waited=true;log('shared-pause-wait',{until:new Date(until).toISOString()});}
  if(!await control(db))throw new PilotError('pilot_stopped');
  await wait(Math.max(50,Math.min(5000,until-now+50,SHARED_PAUSE_MAX_WAIT_MS-(now-started))));
 }
}
async function adminUser(db,apx,allowInactive=false){
 await waitOutSharedPause(db);
 const s=await db.collection('apxsessions').findOne({orgId:ORG,...(allowInactive?{}:{isActive:{$ne:false}})});
 if(!s?.session_id)throw new PilotError('admin_session_required');
 const u=new URL('https://cms.appx.co.in/users/get_userdt_by_id');u.searchParams.set('user_id',apx);
 const r=await adminRead(db,u,{Accept:'application/json','Cookie':`ci_session=${s.session_id}`,'Referer':'https://cms.appx.co.in/reports/users','X-Requested-With':'XMLHttpRequest','User-Agent':'Mozilla/5.0','Cache-Control':'no-cache, no-store',Pragma:'no-cache'});
 if(r.http!==200||Number(r.body?.status)!==200||String(r.body?.userdt?.id)!==String(apx))throw new PilotError('admin_session_or_identity_rejected',r.http);
 return r.body.userdt;
}
// Pre-send redirects retry only the admin GET, before any OTP is reserved or sent.
async function preOtpAdminUser(db,job,owner){
 for(let attempt=0;attempt<3;attempt++){
  try{
   const user=await adminUser(db,job.apxUserId);
   if(attempt)await db.collection(COL.jobs).updateOne({_id:job._id,owner},{$set:{preOtpAdminReadRecoveredAt:new Date()}});
   return user;
  }catch(e){
   if(attempt===2||!(e instanceof PilotError)||e.code!=='admin_session_or_identity_rejected'||e.http!==307)throw e;
   const saved=await db.collection(COL.jobs).updateOne({_id:job._id,owner},{$inc:{preOtpAdminReadRetries:1}});
   if(saved.matchedCount!==1)throw new PilotError('job_lease_lost');
   log('pre-otp-admin-read-retry',{learner:job.priority+1,http:307,attempt:attempt+1});
   await wait((attempt+1)*2000);
   if(!await control(db))throw new PilotError('pilot_stopped');
  }
 }
}
// Post-send retries also read only: never re-enter acquire or replay send/verify.
async function postOtpAdminUser(db,job,owner){
 for(let attempt=0;attempt<2;attempt++){
  try{
   const user=await adminUser(db,job.apxUserId);
   if(attempt)await db.collection(COL.jobs).updateOne({_id:job._id,owner},{$set:{postOtpAdminReadRecoveredAt:new Date()}});
   return user;
  }catch(e){
   if(attempt||!(e instanceof PilotError)||e.code!=='admin_session_or_identity_rejected'||e.http!==307)throw e;
   const saved=await db.collection(COL.jobs).updateOne({_id:job._id,owner},{$inc:{postOtpAdminReadRetries:1}});
   if(saved.matchedCount!==1)throw new PilotError('job_lease_lost');
   log('post-otp-admin-read-retry',{learner:job.priority+1,http:307,attempt:1});
   await wait(2000);
   if(!await control(db))throw new PilotError('pilot_stopped');
  }
 }
}
async function freshOtpUser(db,job,owner,previousOtp,sentAt){
 const baseline=previousOtp==null?'':String(previousOtp).trim();let present=false;
 for(let check=1;check<=4;check++){
  if(!await control(db))throw new PilotError('pilot_stopped');
  const user=await postOtpAdminUser(db,job,owner),value=user.otp==null?'':String(user.otp).trim();
  present=value.length>0;const changed=present&&value!==baseline,ready=present&&(!baseline||changed);
  const saved=await db.collection(COL.jobs).updateOne({_id:job._id,owner},{$inc:{otpReadChecks:1},$set:{otpReadBaselinePresent:!!baseline,otpReadPresent:present,otpReadChanged:changed,otpReadReady:ready,otpReadAgeMs:Date.now()-sentAt,...(ready?{otpReadyAt:new Date()}: {})}});
  if(saved.matchedCount!==1)throw new PilotError('job_lease_lost');
  if(ready)return {...user,otp:value};
  log('otp-read-not-ready',{learner:job.priority+1,check,present,changed});
  if(check<4)await wait(check*2000);
 }
 throw new PilotError(present?'otp_not_fresh':'otp_not_available');
}
function verifyCategory(body){
 const message=String(body?.message||body?.msg||'');
 if(/expir/i.test(message))return 'expired_code';
 if(/(?:invalid|incorrect|wrong).*otp|otp.*(?:invalid|incorrect|wrong)/i.test(message))return 'invalid_code';
 if(/user.*(?:not.*(?:found|exist)|disabled)|account.*(?:disabled|not.*found)/i.test(message))return 'account_unavailable';
 return 'unclassified';
}
function recentServiceFailures(run,now){
 return run.acquisitionFailureEvents.filter(e=>+new Date(e.at)>=now-run.failureWindowMs&&!(run.accountFailureGuard===true&&deferAccountAuth(run,e.code,e.http)));
}
function failureLimitReached(run,now=Date.now()){
 if(accountFailureLimitReached(run))return true;
 if(run.failureWindowMs!==undefined){
  if(run.failureWindowMs!==60000||!Array.isArray(run.acquisitionFailureEvents)||run.acquisitionFailureEvents.some(e=>!Number.isFinite(+new Date(e.at))))return true;
  return recentServiceFailures(run,now).length>=3;
 }
 const base=run.tokenFailureBaseline??0;
 if(!Number.isSafeInteger(base)||base<0||base>(run.tokenFailures||0))return true;
 return (run.tokenFailures||0)-base>=3;
}
function deferAccountAuth(run,code,http){
 return run.deferAccountAuth===true&&(['otp_not_available','otp_not_fresh','no_usable_contact'].includes(code)||code==='otp_verify_or_identity_rejected'&&http===203);
}
async function adminRedirectOutage(db,trialStartedAt,now=Date.now()){
 const metrics=db.collection(requests.METRICS);
 const admin={runId:RUN,endpoint:'admin_user'};
 const noSuccessSince=new Date(now-60000);
 const [redirects]=await metrics.aggregate([
  {$match:{...admin,httpStatus:307,at:{$gte:new Date(Math.max(now-300000,+trialStartedAt||0))}}},
  {$group:{_id:null,hosts:{$addToSet:'$workerHost'},firstAt:{$min:'$at'}}},
 ]).toArray();
 if(!redirects||redirects.hosts.length<3||redirects.firstAt>noSuccessSince)return false;
 const windows=await metrics.aggregate([
  {$match:{...admin,at:{$gte:noSuccessSince},$or:[{httpStatus:307},{httpStatus:200,apiStatus:200}]}},
  {$group:{
   _id:{$gte:['$at',new Date(now-30000)]},
   redirects:{$sum:{$cond:[{$eq:['$httpStatus',307]},1,0]}},
   successes:{$sum:{$cond:[{$eq:['$httpStatus',200]},1,0]}},
  }},
 ]).toArray();
 return windows.every(window=>window.successes===0)||
  windows.length===2&&windows.every(window=>window.redirects>=3&&window.redirects>=window.successes);
}
function accountFailureLimitReached(run){
 if(run.accountFailureGuard!==true)return false;
 if(run.deferAccountAuth!==true||!Array.isArray(run.acquisitionOutcomes)||run.acquisitionOutcomes.some(e=>!['success','account','service'].includes(e.kind)||!Number.isFinite(+new Date(e.at))))return true;
 const sample=run.acquisitionOutcomes.slice(-50);
 return sample.length>=10&&sample.slice(-10).every(e=>e.kind==='account')||sample.length>=20&&sample.filter(e=>e.kind==='account').length/sample.length>=0.30;
}
const studentHeaders=(token,apx)=>({Accept:'*/*','Auth-Key':'appxapi','Client-Service':'Appx',...(token?{Authorization:token,'User-ID':apx}:{}),Origin:'https://vidyagram.online',Referer:'https://vidyagram.online/',source:'website','User-Agent':'Mozilla/5.0'});
async function control(db){
 const c=await db.collection(COL.runs).findOne({_id:RUN});
 if(!c||c.stopped||c.finishedAt||c.expiresAt<=new Date())return null;
 return c;
}
const STOP_PRIORITY={checkpoint_review:0,token_failures_stop:20,account_auth_failure_spike:20,experiment_baseline_failed:20,admin_session_review:30,experiment_throttled:40,experiment_route_blocked:50};
async function stopRun(db,status,cause={}){
 const priority=STOP_PRIORITY[status];if(priority===undefined)throw new PilotError('invalid_stop_status');
 const lower=Object.keys(STOP_PRIORITY).filter(key=>STOP_PRIORITY[key]<priority);
 return db.collection(COL.runs).updateOne({_id:RUN,$or:[{stopped:{$ne:true}},{status:{$in:lower}}]},{$set:{stopped:true,status,stopPriority:priority,stoppedAt:new Date(),stopCause:cause}});
}
async function* candidateOrderGroups(db,active,ObjectId,orderLimit,batchSize){
 const seen=new Set();
 let group=[];
 for await(const order of db.collection('orders').find(active,{projection:{userId:1}}).sort({_id:-1}).limit(orderLimit)){
  const uid=String(order.userId);
  if(seen.has(uid)||!ObjectId.isValid(uid))continue;
  seen.add(uid);
  group.push(uid);
  if(group.length===batchSize){yield group;group=[];}
 }
 if(group.length)yield group;
}
async function candidates(db,ObjectId){
 const courses=await db.collection('courses').find({apxCourseId:{$exists:true}},{projection:{apxCourseId:1}}).toArray();
 const vid=new Set((await db.collection('courseclasses').distinct('course')).map(String));
 const cm=new Map(courses.filter(c=>c.apxCourseId&&vid.has(String(c._id))).map(c=>[String(c._id),String(c.apxCourseId)]));
 const pm=new Map((await db.collection('plans').find({},{projection:{course:1}}).toArray()).map(p=>[String(p._id),arr(p.course).map(String)]));
 const claimed=new Set((await db.collection(COL.jobs).find({orgId:ORG},{projection:{apxUserId:1}}).toArray()).map(j=>String(j.apxUserId)));
 const cached=new Set((await db.collection('apxtestusertokens').find({orgId:ORG},{projection:{apxUserId:1}}).toArray()).map(t=>String(t.apxUserId)));
 const apxSeen=new Set(),jobs=[];let inspected=0;
 const active={orderStatus:'success',status:{$ne:0},grandTotal:{$gt:0},$or:[{expireDate:{$exists:false}},{expireDate:null},{expireDate:{$gte:new Date()}}]};
 const excludeCached=freshCohort||['-azure50','-fleet500','-fleet2000','-overnight6000','-follow1000'].some(suffix=>RUN.endsWith(suffix));
 const orderLimit=freshCohort?0:['-fleet2000','-overnight6000','-follow1000'].some(suffix=>RUN.endsWith(suffix))?100000:20000;
 // Recent purchases first, but require observed source viewing activity too.
 for await(const group of candidateOrderGroups(db,active,ObjectId,orderLimit,freshCohort?200:1)){
  const users=await db.collection('users').find({_id:{$in:group.map(uid=>new ObjectId(uid))},status:{$ne:0},usersApxId:{$exists:true,$nin:[null,'']}},{projection:{usersApxId:1,customer_id:1}}).toArray();
  const usersById=new Map(users.map(user=>[String(user._id),user]));
  const rawById=new Map(),ordersByUser=new Map();
  if(freshCohort){
   const sourceIds=[...new Set(users.filter(user=>Number(user.customer_id)===781).map(user=>String(user.usersApxId)).filter(apx=>/^\d+$/.test(apx)&&!apxSeen.has(apx)&&!claimed.has(apx)&&!cached.has(apx)))];
   const sourceRows=await db.collection('apx_user_course_test_detail').find({apxId:{$in:sourceIds.flatMap(apx=>[apx,Number(apx)])}},{projection:{apxId:1,'courses.courseId':1,'courses.data.merged_courses.video_duration_total':1}}).toArray();
   const rawBySourceValue=new Map(sourceRows.map(row=>[row.apxId,row]));
   for(const apx of sourceIds)rawById.set(apx,rawBySourceValue.get(apx)||rawBySourceValue.get(Number(apx)));
   const usersWithWatch=group.filter(uid=>{
    const user=usersById.get(String(new ObjectId(uid)));
    return arr(rawById.get(String(user?.usersApxId))?.courses).some(c=>arr(c.data?.merged_courses).some(e=>Number(e.video_duration_total)>0));
   });
   const orderRows=await db.collection('orders').find({...active,userId:{$in:usersWithWatch.flatMap(uid=>[uid,new ObjectId(uid)])}},{projection:{userId:1,courseId:1,latestCourseId:1,planId:1,build:1}}).toArray();
   for(const row of orderRows){
    const key=String(row.userId);
    if(!ordersByUser.has(key))ordersByUser.set(key,[]);
    ordersByUser.get(key).push(row);
   }
  }
  for(const uid of group){
  inspected++;
  const user=usersById.get(String(new ObjectId(uid)));
  if(!user||Number(user.customer_id)!==781)continue;
  const apx=String(user.usersApxId);if(!/^\d+$/.test(apx)||apxSeen.has(apx)||claimed.has(apx))continue;
  if(excludeCached&&cached.has(apx))continue;
  const raw=freshCohort?rawById.get(apx):await db.collection('apx_user_course_test_detail').findOne({apxId:{$in:[apx,Number(apx)]}},{projection:{'courses.courseId':1,'courses.data.merged_courses.video_duration_total':1}});
  const watched=new Set(arr(raw?.courses).filter(c=>arr(c.data?.merged_courses).some(e=>Number(e.video_duration_total)>0)).map(c=>String(c.courseId)));
  if(!watched.size)continue;
  const orders=freshCohort?(ordersByUser.get(uid)||[]):await db.collection('orders').find({...active,userId:{$in:[uid,new ObjectId(uid)]}},{projection:{courseId:1,latestCourseId:1,planId:1,build:1}}).toArray();
  const localIds=new Set(orders.flatMap(o=>[...arr(o.courseId),...arr(o.latestCourseId),...arr(o.planId).flatMap(p=>pm.get(String(p))||[]),...(o.build?.courseId?[o.build.courseId]:[])]).map(String));
  const relevant=[...localIds].filter(c=>cm.has(c)).map(c=>({courseId:c,apxCourseId:cm.get(c)}));
  if(!relevant.length||!relevant.some(c=>watched.has(c.apxCourseId)))continue;
  if(!freshCohort){
   const existing=await db.collection(COL.jobs).findOne({_id:jobId(apx)});if(existing&&existing.runId!==RUN)continue;
  }
  apxSeen.add(apx);jobs.push({_id:jobId(apx),runId:RUN,orgId:ORG,userId:uid,apxUserId:apx,courses:relevant,priority:jobs.length,selection:'recent positive-value unexpired purchase and positive source watch history',state:'queued',createdAt:new Date(),updatedAt:new Date()});
  if(jobs.length%50===0)log('cohort-progress',{selected:jobs.length,target:MAX_USERS,inspected});
  if(jobs.length===MAX_USERS)return {jobs,inspected};
  }
 }
 return {jobs,inspected};
}
// Random learners from the census no-history list (vidyagram-completion-history-census.cjs). Rechecks each one live.
async function noHistoryCandidates(db,ObjectId,apxIds,maxUsers=MAX_USERS){
 const courses=await db.collection('courses').find({apxCourseId:{$exists:true}},{projection:{apxCourseId:1}}).toArray();
 const vid=new Set((await db.collection('courseclasses').distinct('course')).map(String));
 const cm=new Map(courses.filter(c=>c.apxCourseId&&vid.has(String(c._id))).map(c=>[String(c._id),String(c.apxCourseId)]));
 const pm=new Map((await db.collection('plans').find({},{projection:{course:1}}).toArray()).map(p=>[String(p._id),arr(p.course).map(String)]));
 const claimed=new Set((await db.collection(COL.jobs).find({orgId:ORG},{projection:{apxUserId:1}}).toArray()).map(j=>String(j.apxUserId)));
 const cached=new Set((await db.collection('apxtestusertokens').find({orgId:ORG},{projection:{apxUserId:1}}).toArray()).map(t=>String(t.apxUserId)));
 const active={orderStatus:'success',status:{$ne:0},grandTotal:{$gt:0},$or:[{expireDate:{$exists:false}},{expireDate:null},{expireDate:{$gte:new Date()}}]};
 const pool=[...new Set(apxIds.map(String))];
 for(let i=pool.length-1;i>0;i--){const j=crypto.randomInt(i+1);[pool[i],pool[j]]=[pool[j],pool[i]];}
 const jobs=[];let inspected=0;
 for(const apx of pool){
  if(jobs.length===maxUsers)break;
  inspected++;
  if(!/^\d+$/.test(apx)||claimed.has(apx)||cached.has(apx))continue;
  const user=await db.collection('users').findOne({usersApxId:{$in:[apx,Number(apx)]},customer_id:781,status:{$ne:0}},{projection:{_id:1}});
  if(!user)continue;
  const uid=String(user._id);
  const orders=await db.collection('orders').find({...active,userId:{$in:[uid,new ObjectId(uid)]}},{projection:{courseId:1,latestCourseId:1,planId:1,build:1}}).toArray();
  const localIds=new Set(orders.flatMap(o=>[...arr(o.courseId),...arr(o.latestCourseId),...arr(o.planId).flatMap(p=>pm.get(String(p))||[]),...(o.build?.courseId?[o.build.courseId]:[])]).map(String));
  const relevant=[...localIds].filter(c=>cm.has(c)).map(c=>({courseId:c,apxCourseId:cm.get(c)}));
  if(!relevant.length)continue;
  const raw=await db.collection('apx_user_course_test_detail').findOne({apxId:{$in:[apx,Number(apx)]}},{projection:{'courses.courseId':1,'courses.data.merged_courses.video_duration_total':1}});
  const watched=new Set(arr(raw?.courses).filter(c=>arr(c.data?.merged_courses).some(e=>Number(e.video_duration_total)>0)).map(c=>String(c.courseId)));
  if(relevant.some(c=>watched.has(c.apxCourseId)))continue;
  if(await db.collection(COL.jobs).findOne({_id:jobId(apx)}))continue;
  jobs.push({_id:jobId(apx),runId:RUN,orgId:ORG,userId:uid,apxUserId:apx,courses:relevant,priority:jobs.length,selection:'random paid learner with no positive saved watch seconds on an owned course',state:'queued',createdAt:new Date(),updatedAt:new Date()});
 }
 return {jobs,inspected};
}
async function seed(client,db,ObjectId,commit){
 const existing=await db.collection(COL.runs).findOne({_id:RUN});
 if(existing){log('existing-pilot',{users:await db.collection(COL.jobs).countDocuments({runId:RUN}),state:existing.status});return;}
 if(RUN.endsWith('-overnight6000')&&Date.now()>=Date.parse('2026-11-04T03:30:00Z'))throw new PilotError('overnight_cutoff_passed');
 const {jobs,inspected}=RUN.endsWith('-nohistory50')?await noHistoryCandidates(db,ObjectId,fs.readFileSync(process.env.VG_NOHISTORY_LIST,'utf8').split('\n').filter(Boolean).map(l=>l.split('\t')[0])):await candidates(db,ObjectId);
 log('cohort-preview',{users:jobs.length,coursePairs:jobs.reduce((n,j)=>n+j.courses.length,0),inspected,realOtpMaximum:jobs.length,sourceOnly:true});
 if(!commit)return;
 if(!jobs.length||jobs.length>MAX_USERS||!FOLLOW_ON_COHORTS.has(RUN)&&jobs.length!==MAX_USERS)throw new PilotError('cohort_size_mismatch');
 const s=client.startSession();try{await s.withTransaction(async()=>{
  if(freshCohort&&await db.collection('apxtestusertokens').findOne({orgId:ORG,apxUserId:{$in:jobs.map(job=>job.apxUserId)}},{session:s,projection:{_id:1}}))throw new PilotError('cohort_cached_token_changed');
  await db.collection(COL.runs).insertOne({_id:RUN,tenant:'vidyagram',orgId:ORG,maxUsers:jobs.length,...(RUN.endsWith('-fleet2000')?{acquireCeiling:200,checkpointSize:200}:{}),otpReservations:0,otpSent:0,tokenFailures:0,stopped:false,status:'prepared',sourceOnly:true,createdAt:new Date(),expiresAt:new Date(Date.now()+RUN_HOURS*3600000),...(RUN.endsWith('-overnight6000')?{stopped:true,status:'queued_overnight',predecessorRun:'vg-completion-20261104-fleet2000',expiresAt:new Date('2026-11-04T03:30:00Z'),fixedPacing:{learnerGapMs:30000,adminGapMs:1000,requestGapMs:1500}}:{}),...(freshCohort?{stopped:true,status:'queued_prepared',acquireCeiling:0,expiresAt:new Date(0)}:{})},{session:s});
  await db.collection(COL.jobs).insertMany(jobs,{session:s});
 },{writeConcern:{w:'majority'}});}finally{await s.endSession();}
 log('pilot-seeded',{users:jobs.length});
}
async function acquire(client,db,job,owner){
 const tokens=db.collection('apxtestusertokens'),jobs=db.collection(COL.jobs);
 const cached=await tokens.findOne({orgId:ORG,apxUserId:job.apxUserId});
 if(cached?.token){await jobs.updateOne({_id:job._id,owner},{$set:{state:'token_ready',tokenSource:'cached',tokenSavedAt:cached.mintedAt,acquisitionHost:os.hostname(),acquisitionEgressIp:requests.clientFor(db).config.egress,leaseUntil:new Date(0),updatedAt:new Date()}});return;}
 const dt=await preOtpAdminUser(db,job,owner);
 const phone=String(dt.phone||'').trim(),email=String(dt.email||'').trim();
 const identifier=/^\+?\d{10,15}$/.test(phone)?phone:/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)?email:null;
 if(!identifier)throw new PilotError('no_usable_contact');
 if(!await control(db))throw new PilotError('pilot_stopped');
 await reserveOtp(client,db,job,owner); // Persist before external request: no automatic resend after an uncertain outcome.
 const send=new URL('https://armathsapi.akamai.net.in/get/sendotp');send.searchParams.set('phone',identifier);
 const sent=await getJSON(db,send,studentHeaders());
 if(sent.http!==200||!sent.body||Number(sent.body.status)!==200)throw new PilotError('otp_send_rejected',sent.http);
 await db.collection(COL.runs).updateOne({_id:RUN},{$inc:{otpSent:1}});
 const sentAt=Date.now();await jobs.updateOne({_id:job._id,owner},{$set:{otpSentAt:new Date(sentAt)}});
 await wait(1500);
 const fresh=await freshOtpUser(db,job,owner,dt.otp,sentAt);
 const verify=new URL('https://armathsapi.akamai.net.in/get/otpverify');
 for(const[k,v]of Object.entries({useremail:identifier,otp:String(fresh.otp),device_id:`WebBrowserMigrationVG${crypto.randomUUID()}`,mydeviceid:'',mydeviceid2:''}))verify.searchParams.set(k,v);
 const vr=await getJSON(db,verify,studentHeaders());
 await jobs.updateOne({_id:job._id,owner},{$set:{verificationResult:{http:vr.http,api:Number.isFinite(Number(vr.body?.status))?Number(vr.body.status):null,sourceIdentityMatches:String(vr.body?.user?.userid)===job.apxUserId,category:verifyCategory(vr.body)}}});
 if(vr.http!==200||Number(vr.body?.status)!==200||!vr.body.user?.token||String(vr.body.user.userid)!==job.apxUserId)throw new PilotError('otp_verify_or_identity_rejected',vr.http);
 const now=new Date();
 await tokens.updateOne({orgId:ORG,apxUserId:job.apxUserId},{$set:{token:vr.body.user.token,mintedAt:now,updatedAt:now},$setOnInsert:{orgId:ORG,apxUserId:job.apxUserId,createdAt:now}},{upsert:true});
 await jobs.updateOne({_id:job._id,owner},{$set:{state:'token_ready',tokenSource:'minted',tokenSavedAt:now,acquisitionHost:os.hostname(),acquisitionEgressIp:requests.clientFor(db).config.egress,leaseUntil:new Date(0),updatedAt:now}});
 log('token-saved',{learner:job.priority+1});
}
function transientCompletionError(e){
 return e.name==='TypeError'||e.name==='TimeoutError'||e.code==='completion_access_rejected'&&[500,502,503,504].some(n=>n===e.http||n===e.apiStatus);
}
async function completionRead(db,job,owner,course,url,headers){
 if(!/^\d+$/.test(String(course.apxCourseId)))throw new PilotError('invalid_completion_course');
 const field='completionReadAttempts.'+course.apxCourseId;
 for(;;){
  if(!await control(db))throw new PilotError('pilot_stopped');
  const saved=await db.collection(COL.jobs).findOneAndUpdate({_id:job._id,runId:RUN,owner,state:'reading',$or:[{[field]:{$exists:false}},{[field]:{$lt:3}}]},{$inc:{[field]:1},$set:{lastCompletionCourse:course.apxCourseId}},{returnDocument:'after',includeResultMetadata:false});
  if(!saved)throw new PilotError('completion_read_budget_exhausted');
  const attempt=saved.completionReadAttempts[String(course.apxCourseId)];
  try{
   const result=await getJSON(db,url,headers),api=Number(result.body?.status);
   if(result.http!==200||api!==200){const e=new PilotError('completion_access_rejected',result.http);e.apiStatus=api;throw e;}
   return result;
  }catch(e){
   if(attempt>=3||!transientCompletionError(e))throw e;
   log('completion-read-retry',{learner:job.priority+1,course:course.apxCourseId,attempt,http:e.http??null,error:e.name});
   await wait(attempt*2000);
  }
 }
}
async function readCourses(db,job,owner,ObjectId){
 const token=await db.collection('apxtestusertokens').findOne({orgId:ORG,apxUserId:job.apxUserId});if(!token?.token)throw new PilotError('cached_token_missing');
 for(const c of job.courses){
  if(!await control(db))throw new PilotError('pilot_stopped');
  const id=`${job._id}:${c.apxCourseId}`;
  if(await db.collection(COL.courses).findOne({_id:id,runId:RUN,state:{$in:['captured','mapping_exception']}}))continue;
  const u=new URL('https://armathsapi.akamai.net.in/get/getVideoCompletion');u.searchParams.set('item_id',c.apxCourseId);u.searchParams.set('item_type','10');
  const start=Date.now(),r=await completionRead(db,job,owner,c,u,studentHeaders(token.token,job.apxUserId));
  const f=normalizeFlags(r.body.data);
  const placements=await db.collection('courseclasses').find({course:new ObjectId(c.courseId)},{projection:{course:1,class:1,apxClassId:1,apxDisplayPlacements:1}}).toArray();
  const ledger=await db.collection('apxcatalogimports').find({'placements.apxCourseId':c.apxCourseId},{projection:{classId:1,placements:1}}).toArray();
  const mapping=buildMapping(placements,c.courseId,ledger,c.apxCourseId),mapped=[],unmatched=[];
  for(const video of f.completedIds){const cid=mapping.unique.get(video);if(cid)mapped.push({sourceVideoId:video,classId:cid});else unmatched.push(video);}
  await db.collection(COL.courses).updateOne({_id:id},{$set:{runId:RUN,orgId:ORG,userId:job.userId,apxUserId:job.apxUserId,...c,state:unmatched.length||f.invalidCount?'mapping_exception':'captured',flags:f.flags,invalidCount:f.invalidCount,completedCount:f.completedIds.length,mappedCount:new Set(mapped.map(m=>m.classId)).size,mapped,unmatched,fetchMs:Date.now()-start,fetchedAt:new Date(),mappingVersion:'vg-catalogue-ledger-and-display-v1',importState:'staged_prelaunch_review',classProgressWrites:0}},{upsert:true});
  await db.collection(COL.jobs).updateOne({_id:job._id,owner},{$set:{leaseUntil:new Date(Date.now()+600000),updatedAt:new Date()}});
  await wait(500);
 }
 const docs=await db.collection(COL.courses).find({runId:RUN,apxUserId:job.apxUserId},{projection:{state:1}}).toArray();
 await db.collection(COL.jobs).updateOne({_id:job._id,owner},{$set:{state:docs.some(d=>d.state==='mapping_exception')?'mapping_exception':'captured',readerHost:os.hostname(),capturedAt:new Date(),updatedAt:new Date(),leaseUntil:new Date(0)}});
 log('learner-captured',{learner:job.priority+1,courses:docs.length});
}
async function worker(client,db,role,ObjectId){
 if(!['acquire','read','both'].includes(role))throw new PilotError('invalid_worker_role');
 const owner=`${os.hostname()}:${role}:${process.pid}`,learnerGap=requests.clientFor(db).config.learnerGapMs;let nextOtp=0,lastSessionLog=0;
 const prior=await db.collection(COL.jobs).find({runId:RUN,$or:[{acquisitionHost:os.hostname()},{owner:{$regex:'^'+os.hostname().replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+':'}}],otpAttemptedAt:{$exists:true}}).sort({otpAttemptedAt:-1}).limit(1).toArray();
 if(prior[0])nextOtp=new Date(prior[0].otpSentAt||prior[0].otpAttemptedAt).getTime()+pacingFor(prior[0],learnerGap).learnerGapMs;
 let ctl;
 while((ctl=await control(db))){
  const gapNow=effectiveLearnerGap(ctl,learnerGap);
  const localRoute=await db.collection(requests.RATE).findOne({_id:`ip:${requests.clientFor(db).config.egress}`});
  if(localRoute?.rateLimitedHold){await db.collection(COL.workers).updateOne({_id:owner},{$set:{state:'rate_limited_hold',heartbeatAt:new Date()}},{upsert:true});return;}
  // This IP is cooling down after a 429 (throttleCooldown): wait without holding a job; other hosts carry on.
  if(localRoute?.cooldownUntil>new Date()){
   await db.collection(COL.workers).updateOne({_id:owner},{$set:{runId:RUN,role,host:os.hostname(),state:'route_cooldown',cooldownUntil:localRoute.cooldownUntil,heartbeatAt:new Date()}},{upsert:true});
   await wait(Math.max(50,Math.min(Number(process.env.VG_ROUTE_COOLDOWN_POLL_MS||30000),+localRoute.cooldownUntil-Date.now())));continue;
  }
  await db.collection(COL.workers).updateOne({_id:owner},{$set:{runId:RUN,role,host:os.hostname(),learnerGapMs:gapNow,gateClient:requests.GATE_CLIENT||'lock',egressIp:requests.clientFor(db).config.egress,requestGapMs:requests.clientFor(db).config.ipGapMs,adminGapMs:requests.clientFor(db).config.adminGapMs,heartbeatAt:new Date(),state:'running'}},{upsert:true});
  const sharedRate=await db.collection(requests.RATE).findOne({_id:'org:2177599:all'});
  if(sharedRate?.cooldownUntil>new Date()){await wait(2000);continue;}
  // Read-only retries never return to acquisition. Ambiguous OTP outcomes are terminal.
  await db.collection(COL.jobs).updateMany({runId:RUN,state:'reading',leaseUntil:{$lt:new Date()}},{$set:{state:'read_retry',leaseUntil:new Date(0)}});
  await db.collection(COL.jobs).updateMany({runId:RUN,state:'acquiring',leaseUntil:{$lt:new Date()},otpAttemptedAt:{$exists:true}},{$set:{state:'otp_outcome_uncertain',leaseUntil:new Date(0)}});
  await db.collection(COL.jobs).updateMany({runId:RUN,state:'acquiring',leaseUntil:{$lt:new Date()},otpAttemptedAt:{$exists:false}},{$set:{state:'queued',leaseUntil:new Date(0)}});
  let job,task;
  if(role!=='acquire'){job=await claim(db,'read',owner);if(job)task='read';}
  if(!job&&role!=='read'&&Date.now()>=nextOtp){
   const session=await db.collection('apxsessions').findOne({orgId:ORG,isActive:{$ne:false}},{projection:{_id:1}});
   if(session){job=await claim(db,'acquire',owner);if(job)task='acquire';}
   else if(Date.now()-lastSessionLog>60000){lastSessionLog=Date.now();log('waiting-admin-session');await db.collection(COL.runs).updateOne({_id:RUN},{$set:{status:'waiting_admin_session'}});}
  }
  if(!job){
   const cfg=await db.collection(COL.runs).findOne({_id:RUN});
   if(Number.isInteger(cfg?.acquireCeiling)&&cfg.acquireCeiling<MAX_USERS){
    const pending=await db.collection(COL.jobs).countDocuments({runId:RUN,priority:{$lt:cfg.acquireCeiling},state:{$in:['queued','waiting_session','acquiring','token_ready','reading','read_retry']}});
    if(!pending){await db.collection(COL.runs).updateOne({_id:RUN,stopped:{$ne:true}},{$set:{stopped:true,status:'checkpoint_review',checkpointAt:new Date()}});break;}
   }
   const remaining=await db.collection(COL.jobs).countDocuments({runId:RUN,state:{$in:cfg?.readOnlyRecovery?['token_ready','reading','read_retry']:['queued','waiting_session','acquiring','token_ready','reading','read_retry']}});
   if(!remaining){const exceptions=await db.collection(COL.jobs).countDocuments({runId:RUN,state:{$ne:'captured'}});await db.collection(COL.runs).updateOne({_id:RUN},{$set:{status:cfg?.readOnlyRecovery?'read_recovery_complete':exceptions?'capture_complete_with_exceptions':'capture_complete',finishedAt:new Date()}});break;}
   await wait(2000);continue;
  }
  try{
   if(task==='acquire'){
    const policy=pacingFor(job,gapNow);
    if(policy.experimentPhase==='accelerated_30s')await ensureBaseline(db);
    Object.assign(job,policy);
    await db.collection(COL.jobs).updateOne({_id:job._id,owner},{$set:policy});
    await db.collection(COL.runs).updateOne({_id:RUN},{$set:{experimentPhase:policy.experimentPhase,currentLearnerGapMs:policy.learnerGapMs}});
    nextOtp=Date.now()+policy.learnerGapMs;try{await requests.runJob(job,owner,'acquire',()=>acquire(client,db,job,owner));await db.collection(COL.runs).updateOne({_id:RUN},{$push:{acquisitionOutcomes:{$each:[{at:new Date(),kind:'success'}],$slice:-50}}});}finally{nextOtp=Date.now()+policy.learnerGapMs;}
   }
   else await requests.runJob(job,owner,'read',()=>readCourses(db,job,owner,ObjectId));
   await db.collection(COL.runs).updateOne({_id:RUN,stopped:{$ne:true},finishedAt:{$exists:false}},{$set:{status:'running',updatedAt:new Date()}});
  }catch(e){
   const code=e instanceof PilotError||e instanceof requests.RequestError?e.code:e.name;
   const latest=await db.collection(COL.jobs).findOne({_id:job._id},{projection:{otpAttemptedAt:1,readFailures:1}});
   const sessionError=['admin_session_required','admin_session_or_identity_rejected'].includes(code);
   const routeBlocked=e.http===403,limited=code==='source_rate_limited',quarantined=code==='source_route_quarantined',sharedPause=code==='admin_shared_pause',paused=limited||sharedPause||quarantined;
   const policy=await db.collection(COL.runs).findOne({_id:RUN});
   const cause={code,http:e.http??null,workerHost:os.hostname(),task};
   const isolated=policy.throttleIsolation===true&&(limited||quarantined);
   if(isolated&&limited){
    const egressIp=requests.clientFor(db).config.egress;
    await db.collection(requests.RATE).updateOne({_id:`ip:${egressIp}`},{$set:{rateLimitedHold:true,heldAt:new Date()}},{upsert:true});
    await db.collection(COL.runs).updateOne({_id:RUN},{$push:{isolated429Events:{$each:[{at:new Date(),egressIp,workerHost:os.hostname(),task}],$slice:-50}}});
    const latestPolicy=await db.collection(COL.runs).findOne({_id:RUN});
    const affected=new Set((latestPolicy.isolated429Events||[]).filter(x=>+new Date(x.at)>=Date.now()-1800000).map(x=>x.egressIp));
    if(affected.size>=2)await stopRun(db,'experiment_throttled',{...cause,code:'multiple_routes_rate_limited'});
   }
   // throttleCooldown: the request client cooled down only this IP; the run goes on unless a second IP was limited within 30 min.
   const routeCooled=policy.throttleCooldown===true&&policy.throttleIsolation!==true&&limited;
   if(routeCooled){
    const egressIp=requests.clientFor(db).config.egress;
    await db.collection(COL.runs).updateOne({_id:RUN},{$push:{route429Events:{$each:[{at:new Date(),egressIp,workerHost:os.hostname(),task}],$slice:-50}}});
    const latestPolicy=await db.collection(COL.runs).findOne({_id:RUN},{projection:{route429Events:1}});
    const affected=new Set((latestPolicy.route429Events||[]).filter(x=>+new Date(x.at)>=Date.now()-1800000).map(x=>x.egressIp));
    if(affected.size>=2)await stopRun(db,'experiment_throttled',{...cause,code:'multiple_routes_rate_limited'});
   }
   if((stopsOnThrottle()||policy.deferAccountAuth===true)&&(routeBlocked||paused&&!isolated&&!routeCooled&&!(policy.throttleIsolation===true&&sharedPause)))await stopRun(db,routeBlocked?'experiment_route_blocked':'experiment_throttled',cause);
   const otpTimeout=task==='acquire'&&code==='TimeoutError'&&['otp_send','otp_verify'].includes(e.apxEndpoint);
   const otpPaused=code==='otp_acquisition_paused';
   const redirectDeferred=task==='acquire'&&policy.deferAccountAuth===true&&code==='admin_session_or_identity_rejected'&&e.http===307;
   const deferred=redirectDeferred||task==='acquire'&&deferAccountAuth(policy,code,e.http);
   const state=otpPaused?(latest?.otpAttemptedAt?'otp_outcome_uncertain':'queued'):routeBlocked?'source_route_blocked':isolated?(task==='read'?'read_rate_deferred':latest?.otpAttemptedAt?'otp_outcome_uncertain':'waiting_rate_deferred'):paused?(task==='read'?'read_retry':latest?.otpAttemptedAt?'otp_outcome_uncertain':'waiting_session'):deferred?'auth_deferred':task==='acquire'?(sessionError&&!latest?.otpAttemptedAt?'waiting_session':'token_failed'):'read_failed';
   const failedJob={$set:{state,lastError:code,lastHttp:e.http??null,updatedAt:new Date(),leaseUntil:new Date(0),...(deferred?{authDeferredAt:new Date(),authDeferredReason:code}: {})}};
   if(!otpTimeout)await db.collection(COL.jobs).updateOne({_id:job._id,owner},failedJob);
   if(redirectDeferred)await db.collection(COL.runs).updateOne({_id:RUN},{$inc:{authDeferred:1}});
   else if(task==='acquire'&&['token_failed','auth_deferred'].includes(state)&&code!=='pilot_stopped')await db.collection(COL.runs).updateOne({_id:RUN},{$inc:{tokenFailures:1,...(deferred?{authDeferred:1}:{})},$push:{acquisitionFailureEvents:{$each:[{at:new Date(),code,http:e.http??null,...(otpTimeout?{otpTimeout:true}:{})}],$slice:-50},acquisitionOutcomes:{$each:[{at:new Date(),kind:deferred?'account':'service'}],$slice:-50}}});
   const run=await db.collection(COL.runs).findOne({_id:RUN});
   const now=Date.now();
   const failureLimit=failureLimitReached(run,now);
   const accountSpike=accountFailureLimitReached(run);
   const serviceEvents=run.otpTimeoutAutoRecovery&&run.failureWindowMs===60000&&Array.isArray(run.acquisitionFailureEvents)?recentServiceFailures(run,now):[];
   const otpBurst=!accountSpike&&serviceEvents.length>=3&&serviceEvents.every(event=>event.otpTimeout===true);
   if(run.otpTimeoutAutoRecovery&&otpTimeout&&!accountSpike&&run.otpRecovery?.phase==='canary'&&latest?.otpAttemptedAt>=run.otpRecovery.since){
    await db.collection(COL.runs).updateOne({_id:RUN,stopped:false,'otpRecovery.phase':'canary','otpRecovery.since':run.otpRecovery.since},{$set:{otpRecovery:{phase:'review',since:new Date(now),reason:'otp_timeout'}}});
   }else if(otpTimeout&&run.otpRecovery?.phase==='cooling'&&(!failureLimit||otpBurst)){
    await db.collection(COL.runs).updateOne({_id:RUN,stopped:false,'otpRecovery.phase':'cooling'},{$max:{'otpRecovery.retryAt':new Date(now+60000)}});
   }else if(otpBurst){
    await db.collection(COL.runs).updateOne({_id:RUN,stopped:false,otpRecovery:{$exists:false}},{$set:{otpRecovery:{phase:'cooling',since:new Date(now),retryAt:new Date(now+60000)}}});
   }else if(!run.readOnlyRecovery&&failureLimit)await stopRun(db,accountSpike?'account_auth_failure_spike':'token_failures_stop',cause);
   if(otpTimeout)await db.collection(COL.jobs).updateOne({_id:job._id,owner},failedJob);
   if(stopsOnThrottle()&&code==='experiment_baseline_not_ready')await stopRun(db,'experiment_baseline_failed',cause);
   if(policy.deferAccountAuth===true&&sessionError&&(!redirectDeferred||await adminRedirectOutage(db,policy.trialStartedAt)))await stopRun(db,'admin_session_review',cause);
   log('job-failed',{learner:job.priority+1,task,code,http:e.http??null});
   if(isolated){await db.collection(COL.workers).updateOne({_id:owner},{$set:{state:'rate_limited_hold',heartbeatAt:new Date()}});return;}
   if(routeBlocked){await db.collection(COL.workers).updateOne({_id:owner},{$set:{state:'source_route_blocked',heartbeatAt:new Date()}});return;}
  }
 }
 await db.collection(COL.workers).updateOne({_id:owner},{$set:{state:'stopped',heartbeatAt:new Date()}});
 log('worker-exit',{role});
}
async function status(db){
 const run=await db.collection(COL.runs).findOne({_id:RUN});
 const jobs=await db.collection(COL.jobs).aggregate([{$match:{runId:RUN}},{$group:{_id:'$state',n:{$sum:1}}}]).toArray();
 const captures=await db.collection(COL.courses).aggregate([{$match:{runId:RUN}},{$group:{_id:null,courses:{$sum:1},completed:{$sum:'$completedCount'},mapped:{$sum:'$mappedCount'},exceptions:{$sum:{$size:'$unmatched'}}}}]).toArray();
 log('pilot-status',{run,jobs,captures});
}
const MAPPING_VERSION='vg-catalogue-ledger-and-display-v1';
async function remap(db,ObjectId){
 let count=0;
 for await(const c of db.collection(COL.courses).find({runId:RUN,completedCount:{$gt:0},mappingVersion:{$ne:MAPPING_VERSION}})){
  const placements=await db.collection('courseclasses').find({course:new ObjectId(c.courseId)},{projection:{course:1,class:1,apxClassId:1,apxDisplayPlacements:1}}).toArray();
  const ledger=await db.collection('apxcatalogimports').find({'placements.apxCourseId':c.apxCourseId},{projection:{classId:1,placements:1}}).toArray();
  const m=buildMapping(placements,c.courseId,ledger,c.apxCourseId),mapped=[],unmatched=[];
  for(const[id,flag]of Object.entries(c.flags)){if(flag!==1)continue;const cls=m.unique.get(id);if(cls)mapped.push({sourceVideoId:id,classId:cls});else unmatched.push(id);}
  await db.collection(COL.courses).updateOne({_id:c._id,runId:RUN,fetchedAt:c.fetchedAt},{$set:{mappingVersion:MAPPING_VERSION,mapped,mappedCount:new Set(mapped.map(x=>x.classId)).size,unmatched,state:unmatched.length||c.invalidCount?'mapping_exception':'captured',mappedAt:new Date()}});count++;
 }
 for await(const j of db.collection(COL.jobs).find({runId:RUN,state:'mapping_exception'})){
  const docs=await db.collection(COL.courses).find({runId:RUN,apxUserId:j.apxUserId},{projection:{state:1}}).toArray();
  if(docs.length===j.courses.length&&docs.every(d=>d.state==='captured'))await db.collection(COL.jobs).updateOne({_id:j._id,state:'mapping_exception'},{$set:{state:'captured',updatedAt:new Date()}});
 }
 if(count)log('source-flags-remapped',{courses:count});
 return count;
}
async function main(){
 const {client,ObjectId}=runtime();await client.connect();const db=client.db('vidyagramdb');
 try{
  const cmd=process.argv[2]||'status';
  if(cmd==='preview'||cmd==='seed')await seed(client,db,ObjectId,cmd==='seed');
  else if(cmd==='worker')await worker(client,db,process.argv[3]||'both',ObjectId);
  else if(cmd==='canary'){
   const owner=`${os.hostname()}:canary:${process.pid}`;
   if(!await control(db))throw new PilotError('pilot_stopped');
   const j=await claim(db,'acquire',owner);if(!j)throw new PilotError('no_canary_job');
   try{
    await requests.runJob(j,owner,'acquire',()=>acquire(client,db,j,owner));
    const read=await db.collection(COL.jobs).findOneAndUpdate({_id:j._id,state:'token_ready',owner},{$set:{state:'reading',leaseUntil:new Date(Date.now()+600000)}},{returnDocument:'after',includeResultMetadata:false});
    if(!read)throw new PilotError('canary_token_not_ready');
    await requests.runJob(read,owner,'read',()=>readCourses(db,read,owner,ObjectId));
    log('canary-complete',{learner:j.priority+1});
   }catch(e){await db.collection(COL.jobs).updateOne({_id:j._id,owner},{$set:{state:'canary_failed',lastError:e instanceof PilotError?e.code:e.name,leaseUntil:new Date(0),updatedAt:new Date()}});throw e;}
  }
  else if(cmd==='stop'){await db.collection(COL.runs).updateOne({_id:RUN},{$set:{stopped:true,status:'operator_stopped',stoppedAt:new Date()}});await status(db);}
  else if(cmd==='status')await status(db);
  else if(cmd==='request-probe'){
   const t=await db.collection('apxtestusertokens').findOne({orgId:ORG},{sort:{mintedAt:-1}});if(!t)throw new PilotError('cached_probe_user_missing');
   const raw=await db.collection('apx_user_course_test_detail').findOne({apxId:{$in:[t.apxUserId,Number(t.apxUserId)]}},{projection:{'courses.courseId':1}});
   const course=raw?.courses?.[0]?.courseId;if(!course)throw new PilotError('cached_probe_course_missing');
   await adminUser(db,t.apxUserId);
   for(let i=0;i<2;i++){
    const u=new URL('https://armathsapi.akamai.net.in/get/getVideoCompletion');u.searchParams.set('item_id',String(course));u.searchParams.set('item_type','10');
    const r=await getJSON(db,u,studentHeaders(t.token,t.apxUserId));if(r.http!==200||Number(r.body?.status)!==200)throw new PilotError('cached_probe_failed',r.http);normalizeFlags(r.body.data);
   }
   log('paced-probe-complete',{requests:3,otpSent:0,egressIp:requests.clientFor(db).config.egress});
  }
  else if(cmd==='metrics-setup'){
   const rs=await db.admin().command({replSetGetStatus:1});if(rs.members.some(m=>m.health!==1))throw new PilotError('replica_set_unhealthy');
   await db.collection(requests.METRICS).createIndex({at:1},{expireAfterSeconds:604800,name:'request_metrics_7day',commitQuorum:'majority'});
   await db.collection(requests.METRICS).createIndex({runId:1,at:-1},{name:'run_recent_requests',commitQuorum:'majority'});
   log('request-metrics-ready',{retentionDays:7});
  }
  else if(cmd==='classify-blocked-routes'){
   const r=await db.collection(COL.jobs).updateMany({runId:RUN,state:'token_failed',lastHttp:403},{$set:{state:'source_route_blocked',updatedAt:new Date()}});
   const failures=await db.collection(COL.jobs).countDocuments({runId:RUN,state:'token_failed'});
   await db.collection(COL.runs).updateOne({_id:RUN},{$set:{tokenFailures:failures}});
   await db.collection(COL.workers).updateMany({runId:RUN,host:'instance-20260216-1825'},{$set:{state:'source_route_blocked',heartbeatAt:new Date()}});
   log('blocked-routes-classified',{jobs:r.modifiedCount,tokenFailures:failures});
  }
  else if(cmd==='remap')await remap(db,ObjectId);
  else if(cmd==='mapper'){
   const id=`${os.hostname()}:mapper:${process.pid}`;
   do{
    await remap(db,ObjectId);
    const c=await db.collection(COL.runs).findOne({_id:RUN});
    if(!c||c.stopped||c.finishedAt||c.expiresAt<=new Date())break;
    await db.collection(COL.workers).updateOne({_id:id},{$set:{runId:RUN,role:'mapping',host:os.hostname(),state:'running',heartbeatAt:new Date()}},{upsert:true});
    await wait(15000);
   }while(true);
   await db.collection(COL.workers).updateOne({_id:id},{$set:{state:'stopped',heartbeatAt:new Date()}});
  }
  else if(cmd==='preflight'||cmd==='activate-session'){
   const t=await db.collection('apxtestusertokens').findOne({orgId:ORG});if(!t)throw new PilotError('cached_probe_user_missing');
   const before=await db.collection('apxsessions').findOne({orgId:ORG},{projection:{session_id:1}});
   const dt=await adminUser(db,t.apxUserId,true);
   if(cmd==='activate-session')await db.collection('apxsessions').updateOne({orgId:ORG,session_id:before.session_id},{$set:{isActive:true,lastHttpStatus:200,lastCheckedAt:new Date(),lastError:null,consecutiveLoginRedirects:0,updatedAt:new Date()}});
   log('admin-preflight',{identityMatches:String(dt.id)===t.apxUserId,hasContact:!!(dt.phone||dt.email),activated:cmd==='activate-session'});
  }else throw new PilotError('unknown_command');
 }finally{await client.close();}
}
module.exports={RUN,COL,effectiveLearnerGap,MAX_USERS,waitOutSharedPause,preOtpAdminUser,postOtpAdminUser,failureLimitReached,accountFailureLimitReached,deferAccountAuth,stopRun,worker,PilotError,candidates,noHistoryCandidates,normalizeFlags,buildMapping,claim,reserveOtp,jobId,acquire,readCourses,adminUser,remap,pacingFor,ensureBaseline,runSpec,stopsOnThrottle};
if(require.main===module)main().catch(e=>{log('pilot-fatal',{code:e instanceof PilotError||e instanceof requests.RequestError?e.code:e.name,detailCode:typeof e.code==='string'?e.code:null,http:e.http??null});process.exitCode=1;});
