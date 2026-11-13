// READ-ONLY, aggregate output only. Explains why captured VG completion flags have no class: traces each unmatched
// video through apxcatalogrows, apxcatalogimports and apxingestjobs, and tests recovery by same link or unique title.
// Never prints raw catalogue rows (they hold stream secrets).
// Run on an Azure migrator: VG_APP_ROOT=$dir/runtime VG_ENV_PATH=$dir/.env.development node - < this file
'use strict';
const path=require('path');
const root=process.env.VG_APP_ROOT||process.cwd();
const req=n=>require(require.resolve(n,{paths:[root]}));
const env=req('dotenv').parse(require('fs').readFileSync(process.env.VG_ENV_PATH||path.join(root,'.env.development')));
if(!/^mongodb(?:\+srv)?:\/\/[^/]+\/vidyagramdb(?:\?|$)/.test(env.MONGO_URI||''))throw Error('VG database guard');
const {MongoClient,ObjectId}=req('mongodb');
const ORG='2177599',CUSTOMER='781',RUNS=/^vg-completion-20261103-/;
const norm=s=>String(s||'').trim().replace(/\s+/g,' ').toLowerCase();
const bump=(o,k,n=1)=>{o[k]=(o[k]||0)+n;};
const linkKey=l=>{const s=String(l||'').split('?')[0].trim();return s&&s!=='null'?s:'';};
(async()=>{
 const client=new MongoClient(env.MONGO_URI,{minPoolSize:0,maxPoolSize:2,readPreference:'secondaryPreferred',serverSelectionTimeoutMS:15000});
 await client.connect();
 try{
  const db=client.db('vidyagramdb');
  const caps=await db.collection('apx_vg_completion_captures').find({orgId:ORG,runId:RUNS,'unmatched.0':{$exists:true}},{projection:{runId:1,userId:1,courseId:1,apxCourseId:1,unmatched:1}}).toArray();
  const items=new Map();
  for(const c of caps)for(const v of c.unmatched){
   const k=`${c.apxCourseId}|${v}`;
   const it=items.get(k)||items.set(k,{video:String(v),apxCourseId:String(c.apxCourseId),courseId:String(c.courseId),flags:0,users:new Set()}).get(k);
   it.flags++;it.users.add(String(c.userId));
  }
  const list=[...items.values()],videos=[...new Set(list.map(i=>i.video))],apxCourses=[...new Set(list.map(i=>i.apxCourseId))],localCourses=[...new Set(list.map(i=>i.courseId))];
  const rowsByKey=new Map(),rowCourses=new Map();
  const rowProj={apxCourseId:1,rowId:1,hiddenReason:1,lastSeenRunId:1,'raw.title':1,'raw.link':1,'raw.deleted':1,'raw.enable':1,'raw.type':1,'raw.stream_status':1,'raw.created_at':1};
  for(let i=0;i<videos.length;i+=500)for(const r of await db.collection('apxcatalogrows').find({customerId:CUSTOMER,rowId:{$in:videos.slice(i,i+500)}},{projection:rowProj}).toArray()){
   rowsByKey.set(`${r.apxCourseId}|${r.rowId}`,r);(rowCourses.get(String(r.rowId))||rowCourses.set(String(r.rowId),[]).get(String(r.rowId))).push(String(r.apxCourseId));
  }
  const ledgerByRow=new Map();
  for(let i=0;i<videos.length;i+=500)for(const l of await db.collection('apxcatalogimports').find({customerId:CUSTOMER,'placements.rowId':{$in:videos.slice(i,i+500)}},{projection:{classId:1,assetKey:1,'placements.rowId':1,'placements.apxCourseId':1}}).toArray())
   for(const p of l.placements||[])(ledgerByRow.get(String(p.rowId))||ledgerByRow.set(String(p.rowId),[]).get(String(p.rowId))).push({classId:String(l.classId),apxCourseId:String(p.apxCourseId)});
  const jobs=new Map();
  for(let i=0;i<videos.length;i+=500)for(const j of await db.collection('apxingestjobs').find({apxClassId:{$in:videos.slice(i,i+500)}},{projection:{apxClassId:1,status:1,classId:1}}).toArray())jobs.set(String(j.apxClassId),j);
  // What each local course actually holds: placed classes, their titles and the links of rows already mapped to them.
  const placedByCourse=new Map(),titleByCourse=new Map(),linkByCourse=new Map();
  for(const cid of localCourses){
   const ps=await db.collection('courseclasses').find({course:new ObjectId(cid)},{projection:{class:1,title:1,apxTitle:1}}).toArray();
   const classDocs=await db.collection('classes').find({_id:{$in:ps.map(p=>p.class)}},{projection:{title:1}}).toArray();
   const titles=new Map(classDocs.map(d=>[String(d._id),d.title]));
   placedByCourse.set(cid,new Set(ps.map(p=>String(p.class))));
   const byTitle=new Map();
   for(const p of ps)for(const t of new Set([p.apxTitle,p.title,titles.get(String(p.class))].map(norm).filter(Boolean)))(byTitle.get(t)||byTitle.set(t,new Set()).get(t)).add(String(p.class));
   titleByCourse.set(cid,byTitle);
  }
  for(const apx of apxCourses){
   const local=list.find(i=>i.apxCourseId===apx).courseId,placed=placedByCourse.get(local);
   const ledger=await db.collection('apxcatalogimports').find({customerId:CUSTOMER,'placements.apxCourseId':apx},{projection:{classId:1,'placements.rowId':1,'placements.apxCourseId':1}}).toArray();
   const rowToClass=new Map();
   for(const l of ledger)if(placed.has(String(l.classId)))for(const p of l.placements||[])if(String(p.apxCourseId)===apx)rowToClass.set(String(p.rowId),String(l.classId));
   const byLink=new Map();
   for(const r of await db.collection('apxcatalogrows').find({customerId:CUSTOMER,apxCourseId:apx,rowId:{$in:[...rowToClass.keys()]}},{projection:{rowId:1,'raw.link':1}}).toArray()){
    const k=linkKey(r.raw?.link);if(k)(byLink.get(k)||byLink.set(k,new Set()).get(k)).add(rowToClass.get(String(r.rowId)));
   }
   linkByCourse.set(apx,byLink);
  }
  const cat={};const titles={};const recent={};
  for(const it of list){
   const row=rowsByKey.get(`${it.apxCourseId}|${it.video}`);
   const led=ledgerByRow.get(it.video)||[];const job=jobs.get(it.video);
   let cause;
   if(!row)cause=(rowCourses.get(it.video)||[]).length?'catalogue row only under another course':'not in catalogue';
   else if(row.hiddenReason){
    const h=String(row.hiddenReason);
    cause=/deleted/i.test(h)?'hidden: inside a deleted folder':/disabled/i.test(h)?'hidden: disabled':/outside/i.test(h)?'hidden: outside Home':'hidden: other';
   }
   else if(String(row.raw?.deleted)==='1')cause='row marked deleted';
   else if(String(row.raw?.enable)==='0')cause='row disabled';
   else if(led.some(l=>l.apxCourseId===it.apxCourseId))cause='imported, class not placed in this course';
   else if(led.length)cause='imported under another course only';
   else if(job)cause=`visible, ingest job ${job.status}`;
   else cause=`visible, never imported (${row.raw?.type||'unknown type'})`;
   let recover='none';
   const l=linkKey(row?.raw?.link),byLink=linkByCourse.get(it.apxCourseId)?.get(l);
   const byTitle=titleByCourse.get(it.courseId)?.get(norm(row?.raw?.title));
   if(byLink&&byLink.size===1)recover='same video link, one class';
   else if(byLink&&byLink.size>1)recover='same video link, several classes';
   else if(byTitle&&byTitle.size===1)recover='same title, one class';
   else if(byTitle&&byTitle.size>1)recover='same title, several classes';
   const c=cat[cause]||={videos:0,flags:0,recover:{}};
   c.videos++;c.flags+=it.flags;bump(c.recover,recover,it.flags);
   (titles[cause]||=[]);if(titles[cause].length<4&&row?.raw?.title)titles[cause].push(String(row.raw.title).slice(0,50));
   if(row?.raw?.created_at)bump(recent,String(row.raw.created_at).slice(0,7),it.flags);
  }
  // Videos missing from catalogue rows: do any other catalogue stores know them, and how old are the ids?
  const missing=list.filter(i=>!rowsByKey.has(`${i.apxCourseId}|${i.video}`)&&!(rowCourses.get(i.video)||[]).length);
  const missingIds=new Set(missing.map(i=>i.video)),seenTree=new Map();
  for(const t of await db.collection('apxcatalogtree').find({customerId:CUSTOMER,apxCourseId:{$in:[...new Set(missing.map(i=>i.apxCourseId))]}},{projection:{'rows.id':1,'rows.Title':1,'rows.material_type':1,apxCourseId:1}}).toArray())
   for(const r of t.rows||[])if(missingIds.has(String(r.id)))seenTree.set(String(r.id),{title:r.Title,type:r.material_type});
  const inContent=await db.collection('apxcatalogcontent').countDocuments({customerId:CUSTOMER,rowId:{$in:[...missingIds]}});
  const idPosition={belowCourseOldestRow:0,withinCourseRange:0,aboveCourseNewestRow:0};
  for(const apx of new Set(missing.map(i=>i.apxCourseId))){
   const ids=(await db.collection('apxcatalogrows').find({customerId:CUSTOMER,apxCourseId:apx},{projection:{rowId:1}}).toArray()).map(r=>Number(r.rowId)).filter(Number.isFinite);
   if(!ids.length)continue;const lo=Math.min(...ids),hi=Math.max(...ids);
   for(const i of missing)if(i.apxCourseId===apx){const n=Number(i.video);bump(idPosition,n<lo?'belowCourseOldestRow':n>hi?'aboveCourseNewestRow':'withinCourseRange');}
  }
  // Same-title candidates: does the deleted row's folder and length agree with the class it would land on?
  const titleCheck={candidates:0,folderMatches:0,folderDiffers:0,lengthClose:0,lengthFar:0,lengthUnknown:0};
  const fullRow=await db.collection('apxcatalogrows').findOne({customerId:CUSTOMER,hiddenReason:/deleted/i});
  const durKeys=Object.keys(fullRow?.raw||{}).filter(k=>/dur|length/i.test(k));
  for(const it of list){
   const row=rowsByKey.get(`${it.apxCourseId}|${it.video}`);if(!row)continue;
   const hit=titleByCourse.get(it.courseId)?.get(norm(row.raw?.title));if(!hit||hit.size!==1)continue;
   const classId=[...hit][0];titleCheck.candidates++;
   const p=await db.collection('courseclasses').findOne({course:new ObjectId(it.courseId),class:new ObjectId(classId)},{projection:{sectionName:1,topicName:1}});
   const folders=String(row.hiddenReason||'').split('>').map(s=>norm(s.replace(/\(deleted\)/i,''))).filter(s=>s&&s!=='home');
   const names=[p?.sectionName,p?.topicName].map(norm).filter(Boolean);
   if(folders.some(f=>names.some(n=>n===f||n.includes(f)||f.includes(n))))titleCheck.folderMatches++;else titleCheck.folderDiffers++;
   const raw=await db.collection('apxcatalogrows').findOne({_id:row._id},{projection:Object.fromEntries(durKeys.map(k=>[`raw.${k}`,1]))});
   const srcLen=durKeys.map(k=>Number(raw?.raw?.[k])).find(n=>n>0);
   const cls=await db.collection('classes').findOne({_id:new ObjectId(classId)},{projection:{duration:1,apxDurationSeconds:1}});
   const len=Number(cls?.duration)||Number(cls?.apxDurationSeconds);
   if(!srcLen||!len)titleCheck.lengthUnknown++;else if(Math.abs(srcLen-len)<=Math.max(60,len*.05))titleCheck.lengthClose++;else titleCheck.lengthFar++;
  }
  // Would a same-title recovery add anything, or does the learner already have that class flagged?
  const already=new Set();
  for(const c of await db.collection('apx_vg_completion_captures').find({orgId:ORG,runId:RUNS,userId:{$in:[...new Set(list.flatMap(i=>[...i.users]))]},'mapped.0':{$exists:true}},{projection:{userId:1,courseId:1,'mapped.classId':1}}).toArray())
   for(const m of c.mapped)already.add(`${c.userId}|${m.classId}|${c.courseId}`);
  const recovery={learnerClassPairs:0,alreadyFlaggedOnNewCopy:0,wouldBeNew:0};
  for(const it of list){
   const row=rowsByKey.get(`${it.apxCourseId}|${it.video}`);if(!row)continue;
   const hit=titleByCourse.get(it.courseId)?.get(norm(row.raw?.title));if(!hit||hit.size!==1)continue;
   for(const u of it.users){recovery.learnerClassPairs++;if(already.has(`${u}|${[...hit][0]}|${it.courseId}`))recovery.alreadyFlaggedOnNewCopy++;else recovery.wouldBeNew++;}
  }
  titleCheck.recovery=recovery;
  const courseNotes=await db.collection('apxcatalogcourses').find({customerId:CUSTOMER,apxCourseId:{$in:['74','114','104']}},{projection:{apxCourseId:1,'capture.completeness.explained':1,'capture.completeness.catalogTotal':1}}).toArray();
  const deep={missing:{videos:missing.length,flags:missing.reduce((a,i)=>a+i.flags,0),inTree:seenTree.size,treeSampleTitles:[...seenTree.values()].slice(0,4).map(t=>String(t.title).slice(0,50)),inContent,idPosition},titleCheck,durKeys,courseNotes:courseNotes.map(c=>({apxCourseId:c.apxCourseId,total:c.capture?.completeness?.catalogTotal,explained:c.capture?.completeness?.explained}))};
  const allFlags=list.reduce((a,i)=>a+i.flags,0);
  const affected=new Set(list.flatMap(i=>[...i.users]));
  const byRun={};for(const c of caps)bump(byRun,c.runId,c.unmatched.length);
  const top=[...new Map(list.map(i=>[i.apxCourseId,0])).keys()].map(apx=>({apxCourseId:apx,flags:list.filter(i=>i.apxCourseId===apx).reduce((a,i)=>a+i.flags,0),videos:list.filter(i=>i.apxCourseId===apx).length})).sort((a,b)=>b.flags-a.flags).slice(0,6);
  console.log(JSON.stringify({now:new Date().toISOString(),unmatchedFlags:allFlags,distinctVideoCoursePairs:list.length,distinctVideos:videos.length,learnersAffected:affected.size,byRun,causes:Object.entries(cat).sort((a,b)=>b[1].flags-a[1].flags).map(([cause,v])=>({cause,...v,sampleTitles:titles[cause]})),createdMonthOfFlaggedVideos:recent,top,deep}));
 }finally{await client.close();}
})().catch(e=>{console.error(String(e.message).replace(/mongodb(\+srv)?:\/\/\S+/g,'<uri>'));process.exit(1);});
