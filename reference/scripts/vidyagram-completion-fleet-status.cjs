// Read-only VG completion fleet view from apx_vg_request_metrics: per-worker OTP pace, peak hour, non-200s.
// Run on an Azure migrator: VG_APP_ROOT=$dir/runtime VG_ENV_PATH=$dir/.env.development node vidyagram-completion-fleet-status.cjs [runId]
'use strict';
const path=require('path');
const RUN=process.argv[2]||'vg-completion-20261103-fleet500';
const root=process.env.VG_APP_ROOT||process.cwd();
const req=n=>require(require.resolve(n,{paths:[root]}));
const env=req('dotenv').parse(require('fs').readFileSync(process.env.VG_ENV_PATH||path.join(root,'.env.development')));
const {MongoClient}=req('mongodb');
const median=a=>{const s=[...a].sort((x,y)=>x-y);return s.length?s[Math.floor(s.length/2)]:null;};
(async()=>{
 const client=new MongoClient(env.MONGO_URI,{minPoolSize:0,maxPoolSize:2,serverSelectionTimeoutMS:15000});
 await client.connect();
 try{
  const db=client.db('vidyagramdb'),now=Date.now();
  const rows=await db.collection('apx_vg_request_metrics').find({runId:RUN},{projection:{at:1,workerHost:1,egressIp:1,endpoint:1,httpStatus:1,apiStatus:1,error:1,learnerGapMs:1}}).sort({at:1}).toArray();
  const hosts={};const bad={};
  for(const r of rows){
   const h=hosts[r.workerHost]||={egress:r.egressIp,requests:0,otp:[],reads:0,gap:r.learnerGapMs};
   h.requests++;
   if(r.endpoint==='otp_send')h.otp.push(new Date(r.at).getTime());
   if(r.endpoint==='completion_read')h.reads++;
   if(r.httpStatus!==200||r.apiStatus!==200||r.error){const k=[r.workerHost,r.endpoint,r.httpStatus,r.apiStatus,r.error].join(' ');(bad[k]||={n:0,last:r.at}).n++;bad[k].last=r.at;}
  }
  const report=Object.entries(hosts).map(([host,h])=>{
   const t=h.otp,recent=t.filter(x=>now-x<600000);
   return {host,egress:h.egress,gapMs:h.gap,requests:h.requests,reads:h.reads,otp:t.length,firstOtp:t.length?new Date(t[0]).toISOString():null,lastOtp:t.length?new Date(t[t.length-1]).toISOString():null,medianGapS:t.length>1?Math.round(median(t.slice(1).map((x,i)=>x-t[i]))/100)/10:null,otpLast10Min:recent.length,peak60Min:t.reduce((m,x)=>Math.max(m,t.filter(y=>y>=x&&y-x<3600000).length),0)};
  });
  const all=Object.values(hosts).flatMap(h=>h.otp);
  const run=await db.collection('apx_vg_completion_pilots').findOne({_id:RUN},{projection:{stopped:1,status:1,stoppedAt:1,finishedAt:1,expiresAt:1,experimentPhase:1}});
  const jobs=await db.collection('apx_vg_completion_jobs').aggregate([{$match:{runId:RUN}},{$group:{_id:'$state',n:{$sum:1}}}]).toArray();
  const workers=await db.collection('apx_vg_completion_workers').find({runId:RUN},{projection:{host:1,role:1,learnerGapMs:1,egressIp:1,updatedAt:1,heartbeatAt:1,lastSeenAt:1}}).toArray();
  const limits=await db.collection('apx_vg_request_limits').find({$or:[{cooldownUntil:{$gt:new Date()}},{blocked:true}]}).limit(20).toArray();
  console.log(JSON.stringify({now:new Date(now).toISOString(),run,jobs,hosts:report,totalOtp:all.length,fleetOtpLast10Min:all.filter(x=>now-x<600000).length,fleetPeak60Min:all.reduce((m,x)=>Math.max(m,all.filter(y=>y>=x&&y-x<3600000).length),0),nonOk:bad,workers,activeCooldownsOrBlocks:limits},null,1));
 }finally{await client.close();}
})().catch(e=>{console.error(e.message.replace(/mongodb(\+srv)?:\/\/\S+/g,'<uri>'));process.exit(1);});
