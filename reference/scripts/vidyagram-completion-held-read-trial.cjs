// Bounded saved-token reads, one existing route, >=60s between calls. Fleet stays stopped.
// Default: three courses. --recover-pending: four pending learners, <=30 courses, 45min window.
'use strict';
const fs=require('fs'),os=require('os');
const RECOVER=process.argv.includes('--recover-pending'),MAX=RECOVER?30:3;
const RUN='vg-completion-20261104-overnight6000',ID=RUN+(RECOVER?':held-pending-recovery-20261105':':held-read-trial-20261104');
const deadline=Date.now()+45*60000;
const root=process.cwd(),assert=(ok,message)=>{if(!ok)throw Error(message);};
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function main(){
 assert(os.hostname()==='migrator','wrong_host');
 const env=require(root+'/runtime/node_modules/dotenv').parse(fs.readFileSync(root+'/.env.development'));
 assert(/^mongodb(?:\+srv)?:\/\/[^/]+\/vidyagramdb(?:\?|$)/.test(env.MONGO_URI||''),'wrong_tenant');
 const {MongoClient,ObjectId}=require(root+'/runtime/node_modules/mongodb');
 const conn=new MongoClient(env.MONGO_URI,{minPoolSize:0,maxPoolSize:3,readPreference:'primary',serverSelectionTimeoutMS:15000});
 const p=require('./vidyagram-completion-pilot.cjs'),requests=require('./vidyagram-apx-request-client.cjs');
 try{
  await conn.connect();const db=conn.db('vidyagramdb'),trials=db.collection('apx_vg_completion_diagnostics'),jobs=db.collection(p.COL.jobs),captures=db.collection(p.COL.courses);
  async function guard(){
   const run=await db.collection(p.COL.runs).findOne({_id:RUN});
   assert(run?.stopped&&run.status==='experiment_throttled'&&run.readOnlyRecovery,'run_state_changed');
   assert(RECOVER?Date.now()+30000<deadline:new Date(run.expiresAt)>new Date(Date.now()+30000),'recovery_window_expired');
   const rate=await db.collection(requests.RATE).findOne({_id:'org:2177599:all'});
   assert(rate?.maxConcurrent===1&&!rate.blocked&&new Date(rate.cooldownUntil)<=new Date(),'rate_gate_not_ready');
   assert(await db.collection(p.COL.workers).countDocuments({runId:RUN,state:'running',heartbeatAt:{$gte:new Date(Date.now()-600000)}})===0,'workers_active');
  }
  await guard();if(RECOVER){const passed=await trials.findOne({_id:RUN+':held-read-trial-20261104'});assert(passed?.state==='finished'&&passed?.calls===3&&passed?.stored===3,'prior_trial_not_passed');assert(await jobs.countDocuments({runId:RUN,state:{$in:['read_retry','read_failed']}})===4,'pending_cohort_changed');}
  const prior=await trials.findOne({_id:RUN+':single-rate-check-20261104-2150'});
  assert(prior?.http===200&&prior?.api===200&&prior?.calls===1,'diagnostic_prerequisite_failed');
  const candidates=[];let exhaustedCourses=0;
  for await(const job of jobs.find({runId:RUN,state:{$in:['read_retry','read_failed']}}).sort({priority:1})){
   const token=await db.collection('apxtestusertokens').findOne({orgId:'2177599',apxUserId:job.apxUserId});if(!token?.token)continue;
   for(const course of job.courses){
    if(!/^\d+$/.test(String(course.apxCourseId)))throw Error('invalid_course');
    if(await captures.findOne({_id:job._id+':'+course.apxCourseId,runId:RUN,state:{$in:['captured','mapping_exception']}}))continue;
    if((job.completionReadAttempts?.[String(course.apxCourseId)]||0)>=3){exhaustedCourses++;continue;}
    candidates.push({job,course,token});if(!RECOVER)break;
   }
   if(!RECOVER&&candidates.length===3)break;
  }
  assert(candidates.length>0,'no_budgeted_saved_reads');assert(candidates.length<=MAX,'course_budget_exceeded');
  console.log(JSON.stringify({event:'held-trial-preview',courses:candidates.length,exhaustedCourses,maxCalls:candidates.length,minimumGapMs:60000,otpSends:0,commit:process.argv.includes('--commit')}));
  if(!process.argv.includes('--commit'))return;
  try{await trials.insertOne({_id:ID,runId:RUN,at:new Date(),state:'reserved',maxSourceCalls:MAX,minimumGapMs:60000,otpSends:0,expiresAt:new Date(deadline),scope:RECOVER?'four_existing_saved_token_learners':'three_course_trial'});}catch(e){if(e.code===11000)throw Error('trial_already_reserved');throw e;}
  let calls=0,lastFinished=0,stored=0,learners=0;
  const client=requests.createClient(db,{runId:RUN,config:{egress:'20.193.151.140',ipGapMs:3000,adminGapMs:2000,learnerGapMs:60000,jitterMs:250,cooldownMs:60000},fetch:async(...args)=>{
   await guard();assert(calls<MAX,'source_budget_exceeded');calls++;await trials.updateOne({_id:ID},{$set:{calls,lastDispatchAt:new Date()}});return fetch(...args);
  }});
  try{
   for(const {job,course,token}of candidates){
    if(lastFinished)await pause(Math.max(0,60000-(Date.now()-lastFinished)));
    await guard();const field='completionReadAttempts.'+course.apxCourseId;
    const reserved=await jobs.updateOne({_id:job._id,runId:RUN,state:job.state,$or:[{[field]:{$exists:false}},{[field]:{$lt:3}}]},{$inc:{[field]:1}});
    assert(reserved.modifiedCount===1,'read_budget_changed');
    const u=new URL('https://armathsapi.akamai.net.in/get/getVideoCompletion');u.searchParams.set('item_id',course.apxCourseId);u.searchParams.set('item_type','10');
    const start=Date.now(),r=await client.request(u,{Accept:'*/*','Auth-Key':'appxapi','Client-Service':'Appx',Authorization:token.token,'User-ID':job.apxUserId,Origin:'https://vidyagram.online',Referer:'https://vidyagram.online/',source:'website','User-Agent':'Mozilla/5.0'});lastFinished=Date.now();
    assert(r.http===200&&Number(r.body?.status)===200,'completion_non200');const f=p.normalizeFlags(r.body?.data);assert(f.invalidCount===0,'invalid_completion_flags');
    const placements=await db.collection('courseclasses').find({course:new ObjectId(course.courseId)},{projection:{course:1,class:1,apxClassId:1,apxDisplayPlacements:1}}).toArray();
    const ledger=await db.collection('apxcatalogimports').find({'placements.apxCourseId':course.apxCourseId},{projection:{classId:1,placements:1}}).toArray();
    const mapping=p.buildMapping(placements,course.courseId,ledger,course.apxCourseId),mapped=[],unmatched=[];
    for(const video of f.completedIds){const id=mapping.unique.get(video);if(id)mapped.push({sourceVideoId:video,classId:id});else unmatched.push(video);}
    const capture={runId:RUN,orgId:'2177599',userId:job.userId,apxUserId:job.apxUserId,...course,state:unmatched.length?'mapping_exception':'captured',flags:f.flags,invalidCount:0,completedCount:f.completedIds.length,mappedCount:new Set(mapped.map(x=>x.classId)).size,mapped,unmatched,fetchMs:lastFinished-start,fetchedAt:new Date(),mappingVersion:'vg-catalogue-ledger-and-display-v1',importState:'staged_prelaunch_review',classProgressWrites:0};
    await captures.updateOne({_id:job._id+':'+course.apxCourseId},{$set:capture},{upsert:true});stored++;
    const done=await captures.find({runId:RUN,apxUserId:job.apxUserId,state:{$in:['captured','mapping_exception']}},{projection:{apxCourseId:1,state:1}}).toArray();
    if(job.courses.every(x=>done.some(d=>String(d.apxCourseId)===String(x.apxCourseId)))){
     const updated=await jobs.updateOne({_id:job._id,runId:RUN,state:job.state},{$set:{state:done.some(x=>x.state==='mapping_exception')?'mapping_exception':'captured',capturedAt:new Date(),updatedAt:new Date(),readerHost:os.hostname(),leaseUntil:new Date(0)}});learners+=updated.modifiedCount;
    }
    console.log(JSON.stringify({event:'held-trial-course-stored',calls,stored,learners,dataWasNull:r.body.data===null,flags:Object.keys(f.flags).length,completed:f.completedIds.length,mapped:capture.mappedCount,unmatched:unmatched.length}));
   }
   await trials.updateOne({_id:ID},{$set:{state:'finished',finishedAt:new Date(),calls,stored,learners,fleetResumed:false}});
  }catch(e){const error=e.code||e.message||e.name;await trials.updateOne({_id:ID},{$set:{state:'halted',finishedAt:new Date(),calls,stored,learners,error:/^[a-z_]+$/.test(error)?error:e.name,http:e.http??null,fleetResumed:false}});throw e;}
  console.log(JSON.stringify({event:'held-trial-finished',calls,stored,learners,otpSends:0,fleetResumed:false}));
 }finally{await conn.close();}
}
main().catch(e=>{console.error(JSON.stringify({event:'held-trial-aborted',error:/^[a-z_]+$/.test(e.code||e.message)?e.code||e.message:e.name,http:e.http??null}));process.exitCode=1;});
