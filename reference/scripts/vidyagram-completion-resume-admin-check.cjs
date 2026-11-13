// No-OTP admin identity check before a resume. Run from ~/vidyagram-completion-azure-20261103 with VG_COMPLETION_RUN etc. set.
const fs=require('node:fs');
const dep=name=>require(require.resolve(name,{paths:[process.cwd()+'/runtime']}));
const uri=dep('dotenv').parse(fs.readFileSync('.env.development')).MONGO_URI;
if(!/^mongodb(?:\+srv)?:\/\/[^/]+\/vidyagramdb(?:\?|$)/.test(uri||''))process.exit(2);
const client=new (dep('mongodb').MongoClient)(uri,{readPreference:'primary',serverSelectionTimeoutMS:8000});
// VG_PILOT_PATH: the cohort's pilot (later cohorts need a pilot that knows their run id).
const pilot=require(process.env.VG_PILOT_PATH||'./fleet800-cohort-20261109-wait/vidyagram-completion-pilot.cjs');
(async()=>{try{
 const db=client.db('vidyagramdb');
 const run=await db.collection(pilot.COL.runs).findOne({_id:pilot.RUN,stopped:true,$or:[{status:{$in:['experiment_throttled','checkpoint_review','token_failures_stop','trial_controller_recovered']}},
   // Same stale-OTP spike resume-next.cjs accepts.
   {status:'account_auth_failure_spike','stopCause.code':{$in:['otp_not_fresh','otp_not_available']},'stopCause.http':null}]},{projection:{_id:1}});
 if(!run)throw Error('run_changed');
 const job=await db.collection(pilot.COL.jobs).findOne({runId:pilot.RUN,state:'captured'},{projection:{_id:0,apxUserId:1}});
 if(!/^\d+$/.test(job?.apxUserId||''))throw Error('missing_captured_fixture');
 await pilot.adminUser(db,job.apxUserId);
 console.log(JSON.stringify({event:'admin_lookup_passed',http:200,otpSent:0}));
}finally{await client.close()}})().catch(e=>{
 console.log(JSON.stringify({event:'admin_lookup_failed',type:e.name,code:e instanceof pilot.PilotError?e.code:undefined,http:e.http??null}));
 process.exitCode=1;
});
