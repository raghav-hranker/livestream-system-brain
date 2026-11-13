// Explicitly authorised one-fresh-learner acquisition test. Never activates the fleet.
'use strict';
const fs=require('fs'),os=require('os');
const RUN='vg-completion-20261105-fresh1',OLD='vg-completion-20261104-overnight6000';
process.env.VG_COMPLETION_RUN=RUN;process.env.VG_EGRESS_ID='20.193.151.140';process.env.VG_REQUEST_GAP_MS='7500';process.env.VG_ADMIN_GAP_MS='2000';process.env.VG_LEARNER_GAP_MS='60000';
const root=process.cwd(),assert=(x,m)=>{if(!x)throw Error(m);};
async function main(){
 assert(os.hostname()==='migrator','wrong_host');
 const env=require(root+'/runtime/node_modules/dotenv').parse(fs.readFileSync(root+'/.env.development'));
 assert(/^mongodb(?:\+srv)?:\/\/[^/]+\/vidyagramdb(?:\?|$)/.test(env.MONGO_URI||''),'wrong_tenant');
 const {MongoClient}=require(root+'/runtime/node_modules/mongodb'),p=require('./vidyagram-completion-pilot.cjs'),requests=require('./vidyagram-apx-request-client.cjs');
 const c=new MongoClient(env.MONGO_URI,{minPoolSize:0,maxPoolSize:3,readPreference:'primary',serverSelectionTimeoutMS:15000});
 try{
  await c.connect();const db=c.db('vidyagramdb'),runs=db.collection(p.COL.runs),jobs=db.collection(p.COL.jobs),audits=db.collection('apx_vg_completion_diagnostics');
  assert(!await runs.findOne({_id:RUN}),'fresh_test_already_reserved');
  const old=await runs.findOne({_id:OLD});assert(old?.stopped&&old.status==='account_auth_failure_spike','unexpected_fleet_state');
  assert(await db.collection(p.COL.workers).countDocuments({runId:{$in:[OLD,'vg-completion-20261105-follow1000']},state:'running',heartbeatAt:{$gte:new Date(Date.now()-600000)}})===0,'workers_active');
  const route=await db.collection(requests.RATE).findOne({_id:'ip:20.193.151.140'}),shared=await db.collection(requests.RATE).findOne({_id:'org:2177599:all'});
  assert(!route?.blocked&&!route?.rateLimitedHold&&!shared?.blocked&&shared?.maxConcurrent===1,'route_unavailable');
  assert([route,shared].every(x=>!x?.cooldownUntil||new Date(x.cooldownUntil)<=new Date()),'cooldown_active');
  let job;
  for await(const candidate of jobs.find({runId:OLD,state:'queued',otpAttemptedAt:{$exists:false}}).sort({priority:1})){
   if(!await db.collection('apxtestusertokens').findOne({orgId:'2177599',apxUserId:candidate.apxUserId})){job=candidate;break;}
  }
  assert(job,'fresh_candidate_missing');console.log(JSON.stringify({event:'fresh1-preview',learners:1,maxOtpSends:1,maxVerifyCalls:1,fleetResumed:false,commit:process.argv.includes('--commit')}));
  if(!process.argv.includes('--commit'))return;
  const owner='migrator:fresh1:'+process.pid,expiry=new Date(Date.now()+600000),s=c.startSession();
  try{await s.withTransaction(async()=>{
   await audits.insertOne({_id:RUN,at:new Date(),state:'reserved',beforeJob:job,originRun:OLD,maxOtpSends:1},{session:s});
   await runs.insertOne({_id:RUN,tenant:'vidyagram',orgId:'2177599',maxUsers:1,otpReservations:0,otpSent:0,stopped:false,status:'freshness_test',createdAt:new Date(),expiresAt:expiry,sourceOnly:true},{session:s});
   const changed=await jobs.updateOne({_id:job._id,runId:OLD,state:'queued',otpAttemptedAt:{$exists:false}},{$set:{runId:RUN,state:'acquiring',owner,priority:0,leaseUntil:expiry,updatedAt:new Date()}},{session:s});assert(changed.modifiedCount===1,'candidate_changed');
  },{readConcern:{level:'snapshot'},writeConcern:{w:'majority'}});}finally{await s.endSession();}
  const actual=await jobs.findOne({_id:job._id}),counts={admin:0,send:0,verify:0},native=global.fetch;
  global.fetch=async(input,init)=>{
   const pathname=new URL(input).pathname,key=pathname==='/users/get_userdt_by_id'?'admin':pathname==='/get/sendotp'?'send':pathname==='/get/otpverify'?'verify':null;
   assert(key,'unexpected_test_endpoint');counts[key]++;assert(counts.send<=1&&counts.verify<=1&&counts.admin<=5,'test_request_budget_exceeded');return native(input,init);
  };
  let error=null,http=null;
  try{await requests.runJob(actual,owner,'acquire',()=>p.acquire(c,db,actual,owner));}catch(e){error=e.code||e.name;http=e.http??null;}finally{global.fetch=native;}
  const saved=await jobs.findOne({_id:job._id}),test=await runs.findOne({_id:RUN}),success=!error&&saved.state==='token_ready'&&saved.tokenSource==='minted';
  let state=success?'token_ready':p.deferAccountAuth({deferAccountAuth:true},error,http)?'auth_deferred':saved.otpAttemptedAt?'otp_outcome_uncertain':'queued';
  const session=c.startSession();try{await session.withTransaction(async()=>{
   await runs.updateOne({_id:RUN},{$set:{stopped:true,status:success?'freshness_test_passed':'freshness_test_failed',finishedAt:new Date()}},{session});
   const changed=await jobs.updateOne({_id:job._id,runId:RUN,owner},{$set:{runId:OLD,priority:job.priority,state,freshnessTestRun:RUN,updatedAt:new Date(),leaseUntil:new Date(0),...(!success?{lastError:error,lastHttp:http}:{}),...(state==='auth_deferred'?{authDeferredAt:new Date(),authDeferredReason:error}:{})}},{session});assert(changed.modifiedCount===1,'test_restore_changed');
   if(state==='auth_deferred')await runs.updateOne({_id:OLD,stopped:true},{$inc:{authDeferred:1,tokenFailures:1}},{session});
   await audits.updateOne({_id:RUN},{$set:{state:success?'passed':'failed',finishedAt:new Date(),http,error,counts,otpReservations:test.otpReservations,otpSent:test.otpSent,ready:saved.otpReadReady||false,otpPresent:saved.otpReadPresent||false,otpChanged:saved.otpReadChanged||false,readChecks:saved.otpReadChecks||0,readAgeMs:saved.otpReadAgeMs||0,verification:saved.verificationResult||null,restoredToOrigin:true,fleetResumed:false}},{session});
  },{writeConcern:{w:'majority'}});}finally{await session.endSession();}
  console.log(JSON.stringify({event:'fresh1-result',success,error,http,counts,otpReservations:test.otpReservations,otpSent:test.otpSent,ready:saved.otpReadReady||false,otpChanged:saved.otpReadChanged||false,readChecks:saved.otpReadChecks||0,readAgeMs:saved.otpReadAgeMs||0,verification:saved.verificationResult||null,jobState:state,fleetResumed:false}));
 }finally{await c.close();}
}
main().catch(e=>{console.error(JSON.stringify({event:'fresh1-aborted',error:/^[a-z_]+$/.test(e.message||'')?e.message:e.name}));process.exitCode=1;});
