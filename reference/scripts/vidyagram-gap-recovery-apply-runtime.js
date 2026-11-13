// Appended to vidyagram-candidate-fullcheck-runtime.js by vidyagram-gap-recovery-apply.cjs. WRITES (job claim, R2, Class link).
// One video at a time, stop on the first failure. Per video: AppX identity + inventory guard, DB guard against before.ejson,
// CAS claim (operation file first), worker copy on the bastion, then DB completion + signed admin-preview playback checks.
(async()=>{
 const fs=require('fs'),{spawn,execFileSync}=require('child_process');
 const base='/Users/raghav/Projects/system-brain',out=base+'/vidyagram/reports/appx-gap-recovery-2026-11-11';
 const plan=JSON.parse(fs.readFileSync(out+'/plan.json')).plans;
 const snap=JSON.parse(fs.readFileSync(out+'/before.ejson','utf8'));
 const WS=['-o','BatchMode=yes','-o','ConnectTimeout=12','-i','/Users/raghav/.ssh/hranker-webserver2-2','hranker@148.113.49.18'];
 const NODE='/home/hranker/.nvm/versions/node/v22.22.2/bin/node';
 const writeScript=fs.readFileSync(base+'/reference/scripts/vidyagram-gap-recovery-write.cjs');
 function db(envs){const pre=Object.entries(envs).map(([k,v])=>`${k}='${String(v).replace(/'/g,"'\\''")}'`).join(' ');return JSON.parse(execFileSync('ssh',[...WS,`${pre} ${NODE} -`],{input:writeScript,timeout:120000,maxBuffer:4194304}).toString());}
 results.mode='apply';results.recoveries=[];results.productionWrites=0;
 const only=process.env.ONLY?process.env.ONLY.split(','):null;const todo=plan.filter(p=>!only||only.includes(p.classId));if(!todo.length)throw Error('NothingSelected');
 const control=await token('71','189847',(await source.contentPage('71',0,10000)).find(x=>String(x.id)==='189847'));if(!control.url)throw Error('ControlFailed');results.controls.push({at:new Date().toISOString(),hasUsableUrl:true});
 const pages=new Map();
 for(const course of [...new Set(todo.map(x=>x.course))]){const page=await source.contentPage(course,0,10000);if(page.length>=10000)throw Error('TruncatedSource');pages.set(course,page);progress('apply listing '+course);}
 const workerSrc=fs.readFileSync(base+'/reference/scripts/vidyagram-gap-recovery-worker.cjs','utf8').replace('const classMap=JOB_CLASS_MAP;','const classMap='+JSON.stringify(Object.fromEntries(plan.map(p=>[p.job,p.classId])))+';');if(!/const classMap=\{/.test(workerSrc))throw Error('WorkerMapMissing');
 const code='eval(Buffer.from("'+Buffer.from(workerSrc).toString('base64')+'","base64").toString())';
 for(const p of todo){const rec={job:p.job,classId:p.classId,title:p.title,startedAt:new Date().toISOString()};results.recoveries.push(rec);
  const before=snap.find(x=>x.job&&x.job._id.$oid===p.job);if(!before||before.class._id.$oid!==p.classId)throw Error('SnapshotMissing');
  // DB guard: same as the snapshot, still dead, still no video
  const [s]=db({MODE:'state',IDS:JSON.stringify([{job:p.job,classId:p.classId}])});rec.stateBefore=s;
  const snapUpdated=new Date(before.job.updatedAt.$date).toISOString();
  const releasedByUs=s.jobError==='Gap recovery (complete AppX qualities) failed; held for review'&&s.attempts>before.job.attempts;rec.releasedByUsBefore=releasedByUs;
  if(s.jobStatus!=='dead'||s.jobClassId!==p.classId||(!releasedByUs&&(s.attempts!==before.job.attempts||s.jobUpdatedAt!==snapUpdated))||s.hasHlsAsset||s.classStatus!==before.class.status||s.apxAssetKey!==before.class.apxAssetKey)throw Error('CurrentStateGuard');
  // AppX guard: same asset, same inventory per planned rendition
  const raw=pages.get(p.course).find(x=>String(x.id)===p.rowId);
  if(!raw||String(raw.deleted)==='1'||deriveApxAssetKey(usableClassLink(raw))!==before.class.apxAssetKey)throw Error('SourceIdentityGuard');
  const minted=await token(p.course,p.rowId,raw);if(!minted.url)throw Error('NoPlayableUrl');
  const renditions=[];
  for(const r of p.renditions){const hit=(minted.body.urls||[]).find(x=>String(x.quality).toLowerCase()===r.appxLabel.toLowerCase()&&x.path);if(!hit)throw Error('LabelMissing');
   const pl=await playlist(hit.path);const refs=mediaRefs(pl.text);const h=crypto.createHash('sha256').update(refs.map(x=>new URL(x,hit.path).pathname).join('\n')).digest('hex');
   if(pl.http!==200||h!==r.inventoryHash||refs.length!==r.segments)throw Error('InventoryChangedBeforeClaim');
   renditions.push({rung:r.rung,sourceUrl:hit.path,inventoryHash:r.inventoryHash,segments:r.segments,width:r.width,height:r.height});}
  // Claim by compare-and-set; operation recorded first
  const op={job:p.job,filter:{status:'dead',attempts:s.attempts,updatedAt:s.jobUpdatedAt},set:{status:'claimed',attempts:s.attempts+1,error:null}};
  fs.writeFileSync(out+'/operation-'+p.job+'-a'+s.attempts+'.json',JSON.stringify(op,null,2),{mode:0o600,flag:'wx'});
  const claim=db({MODE:'claim',JOB:p.job,ATTEMPTS:s.attempts,UPDATED_AT:s.jobUpdatedAt});if(claim.matched!==1)throw Error('ClaimCASFailed');results.productionWrites++;rec.claimedAt=new Date().toISOString();checkpoint();
  // Copy on the bastion
  let result=null;const run=await new Promise(resolve=>{const child=spawn('ssh',['-i','/Users/raghav/.ssh/raghav','-o','BatchMode=yes','-o','ConnectTimeout=12','-o','ServerAliveInterval=30','opc@92.4.88.60',"sudo -n docker exec -i apx-ingest-781 node -e '"+code+"'"],{stdio:['pipe','pipe','pipe']});
   let pending='',stderr='';child.stdout.on('data',b=>{pending+=b.toString();const lines=pending.split('\n');pending=lines.pop();for(const line of lines){if(line.startsWith('RESULT ')){result=JSON.parse(line.slice(7));}else if(line.startsWith('{"progress"')){try{const r=JSON.parse(line);if(r.progress==='rendition copied')progress('rendition copied',{n:results.recoveries.length,rung:r.rung,segments:r.segments});}catch{}}}});
   child.stderr.on('data',b=>{stderr+=b.toString().slice(0,2000);});child.on('error',()=>resolve({code:255}));
   child.on('close',code=>{const f=stderr.split('\n').map(x=>{try{return JSON.parse(x)}catch{return null}}).find(x=>x&&x.ok===false);resolve({code,failure:f||null});});
   child.stdin.end(JSON.stringify({clientId:'781',jobId:p.job,classId:p.classId,renditions,menuLabels:p.menuLabels}));});
  rec.worker=result||run;
  if(run.code!==0||!result?.ok){rec.release=db({MODE:'release',JOB:p.job,ATTEMPTS:s.attempts});rec.ok=false;checkpoint();throw Error('CopyFailed');}
  results.productionWrites++;
  // Completion: job done, Class has its video, status and placements untouched
  const [a]=db({MODE:'state',IDS:JSON.stringify([{job:p.job,classId:p.classId}])});rec.stateAfter=a;
  if(a.jobStatus!=='done'||!a.hasHlsAsset||a.classStatus!==s.classStatus||a.placementsHash!==s.placementsHash)throw Error('CompletionGuard');
  // Signed admin-preview walk: master, every rendition, first/middle/last segment
  const pb=JSON.parse(execFileSync('ssh',[...WS,`cd /var/www/backend.vidyagramar.com/vidyagram-backend && DOTENV_CONFIG_PATH=.env.development PATH=/home/hranker/.nvm/versions/node/v22.22.2/bin:$PATH node -r dotenv/config - ${p.classId}`],{input:fs.readFileSync(base+'/reference/scripts/vidyagram-seven-playback.cjs'),timeout:180000,maxBuffer:2097152}).toString());
  fs.writeFileSync(out+'/playback-'+p.classId+'.json',JSON.stringify(pb,null,2));
  rec.playbackOk=pb.ok&&pb.assets[0].renditions.length===p.menuLabels.length;if(!rec.playbackOk)throw Error('PlaybackFailed');
  rec.ok=true;rec.finishedAt=new Date().toISOString();checkpoint();progress('recovered '+results.recoveries.filter(x=>x.ok).length+'/'+todo.length,{classId:p.classId});
 }
 results.completedAt=new Date().toISOString();secret='';checkpoint();
})().catch(e=>{secret='';results.error=e.name;results.reason=/^[A-Za-z]+$/.test(e.message)?e.message:'GuardOrNetworkFailure';results.completedAt=new Date().toISOString();checkpoint();process.exitCode=1;});
