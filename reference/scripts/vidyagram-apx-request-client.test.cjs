'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const r=require('./vidyagram-apx-request-client.cjs');
const root='/Users/raghav/Projects/worktrees/vg-backend';
const {MongoMemoryReplSet}=require(root+'/node_modules/mongodb-memory-server');
const {MongoClient}=require(root+'/node_modules/mongoose').mongo;
let rs,client,db;
const cfg=(ip='192.0.2.1')=>({egress:ip,ipGapMs:80,adminGapMs:120,jitterMs:0,cooldownMs:1000,learnerGapMs:60000});
const reply=(status=200,body={status:200,data:null},retry=null)=>({status,json:async()=>body,headers:{get:()=>retry}});
const url='https://armathsapi.akamai.net.in/get/getVideoCompletion?item_id=PRIVATE&item_type=10';
test('an isolated held route cannot dispatch again, including after restart',async()=>{
 await db.collection(r.RATE).insertOne({_id:'ip:192.0.2.1',rateLimitedHold:true});let calls=0;
 const a=r.createClient(db,{config:cfg(),fetch:async()=>{calls++;return reply();}});
 await assert.rejects(a.request(url,{}),e=>e.code==='source_route_quarantined');assert.equal(calls,0);
});
test('shared dispatch spacing applies across IPs and grows with retained penalty',async()=>{
 let now=100000;const starts=[];
 await db.collection(r.RATE).insertOne({_id:'org:2177599:all',maxConcurrent:1,dispatchGapMs:250,dispatchPenaltyBaseline:4,penalty:8,nextAt:new Date(0),cooldownUntil:new Date(0),leaseUntil:new Date(0)});
 for(const ip of ['192.0.2.1','192.0.2.2']){const a=r.createClient(db,{config:cfg(ip),now:()=>now,sleep:async ms=>{now+=ms;},fetch:async()=>{starts.push(now);return reply();}});await a.request(url,{});}
 assert.ok(starts[1]-starts[0]>=500);
});
test('isolated429 holds the route and retains a ten-minute shared cooldown',async()=>{
 const job={_id:'job',runId:'isolated-run',owner:'owner'};let now=Date.now(),calls=0;
 await db.collection('apx_vg_completion_pilots').insertOne({_id:job.runId,throttleIsolation:true,stopped:false,expiresAt:new Date(now+3600000)});
 await db.collection('apx_vg_completion_jobs').insertOne(job);
 const a=r.createClient(db,{config:cfg(),now:()=>now,fetch:async()=>{calls++;return reply(429,{status:429},'60');}});
 await assert.rejects(r.runJob(job,job.owner,'read',()=>a.request(url,{})),e=>e.code==='source_rate_limited');
 const ip=await db.collection(r.RATE).findOne({_id:'ip:192.0.2.1'}),shared=await db.collection(r.RATE).findOne({_id:'org:2177599:all'});
 assert.equal(ip.rateLimitedHold,true);assert.ok(+shared.cooldownUntil>=now+600000);assert.equal(calls,1);
});
test.before(async()=>{rs=await MongoMemoryReplSet.create({binary:{version:'7.0.14'},replSet:{count:1},instanceOpts:[{port:0}]});client=new MongoClient(rs.getUri());await client.connect();db=client.db('vidyagramdb');});
test.after(async()=>{await client?.close();await rs?.stop();});
test.beforeEach(async()=>{await db.dropDatabase();});
test('an OTP pause blocks a reserved send at dispatch while completion reads continue',async()=>{
 const job={_id:'job',runId:'otp-recovery',owner:'owner'};
 const runs=db.collection('apx_vg_completion_pilots');
 await runs.insertOne({_id:job.runId,stopped:false,expiresAt:new Date(Date.now()+60000),otpRecovery:{phase:'cooling'}});
 await db.collection('apx_vg_completion_jobs').insertOne({...job,otpAttemptedAt:new Date()});
 const dispatched=[];
 const a=r.createClient(db,{config:cfg(),fetch:async input=>{dispatched.push(input.pathname);return reply();}});
 await assert.rejects(r.runJob(job,job.owner,'acquire',()=>a.request('https://armathsapi.akamai.net.in/get/sendotp',{})),/otp_acquisition_paused/);
 await r.runJob(job,job.owner,'read',()=>a.request(url,{}));
 await runs.updateOne({_id:job.runId},{$set:{otpTimeoutAutoRecovery:true,otpRecovery:{phase:'canary',ceiling:5,deadline:new Date(Date.now()+60000)}}});
 await db.collection('apx_vg_completion_jobs').updateOne({_id:job._id},{$set:{state:'acquiring',priority:6}});
 await assert.rejects(r.runJob(job,job.owner,'acquire',()=>a.request('https://armathsapi.akamai.net.in/get/sendotp',{})),/job_lease_lost/);
 assert.deepEqual(dispatched,['/get/getVideoCompletion']);
});
test('requires effective egress identity and rejects invalid pacing',()=>{
 assert.throws(()=>r.config({}),/effective_egress_ip_required/);
 assert.throws(()=>r.config({VG_EGRESS_ID:'192.0.2.1',VG_REQUEST_GAP_MS:'0'}));
 assert.equal(r.config({VG_EGRESS_ID:'192.0.2.1'}).learnerGapMs,60000);
});
test('parses Retry-After seconds, dates, and absent/malformed values',()=>{
 const now=Date.parse('2026-11-03T10:00:00Z');
 assert.equal(r.retryAfterMs('120',now,60000),120000);
 assert.equal(r.retryAfterMs('Tue, 03 Nov 2026 10:02:00 GMT',now,60000),120000);
 assert.equal(r.retryAfterMs('bad',now,60000),60000);
});
test('separate processes on one egress IP dispatch serially with a gap',async()=>{
 const starts=[];const fetch=async()=>{starts.push(Date.now());await new Promise(res=>setTimeout(res,20));return reply();};
 const a=r.createClient(db,{config:cfg(),fetch,host:'a'}),b=r.createClient(db,{config:cfg(),fetch,host:'b'});
 await Promise.all([a.request(url,{}),b.request(url,{})]);
 assert.equal(starts.length,2);assert.ok(starts[1]-starts[0]>=90,JSON.stringify(starts));
});
test('admin requests share spacing across different egress IPs',async()=>{
 const starts=[];const fetch=async()=>{starts.push(Date.now());return reply(200,{status:200,userdt:{}});};
 const a=r.createClient(db,{config:cfg(),fetch}),b=r.createClient(db,{config:cfg('192.0.2.2'),fetch});
 await Promise.all([a.request('https://cms.appx.co.in/users/get_userdt_by_id',{}),b.request('https://cms.appx.co.in/users/get_userdt_by_id',{})]);
 assert.ok(starts[1]-starts[0]>=110,JSON.stringify(starts));
});
test('waiting on one IP does not hold the shared organisation gate',async()=>{
 let now=100000,otherPassed=false;
 await db.collection(r.RATE).insertOne({_id:'ip:192.0.2.1',nextAt:new Date(now+1000),leaseUntil:new Date(0),cooldownUntil:new Date(0),penalty:1});
 const b=r.createClient(db,{config:cfg('192.0.2.2'),now:()=>now,random:()=>0,fetch:async()=>{otherPassed=true;return reply();}});
 const a=r.createClient(db,{config:cfg(),now:()=>now,random:()=>0,sleep:async ms=>{if(!otherPassed)await b.request(url,{});now+=ms;},fetch:async()=>reply()});
 await a.request(url,{});assert.equal(otherPassed,true);
});
test('429 persists a shared cooldown, honours Retry-After, and never retries an OTP request',async()=>{
 await db.collection(r.RATE).insertOne({_id:'org:2177599:all',maxConcurrent:2,nextAt:new Date(0),cooldownUntil:new Date(0),leaseUntil:new Date(0),penalty:1});
 let now=100000,calls=0;const a=r.createClient(db,{config:cfg(),now:()=>now,sleep:async ms=>{now+=ms;},fetch:async()=>{calls++;return reply(429,{status:429},'120');}});
 await assert.rejects(a.request('https://armathsapi.akamai.net.in/get/sendotp?phone=SECRET',{}),e=>e.code==='source_rate_limited');
 assert.equal(calls,1);
 const global=await db.collection(r.RATE).findOne({_id:'org:2177599:all'});assert.equal(global.cooldownUntil.getTime(),220000);assert.equal(global.penalty,2);
 let resumedAt;
 const b=r.createClient(db,{config:cfg('192.0.2.2'),now:()=>now,sleep:async ms=>{now+=ms;},fetch:async()=>{resumedAt=now;return reply();}});
 await b.request(url,{});assert.ok(resumedAt>=220000);
 assert.equal((await db.collection('distributedlocks').findOne({key:'apx-rate-limit-pause'})).expiresAt.getTime(),220000);
});
test('403 blocks that egress across restarts without affecting another route',async()=>{
 let calls=0;const a=r.createClient(db,{config:cfg(),fetch:async()=>{calls++;return reply(403,null);}});
 await assert.rejects(a.request(url,{}),e=>e.http===403);
 const restarted=r.createClient(db,{config:cfg(),fetch:async()=>{calls++;return reply();}});
 await assert.rejects(restarted.request(url,{}),e=>e.http===403);assert.equal(calls,1);
 const b=r.createClient(db,{config:cfg('192.0.2.2'),fetch:async()=>reply()});assert.equal((await b.request(url,{})).http,200);
});
test('metrics contain timing and statuses but no query values, headers, tokens or source body',async()=>{
 const a=r.createClient(db,{config:cfg(),runId:'fixture',fetch:async()=>reply(200,{status:200,data:{SECRET:'OTP'}})});
 await a.request(url,{Authorization:'TOKEN',Cookie:'COOKIE'});
 const metrics=await db.collection(r.METRICS).find({}).toArray(),text=JSON.stringify(metrics);
 assert.equal(metrics[0].endpoint,'completion_read');assert.equal(metrics[0].httpStatus,200);
 for(const value of ['PRIVATE','SECRET','TOKEN','COOKIE','OTP','item_id','Authorization'])assert.ok(!text.includes(value),value);
});
test('network errors are recorded once and never replayed',async()=>{
 let calls=0;const a=r.createClient(db,{config:cfg(),fetch:async()=>{calls++;throw new TypeError('secret URL');}});
 await assert.rejects(a.request(url,{}));assert.equal(calls,1);const m=await db.collection(r.METRICS).findOne({});assert.equal(m.error,'TypeError');assert.equal(m.httpStatus,null);
});
test('an orphaned request lease expires and allows recovery',async()=>{
 let now=100000;const a=r.createClient(db,{config:cfg(),now:()=>now,sleep:async ms=>{now+=ms;},fetch:async()=>reply()});
 const abandoned=await a.take(false);assert.equal(abandoned.ids.length,2);
 const b=r.createClient(db,{config:cfg(),now:()=>now,sleep:async ms=>{now+=ms;},fetch:async()=>reply()});
 assert.equal((await b.request(url,{})).http,200);assert.ok(now>=145000);
});
test('stopping a job while it waits for a permit prevents the source request',async()=>{
 const job={_id:'fixture-job',runId:'fixture-run',owner:'fixture-owner'};
 await db.collection('apx_vg_completion_pilots').insertOne({_id:job.runId,stopped:false,expiresAt:new Date(Date.now()+60000)});
 await db.collection('apx_vg_completion_jobs').insertOne(job);
 await db.collection(r.RATE).insertOne({_id:'org:2177599:all',nextAt:new Date(0),leaseUntil:new Date(0),cooldownUntil:new Date(Date.now()+60000),penalty:1});
 let calls=0;const a=r.createClient(db,{config:cfg(),sleep:async()=>{await db.collection('apx_vg_completion_pilots').updateOne({_id:job.runId},{$set:{stopped:true}});},fetch:async()=>{calls++;return reply();}});
 await assert.rejects(r.runJob(job,job.owner,'acquire',()=>a.request(url,{})),e=>e.code==='pilot_stopped');assert.equal(calls,0);
});
test('a worker that lost job ownership cannot dispatch a request',async()=>{
 const job={_id:'fixture-job',runId:'fixture-run',owner:'new-owner'};
 await db.collection('apx_vg_completion_pilots').insertOne({_id:job.runId,stopped:false,expiresAt:new Date(Date.now()+60000)});
 await db.collection('apx_vg_completion_jobs').insertOne(job);
 let calls=0;const a=r.createClient(db,{config:cfg(),fetch:async()=>{calls++;return reply();}});
 await assert.rejects(r.runJob(job,'old-owner','acquire',()=>a.request(url,{})),e=>e.code==='job_lease_lost');assert.equal(calls,0);
});
test('transport diagnostics preserve known nested error codes without leaking messages or addresses',async()=>{
 const nested=Object.assign(new Error('PRIVATE TOKEN COOKIE'),{code:'ETIMEDOUT',address:'34.54.193.158'});
 const unreachable=Object.assign(new Error('PRIVATE'),{code:'ENETUNREACH'});
 const unknown=Object.assign(new Error('PRIVATE'),{code:'PRIVATE_TOKEN'});
 const failure=new TypeError('SECRET request URL',{cause:new AggregateError([nested,unreachable,unknown],'PRIVATE')});
 const a=r.createClient(db,{config:cfg(),fetch:async()=>{throw failure;}});
 await assert.rejects(a.request(url,{}));
 const metric=await db.collection(r.METRICS).findOne({});assert.deepEqual(metric.transportCodes,['ETIMEDOUT','ENETUNREACH']);
 const encoded=JSON.stringify(metric);for(const secret of ['PRIVATE','TOKEN','COOKIE','SECRET','34.54.193.158'])assert.ok(!encoded.includes(secret));
});
test('two shared slots allow cross-IP overlap but never a third in-flight request',async()=>{
 await db.collection(r.RATE).insertOne({_id:'org:2177599:all',maxConcurrent:2,nextAt:new Date(0),cooldownUntil:new Date(0),leaseUntil:new Date(0),penalty:1});
 let active=0,peak=0,calls=0;
 const fetch=async()=>{active++;peak=Math.max(peak,active);calls++;await new Promise(resolve=>setTimeout(resolve,300));active--;return reply();};
 await Promise.all([1,2,3,4].map(n=>r.createClient(db,{config:cfg('192.0.2.'+n),fetch}).request(url,{})));
 assert.equal(peak,2);assert.equal(calls,4);assert.equal(active,0);
 assert.equal(await db.collection(r.RATE).countDocuments({_id:/slot:/,ticket:{$exists:true}}),0);
});
test('two-slot mode retains same-IP and shared admin spacing',async()=>{
 await db.collection(r.RATE).insertOne({_id:'org:2177599:all',maxConcurrent:2,nextAt:new Date(0),cooldownUntil:new Date(0),leaseUntil:new Date(0),penalty:1});
 const starts=[];const fetch=async()=>{starts.push(Date.now());await new Promise(resolve=>setTimeout(resolve,30));return reply();};
 const a=r.createClient(db,{config:cfg(),fetch}),b=r.createClient(db,{config:cfg(),fetch});
 await Promise.all([a.request(url,{}),b.request(url,{})]);assert.ok(starts[1]-starts[0]>=100);
 starts.length=0;
 const c=r.createClient(db,{config:cfg('192.0.2.2'),fetch}),d=r.createClient(db,{config:cfg('192.0.2.3'),fetch});
 await Promise.all([c.request('https://cms.appx.co.in/users/get_userdt_by_id',{}),d.request('https://cms.appx.co.in/users/get_userdt_by_id',{})]);assert.ok(starts[1]-starts[0]>=140);
});
test('two paced slots overlap slow requests and space starts across all routes',async()=>{
 await db.collection(r.RATE).insertOne({_id:'org:2177599:all',maxConcurrent:2,dispatchGapMs:250,dispatchPenaltyBaseline:4,penalty:8,nextAt:new Date(0),cooldownUntil:new Date(0),leaseUntil:new Date(0)});
 const starts=[];let active=0,peak=0;
 const fetch=async()=>{
  starts.push(Date.now());
  peak=Math.max(peak,++active);
  await new Promise(resolve=>setTimeout(resolve,850));
  active--;
  return reply();
 };
 await Promise.all([1,2,3,4].map(n=>r.createClient(db,{config:cfg('192.0.2.'+n),fetch}).request(url,{})));
 assert.equal(peak,2);
 assert.equal(starts.length,4);
 assert.ok(starts.slice(1).every((start,index)=>start-starts[index]>=500));
 assert.equal(await db.collection(r.RATE).countDocuments({ticket:{$exists:true}}),0);
});
test('a short dispatch lease recheck does not sleep through the next eligible start',async()=>{
 const gate='org:2177599:all';
 const start=100000;
 let now=start,dispatchedAt;
 await db.collection(r.RATE).insertOne({_id:gate,maxConcurrent:2,dispatchGapMs:400,dispatchPenaltyBaseline:4,penalty:4,
  nextAt:new Date(0),cooldownUntil:new Date(0),leaseUntil:new Date(start+45000)});
 const client=r.createClient(db,{config:cfg(),now:()=>now,sleep:async ms=>{
  now+=ms;
  if(now>=start+30)await db.collection(r.RATE).updateOne({_id:gate},{$set:{leaseUntil:new Date(0),nextAt:new Date(start+400)}});
 },fetch:async()=>{dispatchedAt=now;return reply();}});
 await client.request(url,{});
 assert.equal(dispatchedAt-start,400);
});
test('an unsupported shared concurrency fails closed without source dispatch or leaked leases',async()=>{
 await db.collection(r.RATE).insertOne({_id:'org:2177599:all',maxConcurrent:3,nextAt:new Date(0),cooldownUntil:new Date(0),leaseUntil:new Date(0),penalty:1});
 let calls=0;const a=r.createClient(db,{config:cfg(),fetch:async()=>{calls++;return reply();}});
 await assert.rejects(a.request(url,{}),e=>e.code==='invalid_shared_concurrency');assert.equal(calls,0);assert.equal(await db.collection(r.RATE).countDocuments({ticket:{$exists:true}}),0);
});
test('throttleCooldown 429 cools only this IP: 15 min, doubling within 6 h; no org cooldown or shared pause',async()=>{
 const job={_id:'job',runId:'cooldown-run',owner:'owner'};let now=Date.now(),calls=0;
 await db.collection('apx_vg_completion_pilots').insertOne({_id:job.runId,throttleCooldown:true,stopped:false,expiresAt:new Date(now+86400000)});
 await db.collection('apx_vg_completion_jobs').insertOne(job);
 await db.collection(r.RATE).insertOne({_id:'org:2177599:all',maxConcurrent:2,nextAt:new Date(0),cooldownUntil:new Date(0),leaseUntil:new Date(0),penalty:6,dispatchGapMs:250,dispatchPenaltyBaseline:4});
 const sleep=async ms=>{now+=ms;};const a=r.createClient(db,{config:cfg(),now:()=>now,sleep,fetch:async()=>{calls++;return reply(429,{status:429});}});
 await assert.rejects(r.runJob(job,job.owner,'read',()=>a.request(url,{})),e=>e.code==='source_rate_limited');
 let ip=await db.collection(r.RATE).findOne({_id:'ip:192.0.2.1'}),org=await db.collection(r.RATE).findOne({_id:'org:2177599:all'});
 assert.equal(+ip.cooldownUntil-+ip.last429At,900000);assert.equal(ip.routeCooldownStreak,1);assert.notEqual(ip.rateLimitedHold,true);
 assert.equal(org.penalty,6);assert.ok(+org.cooldownUntil<=now);assert.equal(await db.collection('distributedlocks').countDocuments({}),0);
 // Another IP is not held back by it.
 let other=0;const b=r.createClient(db,{config:cfg('192.0.2.2'),now:()=>now,sleep,fetch:async()=>{other++;return reply();}});await b.request(url,{});assert.equal(other,1);
 now=+ip.cooldownUntil+1;
 await assert.rejects(r.runJob(job,job.owner,'read',()=>a.request(url,{})),e=>e.code==='source_rate_limited');
 ip=await db.collection(r.RATE).findOne({_id:'ip:192.0.2.1'});assert.equal(+ip.cooldownUntil-+ip.last429At,1800000);assert.equal(ip.routeCooldownStreak,2);assert.equal(calls,2);
});
// Reservation mode (gate dispatchMode:'reserve'): one atomic update books each request's start slot; no lock polling.
const reserveGate=(over={})=>({_id:'org:2177599:all',dispatchMode:'reserve',maxConcurrent:2,dispatchGapMs:250,dispatchPenaltyBaseline:4,penalty:4,nextAt:new Date(0),cooldownUntil:new Date(0),leaseUntil:new Date(0),...over});
const gaps=a=>{const s=[...a].sort((x,y)=>x-y);return s.slice(1).map((v,i)=>v-s[i]);};
test('reserve: starts across IPs are spaced by the gate gap with no polling slack',async()=>{
 await db.collection(r.RATE).insertOne(reserveGate());
 const starts=[];const fetch=async()=>{starts.push(Date.now());await new Promise(res=>setTimeout(res,20));return reply();};
 const clients=[1,2,3,4,5,6].map(n=>r.createClient(db,{config:cfg('192.0.2.'+n),fetch}));
 await Promise.all(clients.map(async a=>{for(let i=0;i<3;i++)await a.request(url,{});}));
 const g=gaps(starts);assert.equal(starts.length,18);
 assert.ok(Math.min(...g)>=240,`min gap ${Math.min(...g)}`);
 assert.ok(g.sort((x,y)=>x-y)[Math.floor(g.length/2)]<=290,`median gap ${g[Math.floor(g.length/2)]}`);
 const gate=await db.collection(r.RATE).findOne({_id:'org:2177599:all'});assert.equal((gate.inflight||[]).length,0);
});
test('reserve: penalty stretches the spacing like the lock gate',async()=>{
 await db.collection(r.RATE).insertOne(reserveGate({penalty:8}));
 const starts=[];const fetch=async()=>{starts.push(Date.now());return reply();};
 await Promise.all([1,2,3].map(n=>r.createClient(db,{config:cfg('192.0.2.'+n),fetch}).request(url,{})));
 assert.ok(Math.min(...gaps(starts))>=490);
});
test('reserve: never a third request in flight; a blocked slot goes to the back of the line',async()=>{
 await db.collection(r.RATE).insertOne(reserveGate());
 const starts=[];let active=0,peak=0;
 const fetch=async()=>{starts.push(Date.now());peak=Math.max(peak,++active);await new Promise(res=>setTimeout(res,700));active--;return reply();};
 await Promise.all([1,2,3,4].map(n=>r.createClient(db,{config:cfg('192.0.2.'+n),fetch}).request(url,{})));
 assert.equal(peak,2);assert.equal(starts.length,4);assert.ok(Math.min(...gaps(starts))>=240);
 const gate=await db.collection(r.RATE).findOne({_id:'org:2177599:all'});assert.equal((gate.inflight||[]).length,0);
});
test('reserve: same-IP and admin spacing still hold',async()=>{
 await db.collection(r.RATE).insertOne(reserveGate({dispatchGapMs:250,penalty:1}));
 const starts=[];const fetch=async()=>{starts.push(Date.now());await new Promise(res=>setTimeout(res,30));return reply();};
 const a=r.createClient(db,{config:{...cfg(),ipGapMs:400},fetch}),b=r.createClient(db,{config:{...cfg(),ipGapMs:400},fetch});
 await Promise.all([a.request(url,{}),b.request(url,{})]);assert.ok(starts[1]-starts[0]>=400,`same ip ${starts[1]-starts[0]}`);
 starts.length=0;
 const admin='https://cms.appx.co.in/users/get_userdt_by_id';
 const c=r.createClient(db,{config:{...cfg('192.0.2.2'),adminGapMs:600},fetch}),d=r.createClient(db,{config:{...cfg('192.0.2.3'),adminGapMs:600},fetch});
 await Promise.all([c.request(admin,{}),d.request(admin,{})]);assert.ok(starts[1]-starts[0]>=600,`admin ${starts[1]-starts[0]}`);
});
test('reserve: a 429 cools the gate; booked slots wait it out, then re-book',async()=>{
 await db.collection(r.RATE).insertOne(reserveGate({dispatchGapMs:300}));
 const starts=[];let limitedAt;
 const limited=r.createClient(db,{config:cfg('192.0.2.1'),fetch:async()=>{starts.push(Date.now());await new Promise(res=>setTimeout(res,100));limitedAt=Date.now();return reply(429,{status:429},'2');}});
 const queued=r.createClient(db,{config:cfg('192.0.2.2'),fetch:async()=>{starts.push(Date.now());return reply();}});
 const results=await Promise.allSettled([limited.request(url,{}),new Promise(res=>setTimeout(res,20)).then(()=>queued.request(url,{}))]);
 assert.equal(results[0].reason?.code,'source_rate_limited');assert.equal(results[1].status,'fulfilled');
 assert.equal(starts.length,2);assert.ok(starts[1]>=limitedAt+1990,`queued fired ${starts[1]-limitedAt} ms after the 429`);
 const gate=await db.collection(r.RATE).findOne({_id:'org:2177599:all'});assert.equal((gate.inflight||[]).length,0);
});
test('reserve: books at most 10 s ahead; a far frontier waits instead of booking',async()=>{
 let now=1000000;const sleeps=[];let dispatchedAt;
 await db.collection(r.RATE).insertOne(reserveGate({nextAt:new Date(now+25000)}));
 const a=r.createClient(db,{config:cfg(),now:()=>now,sleep:async ms=>{sleeps.push(ms);now+=ms;},fetch:async()=>{dispatchedAt=now;return reply();}});
 await a.request(url,{});
 assert.equal(dispatchedAt,1000000+25000);assert.ok(sleeps.every(ms=>ms<=10000));
});
test('reserve: a stopped job never dispatches its booked slot',async()=>{
 const job={_id:'job',runId:'reserve-stop',owner:'owner'};let calls=0;
 await db.collection('apx_vg_completion_pilots').insertOne({_id:job.runId,stopped:false,expiresAt:new Date(Date.now()+60000)});
 await db.collection('apx_vg_completion_jobs').insertOne(job);
 await db.collection(r.RATE).insertOne(reserveGate({nextAt:new Date(Date.now()+400)}));
 const a=r.createClient(db,{config:cfg(),fetch:async()=>{calls++;return reply();}});
 setTimeout(()=>db.collection('apx_vg_completion_pilots').updateOne({_id:job.runId},{$set:{stopped:true}}),100);
 await assert.rejects(r.runJob(job,job.owner,'read',()=>a.request(url,{})),e=>e.code==='pilot_stopped');assert.equal(calls,0);
 const gate=await db.collection(r.RATE).findOne({_id:'org:2177599:all'});assert.equal((gate.inflight||[]).length,0);
});
test('reserve: without the flag the lock gate is used (no reservation fields written)',async()=>{
 await db.collection(r.RATE).insertOne(reserveGate({dispatchMode:undefined}));
 await r.createClient(db,{config:cfg(),fetch:async()=>reply()}).request(url,{});
 const gate=await db.collection(r.RATE).findOne({_id:'org:2177599:all'});assert.equal(gate.reserveRoutes,undefined);assert.equal(gate.inflight,undefined);
});
// Production has ~6 ms Mongo round trips and ~20 workers; the lock gate loses ~40% of its capacity there.
const slowDb=(ms=6)=>({collection:name=>{const col=db.collection(name);const lag=f=>async(...a)=>{await new Promise(res=>setTimeout(res,ms));return f(...a);};
 return new Proxy(col,{get(t,k){if(k==='find')return (...a)=>{const cur=t.find(...a);return {toArray:lag(()=>cur.toArray())};};
  const v=t[k];return typeof v==='function'&&['findOne','findOneAndUpdate','updateOne','updateMany','insertOne','countDocuments'].includes(k)?lag(v.bind(t)):v;}});}});
test('reserve: with 6 ms Mongo and 12 workers the median start gap stays within 15% of the gate gap',async()=>{
 await db.collection(r.RATE).insertOne(reserveGate({dispatchGapMs:250}));
 const starts=[];const fetch=async()=>{starts.push(Date.now());await new Promise(res=>setTimeout(res,40));return reply();};
 const sdb=slowDb();
 await Promise.all(Array.from({length:12},(_,n)=>r.createClient(sdb,{config:cfg('192.0.2.'+(n+1)),fetch})).map(async a=>{for(let i=0;i<3;i++)await a.request(url,{});}));
 const g=gaps(starts).sort((x,y)=>x-y);
 assert.ok(g[0]>=240,`min ${g[0]}`);assert.ok(g[Math.floor(g.length/2)]<=287,`median ${g[Math.floor(g.length/2)]}, p90 ${g[Math.floor(g.length*.9)]}`);
});
test('reserve: same IP and admin never overlap; the next starts gap ms after completion, even when slow',async()=>{
 await db.collection(r.RATE).insertOne(reserveGate({dispatchGapMs:250,penalty:1}));
 const starts=[],ends=[];const fetch=async()=>{starts.push(Date.now());await new Promise(res=>setTimeout(res,600));ends.push(Date.now());return reply();};
 const a=r.createClient(db,{config:{...cfg(),ipGapMs:200},fetch}),b=r.createClient(db,{config:{...cfg(),ipGapMs:200},fetch});
 await Promise.all([a.request(url,{}),b.request(url,{})]);assert.ok(starts[1]-ends[0]>=195,`same ip: second start ${starts[1]-ends[0]} ms after first end`);
 starts.length=0;ends.length=0;
 const admin='https://cms.appx.co.in/users/get_userdt_by_id';
 const c=r.createClient(db,{config:{...cfg('192.0.2.2'),adminGapMs:200},fetch}),d=r.createClient(db,{config:{...cfg('192.0.2.3'),adminGapMs:200},fetch});
 await Promise.all([c.request(admin,{}),d.request(admin,{})]);assert.ok(starts[1]-ends[0]>=195,`admin: second start ${starts[1]-ends[0]} ms after first end`);
 const gate=await db.collection(r.RATE).findOne({_id:'org:2177599:all'});assert.equal((gate.inflight||[]).length,0);
});
