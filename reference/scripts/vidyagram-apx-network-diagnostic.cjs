// Bounded paced reads only. No OTP/contact/credential output; preserves original transport codes.
'use strict';
const fs=require('fs'),path=require('path'),net=require('net'),dns=require('dns');
const root=process.env.VG_APP_ROOT,req=n=>require(require.resolve(n,{paths:[root]}));
const env=req('dotenv').parse(fs.readFileSync(process.env.VG_ENV_PATH||path.join(root,'.env.development')));
if(!/^mongodb(?:\+srv)?:\/\/[^/]+\/vidyagramdb(?:\?|$)/.test(env.MONGO_URI||''))throw Error('wrong_tenant_database');
let driver;try{driver=req('mongodb');}catch{driver=req('mongoose').mongo;}
const requests=require('./vidyagram-apx-request-client.cjs');const p=require('./vidyagram-completion-pilot.cjs');
const code=x=>typeof x==='string'&&/^[A-Z][A-Z0-9_]{1,60}$/.test(x)?x:null;
const causes=e=>[e,e?.cause,...(e?.cause?.errors||[])].filter(Boolean).map(x=>({name:x.name,code:code(x.code),syscall:['connect','getaddrinfo','read','write'].includes(x.syscall)?x.syscall:null,address:net.isIP(x.address||'')?x.address:null}));
(async()=>{const client=new driver.MongoClient(env.MONGO_URI,{minPoolSize:0,maxPoolSize:3,readPreference:'primary',serverSelectionTimeoutMS:15000});try{
 await client.connect();const db=client.db('vidyagramdb');const token=await db.collection('apxtestusertokens').findOne({orgId:'2177599'},{sort:{mintedAt:-1}});const job=await db.collection('apx_vg_completion_jobs').findOne({orgId:'2177599',apxUserId:token?.apxUserId});if(!token?.token||!job?.courses?.length)throw Error('cached_fixture_missing');
 const config={host:require('os').hostname(),node:process.version,egress:process.env.VG_EGRESS_ID,autoSelectFamily:net.getDefaultAutoSelectFamily(),attemptTimeoutMs:net.getDefaultAutoSelectFamilyAttemptTimeout(),dnsOrder:dns.getDefaultResultOrder(),resolved:{}};
 for(const host of ['cms.appx.co.in','armathsapi.akamai.net.in'])config.resolved[host]=await dns.promises.lookup(host,{all:true}).catch(e=>({code:code(e.code)}));
 console.log(JSON.stringify({event:'vg-network-diagnostic-settings',...config}));
 let ok=0,failed=0;const original=global.fetch;
 global.fetch=async(...args)=>{try{return await original(...args);}catch(e){console.log(JSON.stringify({event:'vg-network-diagnostic-cause',at:new Date(),host:config.host,endpoint:new URL(args[0]).pathname,causes:causes(e)}));throw e;}};
 const rounds=Number(process.env.VG_DIAGNOSTIC_READS||20);if(!Number.isInteger(rounds)||rounds<1||rounds>200)throw Error('invalid_diagnostic_budget');
 for(let i=0;i<rounds;i++){
  try{if(i%2===0)await p.adminUser(db,token.apxUserId);
   else{const u=new URL('https://armathsapi.akamai.net.in/get/getVideoCompletion');u.searchParams.set('item_id',job.courses[0].apxCourseId);u.searchParams.set('item_type','10');const r=await requests.clientFor(db).request(u,{Accept:'*/*','Auth-Key':'appxapi','Client-Service':'Appx',Authorization:token.token,'User-ID':token.apxUserId,Origin:'https://vidyagram.online',Referer:'https://vidyagram.online/',source:'website','User-Agent':'Mozilla/5.0'});if(r.http!==200||Number(r.body?.status)!==200)throw Object.assign(Error('source_non200'),{http:r.http});}
   ok++;
  }catch(e){failed++;console.log(JSON.stringify({event:'vg-network-diagnostic-failed',at:new Date(),index:i,code:code(e.code),http:e.http??null,causes:causes(e)}));if(e.http===403||e.http===429)break;}
 }
 console.log(JSON.stringify({event:'vg-network-diagnostic-complete',at:new Date(),host:config.host,ok,failed,otpSends:0}));
}finally{await client.close();}})().catch(e=>{console.error(JSON.stringify({event:'vg-network-diagnostic-aborted',name:e.name,code:code(e.code)}));process.exitCode=1;});
