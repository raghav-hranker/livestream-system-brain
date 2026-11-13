// One authorised saved-token GET on the last throttled route; never resumes the fleet.
'use strict';
const fs=require('fs'),os=require('os');
const RUN='vg-completion-20261104-overnight6000',ID=RUN+':single-rate-check-20261104-2150';
const NOT_BEFORE=Date.parse('2026-11-04T16:20:00Z'),LAST_429=Date.parse('2026-11-04T15:18:46.120Z');
const root=process.env.VG_APP_ROOT||process.cwd();
function assert(x,msg){if(!x)throw Error(msg);}
async function main(){
 assert(Date.now()>=NOT_BEFORE,'too_early');
 assert(Date.now()<Date.parse('2026-11-04T18:29:59Z'),'diagnostic_expired');
 assert(os.hostname()==='migrator','wrong_host');
 const env=require(root+'/runtime/node_modules/dotenv').parse(fs.readFileSync(root+'/.env.development'));
 assert(/^mongodb(?:\+srv)?:\/\/[^/]+\/vidyagramdb(?:\?|$)/.test(env.MONGO_URI||''),'wrong_tenant');
 const {MongoClient}=require(root+'/runtime/node_modules/mongodb');
 const c=new MongoClient(env.MONGO_URI,{minPoolSize:0,maxPoolSize:3,readPreference:'primary',serverSelectionTimeoutMS:15000});
 try{
  await c.connect();const db=c.db('vidyagramdb'),runs=db.collection('apx_vg_completion_pilots'),jobs=db.collection('apx_vg_completion_jobs'),diagnostics=db.collection('apx_vg_completion_diagnostics');
  async function guard(){
   const run=await runs.findOne({_id:RUN}),rate=await db.collection('apx_vg_request_limits').findOne({_id:'org:2177599:all'});
   assert(run?.stopped===true&&run.status==='experiment_throttled'&&run.readOnlyRecovery===true,'run_state_changed');
   assert(new Date(run.expiresAt).getTime()>Date.now(),'run_expired');
   assert(rate?.maxConcurrent===1&&!rate.blocked&&new Date(rate.cooldownUntil).getTime()<=Date.now(),'rate_gate_not_ready');
   const latest=await db.collection('apx_vg_request_metrics').findOne({runId:RUN,$or:[{httpStatus:429},{apiStatus:429}]},{sort:{at:-1},projection:{at:1}});
   assert(new Date(latest?.at).getTime()===LAST_429&&Date.now()-LAST_429>=3600000,'rate_history_changed');
   assert(await db.collection('apx_vg_completion_workers').countDocuments({runId:RUN,state:'running',heartbeatAt:{$gte:new Date(Date.now()-600000)}})===0,'workers_active');
  }
  await guard();
  if(await diagnostics.findOne({_id:ID})){console.log(JSON.stringify({event:'single-rate-check-already-reserved'}));return;}
  const job=await jobs.findOne({runId:RUN,state:'read_retry',lastError:'source_rate_limited',lastHttp:429});
  assert(job,'failed_read_fixture_missing');
  const course=job.courses.find(x=>String(x.apxCourseId)===String(job.lastCompletionCourse));
  assert(course&&/^\d+$/.test(String(course.apxCourseId)),'failed_course_fixture_missing');
  const token=await db.collection('apxtestusertokens').findOne({orgId:'2177599',apxUserId:job.apxUserId});assert(token?.token,'saved_token_missing');
  const field='completionReadAttempts.'+course.apxCourseId;
  assert((job.completionReadAttempts?.[String(course.apxCourseId)]||0)<3,'read_budget_exhausted');
  try{await diagnostics.insertOne({_id:ID,runId:RUN,at:new Date(),state:'reserved',egressIp:'20.193.151.140',maxSourceCalls:1,otpSends:0});}catch(e){if(e.code===11000)return;throw e;}
  const reserved=await jobs.updateOne({_id:job._id,runId:RUN,state:'read_retry',lastError:'source_rate_limited',$or:[{[field]:{$exists:false}},{[field]:{$lt:3}}]},{$inc:{[field]:1}});
  assert(reserved.modifiedCount===1,'read_budget_reservation_failed');
  let calls=0,http=null,headers={},api=null,validShape=false,error=null;
  const requests=require('./vidyagram-apx-request-client.cjs');
  const client=requests.createClient(db,{runId:RUN,config:{egress:'20.193.151.140',ipGapMs:3000,adminGapMs:2000,learnerGapMs:60000,jitterMs:250,cooldownMs:60000},fetch:async(...args)=>{
   await guard();assert(calls++===0,'source_budget_exceeded');
   const r=await fetch(...args);http=r.status;
   for(const key of ['retry-after','ratelimit-limit','ratelimit-remaining','ratelimit-reset','x-ratelimit-limit','x-ratelimit-remaining','x-ratelimit-reset']){
    const v=r.headers.get(key);if(v&&/^\d+(?:\.\d+)?$/.test(v.trim()))headers[key]=Number(v);
    else if(key==='retry-after'&&v&&Number.isFinite(Date.parse(v)))headers[key]=new Date(v).toISOString();
   }
   return r;
  }});
  const u=new URL('https://armathsapi.akamai.net.in/get/getVideoCompletion');u.searchParams.set('item_id',course.apxCourseId);u.searchParams.set('item_type','10');
  try{const r=await client.request(u,{Accept:'*/*','Auth-Key':'appxapi','Client-Service':'Appx',Authorization:token.token,'User-ID':job.apxUserId,Origin:'https://vidyagram.online',Referer:'https://vidyagram.online/',source:'website','User-Agent':'Mozilla/5.0'});api=Number(r.body?.status)||null;const f=require('./vidyagram-completion-pilot.cjs').normalizeFlags(r.body?.data);validShape=f.invalidCount===0;}
  catch(e){error=['source_rate_limited','source_access_denied'].includes(e.code)?e.code:e.name;}
  const result={event:'single-rate-check-complete',at:new Date(),state:'finished',calls,http,api,validShape,safeRateHeaders:headers,error,otpSends:0,fleetResumed:false};
  await diagnostics.updateOne({_id:ID},{$set:result});console.log(JSON.stringify(result));
 }finally{await c.close();}
}
main().catch(e=>{console.error(JSON.stringify({event:'single-rate-check-aborted',error:/^[a-z_]+$/.test(e.message)?e.message:e.name}));process.exitCode=1;});
