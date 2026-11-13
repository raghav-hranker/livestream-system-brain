// VM-local bounded continuation. No SSH key or local laptop process is needed.
'use strict';
const fs=require('fs'),path=require('path'),{spawn}=require('child_process');
const PARENT='vg-completion-20261104-fleet2000',NEXT='vg-completion-20261104-overnight6000';
const CUTOFF=Date.parse('2026-11-04T03:30:00Z');
function decision(parent,next,health,now=Date.now()){
 if(!parent||now>=CUTOFF||parent.stopped||parent.tokenFailures!==3||!parent.finishedAt&&+new Date(parent.expiresAt)<=now)return 'stop';
 if(!next)return 'wait';
 if(+new Date(next.expiresAt)<=now||+new Date(next.expiresAt)>CUTOFF||next.finishedAt)return 'stop';
 if(next.stopped&&next.status!=='queued_overnight')return 'stop';
 if(!parent.finishedAt)return 'wait';
 if(!['capture_complete','capture_complete_with_exceptions'].includes(parent.status)||parent.tokenFailures!==3||health.completed!==1200||health.blocks!==0)return 'stop';
 return next.status==='queued_overnight'&&next.stopped||next.status==='running'&&!next.stopped?'start':'stop';
}
async function main(){
 const role=process.argv[2];if(!['acquire','read','sheet'].includes(role))throw Error('invalid_role');
 if(process.env.VG_LEARNER_GAP_MS!=='30000'||process.env.VG_ADMIN_GAP_MS!=='1000'||process.env.VG_REQUEST_GAP_MS!=='1500')throw Error('overnight_pacing_mismatch');
 const root=process.env.VG_APP_ROOT,req=n=>require(require.resolve(n,{paths:[root]}));
 const env=req('dotenv').parse(fs.readFileSync(process.env.VG_ENV_PATH||path.join(root,'.env.development')));
 if(!/^mongodb(?:\+srv)?:\/\/[^/]+\/vidyagramdb(?:\?|$)/.test(env.MONGO_URI||''))throw Error('wrong_tenant_database');
 let driver;try{driver=req('mongodb');}catch{driver=req('mongoose').mongo;}
 const c=new driver.MongoClient(env.MONGO_URI,{minPoolSize:0,maxPoolSize:2,readPreference:'primary',serverSelectionTimeoutMS:15000});
 let start=false;try{
  await c.connect();const db=c.db('vidyagramdb');
  console.log(JSON.stringify({event:'overnight-waiting',at:new Date(),role,parent:PARENT,next:NEXT,cutoff:new Date(CUTOFF)}));
  while(Date.now()<CUTOFF){
   const parent=await db.collection('apx_vg_completion_pilots').findOne({_id:PARENT});
   const next=await db.collection('apx_vg_completion_pilots').findOne({_id:NEXT});
   let health={completed:0,blocks:0};
   if(parent?.finishedAt){
    const ev=await db.collection('apx_vg_completion_tuning_events').findOne({_id:PARENT+':stage5-overnight'});if(!ev)throw Error('missing_predecessor_review');
    health.completed=await db.collection('apx_vg_completion_jobs').countDocuments({runId:PARENT,priority:{$gte:800,$lt:2000},state:{$in:['captured','mapping_exception']}});
    health.blocks=await db.collection('apx_vg_request_metrics').countDocuments({runId:PARENT,at:{$gte:ev.at},$or:[{httpStatus:{$in:[403,429]}},{apiStatus:{$in:[403,429]}}]});
   }
   const action=decision(parent,next,health);
   if(action==='stop'){console.log(JSON.stringify({event:'overnight-not-started',at:new Date(),role,parentStatus:parent?.status,nextStatus:next?.status,health}));return;}
   if(action==='start'){
    if(next.status==='queued_overnight'){
     const changed=await db.collection('apx_vg_completion_pilots').updateOne({_id:NEXT,status:'queued_overnight',stopped:true,predecessorRun:PARENT},{$set:{status:'running',stopped:false,startedAt:new Date(),handoffVerifiedAt:new Date()}});
     if(changed.modifiedCount!==1)continue;
    }
    start=true;break;
   }
   await new Promise(r=>setTimeout(r,15000));
  }
 }finally{await c.close();}
 if(!start)return;
 console.log(JSON.stringify({event:'overnight-starting',at:new Date(),role,runId:NEXT}));
 const file=path.join(__dirname,role==='sheet'?'vidyagram-completion-sheet.cjs':'vidyagram-completion-pilot.cjs');
 const args=role==='sheet'?[file]:[file,'worker',role];
 const child=spawn('flock',[path.join(__dirname,role+'.lock'),process.execPath,...args],{env:{...process.env,VG_COMPLETION_RUN:NEXT},stdio:['ignore','inherit','inherit']});
 child.on('error',()=>{console.error(JSON.stringify({event:'overnight-child-failed',role}));process.exitCode=1;});
 child.on('exit',(code,signal)=>{process.exitCode=code??1;console.log(JSON.stringify({event:'overnight-child-exit',at:new Date(),role,code,signal}));});
}
module.exports={decision,CUTOFF};
if(require.main===module)main().catch(e=>{console.error(JSON.stringify({event:'overnight-handoff-failed',error:e.name,code:typeof e.code==='string'?e.code:null}));process.exitCode=1;});
