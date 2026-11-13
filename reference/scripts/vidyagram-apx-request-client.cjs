// All migration AppX HTTP traffic passes through this shared, Mongo-backed gate.
// Keys are per effective egress IP and per VG org; no cookie/contact appears in keys or telemetry.
'use strict';
const {AsyncLocalStorage}=require('node:async_hooks');
const os=require('node:os'),crypto=require('node:crypto'),net=require('node:net');
const RATE='apx_vg_request_limits',METRICS='apx_vg_request_metrics',ORG='2177599';
const context=new AsyncLocalStorage(),clients=new WeakMap();
const GLOBAL_KEY=`org:${ORG}:all`;
const ENDPOINTS=new Map([
 ['cms.appx.co.in/users/get_userdt_by_id','admin_user'],
 ['armathsapi.akamai.net.in/get/sendotp','otp_send'],
 ['armathsapi.akamai.net.in/get/otpverify','otp_verify'],
 ['armathsapi.akamai.net.in/get/getVideoCompletion','completion_read'],
]);
const OTP_ENDPOINTS=new Set(['otp_send','otp_verify']);
const HORIZON_MS=10000,INFLIGHT_LEASE_MS=25000,PREP_MS=60; // reservation mode: book at most 10 s ahead; in-flight lease > the 20 s fetch timeout
class RequestError extends Error{constructor(code,http){super(code);this.name='RequestError';this.code=code;this.http=http;}}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function integer(v,fallback,min,max){const n=v===undefined?fallback:Number(v);if(!Number.isSafeInteger(n)||n<min||n>max)throw new RequestError('invalid_request_pacing');return n;}
function config(env=process.env){
 const egress=env.VG_EGRESS_ID;if(!net.isIP(egress||''))throw new RequestError('effective_egress_ip_required');
 return {egress,ipGapMs:integer(env.VG_REQUEST_GAP_MS,1500,250,60000),adminGapMs:integer(env.VG_ADMIN_GAP_MS,2000,250,60000),jitterMs:integer(env.VG_REQUEST_JITTER_MS,250,0,2000),cooldownMs:integer(env.VG_COOLDOWN_MS,60000,1000,3600000),learnerGapMs:integer(env.VG_LEARNER_GAP_MS,60000,1000,3600000)};
}
function retryAfterMs(value,now,fallback){
 if(typeof value==='string'&&/^\d+(\.\d+)?$/.test(value.trim()))return Math.max(1000,Math.ceil(Number(value)*1000));
 const parsed=value?Date.parse(value):NaN;return Number.isFinite(parsed)&&parsed>now?parsed-now:fallback;
}
function keys(c,admin){return [`ip:${c.egress}`,...(admin?[`org:${ORG}:admin`]:[])];}
function isDue(d,now){return !d||[d.leaseUntil,d.nextAt,d.cooldownUntil].every(x=>!x||new Date(x).getTime()<=now);}
function sharedGap(shared){
 if(!shared?.dispatchGapMs)return 0;
 if(!Number.isSafeInteger(shared.dispatchGapMs)||shared.dispatchGapMs<250||shared.dispatchGapMs>60000||shared.dispatchPenaltyBaseline!==4)throw new RequestError('invalid_shared_dispatch_gap');
 return shared.dispatchGapMs*Math.max(1,(shared.penalty||1)/shared.dispatchPenaltyBaseline);
}
const TRANSPORT_CODES=new Set(['ETIMEDOUT','ENETUNREACH','EHOSTUNREACH','ECONNRESET','ECONNREFUSED','ENOTFOUND','EAI_AGAIN','EPIPE','UND_ERR_CONNECT_TIMEOUT','UND_ERR_SOCKET','CERT_HAS_EXPIRED','ERR_TLS_CERT_ALTNAME_INVALID','DEPTH_ZERO_SELF_SIGNED_CERT']);
function transportCodes(e){return [...new Set([e,e?.cause,...(Array.isArray(e?.cause?.errors)?e.cause.errors:[])].map(x=>x?.code).filter(c=>TRANSPORT_CODES.has(c)))];}
function createClient(db,opts={}){
 const c=opts.config||config(),clock=opts.now||Date.now,wait=opts.sleep||sleep,random=opts.random||Math.random;
 const host=opts.host||os.hostname(),fetcher=opts.fetch||((...a)=>fetch(...a));
 async function guard(endpoint){
  const x=context.getStore();if(!x)return;
  const run=await db.collection('apx_vg_completion_pilots').findOne({_id:x.runId},{projection:{stopped:1,expiresAt:1,finishedAt:1,otpRecovery:1,otpTimeoutAutoRecovery:1}});
  if(!run||run.stopped||run.finishedAt||new Date(run.expiresAt).getTime()<=clock())throw new RequestError('pilot_stopped');
  const now=new Date(clock()),canary=endpoint==='otp_send'&&run.otpRecovery;
  if(canary&&(canary.phase!=='canary'||!(canary.deadline>now)))throw new RequestError('otp_acquisition_paused');
  const job={_id:x.jobId,runId:x.runId,owner:x.owner};
  if(run.otpTimeoutAutoRecovery&&OTP_ENDPOINTS.has(endpoint))Object.assign(job,{state:'acquiring',leaseUntil:{$gt:now},otpAttemptedAt:{$exists:true}});
  if(canary)job.priority={$lt:canary.ceiling};
  const owned=await db.collection('apx_vg_completion_jobs').findOne(job,{projection:{_id:1}});
  if(!owned)throw new RequestError('job_lease_lost');
  const renewed=await db.collection('apx_vg_completion_jobs').updateOne(job,{$set:{leaseUntil:new Date(clock()+600000)}});
  if(renewed.matchedCount!==1)throw new RequestError('job_lease_lost');
 }
 // Reservation mode (gate dispatchMode:'reserve', two-slot spaced gate only). One atomic update on the org document books this
 // request's start slot: slot = max(frontier, now); frontier += gap. Per-IP and admin spacing ride in the same document
 // (reserveRoutes.<ip>, reserveAdminAt). The worker sleeps to its slot, then claims one of the 2 in-flight leases (inflight[]);
 // if both are busy it gives the slot up and books again at the back. No lock polling, so the gate delivers its configured rate.
 // Flip the flag only while no worker runs: lock-gate workers and reserving workers must never share the gate.
 const routeKey=`r_${c.egress.replace(/[^0-9a-fA-F]/g,'_')}`;
 async function reserveTake(admin,endpoint){
  const ids=keys(c,admin),ticket=crypto.randomUUID(),G=db.collection(RATE);
  for(;;){
   await guard(endpoint);
   const docs=await G.find({_id:{$in:ids}}).toArray(),route=docs.find(d=>d._id===ids[0]),adm=docs.find(d=>d._id===ids[1]);
   if(route?.rateLimitedHold)throw new RequestError('source_route_quarantined',429);
   if(docs.some(d=>d.blocked))throw new RequestError('source_access_denied',403);
   const cool=Math.max(0,...docs.map(d=>+new Date(d.cooldownUntil||0)));
   if(cool>clock()){await wait(Math.min(1000,cool-clock()));continue;}
   const now=clock(),nowD=new Date(now);
   const ipGap=c.ipGapMs*(route?.penalty||1)+Math.floor(random()*(c.jitterMs+1));
   const adminGap=c.adminGapMs*(adm?.penalty||1)+Math.floor(random()*(c.jitterMs+1));
   const epoch=new Date(0),frontier={$max:[{$ifNull:['$nextAt',epoch]},nowD]};
   const routeAt={$ifNull:[`$reserveRoutes.${routeKey}`,epoch]},adminAt={$ifNull:['$reserveAdminAt',epoch]};
   const gap={$multiply:['$dispatchGapMs',{$max:[1,{$divide:[{$ifNull:['$penalty',1]},'$dispatchPenaltyBaseline']}]}]};
   const before=await G.findOneAndUpdate({_id:GLOBAL_KEY,dispatchMode:'reserve',maxConcurrent:2,dispatchPenaltyBaseline:4,dispatchGapMs:{$gte:250,$lte:60000},
    blocked:{$ne:true},cooldownUntil:{$lte:nowD},$expr:{$and:[{$lte:[{$subtract:[frontier,nowD]},HORIZON_MS]},{$lte:[routeAt,frontier]},...(admin?[{$lte:[adminAt,frontier]}]:[])]}},
    [{$set:{nextAt:{$add:[frontier,gap]},[`reserveRoutes.${routeKey}`]:{$add:[frontier,ipGap]},...(admin?{reserveAdminAt:{$add:[frontier,adminGap]}}:{})}}],
    {returnDocument:'before',includeResultMetadata:false});
   if(!before){
    const g=await G.findOne({_id:GLOBAL_KEY});
    if(g?.dispatchMode!=='reserve')return null;
    if(g.blocked)throw new RequestError('source_access_denied',403);
    sharedGap(g);if(g.maxConcurrent!==2||!g.dispatchGapMs)throw new RequestError('invalid_shared_concurrency');
    const t=clock(),f=Math.max(+new Date(g.nextAt||0),t);
    const due=Math.max(+new Date(g.cooldownUntil||0),f-HORIZON_MS,+new Date(g.reserveRoutes?.[routeKey]||0)-(f-t),admin?+new Date(g.reserveAdminAt||0)-(f-t):0);
    await wait(Math.min(1000,Math.max(25,due-t)));continue;
   }
   const slot=Math.max(+new Date(before.nextAt||0),now);
   // Run the job/stop checks just before the slot, so the claim below is the last step before the request goes out.
   if(slot-PREP_MS>clock())await wait(slot-PREP_MS-clock());
   await guard(endpoint);
   if(slot>clock())await wait(slot-clock());
   // The claim takes one of the 2 in-flight leases and stamps lastStartAt; it never starts sooner than the current gap after the
   // previous start, so starts are spaced even when a request runs late (and a slowed gate applies at once).
   for(;;){
    const at=new Date(clock()),live={$filter:{input:{$ifNull:['$inflight',[]]},cond:{$gt:['$$this.until',at]}}};
    const claimed=await G.findOneAndUpdate({_id:GLOBAL_KEY,dispatchMode:'reserve',maxConcurrent:2,dispatchPenaltyBaseline:4,dispatchGapMs:{$gte:250,$lte:60000},blocked:{$ne:true},cooldownUntil:{$lte:at},
     $expr:{$and:[{$lt:[{$size:live},2]},{$lte:[{$add:[{$ifNull:['$lastStartAt',epoch]},gap]},at]},
      {$lte:[{$ifNull:[`$routeReadyAt.${routeKey}`,epoch]},at]},...(admin?[{$lte:[{$ifNull:['$adminReadyAt',epoch]},at]}]:[])]}},
     // Like the lock gate's IP/admin leases: busy until this request completes (release sets completion + gap), at most the lease.
     [{$set:{lastStartAt:at,[`routeReadyAt.${routeKey}`]:new Date(+at+INFLIGHT_LEASE_MS),...(admin?{adminReadyAt:new Date(+at+INFLIGHT_LEASE_MS)}:{}),
      inflight:{$concatArrays:[live,[{t:ticket,until:new Date(+at+INFLIGHT_LEASE_MS)}]]}}}],{returnDocument:'after',includeResultMetadata:false});
    if(claimed)return {ids,ticket,reserve:true,dispatch:claimed,ipGap,adminGap};
    const g=await G.findOne({_id:GLOBAL_KEY});const t=clock();
    if(g?.dispatchMode!=='reserve'||g.blocked||g.cooldownUntil>new Date(t)||(g.inflight||[]).filter(x=>+x.until>t).length>=2)break;
    const next=Math.max(+new Date(g.lastStartAt||0)+sharedGap(g),+new Date(g.routeReadyAt?.[routeKey]||0),admin?+new Date(g.adminReadyAt||0):0);
    if(next-t>1000)break; // far behind: give the slot up
    await wait(Math.max(5,next-t));
   }
   // Both in-flight leases busy, a cooldown/block landed, or the mode changed: book again (the loop waits out a cooldown).
  }
 }
 async function releaseReserve(permit,admin,started){
  if(!permit.reserve)return;permit.reserve=false;
  // As in the lock gate: the next request on this IP (and the next admin request) starts gap ms after this one completes.
  const done=clock(),sent=started!==undefined,set={[`routeReadyAt.${routeKey}`]:new Date(done+(sent?permit.ipGap:0))};
  if(admin)set.adminReadyAt=new Date(done+(sent?permit.adminGap:0));
  await db.collection(RATE).updateOne({_id:GLOBAL_KEY,'inflight.t':permit.ticket},{$pull:{inflight:{t:permit.ticket}},$set:set});
 }
 async function take(admin,endpoint){
  const mode=await db.collection(RATE).findOne({_id:GLOBAL_KEY},{projection:{dispatchMode:1}});
  if(mode?.dispatchMode==='reserve'){const p=await reserveTake(admin,endpoint);if(p)return p;}
  const ids=keys(c,admin),ticket=crypto.randomUUID();
  let recheckedDispatchLease;
  for(const id of [...ids,GLOBAL_KEY])await db.collection(RATE).updateOne({_id:id},{$setOnInsert:{nextAt:new Date(0),cooldownUntil:new Date(0),leaseUntil:new Date(0),penalty:1}},{upsert:true});
  for(;;){
   await guard(endpoint);const held=[];let delay=100;
   try{
    const route=await db.collection(RATE).findOne({_id:`ip:${c.egress}`});
    if(route?.rateLimitedHold)throw new RequestError('source_route_quarantined',429);
    const shared=await db.collection(RATE).findOne({_id:GLOBAL_KEY});
    const width=shared?.maxConcurrent??1;
    if(![1,2].includes(width))throw new RequestError('invalid_shared_concurrency');
    const spacedTwoSlot=width===2&&sharedGap(shared)>0;
    if(shared?.blocked)throw new RequestError('source_access_denied',403);
    const sharedNow=clock();
    if(!isDue(shared,sharedNow)){
     const leaseUntil=+new Date(shared.leaseUntil||0);
     const quickRecheck=spacedTwoSlot&&leaseUntil>sharedNow&&leaseUntil!==recheckedDispatchLease;
     if(quickRecheck)recheckedDispatchLease=leaseUntil;
     const dueAt=Math.max(+new Date(shared.nextAt||0),+new Date(shared.cooldownUntil||0),quickRecheck?0:leaseUntil);
     await wait(Math.min(1000,Math.max(100,dueAt-sharedNow)));
     continue;
    }
    for(const id of ids){
     const now=new Date(clock());
     const got=await db.collection(RATE).findOneAndUpdate({_id:id,nextAt:{$lte:now},cooldownUntil:{$lte:now},leaseUntil:{$lte:now}},{$set:{ticket,leaseUntil:new Date(clock()+45000)}},{returnDocument:'after',includeResultMetadata:false});
     if(!got){const d=await db.collection(RATE).findOne({_id:id});delay=Math.max(100,...[d?.nextAt,d?.cooldownUntil,d?.leaseUntil].map(t=>t?new Date(t).getTime()-clock():0));break;}
     held.push(id);
     if(got.blocked)throw new RequestError('source_access_denied',403);
    }
    if(held.length===ids.length){
     // A 429 may have arrived on another IP while these keys were acquired.
     const docs=await db.collection(RATE).find({_id:{$in:ids}}).toArray();
     if(docs.every(d=>!d.cooldownUntil||new Date(d.cooldownUntil).getTime()<=clock())){
      for(let slot=0;slot<width;slot++){
       const id=`org:${ORG}:slot:${slot}`;
       await db.collection(RATE).updateOne({_id:id},{$setOnInsert:{nextAt:new Date(0),cooldownUntil:new Date(0),leaseUntil:new Date(0),penalty:1}},{upsert:true});
       const now=new Date(clock());
       const got=await db.collection(RATE).findOneAndUpdate({_id:id,nextAt:{$lte:now},cooldownUntil:{$lte:now},leaseUntil:{$lte:now}},{$set:{ticket,leaseUntil:new Date(clock()+45000)}},{returnDocument:'after',includeResultMetadata:false});
       if(got){
        held.push(id);
        // Slots bound in-flight HTTP across IPs; the org document carries shared cooldowns.
        const latest=await db.collection(RATE).findOne({_id:GLOBAL_KEY});
        if(latest&&isDue(latest,clock())&&!latest.blocked&&(latest.maxConcurrent??1)===width){
         if(!spacedTwoSlot&&!((width===2)&&latest.dispatchGapMs))return {ids:held,ticket};
         // Keep the organisation lease only through dispatch, and keep the slot through the response.
         const dispatchTime=new Date(clock());
         const dispatch=await db.collection(RATE).findOneAndUpdate({
          _id:GLOBAL_KEY,maxConcurrent:2,dispatchGapMs:shared.dispatchGapMs,dispatchPenaltyBaseline:4,
          blocked:{$ne:true},nextAt:{$lte:dispatchTime},cooldownUntil:{$lte:dispatchTime},leaseUntil:{$lte:dispatchTime},
         },{$set:{ticket,leaseUntil:new Date(+dispatchTime+45000)}},{returnDocument:'after',includeResultMetadata:false});
         if(dispatch)return {ids:held,ticket,dispatch};
        }
        break;
       }
      }
     }
    }
   }catch(e){await release({ids:held,ticket},admin,false);throw e;}
   await release({ids:held,ticket},admin,false);
   await wait(Math.min(1000,delay));
  }
 }
 async function releaseDispatch(permit,started){
  if(!permit.dispatch||permit.reserve!==undefined)return;
  const nextAt=started===undefined?new Date(0):new Date(started+sharedGap(permit.dispatch));
  await db.collection(RATE).updateOne({_id:GLOBAL_KEY,ticket:permit.ticket},{$set:{leaseUntil:new Date(0)},$max:{nextAt},$unset:{ticket:''}});
  permit.dispatch=null;
 }
 async function release(permit,admin,dispatched){
  for(const id of [...permit.ids].reverse()){
   const d=await db.collection(RATE).findOne({_id:id,ticket:permit.ticket});if(!d)continue;
   const shared=id.includes(':slot:')?await db.collection(RATE).findOne({_id:GLOBAL_KEY}):null;
   const slotGap=shared?.maxConcurrent===2?0:sharedGap(shared);
   const base=id===`org:${ORG}:admin`?c.adminGapMs:id.startsWith('ip:')?c.ipGapMs:0;
   const gap=dispatched?(id.includes(':slot:')?slotGap:base*(d.penalty||1)+Math.floor(random()*(c.jitterMs+1))):0;
   await db.collection(RATE).updateOne({_id:id,ticket:permit.ticket},{$set:{leaseUntil:new Date(0)},$max:{nextAt:new Date(clock()+gap)},$unset:{ticket:''}});
  }
 }
 async function cooldown(ids,ms,admin){
  const until=new Date(clock()+ms);
  for(const id of ids){const old=await db.collection(RATE).findOne({_id:id});await db.collection(RATE).updateOne({_id:id},{$max:{cooldownUntil:until,penalty:Math.min(8,(old?.penalty||1)*2)},$set:{last429At:new Date(clock())},$inc:{throttles:1}});}
  await db.collection('distributedlocks').updateOne({key:'apx-rate-limit-pause'},{$max:{expiresAt:until},$set:{lockedAt:new Date(clock()),instanceId:'vg-completion-request-gate'}},{upsert:true});
 }
 // throttleCooldown runs: a 429 cools down only this egress IP: 15 min, doubling for each further 429 on it within 6 h
 // (max 2 h, or Retry-After if longer). No shared org cooldown, org penalty or shared pause; the pilot stops the whole run
 // when a second IP is rate limited within 30 min.
 async function routeCooldown(retryAfter){
  const id=`ip:${c.egress}`,now=clock(),old=await db.collection(RATE).findOne({_id:id});
  const streak=old?.last429At&&now-new Date(old.last429At).getTime()<6*3600000?(old.routeCooldownStreak||0)+1:1;
  const ms=Math.max(Math.min(2*3600000,900000*2**(streak-1)),retryAfterMs(retryAfter,now,0));
  await db.collection(RATE).updateOne({_id:id},{$max:{cooldownUntil:new Date(now+ms)},$set:{penalty:Math.min(8,(old?.penalty||1)*2),last429At:new Date(now),routeCooldownStreak:streak},$inc:{throttles:1}},{upsert:true});
 }
 async function request(url,headers){
  const u=new URL(url),endpoint=ENDPOINTS.get(u.hostname+u.pathname);if(!endpoint||u.protocol!=='https:')throw new RequestError('unapproved_source_endpoint');
  const admin=endpoint==='admin_user',queuedAt=clock();const permit=await take(admin,endpoint);
  let started,dispatched=false,http=null,api=null,error=null,body,codes=[];
  try{
   if(endpoint!=='otp_send'&&!permit.reserve)await guard(endpoint);
   if(permit.reserve){
    // take() ran guard() and claimed with an atomic cooldown/block/spacing check immediately before returning.
   }else if(permit.dispatch){
    const gate=await db.collection(RATE).findOne({_id:GLOBAL_KEY,ticket:permit.ticket,leaseUntil:{$gt:new Date(clock())}});
    if(!gate||gate.maxConcurrent!==2||gate.cooldownUntil>new Date(clock()))throw new RequestError('admin_shared_pause');
    if(gate.blocked)throw new RequestError('source_access_denied',403);
    permit.dispatch=gate;
   }
   if(endpoint==='otp_send'&&!permit.reserve)await guard(endpoint);
   started=clock();dispatched=true;
   const signal=AbortSignal.timeout(20000);
   const response=fetcher(u,{headers,redirect:'manual',signal});
   const [r]=await Promise.all([response,releaseDispatch(permit,started).catch(()=>{})]);http=r.status;
   body=await r.json().catch(()=>{if(http===200&&OTP_ENDPOINTS.has(endpoint)&&signal.aborted)throw signal.reason;return null;});api=body?.status!=null&&Number.isFinite(Number(body.status))?Number(body.status):null;
   if(http===429||api===429){
    const x=context.getStore(),policy=x?await db.collection('apx_vg_completion_pilots').findOne({_id:x.runId},{projection:{throttleIsolation:1,throttleCooldown:1}}):null;
    const isolated=policy?.throttleIsolation===true;
    if(!isolated&&policy?.throttleCooldown===true){await routeCooldown(r.headers?.get('retry-after'));throw new RequestError('source_rate_limited',429);}
    if(isolated)await db.collection(RATE).updateOne({_id:`ip:${c.egress}`},{$set:{rateLimitedHold:true,heldAt:new Date(clock())}});
    await cooldown([...permit.ids,GLOBAL_KEY],Math.max(isolated?600000:0,retryAfterMs(r.headers?.get('retry-after'),clock(),c.cooldownMs)),admin);throw new RequestError('source_rate_limited',429);
   }
   if(http===403||api===403){await db.collection(RATE).updateOne({_id:`ip:${c.egress}`},{$set:{blocked:true,blockedAt:new Date(clock())}});throw new RequestError('source_access_denied',403);}
   return {http,body};
  }catch(e){error=e instanceof RequestError?e.code:e.name;codes=transportCodes(e);if(error==='TimeoutError')e.apxEndpoint=endpoint;throw e;}
  finally{
   if(dispatched){
    const x=context.getStore();
    const event={at:new Date(started),runId:x?.runId||opts.runId||process.env.VG_COMPLETION_RUN||'preflight',workerHost:host,egressIp:c.egress,phase:x?.phase||'probe',experimentPhase:x?.experimentPhase||'probe',learnerGapMs:x?.learnerGapMs??null,endpoint,httpStatus:http,apiStatus:api,latencyMs:clock()-started,queueWaitMs:started-queuedAt,error,transportCodes:codes};
    try{await db.collection(METRICS).insertOne(event);}catch{console.error(JSON.stringify({event:'request-metric-write-failed',endpoint}));}
    console.log(JSON.stringify({event:'apx-request',...event}));
   }
   try{await releaseReserve(permit,admin,started);await releaseDispatch(permit,started);}finally{await release(permit,admin,dispatched);}
  }
 }
 return {request,take,release,config:c};
}
function clientFor(db){if(!clients.has(db))clients.set(db,createClient(db));return clients.get(db);}
function runJob(job,owner,phase,fn){return context.run({runId:job.runId,jobId:job._id,owner,phase,experimentPhase:job.experimentPhase,learnerGapMs:job.learnerGapMs},fn);}
// GATE_CLIENT: workers record it in their heartbeat; flip the gate to dispatchMode 'reserve' only when every worker reports it.
const GATE_CLIENT='reserve-v1';
module.exports={GATE_CLIENT,RATE,METRICS,RequestError,config,retryAfterMs,isDue,createClient,clientFor,runJob};
