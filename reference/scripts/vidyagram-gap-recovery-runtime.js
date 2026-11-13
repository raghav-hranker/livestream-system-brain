// Appended to the read-only media probe helpers (vidyagram-candidate-fullcheck-runtime.js).
// Preview for the 33 AppX segment-gap videos: per video, a fresh token; per AppX quality, the playlist again
// (segment count and inventory hash against the 11-11 probe); per complete quality, segment 0 downloaded whole
// and ffprobed for its dimensions. No catalogue, job or storage writes. URLs and tokens are never recorded.
(async()=>{
 const {spawnSync}=require('child_process');
 const list=await step('authenticated course list',()=>source.courseListPage(0,1000));if(!list)throw Object.assign(Error(),{name:'AuthenticationProbeFailed'});
 const controlRows=await source.contentPage('71',0,10000),controlRaw=controlRows.find(x=>String(x.id)==='189847');
 if(!controlRaw)throw Object.assign(Error(),{name:'MissingControl'});
 const control=await token('71','189847',controlRaw);results.controls.push({name:'Glands01',at:new Date().toISOString(),...control.summary,hasUsableUrl:!!control.url});if(!control.url)throw Object.assign(Error(),{name:'ControlFailed'});checkpoint();
 const pages=new Map();
 for(const course of [...new Set(samples.map(x=>x.course))]){const page=await source.contentPage(course,0,10000);if(page.length>=10000)throw Object.assign(Error(),{name:'TruncatedListing'});pages.set(course,page);progress('gap recovery listing '+course);}
 async function wholeSegment(url){const r=await axios.get(url,{timeout:30000,validateStatus:()=>true,responseType:'arraybuffer',maxContentLength:20971520,family:4,headers});const b=Buffer.from(r.data||[]);results.segmentBytes+=b.length;return {http:r.status,b};}
 function probe(b){const p=spawnSync('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=width,height,codec_name','-of','json','-i','pipe:0'],{input:b,timeout:20000,maxBuffer:1048576});if(p.status!==0)return null;const s=JSON.parse(p.stdout).streams?.[0];return s?.width&&s?.height?{width:s.width,height:s.height,codec:s.codec_name}:null;}
 for(const sample of samples){const record={job:sample.job,classId:sample.classId,title:sample.title,course:sample.course,rowId:sample.rowId,checkedAt:new Date().toISOString(),qualities:[]};results.candidates.push(record);
  const raw=pages.get(sample.course)?.find(x=>String(x.id)===sample.rowId);
  if(!raw){record.outcome='exact source occurrence absent';checkpoint();continue;}
  record.source={enabled:raw.enable,deleted:raw.deleted,sameAsset:deriveApxAssetKey(usableClassLink(raw))===sample.oldAssetKey};
  if(!record.source.sameAsset||String(raw.deleted)==='1'){record.outcome='source identity changed or deleted';checkpoint();continue;}
  try{const minted=await token(sample.course,sample.rowId,raw);record.token=minted.summary;if(!minted.url){record.outcome='AppX returned no playable URL';checkpoint();continue;}
   const advertised=Array.isArray(minted.body.urls)?minted.body.urls.filter(x=>typeof x.path==='string'&&x.path):[];
   for(const q of sample.qualities){const rec={label:q.label,completeOn1111:q.complete,segmentsOn1111:q.segments};record.qualities.push(rec);
    const hit=advertised.find(x=>String(x.quality).toLowerCase()===q.label.toLowerCase());if(!hit){rec.outcome='label no longer offered';continue;}
    const p=await playlist(hit.path);rec.http=p.http;
    if(p.http!==200||!p.text.startsWith('#EXTM3U')||!p.text.includes('#EXT-X-ENDLIST')||/#EXT-X-(KEY|MAP|STREAM-INF)/.test(p.text)){rec.outcome='not a clear final media playlist';continue;}
    const refs=mediaRefs(p.text);rec.segments=refs.length;rec.inventoryHash=crypto.createHash('sha256').update(refs.map(x=>new URL(x,hit.path).pathname).join('\n')).digest('hex');
    rec.durationSec=Math.round([...p.text.matchAll(/#EXTINF:([\d.]+)/g)].reduce((n,m)=>n+Number(m[1]),0));
    rec.sameAs1111=rec.segments===q.segments;
    if(!q.complete){rec.outcome='gap on 11-11; not planned';continue;}
    const s0=await wholeSegment(new URL(refs[0],hit.path).href);rec.seg0Http=s0.http;rec.seg0Bytes=s0.b.length;
    const d=s0.http===200?probe(s0.b):null;s0.b.fill(0);
    if(!d){rec.outcome='segment 0 not probeable';continue;}
    Object.assign(rec,d);rec.estimatedBytes=rec.seg0Bytes*rec.segments;rec.outcome=rec.sameAs1111?'planned':'playlist changed since 11-11';
   }
   record.outcome=record.qualities.some(q=>q.outcome==='planned')?'has a planned quality':'no plannable quality';
  }catch(e){record.outcome='source request unresolved';record.error=e.name;}
  checkpoint();progress('gap recovery '+results.candidates.length+'/'+samples.length);
 }
 const ending=await token('71','189847',controlRaw);results.controls.push({name:'Glands01 ending control',at:new Date().toISOString(),...ending.summary,hasUsableUrl:!!ending.url});
 results.completedAt=new Date().toISOString();results.allScopeConsidered=results.candidates.length===samples.length;secret='';checkpoint();
})().catch(e=>{secret='';results.error=e.name;results.completedAt=new Date().toISOString();checkpoint();process.exitCode=1;});
