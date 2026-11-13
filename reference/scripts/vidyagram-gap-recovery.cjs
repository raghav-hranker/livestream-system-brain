// Read-only preview for recovering the 33 AppX segment-gap videos (Vidyagram 781) from their complete qualities.
// Inputs: gap-qualities.json (11-11 full scan). Reads the AppX session from vidyagramdb on webserver2-2 (in memory only),
// then runs vidyagram-gap-recovery-runtime.js. Output: vidyagram/reports/appx-gap-recovery-2026-11-11/preview.json.
// There is no apply mode in this file.
const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process'),{createRequire}=require('module');
const base=path.resolve(__dirname,'../..'),out=base+'/vidyagram/reports/appx-gap-recovery-2026-11-11';fs.mkdirSync(out,{recursive:true});
const probe=JSON.parse(fs.readFileSync(base+'/vidyagram/reports/appx-missing-verification-2026-10-29/gap-qualities.json'));
const verification=JSON.parse(fs.readFileSync(base+'/vidyagram/reports/appx-missing-verification-2026-10-29/verification.json'));
const samples=probe.candidates.map(c=>({job:c.job,classId:c.classId,title:c.title,course:c.course,rowId:c.rowId,oldAssetKey:verification.candidates.find(v=>v.classId===c.classId).oldAssetKey,
 qualities:c.qualityChecks.map(q=>({label:q.quality,complete:!!q.segmentChecks?.complete,segments:q.segments}))}));
if(samples.length!==33||samples.some(s=>!s.oldAssetKey))throw Error('Gap33Guard');
let runtime=fs.readFileSync(__dirname+'/vidyagram-candidate-fullcheck-runtime.js','utf8');const marker='(async()=>{const list=';const split=runtime.indexOf(marker);if(split<0)throw Error('RuntimeMarker');
runtime=runtime.slice(0,split)+fs.readFileSync(__dirname+'/vidyagram-gap-recovery-runtime.js','utf8');
runtime=runtime.replace('SAMPLE_DATA',JSON.stringify(samples)).replace('EXPECTED_SCOPE','33');
const remote=String.raw`const root='/var/www/backend.vidyagramar.com/vidyagram-backend';const req=require('module').createRequire(root+'/package.json');const fs=require('fs');const env=req('dotenv').parse(fs.readFileSync(root+'/.env.development'));const {MongoClient}=req('mongoose').mongo;(async()=>{const c=new MongoClient(env.MONGO_URI,{serverSelectionTimeoutMS:12000});try{await c.connect();const docs=await c.db('vidyagramdb').collection('apxsessions').find({orgId:'2177599',customerId:'781',isActive:true},{projection:{session_id:1}}).toArray();if(docs.length!==1||!docs[0].session_id)throw Error('SessionGuard');process.stdout.write(docs[0].session_id);}finally{await c.close();}})().catch(()=>process.exitCode=1);`;
function loadSession(){return execFileSync('ssh',['-o','BatchMode=yes','-o','ConnectTimeout=10','-i',process.env.HOME+'/.ssh/hranker-webserver2-2','hranker@148.113.49.18','/home/hranker/.nvm/versions/node/v22.22.2/bin/node -'],{input:remote,maxBuffer:16384});}
runtime=runtime.replace("const axios=require('axios'),crypto=require('crypto');","const axios=require('axios'),crypto=require('crypto');axios.interceptors.request.use(cfg=>{if(new URL(cfg.url).hostname==='cms.appx.co.in'){secret=readCurrentSession();if(cfg.headers?.set)cfg.headers.set('Cookie','apx-aside-collapse=1; ci_session='+secret);else cfg.headers.Cookie='apx-aside-collapse=1; ci_session='+secret;}return cfg;});");
const repo=base+'/.worktrees/vg-media-video-repair',req=createRequire(repo+'/survey-runtime.cjs');
const read=()=>{const b=loadSession();const v=b.toString().trim();b.fill(0);return v;};
const safeConsole={log:line=>{if(line.startsWith('RESULT ')){const r=JSON.parse(line.slice(7));fs.writeFileSync(out+'/preview.json',JSON.stringify(r,null,2));if(!r.checkpoint||r.completedAt)console.log(JSON.stringify({checked:r.candidates.length,requests:r.requests,error:r.error,complete:!!r.completedAt}));}else if(line.startsWith('{"progress"'))console.log(line);}};
new Function('require','readEphemeralSession','readCurrentSession','LOCAL_TS_PROJECT','process','console',runtime)(req,read,read,repo+'/tsconfig.json',process,safeConsole);
