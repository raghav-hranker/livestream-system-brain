// Existing dedicated sheet switches only after the follow-on run activates; no AppX calls.
'use strict';
const fs=require('fs'),path=require('path'),{spawn}=require('child_process');
const RUN='vg-completion-20261105-follow1000',cutoff=Date.parse('2026-11-05T03:30:00Z'),root=process.env.VG_APP_ROOT;
const req=n=>require(require.resolve(n,{paths:[root]})),env=req('dotenv').parse(fs.readFileSync(process.env.VG_ENV_PATH));
if(!/^mongodb(?:\+srv)?:\/\/[^/]+\/vidyagramdb(?:\?|$)/.test(env.MONGO_URI||''))throw Error('wrong_tenant');
const {MongoClient}=req('mongoose').mongo,c=new MongoClient(env.MONGO_URI,{minPoolSize:0,maxPoolSize:2,readPreference:'primary',serverSelectionTimeoutMS:15000});
(async()=>{try{await c.connect();while(Date.now()<cutoff){
 const r=await c.db('vidyagramdb').collection('apx_vg_completion_pilots').findOne({_id:RUN},{projection:{stopped:1,finishedAt:1,status:1}});
 if(r&&!r.stopped&&!r.finishedAt){
  console.log(JSON.stringify({event:'follow-sheet-starting',at:new Date()}));
  await c.close();const child=spawn('flock',['-w','120',path.join(process.cwd(),'sheet.lock'),process.execPath,path.join(process.cwd(),'vidyagram-completion-sheet.cjs')],{env:{...process.env,VG_COMPLETION_RUN:RUN},stdio:'inherit'});
  child.on('error',()=>{console.error(JSON.stringify({event:'follow-sheet-failed'}));process.exitCode=1;});await new Promise(resolve=>child.on('exit',resolve));return;
 }
 await new Promise(resolve=>setTimeout(resolve,15000));
 }}finally{await c.close();}})().catch(e=>{console.error(JSON.stringify({event:'follow-sheet-aborted',error:e.name}));process.exitCode=1;});
