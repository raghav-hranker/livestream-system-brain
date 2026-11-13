// Isolated one-shot execution inside existing 781 image. No queue loop/config change.
'use strict';
const fs=require('fs'),crypto=require('crypto'),{spawnSync}=require('child_process');
const {makeMirrorDeps,resolveOutputTarget}=require('/app/mirror-deps.js');
const {mirrorRung,hlsKey,M3U8_CONTENT_TYPE}=require('/app/mirror.js');
const {deriveRungUrl}=require('/app/mirror-rung-url.js');
const classMap={"6ace99fec9735682f04f0950":"6ace99fd8752d955968b70be","6ace996cc9735682f04f067c":"6ace996c8752d955968b678e","6ace9955c9735682f04f0614":"6ace99558752d955968b6629"};const allowed=new Set(Object.keys(classMap));
const refs=t=>t.split(/\r?\n/).map(x=>x.trim()).filter(x=>x&&!x.startsWith('#'));
const hash=(t,u)=>crypto.createHash('sha256').update(refs(t).map(x=>new URL(x,u).pathname).join('\n')).digest('hex');
(async()=>{const job=JSON.parse(fs.readFileSync(0,'utf8'));if(process.env.CLIENT_ID!=='781'||!allowed.has(job.jobId)||classMap[job.jobId]!==job.classId||job.clientId!=='781')throw Error('TenantScope');const target=resolveOutputTarget();if(target.bucket!=='recordedvideos-vidyagram')throw Error('BucketGuard');if(new URL(process.env.API_URL).hostname!=='backend.vidyagramar.com'||process.env.MIRROR_REPORTING!=='secured')throw Error('ApiTenantGuard');
 const deps=makeMirrorDeps({clientId:'781',jobId:job.jobId,apiUrl:process.env.API_URL,lmsBase:process.env.LMS_BASE||'https://backend.vidyagramar.com',mp4:false,concurrency:4});
 // Validate full segment bodies as they are copied. Cookies are never used here.
 const tick=deps.logProgress.tickRung.bind(deps.logProgress);deps.logProgress.tickRung=async(rung,p)=>{await tick(rung,p);if(p.segsDone%100===0||p.segsDone===p.segsTotal)console.log(JSON.stringify({progress:'segments copied',rung,segsDone:p.segsDone,segsTotal:p.segsTotal}));};
 const fetchSegment=deps.fetchSegment;deps.fetchSegment=async u=>{const b=await fetchSegment(u);if(!(b.length>376&&b[0]===71&&b[188]===71&&b[376]===71))throw Error('InvalidMediaBytes');return b;};
 const entries=[];for(const p of job.renditions){const url=p.sourceUrl,text=await deps.fetchPlaylist(url);if(!/^https:\/\//.test(url))throw Error('SourceHttps');if(!text.includes('#EXT-X-ENDLIST')||hash(text,url)!==p.inventoryHash||refs(text).length!==p.segments)throw Error('InventoryChanged');const b=await deps.fetchSegment(new URL(refs(text)[0],url).href);const probe=spawnSync('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=width,height','-of','json','-i','pipe:0'],{input:b,timeout:20000,maxBuffer:1048576});if(probe.status!==0)throw Error('DimensionProbeFailed');const d=JSON.parse(probe.stdout).streams?.[0];if(!d?.width||!d?.height)throw Error('NoVideoDimensions');if(d.height!==p.expectedHeight)throw Error('SourceDimensionsChanged');entries.push({...p,url,width:d.width,height:d.height});}
 await deps.logProgress.setPhase('claimed');await deps.reportDownloading(job.jobId);await deps.logProgress.setPhase('downloading');const copied=[];
 // Every selected rung must succeed; never omit an individual missing segment.
 for(const e of entries){const r=await mirrorRung(job.classId,e.url,e.rung,deps);if(r.segmentCount!==e.segments)throw Error('CopyCountMismatch');copied.push({...r,width:e.width,height:e.height});console.log(JSON.stringify({progress:'rendition copied',job:job.jobId,rung:e.rung,segments:r.segmentCount}));}
 let master='#EXTM3U\n#EXT-X-VERSION:3\n';for(const r of copied)master+=`#EXT-X-STREAM-INF:BANDWIDTH=${r.peakBandwidth},RESOLUTION=${r.width}x${r.height}\n${r.rung}.m3u8\n`;
 await deps.logProgress.setPhase('publishing');await deps.uploadObject({key:hlsKey(job.classId,'master.m3u8',{clientId:'781'}),body:Buffer.from(master),contentType:M3U8_CONTENT_TYPE});await deps.putClassLink({classId:job.classId,classLink:deps.masterUrl(job.classId)});await deps.reportComplete(job.jobId);await deps.logProgress.setPhase('complete',{classLink:deps.masterUrl(job.classId)});
 console.log('RESULT '+JSON.stringify({job:job.jobId,classId:job.classId,ok:true,allSegmentBodiesValidated:true,renditions:copied.map(r=>({rung:r.rung,segmentCount:r.segmentCount,peakBandwidth:r.peakBandwidth,width:r.width,height:r.height}))}));
})().catch(e=>{console.error(JSON.stringify({ok:false,error:e.name,reason:/^[A-Za-z]+$/.test(e.message)?e.message:'CopyOrCallbackFailed'}));process.exitCode=1;});
