// Read-only all-job source survey. The maintained Vidyagram session is read locally
// into memory and sent only as an HTTPS cookie to the official CMS. No DB writes.
// An optional temporary handoff is consumed/deleted instead; no credentials are saved.
const fs=require('fs'),path=require('path'),{createRequire}=require('module');
const base=path.resolve(__dirname,'..','..'),out=path.join(base,'vidyagram/reports/appx-four-quality-recovery-2026-10-27');
const report=path.join(base,'vidyagram/reports/appx-sync-verify-2026-10-26');
const ledger=JSON.parse(fs.readFileSync(path.join(report,'apxcatalogimports.json')));
const dead=JSON.parse(fs.readFileSync(path.join(base,'vidyagram/reports/appx-sync-repair-2026-10-26/media-video/dead-job-source-eligibility.json')));
const inventory=JSON.parse(fs.readFileSync(path.join(base,'vidyagram/reports/appx-backlog-survey-2026-10-27/inventory.json')));
const qualified=JSON.parse(fs.readFileSync(path.join(base,'vidyagram/reports/appx-backlog-survey-2026-10-27/summary.json'))).rows.filter(x=>x.recoveryCandidate);
const {BSON}=require('/Users/raghav/Projects/worktrees/vg-backend/node_modules/mongoose').mongo;
const queued=BSON.EJSON.parse(fs.readFileSync(path.join(base,'vidyagram/reports/appx-backlog-retry-2026-10-27/queue-canary.ejson'),'utf8'));
const before=BSON.EJSON.parse(fs.readFileSync(path.join(base,'vidyagram/reports/appx-backlog-retry-2026-10-27/before.ejson'),'utf8'));
const selected=JSON.parse(fs.readFileSync(path.join(base,'vidyagram/reports/appx-candidate-complete-check-2026-10-27/summary.json'))).candidates.filter(x=>x.outcome==='required rendition playlist unavailable or unsupported');if(selected.length!==4)throw Error('ExactFourGuard');const unresolvedMode=false;
const samples=selected.map(x=>({...x,originalFailure:null,renditions:undefined,segmentChecks:undefined}));
const remote=fs.readFileSync(path.join(__dirname,'vidyagram-four-quality-execute-runtime.js'),'utf8').replace('SAMPLE_DATA',JSON.stringify(samples)).replace('EXPECTED_SCOPE','4');
async function main(){
 const secretFile='/private/tmp/vidyagram-cms-session-survey.secret';let bytes;
 if(fs.existsSync(secretFile)){const st=fs.statSync(secretFile);if(st.mode&0o077)throw Error('SecretPermissions');bytes=fs.readFileSync(secretFile);if(!bytes.length||bytes.length>4096)throw Error('SecretLength');fs.unlinkSync(secretFile);}
 else {const root='/Users/raghav/Projects/worktrees/vg-backend';const {MongoClient}=require(root+'/node_modules/mongoose').mongo;const env=require(root+'/node_modules/dotenv').parse(fs.readFileSync('/Users/raghav/Projects/worktrees/vg-class-import/.env.development'));const m=env.MONGO_URI.match(/^(mongodb:\/\/)([^/]+)(\/[^?]*)?(?:\?(.*))?$/);if(!m)throw Error('UriForm');const q=new URLSearchParams(m[4]||'');q.set('directConnection','true');q.set('readPreference','primary');const uri=m[1]+m[2].slice(0,m[2].lastIndexOf('@')+1)+'127.0.0.1:27019'+(m[3]||'/vidyagramdb')+'?'+q;const client=new MongoClient(uri,{serverSelectionTimeoutMS:12000});try{await client.connect();const docs=await client.db('vidyagramdb').collection('apxsessions').find({orgId:'2177599',customerId:'781',isActive:true},{projection:{session_id:1}}).toArray();if(docs.length!==1||!docs[0].session_id)throw Error('MissingActiveSession');bytes=Buffer.from(docs[0].session_id);}finally{await client.close();}}
 console.log('Local-memory authentication ready; only sanitized survey progress follows.');
 const repo=path.join(base,'.worktrees/vg-media-video-repair'),localRequire=createRequire(path.join(repo,'survey-runtime.cjs'));
 const safeConsole={log:line=>{if(typeof line!=='string')return;if(line.startsWith('RESULT ')){try{const result=JSON.parse(line.slice(7));result.transport='direct local HTTPS; session cookie only to cms.appx.co.in';fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,(unresolvedMode?'unresolved-check.json':'execution.json')),JSON.stringify(result,null,2));console.log(JSON.stringify({saved:true,requests:result.requests,sessionLost:result.sessionLost,error:result.error??null,courseCount:result.courseList?.count,steps:result.steps.length}));}catch{console.error('survey_result_invalid');process.exitCode=1;}}else if(line.startsWith('{"progress"')){try{const p=JSON.parse(line);console.log(JSON.stringify({progress:p.progress,ok:p.ok,error:p.error}));}catch{}}}};
 let consumed=false;
 const readEphemeralSession=()=>{if(consumed)throw Error('already consumed');consumed=true;const value=bytes.toString('utf8').trim();bytes.fill(0);return value;};
 const fn=new Function('require','readEphemeralSession','LOCAL_TS_PROJECT','process','console',remote);
 try{fn(localRequire,readEphemeralSession,path.join(repo,'tsconfig.json'),process,safeConsole);}catch(e){bytes.fill(0);throw e;}
}
main().catch(e=>{console.error('survey_startup_failed',e.name);process.exitCode=1;});
