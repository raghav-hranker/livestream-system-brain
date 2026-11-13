// Sampled playback validation: actual decoding of beginning/middle/end segments. No catalogue or job writes.
(async()=>{
 const list=await step('authenticated course list',()=>source.courseListPage(0,1000));if(!list)throw Object.assign(Error(),{name:'AuthenticationProbeFailed'});
 const pages=new Map(),controlRows=await source.contentPage('71',0,10000),controlRaw=controlRows.find(x=>String(x.id)==='189847');
 if(!controlRaw)throw Object.assign(Error(),{name:'MissingControl'});
 const control=await token('71','189847',controlRaw);results.controls.push({name:'Glands01',at:new Date().toISOString(),...control.summary,hasUsableUrl:!!control.url});if(!control.url)throw Object.assign(Error(),{name:'ControlFailed'});checkpoint();
 for(const course of [...new Set(samples.map(x=>x.course))]){const page=await source.contentPage(course,0,10000);if(page.length>=10000)throw Object.assign(Error(),{name:'TruncatedListing'});pages.set(course,page);progress('disabled quality listing '+course);}
 for(const sample of samples){const record={...sample,checkedAt:new Date().toISOString(),qualityChecks:[]};results.candidates.push(record);const raw=pages.get(sample.course)?.find(x=>String(x.id)===sample.rowId);
 if(!raw){record.outcome='exact source occurrence absent';checkpoint();continue;}
 record.source={title:String(raw.title??raw.Title??''),enabled:raw.enable,deleted:raw.deleted,sameAsset:deriveApxAssetKey(usableClassLink(raw))===sample.oldAssetKey};
 if(!record.source.sameAsset||String(raw.deleted)==='1'){record.outcome='source identity changed or deleted';checkpoint();continue;}
 try{const minted=await token(sample.course,sample.rowId,raw);record.token=minted.summary;if(!minted.url){record.outcome='AppX returned no playable URL';checkpoint();continue;}
 const advertised=Array.isArray(minted.body.urls)?minted.body.urls.filter(x=>typeof x.path==='string'&&x.path).map(x=>({rung:String(x.quality??'advertised'),url:x.path})):[];
 const entries=[...advertised,{rung:'selected path',url:minted.url},...RUNGS.map(rung=>({rung:rung+' derived',url:deriveRungUrl(minted.url,rung)}))];
 const seen=new Set();for(const entry of entries){const u=new URL(entry.url),identity=u.origin+u.pathname;if(seen.has(identity))continue;seen.add(identity);
 const q={quality:entry.rung};record.qualityChecks.push(q);try{let p=await playlist(entry.url);q.http=p.http;if(p.http===404){await sleep(600);q.confirmationHttp=(await playlist(entry.url)).http;continue;}
 if(p.http!==200||!p.text.startsWith('#EXTM3U')){q.outcome='not a readable HLS playlist';continue;}
 if(p.text.includes('#EXT-X-STREAM-INF')||p.text.includes('#EXT-X-KEY')||p.text.includes('#EXT-X-MAP')){q.outcome='master/encrypted/init-map format needs a separate playback check';continue;}
 const refs=mediaRefs(p.text);q.segments=refs.length;q.endList=p.text.includes('#EXT-X-ENDLIST');if(!refs.length||!q.endList){q.outcome='empty or non-final playlist';continue;}
 const work=refs.map((ref,index)=>{const url=new URL(ref,entry.url).href;return {rung:entry.rung,index,url,file:name(url),originalFailure:false};});
 const indexes=[...new Set([0,Math.floor(work.length/2),work.length-1])];q.playbackSamples=[];
 for(const index of indexes){const item=work[index];const result={index,position:index===0?'beginning':index===work.length-1?'end':'middle'};q.playbackSamples.push(result);
 try{const response=await axios.get(item.url,{timeout:20000,responseType:'arraybuffer',maxContentLength:16777216,validateStatus:()=>true,family:4,headers});const bytes=Buffer.from(response.data);result.http=response.status;result.bytes=bytes.length;results.segmentBytes+=bytes.length;
 if(![200,206].includes(response.status)){if(response.status===404){await sleep(600);result.confirmationHttp=(await segment(item.url)).http;}result.videoDecoded=false;continue;}
 const {spawnSync}=require('child_process');const probe=spawnSync('/opt/homebrew/bin/ffprobe',['-v','error','-show_entries','stream=codec_type,codec_name,width,height','-of','json','-i','pipe:0'],{input:bytes,timeout:15000,maxBuffer:1048576});let streams=[];try{streams=JSON.parse(probe.stdout.toString()).streams||[];}catch{}result.streams=streams;
 const decoded=spawnSync('/opt/homebrew/bin/ffmpeg',['-v','error','-i','pipe:0','-map','0:v:0','-map','0:a?','-t','2','-frames:v','3','-f','null','-','-progress','pipe:1'],{input:bytes,timeout:20000,maxBuffer:1048576});const frameMatches=[...String(decoded.stdout||'').matchAll(/frame=(\d+)/g)];result.decodedFrames=Math.max(0,...frameMatches.map(x=>Number(x[1])));result.decodeExitCode=decoded.status;result.videoDecoded=decoded.status===0&&result.decodedFrames>0&&streams.some(x=>x.codec_type==='video');result.hasAudio=streams.some(x=>x.codec_type==='audio');if(decoded.error)result.decodeError=decoded.error.name;
 }catch(e){result.error=e.name;result.videoDecoded=false;}}
 q.outcome=q.playbackSamples.length===indexes.length&&q.playbackSamples.every(x=>x.videoDecoded)?'video decoded at beginning, middle and end':'sampled playback not established';
 if(q.outcome==='video decoded at beginning, middle and end'){record.outcome=q.outcome;record.readableQuality=entry.rung;break;}

 }catch(e){q.outcome='quality request unresolved';q.error=e.name;}}
 if(!record.outcome)record.outcome=record.qualityChecks.length&&record.qualityChecks.every(q=>q.http===404&&q.confirmationHttp===404)?'all advertised and derived quality playlists return 404':'no playable quality established by samples';
 }catch(e){record.outcome='source request unresolved';record.error=e.name;}
 checkpoint();progress('disabled quality '+results.candidates.length+'/'+samples.length);
 }
 const ending=await token('71','189847',controlRaw);results.controls.push({name:'Glands01 ending control',at:new Date().toISOString(),...ending.summary,hasUsableUrl:!!ending.url});
 results.completedAt=new Date().toISOString();results.allScopeConsidered=results.candidates.length===samples.length;secret='';checkpoint();
})().catch(e=>{secret='';results.error=e.name;results.completedAt=new Date().toISOString();checkpoint();process.exitCode=1;});
