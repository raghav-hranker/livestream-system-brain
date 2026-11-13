// Live updates to existing VG migration spreadsheet. Dedicated Completion tabs only.
'use strict';
const fs=require('fs'),path=require('path');
const {RUN,COL}=require('./vidyagram-completion-pilot.cjs');
const {RATE,METRICS}=require('./vidyagram-apx-request-client.cjs');
const root=process.env.VG_APP_ROOT||process.cwd();const req=n=>require(require.resolve(n,{paths:[root]}));
const env=req('dotenv').parse(fs.readFileSync(process.env.VG_ENV_PATH||path.join(root,'.env.development')));
if(!/^mongodb(?:\+srv)?:\/\/[^/]+\/vidyagramdb(?:\?|$)/.test(env.MONGO_URI||''))throw Error('VG database guard');
const {MongoClient}=req('mongoose').mongo;
const client=new MongoClient(env.MONGO_URI,{minPoolSize:0,maxPoolSize:2,readPreference:'primary',serverSelectionTimeoutMS:15000});
const SHEET='1S8WDIGKnt0gwQB_dVhasseUOgmAtLQbjS3iH5wyglGY';
const tabs=['Completion summary','Completion learners','Completion courses','Completion requests'];
const ist=d=>d?new Date(d).toLocaleString('en-GB',{timeZone:'Asia/Kolkata',hour12:false}):'';
async function collect(db){
 const run=await db.collection(COL.runs).findOne({_id:RUN});
 const jobs=await db.collection(COL.jobs).find({runId:RUN}).sort({priority:1}).toArray();
 const courses=await db.collection(COL.courses).find({runId:RUN},{projection:{flags:0,mapped:0}}).sort({apxUserId:1,apxCourseId:1}).toArray();
 const workers=await db.collection(COL.workers).find({runId:RUN}).toArray();
 const minute=new Date(Date.now()-60000),hour=new Date(Date.now()-3600000);
 const measured=await db.collection(METRICS).aggregate([{$match:{runId:RUN,at:{$gte:hour}}},{$group:{_id:'$workerHost',requests:{$sum:1},lastMinute:{$sum:{$cond:[{$gte:['$at',minute]},1,0]}},http403:{$sum:{$cond:[{$or:[{$eq:['$httpStatus',403]},{$eq:['$apiStatus',403]}]},1,0]}},http429:{$sum:{$cond:[{$or:[{$eq:['$httpStatus',429]},{$eq:['$apiStatus',429]}]},1,0]}},latency:{$avg:'$latencyMs'},queueWait:{$max:'$queueWaitMs'},lastAt:{$max:'$at'},egress:{$last:'$egressIp'}}},{$sort:{_id:1}}]).toArray();
 const limits=await db.collection(RATE).find({}).toArray();
 const lookup=new Map(jobs.map(j=>[j.apxUserId,j.priority+1]));
 const summary=[['Vidyagram manual completion pilot','Value'],['Last refreshed (IST)',ist(new Date())],['Pilot',RUN],['Status',run?.status||'Preparing'],['Learner limit',run?.maxUsers||50],['Learners selected',jobs.length],['OTP reservations',run?.otpReservations||0],['OTP send responses successful',run?.otpSent||0],['Tokens saved/reused',jobs.filter(j=>j.tokenSavedAt).length],['Learners fully read',jobs.filter(j=>['captured','mapping_exception'].includes(j.state)).length],['Course pairs planned',jobs.reduce((s,j)=>s+j.courses.length,0)],['Course pairs captured',courses.length],['Empty completion responses',courses.filter(c=>c.completedCount===0&&c.invalidCount===0).length],['Source completed flags',courses.reduce((s,c)=>s+c.completedCount,0)],['Mapped class completions (per learner/course)',courses.reduce((s,c)=>s+c.mappedCount,0)],['Unmapped source flags',courses.reduce((s,c)=>s+c.unmatched.length,0)],['Invalid source flags',courses.reduce((s,c)=>s+c.invalidCount,0)],['Class progress writes by this capture worker',0],['Import status','Staged for prelaunch import review.'],['Pilot expires (IST)',ist(run?.expiresAt)],['Refresh interval (seconds)',15],[],['Worker','Role','State','Last heartbeat (IST)','Learner pause (ms)','Egress IP'],...workers.map(w=>[w.host,w.role,w.state,ist(w.heartbeatAt),w.learnerGapMs||'',w.egressIp||''])];
 summary.push([],['Acquisition checkpoint',run?.acquireCeiling||'Full batch'],['Experiment phase',(RUN.endsWith('-fleet500')||RUN.endsWith('-fleet2000'))?'Fleet pacing; per-worker values above':run?.experimentPhase||'steady'],['Request monitoring','Instrumented calls only. Earlier batch requests were not logged.'],['Requests in last minute',measured.reduce((n,m)=>n+m.lastMinute,0)],['HTTP/API 403 in last hour',measured.reduce((n,m)=>n+m.http403,0)],['HTTP/API 429 in last hour',measured.reduce((n,m)=>n+m.http429,0)],['Learner pause (ms)',(RUN.endsWith('-fleet500')||RUN.endsWith('-fleet2000'))?'Per-worker values above':run?.currentLearnerGapMs||Number(process.env.VG_LEARNER_GAP_MS||60000)],['Base per-IP request gap (ms)',Number(process.env.VG_REQUEST_GAP_MS||1500)],['Shared admin request gap (ms)',Number(process.env.VG_ADMIN_GAP_MS||2000)],['Request history retention (days)',7],[],['Rate-limit scope','Cooldown until (IST)','Route blocked','Spacing multiplier'],...limits.map(l=>[l._id,l.cooldownUntil>new Date()?ist(l.cooldownUntil):'',l.blocked?'Yes':'No',l.penalty||1]));
 const learners=[['Learner','State','Acquisition server','Completion reader','Token source','OTP attempted (IST)','Token saved (IST)','Course pairs','Updated (IST)','Last error','Experiment phase','Learner pause (ms)'],...jobs.map(j=>[j.priority+1,j.state,j.acquisitionHost||(j.tokenSavedAt?'Not recorded (older batch)':''),j.readerHost||(['captured','mapping_exception'].includes(j.state)?(j.owner||'').split(':')[0]:''),j.tokenSource||'',ist(j.otpAttemptedAt),ist(j.tokenSavedAt),j.courses.length,ist(j.updatedAt),j.lastError||'',j.experimentPhase||(j.tokenSavedAt?'steady':''),j.learnerGapMs||(j.tokenSavedAt?60000:'')])];
 const courseRows=[['Learner','AppX course ID','Read status','Completed flags','Mapped classes','Unmapped flags','Invalid flags','Read time (ms)','Fetched (IST)','Import status'],...courses.map(c=>[lookup.get(c.apxUserId)||'',c.apxCourseId,c.state,c.completedCount,c.mappedCount,c.unmatched.length,c.invalidCount,c.fetchMs,ist(c.fetchedAt),'Staged'])];
 const requestRows=[['Server','Egress IP','Requests/minute','Requests (last hour)','Tokens saved (last hour)','403 (last hour)','429 (last hour)','Mean request time (ms)','Max queue wait (ms)','Latest request (IST)'],...measured.map(m=>[m._id,m.egress,m.lastMinute,m.requests,jobs.filter(j=>j.acquisitionHost===m._id&&j.tokenSource==='minted'&&new Date(j.tokenSavedAt)>=hour).length,m.http403,m.http429,Math.round(m.latency),m.queueWait,ist(m.lastAt)])];
 const unassigned=jobs.filter(j=>!j.acquisitionHost&&j.tokenSource==='minted'&&new Date(j.tokenSavedAt)>=hour).length;
 if(unassigned)requestRows.push(['Older records: acquisition server not recorded','',0,0,unassigned]);
 requestRows.push([],['Request counts cover instrumented calls only. Tokens saved is a rolling 60-minute count.']);
 if(RUN.endsWith('-azure50')||(RUN.endsWith('-fleet500')||RUN.endsWith('-fleet2000'))){
  requestRows.push([],['Acquisition checkpoint',run?.acquireCeiling||'Full batch'],['Experiment phase','Tokens saved','Token interval sample (minutes)','Observed tokens/hour']);
  for(const phase of RUN.endsWith('-azure50')?['baseline_60s','accelerated_30s']:['fleet_30s','fleet_60s']){
   const times=jobs.filter(j=>j.experimentPhase===phase&&j.tokenSource==='minted'&&j.tokenSavedAt).map(j=>new Date(j.tokenSavedAt).getTime()).sort((a,b)=>a-b);
   const span=times.length>1?times.at(-1)-times[0]:0;
   requestRows.push([phase,times.length,Math.round(span/6000)/10,span>=300000?Math.round((times.length-1)*3600000/span):'Collecting sample']);
  }
  requestRows.push(['Rate uses intervals between saved tokens across workers in each phase; shown after five minutes.']);
 }
 return [summary,learners,courseRows,requestRows];
}
async function setup(auth,base){
 const meta=await auth.request({url:base,params:{fields:'sheets.properties'}});const props=meta.data.sheets.map(s=>s.properties);
 const missing=tabs.filter(t=>!props.some(p=>p.title===t));
 if(missing.length)await auth.request({url:`${base}:batchUpdate`,method:'POST',data:{requests:missing.map(title=>({addSheet:{properties:{title,gridProperties:{frozenRowCount:1,rowCount:5000,columnCount:12}}}}))}});
 const current=await auth.request({url:base,params:{fields:'sheets.properties'}});
 const requests=[];
 for(const s of current.data.sheets){const p=s.properties;if(!tabs.includes(p.title))continue;
  requests.push({updateSheetProperties:{properties:{sheetId:p.sheetId,gridProperties:{frozenRowCount:1}},fields:'gridProperties.frozenRowCount'}});
  requests.push({repeatCell:{range:{sheetId:p.sheetId,startRowIndex:0,endRowIndex:1},cell:{userEnteredFormat:{backgroundColor:{red:0.08,green:0.18,blue:0.28},textFormat:{bold:true,foregroundColor:{red:1,green:1,blue:1}}}},fields:'userEnteredFormat'}});
  requests.push({updateDimensionProperties:{range:{sheetId:p.sheetId,dimension:'COLUMNS',startIndex:0,endIndex:p.title==='Completion summary'?2:p.title==='Completion learners'?12:10},properties:{pixelSize:p.title==='Completion summary'?350:165},fields:'pixelSize'}});
 }
 await auth.request({url:`${base}:batchUpdate`,method:'POST',data:{requests}});
 await auth.request({url:`${base}/values:batchClear`,method:'POST',data:{ranges:tabs.map(t=>`'${t}'`)}});
 return current.data.sheets.filter(s=>tabs.includes(s.properties.title)).map(s=>s.properties);
}
async function main(){
 await client.connect();const db=client.db('vidyagramdb');
 if(process.argv.includes('--print')){console.log(JSON.stringify(await collect(db)));return;}
 if(!process.env.GOOGLE_KEY)throw Error('Google service account path required');
 const {GoogleAuth}=req('google-auth-library');
 const auth=await new GoogleAuth({keyFile:process.env.GOOGLE_KEY,scopes:['https://www.googleapis.com/auth/spreadsheets']}).getClient();
 const base=`https://sheets.googleapis.com/v4/spreadsheets/${SHEET}`;
 if(process.argv.includes('--verify')){
  const meta=await auth.request({url:base,params:{fields:'sheets.properties'}});
  const read=await auth.request({url:`${base}/values:batchGet`,params:{ranges:["'Completion summary'!A1:D45","'Completion learners'!A1:J4","'Completion courses'!A1:J4","'Completion requests'!A1:J8"]}});
  console.log(JSON.stringify({event:'sheet-verified',at:new Date().toISOString(),tabs:meta.data.sheets.filter(s=>tabs.includes(s.properties.title)).map(s=>s.properties),ranges:read.data.valueRanges}));return;
 }
 const grids=await setup(auth,base);
 let terminalTicks=0,lastRows=tabs.map(()=>0);
 do{
  try{
   const values=await collect(db);
   const growth=[];
   for(let i=0;i<tabs.length;i++){const g=grids.find(g=>g.title===tabs[i]),needed=Math.max(lastRows[i],values[i].length);if(needed>g.gridProperties.rowCount){g.gridProperties.rowCount=needed+100;growth.push({updateSheetProperties:{properties:{sheetId:g.sheetId,gridProperties:{rowCount:g.gridProperties.rowCount}},fields:'gridProperties.rowCount'}});}}
   if(growth.length)await auth.request({url:`${base}:batchUpdate`,method:'POST',data:{requests:growth}});
   await auth.request({url:`${base}/values:batchUpdate`,method:'POST',data:{valueInputOption:'RAW',data:tabs.map((t,i)=>({range:`'${t}'!A1`,values:Array.from({length:Math.max(lastRows[i],values[i].length)},(_,r)=>Array.from({length:12},(_,c)=>values[i][r]?.[c]??''))}))}});
   lastRows=values.map(rows=>rows.length);
   console.log(JSON.stringify({event:'sheet-refreshed',at:new Date().toISOString(),learnerRows:values[1].length-1,courseRows:values[2].length-1}));
   const run=await db.collection(COL.runs).findOne({_id:RUN});
   if(run&&(run.stopped||run.finishedAt||run.expiresAt<=new Date()))terminalTicks++;else terminalTicks=0;
  }catch(e){console.error(JSON.stringify({event:'sheet-refresh-failed',name:e.name,http:e.response?.status??null}));}
  if(process.argv.includes('--once')||terminalTicks>=4)break;
  await new Promise(r=>setTimeout(r,15000));
 }while(true);
}
main().catch(e=>{console.error(JSON.stringify({event:'sheet-fatal',name:e.name,http:e.response?.status??null}));process.exitCode=1;}).finally(()=>client.close());
