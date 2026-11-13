'use strict';
// Fleet-shaped simulation of the shared AppX gate (14 acquire + 8 read workers, 6 ms Mongo, AppX latency), lock vs reservation mode.
// node reference/scripts/vidyagram-completion-gate-sim.cjs <minutes>   env: SIM_MODES=lock,reserve SIM_LEARNER_GAP=30000 SIM_ADMIN_GAP=1000 SIM_IP_GAP=1500
// Needs the vg-backend worktree's mongodb-memory-server. Local only; touches no real database.
const r=require('/Users/raghav/Projects/system-brain/reference/scripts/vidyagram-apx-request-client.cjs');
const root='/Users/raghav/Projects/worktrees/vg-backend';
const {MongoMemoryReplSet}=require(root+'/node_modules/mongodb-memory-server');const {MongoClient}=require(root+'/node_modules/mongoose').mongo;
const MIN=Number(process.argv[2]||4),MONGO_MS=6;
const sleep=ms=>new Promise(res=>setTimeout(res,ms));
(async()=>{
 const rs=await MongoMemoryReplSet.create({binary:{version:'7.0.14'},replSet:{count:1},instanceOpts:[{port:0}]});const client=new MongoClient(rs.getUri());await client.connect();const db=client.db('sim');
 const slow={collection:name=>{const col=db.collection(name);const lag=f=>async(...a)=>{await sleep(MONGO_MS);return f(...a);};
  return new Proxy(col,{get(t,k){if(k==='find')return (...a)=>{const cur=t.find(...a);return {toArray:lag(()=>cur.toArray())};};const v=t[k];return typeof v==='function'&&['findOne','findOneAndUpdate','updateOne','updateMany','insertOne','countDocuments'].includes(k)?lag(v.bind(t)):v;}});}};
 const out={};
 const LG=Number(process.env.SIM_LEARNER_GAP||30000),AG=Number(process.env.SIM_ADMIN_GAP||1000),IG=Number(process.env.SIM_IP_GAP||1500);
 for(const mode of (process.env.SIM_MODES||'lock,reserve').split(',')){
  await db.dropDatabase();
  await db.collection(r.RATE).insertOne({_id:'org:2177599:all',...(mode==='reserve'?{dispatchMode:'reserve'}:{}),maxConcurrent:2,dispatchGapMs:400,dispatchPenaltyBaseline:4,penalty:4,nextAt:new Date(0),cooldownUntil:new Date(0),leaseUntil:new Date(0)});
  const starts=[],waits=[];let learners=0;const queue=[];const end=Date.now()+MIN*60000;
  const lat={admin_user:45,otp_send:140,otp_verify:155,completion_read:50};
  const mk=ip=>r.createClient(slow,{config:{egress:ip,ipGapMs:IG,adminGapMs:AG,jitterMs:250,cooldownMs:60000,learnerGapMs:LG},
   fetch:async u=>{const ep=u.hostname==='cms.appx.co.in'?'admin_user':u.pathname.endsWith('sendotp')?'otp_send':u.pathname.endsWith('otpverify')?'otp_verify':'completion_read';starts.push(Date.now());await sleep(lat[ep]*(0.7+Math.random()*0.6));return {status:200,json:async()=>({status:200}),headers:{get:()=>null}};}});
  const A='https://cms.appx.co.in/users/get_userdt_by_id',SEND='https://armathsapi.akamai.net.in/get/sendotp',VER='https://armathsapi.akamai.net.in/get/otpverify',READ='https://armathsapi.akamai.net.in/get/getVideoCompletion';
  const byEp={};const timed=async(c,u)=>{const t=Date.now();await c.request(u,{});const w=Date.now()-t;waits.push(w);(byEp[u.split('/').pop()]??=[]).push(w);};
  const acquire=async i=>{const c=mk('10.0.0.'+(i+1));await sleep(Math.random()*30000);
   while(Date.now()<end){await timed(c,A);await timed(c,SEND);await sleep(1500);await timed(c,A);await timed(c,VER);queue.push(1);await sleep(LG);}};
  const read=async i=>{const c=mk('10.0.0.'+(i+1));while(Date.now()<end){if(!queue.length){await sleep(200);continue;}queue.shift();await timed(c,READ);if(Math.random()<0.4)await timed(c,READ);learners++;}};
  await Promise.all([...Array.from({length:14},(_,i)=>acquire(i)),...Array.from({length:8},(_,i)=>read(i))]);
  const s=[...starts].sort((a,b)=>a-b),g=s.slice(1).map((v,i)=>v-s[i]).sort((a,b)=>a-b),w=[...waits].sort((a,b)=>a-b),q=(a,p)=>a[Math.floor((a.length-1)*p)];
  out[mode]={requests:starts.length,reqPerH:Math.round(starts.length/MIN*60),learnersPerH:Math.round(learners/MIN*60),minGap:g[0],medianGap:q(g,.5),p90Gap:q(g,.9),requestWait_p50:q(w,.5),requestWait_p90:q(w,.9)};
  out[mode].waitP50ByEndpoint=Object.fromEntries(Object.entries(byEp).map(([k,v])=>[k,q(v.sort((a,b)=>a-b),.5)]));console.log(mode,`lg=${LG} admin=${AG} ip=${IG}`,JSON.stringify(out[mode]));
 }
 await client.close();await rs.stop();
})().catch(e=>{console.error(e);process.exit(1);});
