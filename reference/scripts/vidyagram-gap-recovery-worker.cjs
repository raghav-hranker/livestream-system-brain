// One-shot copy inside the running apx-ingest-781 container (image a75c030). No queue loop or config change.
// Pinned to the 33 AppX segment-gap jobs (JOB_CLASS_MAP is filled in from plan.json by the apply driver).
// Copies only the renditions it is given, validates every segment body, and publishes the master last with the
// standard Vidyagram menu (mirror-master.js MENU, complete rungs only; 144p only without 1080p; 1080p last as 1920x1080).
'use strict';
const fs=require('fs'),crypto=require('crypto'),{spawnSync}=require('child_process');
const {makeMirrorDeps,resolveOutputTarget}=require('/app/mirror-deps.js');
const {mirrorRung,hlsKey,M3U8_CONTENT_TYPE}=require('/app/mirror.js');
const {MENU}=require('/app/mirror-master.js');
const classMap=JOB_CLASS_MAP;
const refs=t=>t.split(/\r?\n/).map(x=>x.trim()).filter(x=>x&&!x.startsWith('#'));
const hash=(t,u)=>crypto.createHash('sha256').update(refs(t).map(x=>new URL(x,u).pathname).join('\n')).digest('hex');
(async()=>{const job=JSON.parse(fs.readFileSync(0,'utf8'));
 if(process.env.CLIENT_ID!=='781'||job.clientId!=='781'||!Object.prototype.hasOwnProperty.call(classMap,job.jobId)||classMap[job.jobId]!==job.classId)throw Error('TenantScope');
 const target=resolveOutputTarget();if(target.bucket!=='recordedvideos-vidyagram')throw Error('BucketGuard');
 if(new URL(process.env.API_URL).hostname!=='backend.vidyagramar.com'||process.env.MIRROR_REPORTING!=='secured')throw Error('ApiTenantGuard');
 const rungsAllowed=['1080p','480p','360p','240p'];if(!job.renditions.length||job.renditions.some(r=>!rungsAllowed.includes(r.rung))||new Set(job.renditions.map(r=>r.rung)).size!==job.renditions.length)throw Error('RenditionScope');
 const deps=makeMirrorDeps({clientId:'781',jobId:job.jobId,apiUrl:process.env.API_URL,lmsBase:process.env.LMS_BASE||'https://backend.vidyagramar.com',mp4:false,concurrency:4});
 const tick=deps.logProgress.tickRung.bind(deps.logProgress);
 deps.logProgress.tickRung=async(rung,p)=>{await tick(rung,p);if(p.segsDone%100===0||p.segsDone===p.segsTotal)console.log(JSON.stringify({progress:'segments copied',rung,segsDone:p.segsDone,segsTotal:p.segsTotal}));};
 const fetchSegment=deps.fetchSegment;
 deps.fetchSegment=async u=>{const b=await fetchSegment(u);if(!(b.length>376&&b[0]===71&&b[188]===71&&b[376]===71))throw Error('InvalidMediaBytes');return b;};
 const entries=[];
 for(const p of job.renditions){const url=p.sourceUrl;if(!/^https:\/\//.test(url))throw Error('SourceHttps');const text=await deps.fetchPlaylist(url);
  if(!text.includes('#EXT-X-ENDLIST')||/#EXT-X-(KEY|MAP|STREAM-INF)/.test(text)||hash(text,url)!==p.inventoryHash||refs(text).length!==p.segments)throw Error('InventoryChanged');
  const b=await deps.fetchSegment(new URL(refs(text)[0],url).href);
  const probe=spawnSync('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=width,height','-of','json','-i','pipe:0'],{input:b,timeout:20000,maxBuffer:1048576});
  if(probe.status!==0)throw Error('DimensionProbeFailed');const d=JSON.parse(probe.stdout).streams?.[0];
  if(d?.width!==p.width||d?.height!==p.height)throw Error('SourceDimensionsChanged');entries.push({...p,url});}
 await deps.logProgress.setPhase('claimed');await deps.reportDownloading(job.jobId);await deps.logProgress.setPhase('downloading');
 const copied={};
 for(const e of entries){const r=await mirrorRung(job.classId,e.url,e.rung,deps);if(r.segmentCount!==e.segments)throw Error('CopyCountMismatch');copied[e.rung]=r;
  console.log(JSON.stringify({progress:'rendition copied',job:job.jobId,rung:e.rung,segments:r.segmentCount}));}
 const lines=['#EXTM3U','#EXT-X-VERSION:3'];
 for(const m of MENU){if(!copied[m.rung])continue;if(m.name==='144p'&&copied['1080p'])continue;lines.push(`#EXT-X-STREAM-INF:BANDWIDTH=${Math.round(copied[m.rung].peakBandwidth)},RESOLUTION=${m.resolution},NAME="${m.name}"`,m.file);}
 if(copied['1080p'])lines.push(`#EXT-X-STREAM-INF:BANDWIDTH=${Math.round(copied['1080p'].peakBandwidth)},RESOLUTION=1920x1080,NAME="1080p"`,'1080p.m3u8');
 const master=lines.join('\n')+'\n';const labels=lines.filter(l=>l.startsWith('#EXT-X-STREAM-INF')).map(l=>l.match(/NAME="([^"]+)"/)[1]);
 if(JSON.stringify(labels)!==JSON.stringify(job.menuLabels.slice().sort((a,b)=>order(a)-order(b))))throw Error('MenuMismatch');
 await deps.logProgress.setPhase('publishing');
 await deps.uploadObject({key:hlsKey(job.classId,'master.m3u8',{clientId:'781'}),body:Buffer.from(master),contentType:M3U8_CONTENT_TYPE});
 await deps.putClassLink({classId:job.classId,classLink:deps.masterUrl(job.classId)});
 await deps.reportComplete(job.jobId);await deps.logProgress.setPhase('complete',{classLink:deps.masterUrl(job.classId)});
 console.log('RESULT '+JSON.stringify({job:job.jobId,classId:job.classId,ok:true,allSegmentBodiesValidated:true,menu:labels,renditions:Object.values(copied).map(r=>({rung:r.rung,segmentCount:r.segmentCount,peakBandwidth:r.peakBandwidth,bytes:r.bytes}))}));
})().catch(e=>{console.error(JSON.stringify({ok:false,error:e.name,reason:/^[A-Za-z]+$/.test(e.message)?e.message:'CopyOrCallbackFailed'}));process.exitCode=1;});
function order(n){return ['144p','240p','360p','480p','720p','1080p'].indexOf(n);}
