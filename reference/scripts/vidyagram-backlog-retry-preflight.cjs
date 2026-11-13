// Read-only all-job source survey. The maintained Vidyagram session is read locally
// into memory and sent only as an HTTPS cookie to the official CMS. No DB writes.
// An optional temporary handoff is consumed/deleted instead; no credentials are saved.
const fs=require('fs'),path=require('path'),{createRequire}=require('module');
const base=path.resolve(__dirname,'..','..'),out=path.join(base,'vidyagram/reports/appx-backlog-retry-2026-10-27');
const report=path.join(base,'vidyagram/reports/appx-sync-verify-2026-10-26');
const ledger=JSON.parse(fs.readFileSync(path.join(report,'apxcatalogimports.json')));
const dead=JSON.parse(fs.readFileSync(path.join(base,'vidyagram/reports/appx-sync-repair-2026-10-26/media-video/dead-job-source-eligibility.json')));
const inventory=JSON.parse(fs.readFileSync(path.join(base,'vidyagram/reports/appx-backlog-survey-2026-10-27/inventory.json')));
const qualified=JSON.parse(fs.readFileSync(path.join(base,'vidyagram/reports/appx-backlog-survey-2026-10-27/summary.json'))).rows.filter(x=>x.recoveryCandidate);
const canaryIds=[qualified[0].job,qualified[1].job,qualified.find(x=>x.inventory.errorCategory==='noPlayableURL').job];
const phase=process.argv[2]||'--canary';if(!['--canary','--rest'].includes(phase))throw Error('PhaseGuard');
const selected=qualified.filter(x=>phase==='--canary'?canaryIds.includes(x.job):!canaryIds.includes(x.job));
const samples=selected.map(x=>({job:x.job,classId:x.classId,oldAssetKey:x.oldAssetKey,category:x.inventory.errorCategory,currentlyPlanned:true,course:x.course,rowId:x.rowId}));
const remote=String.raw`
const fs=require('fs'),crypto=require('crypto');
let secret=readEphemeralSession();if(!secret)throw Object.assign(new Error(),{name:'MissingSession'});
process.env.TS_NODE_PROJECT=LOCAL_TS_PROJECT;require('ts-node/register/transpile-only');
const axios=require('axios');const {createHttpCatalogSource}=require('./src/services/apx/apxCatalogHttpSource');
const {deriveApxAssetKey}=require('./src/services/apx/apxAssetKey');const{usableClassLink}=require('./src/services/apx/apxCatalogPlanner');
const{selectBestPath,selectDrmPath}=require('./src/services/apx/apxVideoTokenService');
const base='https://cms.appx.co.in',start=new Date(),budget=1600;let calls=0,sessionLost=false,lastAt=0;
const results={observedAt:start.toISOString(),readOnly:true,budget,steps:[],deadSourceSamples:[],geometry:[],pdfMetadata:[],requestTelemetry:[]};
const hash=s=>crypto.createHash('sha256').update(String(s)).digest('hex');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
axios.interceptors.request.use(async config=>{const cookie=config.headers?.get?.('Cookie')||config.headers?.Cookie||config.headers?.cookie;const destination=new URL(config.url);if(cookie&&(destination.protocol!=='https:'||destination.hostname!=='cms.appx.co.in'))throw Object.assign(new Error(),{name:'CredentialDestinationRefused'});if(cookie)config.maxRedirects=0;if(++calls>budget)throw Object.assign(new Error(),{name:'SurveyBudgetExceeded'});const wait=lastAt+1100-Date.now();if(wait>0)await sleep(wait);lastAt=Date.now();return config;});
axios.interceptors.response.use(r=>{let b;try{b=typeof r.data==='string'?JSON.parse(r.data):r.data;}catch{};const rawEndpoint=String(r.config.url).split('?')[0].split('/').at(-1);const endpoint=['get_all_courses','get_course_by_id','get_pc4_contents','getFolderPaths','get_content_by_id','folder_contentsv3','get_video_token'].includes(rawEndpoint)?rawEndpoint:'source-manifest';results.requestTelemetry.push({endpoint,http:r.status,rows:Array.isArray(b?.aaData)?b.aaData.length:Array.isArray(b?.data)?b.data.length:null,total:b?.recordsTotal??b?.iTotalRecords??null});return r;});
const memoryDb={collection:n=>{if(n!=='apxsessions')throw Object.assign(new Error(),{name:'ForbiddenDatabaseAccess'});return {find:()=>({toArray:async()=>[{session_id:secret,orgId:'2177599'}]})};}};
const source=createHttpCatalogSource({db:memoryDb,sessionDb:memoryDb,customerId:'781',orgId:'2177599',tenantApiBase:'https://armathsapi.akamai.net.in',gapMs:1100,timeoutMs:45000,listingTimeoutMs:45000});
async function step(name,fn){if(sessionLost)return null;const at=new Date();try{const data=await fn();results.steps.push({name,ok:true,at:at.toISOString(),milliseconds:Date.now()-at});console.log(JSON.stringify({progress:name,ok:true}));return data;}catch(e){if(e.name==='SessionLost')sessionLost=true;results.steps.push({name,ok:false,at:at.toISOString(),milliseconds:Date.now()-at,error:e.name,http:e.status??e.response?.status??null});console.log(JSON.stringify({progress:name,ok:false,error:e.name}));return null;}}
const stripRow=r=>({id:String(r.id??r.rowId??''),title:String(r.title??r.Title??''),type:r.type??r.material_type??null,enabled:r.enable??null,deleted:r.deleted??null,assetKey:deriveApxAssetKey(usableClassLink(r)),hasUsableLink:!!usableClassLink(r)});
async function tokenProbe(course,rowId,raw){
 const form=new URLSearchParams({course_id:course,video_id:rowId,ytflag:'1',folder_wise_course:'1',recaptcha_token:'',video_url:usableClassLink(raw)||'',uhsVersion:'0.00'});
 const r=await axios.post(base+'/common/get_video_token',form.toString(),{timeout:30000,maxRedirects:0,family:4,validateStatus:()=>true,headers:{Accept:'application/json','Content-Type':'application/x-www-form-urlencoded; charset=UTF-8',Cookie:'apx-aside-collapse=1; ci_session='+secret,Referer:base+'/', 'User-Agent':'Mozilla/5.0','X-Requested-With':'XMLHttpRequest'}});
 const b=r.data&&typeof r.data==='object'?r.data:{};const url=selectBestPath(b.urls)||selectDrmPath(b);
 if(!url)return {http:r.status,hasUsableUrl:false,allWorkerChecksPassed:false};
 async function checkMedia(mediaUrl){const url=mediaUrl;const summary={http:r.status,hasUsableUrl:true,segments:[]};
 const headers={Referer:'https://appx-play.akamai.net.in/',Origin:'https://appx-play.akamai.net.in'};
 async function manifest(u){const x=await axios.get(u,{timeout:20000,maxRedirects:0,family:4,validateStatus:()=>true,maxContentLength:2097152,responseType:'text',headers});return {http:x.status,text:typeof x.data==='string'?x.data:''};}
 let u=url,m=await manifest(u);summary.sourceHttp=m.http;summary.manifest=m.text.startsWith('#EXTM3U');if(m.http!==200||!summary.manifest)return summary;
 if(m.text.includes('#EXT-X-STREAM-INF')){const lines=m.text.split(/\r?\n/);const i=lines.findIndex(x=>x.startsWith('#EXT-X-STREAM-INF'));const relative=lines.slice(i+1).find(x=>x.trim()&&!x.startsWith('#'));if(!relative){summary.mediaPlaylistMissing=true;return summary;}u=new URL(relative.trim(),u).href;m=await manifest(u);summary.childHttp=m.http;if(m.http!==200||!m.text.startsWith('#EXTM3U'))return summary;}
 const segments=m.text.split(/\r?\n/).map(x=>x.trim()).filter(x=>x&&!x.startsWith('#'));
 summary.segmentCount=segments.length;summary.endList=m.text.includes('#EXT-X-ENDLIST');summary.encrypted=m.text.includes('#EXT-X-KEY');
 for(const index of [...new Set([0,Math.floor(segments.length/2),segments.length-1])].filter(x=>x>=0&&segments.length)){
  let stream;try{const response=await axios.get(new URL(segments[index],u).href,{timeout:20000,maxRedirects:0,family:4,validateStatus:()=>true,responseType:'stream',headers:{...headers,Range:'bytes=0-4095'}});stream=response.data;let chunks=[],n=0;for await(const chunk of stream){chunks.push(chunk.subarray(0,Math.max(0,4096-n)));n+=Math.min(chunk.length,Math.max(0,4096-n));if(n>=4096)break;}const bytes=Buffer.concat(chunks);const tsSync=bytes.length>=377&&bytes[0]===71&&bytes[188]===71&&bytes[376]===71;const mp4=['ftyp','styp','moof','sidx'].includes(bytes.subarray(4,8).toString('ascii'));const looksLikeError=/^\s*(?:<!|<html|\{)/i.test(bytes.subarray(0,80).toString('ascii'))||/html|json/i.test(String(response.headers['content-type']||''));summary.segments.push({index,http:response.status,bytesRead:bytes.length,tsSync,mp4,looksLikeError,mediaLike:!looksLikeError&&bytes.length>=188&&(tsSync||mp4||summary.encrypted)});}catch(e){summary.segments.push({index,error:e.name});}finally{stream?.destroy();}
 }
 summary.allSampledSegmentsReadable=summary.segments.length>0&&summary.segments.every(x=>[200,206].includes(x.http)&&x.mediaLike);
 return summary;
 }
 const {RUNGS,deriveRungUrl}=require('/Users/raghav/Projects/worktrees/vt-client-781/apx-ingest-container/mirror-rung-url.js');
 const checks=[];for(const rung of RUNGS){const probe=await checkMedia(deriveRungUrl(url,rung));checks.push({rung,...probe});}
 const high=Array.isArray(b.urls)?b.urls.find(x=>String(x.quality).toLowerCase()==='1080p'&&x.path):null;
 if(high)checks.push({rung:'1080p',...await checkMedia(high.path)});
 return {http:r.status,hasUsableUrl:true,checks,allWorkerChecksPassed:checks.every(x=>x.allSampledSegmentsReadable),optional1080Present:!!high};
}
(async()=>{
 const auth=await step('authentication and course list',()=>source.courseListPage(0,1000));
 if(!auth)throw Object.assign(new Error(),{name:'AuthenticationProbeFailed'});
 results.courseList={count:auth.rows.length,total:auth.total};
 const samples=SAMPLE_DATA;
 const coursePages=new Map();for(const course of [...new Set(samples.map(x=>x.course))]){const rows=await step('fallback course listing '+course,()=>source.contentPage(course,0,10000));if(rows&&rows.length<10000)coursePages.set(course,rows);}

 for(const sample of samples){const rows=coursePages.get(sample.course);const match=rows?.find(x=>String(x.id)===sample.rowId);const body=match?{body:{allRecord:[{...match,course_id:sample.course}]}}:null;const record={...sample};if(!body){record.result='source detail unavailable';results.deadSourceSamples.push(record);continue;}const raw=body.body.allRecord.find(r=>String(r.course_id)===sample.course);if(!raw){record.result='exact course occurrence absent';results.deadSourceSamples.push(record);continue;}record.source=stripRow(raw);record.sameAsset=record.source.assetKey===sample.oldAssetKey;if(record.sameAsset&&record.source.hasUsableLink){const probe=await step('dead token '+sample.rowId,()=>tokenProbe(sample.course,sample.rowId,raw));record.tokenProbe=probe;}else record.result=record.sameAsset?'source still no usable link':'source asset changed';results.deadSourceSamples.push(record);console.log('RESULT '+JSON.stringify({...results,requests:calls,checkpoint:true}));}
 secret='';results.completedAt=new Date().toISOString();results.requests=calls;results.sessionLost=sessionLost;console.log('RESULT '+JSON.stringify(results));
})().catch(e=>{secret='';console.log('RESULT '+JSON.stringify({...results,completedAt:new Date().toISOString(),requests:calls,error:e.name,sessionLost}));process.exitCode=1;});
`.replace('SAMPLE_DATA',JSON.stringify(samples));
async function main(){
 const secretFile='/private/tmp/vidyagram-cms-session-survey.secret';let bytes;
 if(fs.existsSync(secretFile)){const st=fs.statSync(secretFile);if(st.mode&0o077)throw Error('SecretPermissions');bytes=fs.readFileSync(secretFile);if(!bytes.length||bytes.length>4096)throw Error('SecretLength');fs.unlinkSync(secretFile);}
 else {const root='/Users/raghav/Projects/worktrees/vg-backend';const {MongoClient}=require(root+'/node_modules/mongoose').mongo;const env=require(root+'/node_modules/dotenv').parse(fs.readFileSync('/Users/raghav/Projects/worktrees/vg-class-import/.env.development'));const m=env.MONGO_URI.match(/^(mongodb:\/\/)([^/]+)(\/[^?]*)?(?:\?(.*))?$/);if(!m)throw Error('UriForm');const q=new URLSearchParams(m[4]||'');q.set('directConnection','true');q.set('readPreference','primary');const uri=m[1]+m[2].slice(0,m[2].lastIndexOf('@')+1)+'127.0.0.1:27019'+(m[3]||'/vidyagramdb')+'?'+q;const client=new MongoClient(uri,{serverSelectionTimeoutMS:12000});try{await client.connect();const docs=await client.db('vidyagramdb').collection('apxsessions').find({orgId:'2177599',customerId:'781',isActive:true},{projection:{session_id:1}}).toArray();if(docs.length!==1||!docs[0].session_id)throw Error('MissingActiveSession');bytes=Buffer.from(docs[0].session_id);}finally{await client.close();}}
 console.log('Local-memory authentication ready; only sanitized survey progress follows.');
 const repo=path.join(base,'.worktrees/vg-media-video-repair'),localRequire=createRequire(path.join(repo,'survey-runtime.cjs'));
 const safeConsole={log:line=>{if(typeof line!=='string')return;if(line.startsWith('RESULT ')){try{const result=JSON.parse(line.slice(7));result.transport='direct local HTTPS; session cookie only to cms.appx.co.in';fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'preflight-'+phase.slice(2)+'.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({saved:true,requests:result.requests,sessionLost:result.sessionLost,error:result.error??null,courseCount:result.courseList?.count,steps:result.steps.length}));}catch{console.error('survey_result_invalid');process.exitCode=1;}}else if(line.startsWith('{"progress"')){try{const p=JSON.parse(line);console.log(JSON.stringify({progress:p.progress,ok:p.ok,error:p.error}));}catch{}}}};
 let consumed=false;
 const readEphemeralSession=()=>{if(consumed)throw Error('already consumed');consumed=true;const value=bytes.toString('utf8').trim();bytes.fill(0);return value;};
 const fn=new Function('require','readEphemeralSession','LOCAL_TS_PROJECT','process','console',remote);
 try{fn(localRequire,readEphemeralSession,path.join(repo,'tsconfig.json'),process,safeConsole);}catch(e){bytes.fill(0);throw e;}
}
main().catch(e=>{console.error('survey_startup_failed',e.name);process.exitCode=1;});
