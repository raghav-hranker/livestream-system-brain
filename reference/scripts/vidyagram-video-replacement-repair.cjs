// Scoped 2026-10-26 repair. Default preview; explicit queue/place/rollback modes write.
// Never logs Mongo URIs, source URLs, raw exceptions, or playback tokens.
const fs=require('fs'),path=require('path');
const repo=path.resolve(__dirname,'../../.worktrees/vg-media-video-repair');
const {MongoClient,ObjectId,BSON}=require(repo+'/node_modules/mongoose').mongo;
const out=path.resolve(__dirname,'../../vidyagram/reports/appx-sync-repair-2026-10-26/media-video');
const assets=['vid:armaths-data:4656486-1792746126','vid:armaths-data:4657426-1792753322'];
const classIds=['6adc01b520e78c9f77dbc7b6','6adc01b820e78c9f77dbc7bd'].map(x=>new ObjectId(x));
const sourceIds=['193547','193550','193541','193549'];
const mode=process.argv[2]||'--preview';
const save=(name,data)=>fs.writeFileSync(path.join(out,name),BSON.EJSON.stringify(data,null,2,{relaxed:false}),{mode:0o600});
async function main(){
 fs.mkdirSync(out,{recursive:true});
 const dotenv=require(repo+'/node_modules/dotenv'),env=dotenv.parse(fs.readFileSync('/Users/raghav/Projects/worktrees/vg-class-import/.env.development'));
 const m=env.MONGO_URI.match(/^(mongodb:\/\/)([^/]+)(\/[^?]*)?(?:\?(.*))?$/);if(!m)throw Error('unsupported URI');
 const p=new URLSearchParams(m[4]||'');p.set('directConnection','true');p.set('readPreference','primary');
 const uri=m[1]+m[2].slice(0,m[2].lastIndexOf('@')+1)+'127.0.0.1:27019/vidyagramdb?'+p;
 const client=new MongoClient(uri,{serverSelectionTimeoutMS:12000});
 try{await client.connect();const db=client.db('vidyagramdb');if(db.databaseName!=='vidyagramdb')throw Error('wrong DB');
 const classes=await db.collection('classes').find({_id:{$in:classIds}}).toArray();
 if(classes.length!==2||classes.some((c,i)=>!assets.includes(c.apxAssetKey)))throw Error('Class guard');
 const currentJobs=await db.collection('apxingestjobs').find({$or:[{classId:{$in:classIds}},{apxClassId:{$in:sourceIds}}]}).toArray();
 const ledger=await db.collection('apxcatalogimports').find({customerId:'781',assetKey:{$in:assets}}).toArray();
 const currentRows=await db.collection('courseclasses').find({class:{$in:classIds}}).toArray();
 const courses=await db.collection('courses').find({apxCourseId:{$in:['160','161']}}).toArray();
 const mirror=await db.collection('apxcatalogcourses').find({customerId:'781',apxCourseId:{$in:['160','161']}}).toArray();
 const raw=await db.collection('apxcatalogrows').find({customerId:'781',rowId:{$in:sourceIds}}).toArray();
 const snapshot=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../vidyagram/reports/appx-sync-verify-2026-10-26/plans.json')));
 const plans=snapshot.plans.filter(p=>['160','161'].includes(String(p.course.apxCourseId))).map(p=>({...p,items:p.items.filter(i=>assets.includes(i.assetKey))}));
 if(plans.length!==2||plans.some(p=>p.items.length!==2))throw Error('plan scope guard');
 require(repo+'/node_modules/ts-node').register({transpileOnly:true,project:repo+'/tsconfig.json'});
 const {deriveApxAssetKey}=require(repo+'/src/services/apx/apxAssetKey');
 const {usableClassLink}=require(repo+'/src/services/apx/apxCatalogPlanner');
 const proposed=[];
 for(const plan of plans){for(const it of plan.items){const src=raw.find(r=>String(r.apxCourseId)===String(plan.course.apxCourseId)&&String(r.rowId)===String(it.rowId));
 if(!src||deriveApxAssetKey(usableClassLink(src.raw))!==it.assetKey)throw Error('current source asset differs');
 const c=classes.find(c=>c.apxAssetKey===it.assetKey),course=courses.find(c=>String(c.apxCourseId)===String(plan.course.apxCourseId));
 const s=await db.collection('sections').findOne({sectionName:it.placement.section,customer_id:781});
 const t=s&&await db.collection('topics').findOne({section:s._id,topicName:it.placement.topic,customer_id:781});
 const sub=it.placement.subTopic&&t?await db.collection('subtopics').findOne({topic:t._id,subTopicName:it.placement.subTopic}):null;
 if(!course||!s||!t||it.placement.subTopic&&!sub)throw Error('existing canonical taxonomy required');
 proposed.push({apxCourseId:String(plan.course.apxCourseId),rowId:String(it.rowId),classId:c._id,assetKey:it.assetKey,course:course._id,priority:it.priority,apxTitle:it.apxTitle,isFree:it.free,isActive:it.active,section:s._id,topic:t._id,subTopic:sub?sub._id:null,sectionName:s.sectionName,topicName:t.topicName,...(sub?{subTopicName:sub.subTopicName}:{})});
 }}
 const preview={at:new Date(),mode,classes:classes.map(c=>({id:c._id,title:c.title,assetKey:c.apxAssetKey,hasHls:!!c.hlsAsset})),existingNewJobs:currentJobs.filter(j=>classIds.some(id=>id.equals(j.classId))).map(j=>({id:j._id,classId:j.classId,status:j.status})),oldReservedJobs:currentJobs.filter(j=>!classIds.some(id=>id.equals(j.classId))).map(j=>({id:j._id,classId:j.classId,apxCourseId:j.apxCourseId,apxClassId:j.apxClassId,status:j.status})),ledgerCount:ledger.length,existingPlacementCount:currentRows.length,proposedPlacements:proposed,expectedQueueRepresentatives:[{course:'161',rowId:'193541'},{course:'161',rowId:'193549'}]};
 if(mode==='--preview'){
  if(fs.existsSync(path.join(out,'backup-before.ejson')))throw Error('backup already exists; do not overwrite');
  save('backup-before.ejson',{at:new Date(),classes,oldJobs:currentJobs,ledger,currentRows,courses:[],sourceRows:raw.map(r=>({_id:r._id,apxCourseId:r.apxCourseId,rowId:r.rowId,lastSeenRunId:r.lastSeenRunId}))});
  save('preview.ejson',preview);save('scoped-plans.ejson',plans);
 }else if(mode==='--queue'){
  if(!fs.existsSync(path.join(out,'backup-before.ejson')))throw Error('backup required');
  if(currentRows.length||ledger.length||currentJobs.some(j=>classIds.some(id=>id.equals(j.classId))))throw Error('queue already partly repaired; inspect before retry');
  const mongoose=require(repo+'/node_modules/mongoose');await mongoose.connect(uri,{dbName:'vidyagramdb',autoIndex:false,autoCreate:false});
  try{const {commitClassImport}=require(repo+'/src/services/apx/apxCatalogClassCommit');const result=await commitClassImport({db:mongoose.connection.db,customerId:'781',runId:'repair-video-2026-10-26',plans,portThumbnails:false});
   save('queue-result.ejson',result.summary);if(result.summary.failures.length||result.summary.jobsEnqueued!==2||result.summary.ledgerWritten!==2)throw Error('queue outcome guard');
  }finally{await mongoose.disconnect();}
 }else if(mode==='--place'){
  if(!fs.existsSync(path.join(out,'queue-result.ejson')))throw Error('queue proof required');
  const jobs=currentJobs.filter(j=>classIds.some(id=>id.equals(j.classId)));
  if(jobs.length!==2||jobs.some(j=>j.status!=='done')||classes.some(c=>!c.hlsAsset))throw Error('wait for successful native media');
  const storage=BSON.EJSON.parse(fs.readFileSync(path.join(out,'storage-verification.ejson'),'utf8'));
  if(storage.assets?.length!==2||storage.assets.some(a=>!a.ok||!classes.some(c=>String(c._id)===a.classId&&c.hlsAsset?.key===a.masterKey)))throw Error('storage verification required for exact assets');
  if(currentRows.length)throw Error('placement not empty; inspect rerun');
  const now=new Date(),{newPlacementFields}=require(repo+'/src/services/courseClassAssign');
  const docs=proposed.map(p=>{const c=classes.find(c=>c._id.equals(p.classId));const {apxCourseId,rowId,classId,assetKey,...fields}=p;return {_id:new ObjectId(),class:classId,...fields,...newPlacementFields(c,{isFree:p.isFree},now),...(p.isActive?{}:{status:0}),notificationSent:false,scheduledNotificationJobId:null,addedAt:now,createdAt:now,updatedAt:now,__v:0};});
  save('placement-inserts.ejson',docs);
  const session=client.startSession();try{await session.withTransaction(async()=>{if(await db.collection('courseclasses').countDocuments({class:{$in:classIds}},{session}))throw Error('placement changed');await db.collection('courseclasses').insertMany(docs,{session});});}finally{await session.endSession();}
  save('placement-result.ejson',{at:new Date(),insertedIds:docs.map(d=>d._id),count:docs.length});
  save('post-repair.ejson',{classes:await db.collection('classes').find({_id:{$in:classIds}}).toArray(),jobs:await db.collection('apxingestjobs').find({classId:{$in:classIds}}).toArray(),ledger:await db.collection('apxcatalogimports').find({customerId:'781',assetKey:{$in:assets}}).toArray(),rows:await db.collection('courseclasses').find({_id:{$in:docs.map(d=>d._id)}}).toArray()});
 }else if(mode==='--rollback'){
  if(!fs.existsSync(path.join(out,'post-repair.ejson')))throw Error('completed repair checkpoint required');
  const before=BSON.EJSON.parse(fs.readFileSync(path.join(out,'backup-before.ejson'),'utf8'));
  const after=BSON.EJSON.parse(fs.readFileSync(path.join(out,'post-repair.ejson'),'utf8'));
  const stable=a=>BSON.EJSON.stringify(a.slice().sort((a,b)=>String(a._id).localeCompare(String(b._id))),{relaxed:false});
  const jobs=currentJobs.filter(j=>classIds.some(id=>id.equals(j.classId)));
  if(jobs.some(j=>!['done','dead'].includes(j.status)))throw Error('worker not terminal');
  if(stable(classes)!==stable(after.classes)||stable(jobs)!==stable(after.jobs)||stable(ledger)!==stable(after.ledger)||stable(currentRows)!==stable(after.rows))throw Error('post-repair documents changed; manual review required');
  const session=client.startSession();try{await session.withTransaction(async()=>{
   const currentClass=await db.collection('classes').find({_id:{$in:classIds}},{session}).toArray();
   const currentJob=await db.collection('apxingestjobs').find({classId:{$in:classIds}},{session}).toArray();
   const currentLedger=await db.collection('apxcatalogimports').find({customerId:'781',assetKey:{$in:assets}},{session}).toArray();
   const currentPlace=await db.collection('courseclasses').find({class:{$in:classIds}},{session}).toArray();
   if(stable(currentClass)!==stable(after.classes)||stable(currentJob)!==stable(after.jobs)||stable(currentLedger)!==stable(after.ledger)||stable(currentPlace)!==stable(after.rows))throw Error('rollback snapshot changed');
   await db.collection('courseclasses').deleteMany({_id:{$in:after.rows.map(x=>x._id)}},{session});
   await db.collection('apxcatalogimports').deleteMany({_id:{$in:after.ledger.map(x=>x._id)},runId:'repair-video-2026-10-26'},{session});
   await db.collection('apxingestjobs').deleteMany({_id:{$in:after.jobs.map(x=>x._id)},classId:{$in:classIds}},{session});
   for(const doc of before.classes)await db.collection('classes').replaceOne({_id:doc._id},doc,{session});
  });}finally{await session.endSession();}
  save('rollback-result.ejson',{at:new Date(),restoredClasses:2,removedRows:4});
 }else if(mode==='--status'){
  save('status.ejson',preview);
 }else if(mode==='--storage'){
  if(classes.some(c=>!c.hlsAsset?.key))throw Error('media not ready');
  const config=dotenv.parse(fs.readFileSync(path.resolve(__dirname,'../../.env.development')));
  const {S3Client,GetObjectCommand}=require(repo+'/node_modules/@aws-sdk/client-s3');
  if(config.VIDYAGRAM_R2_BUCKET!=='recordedvideos-vidyagram')throw Error('storage tenant guard');
  const s3=new S3Client({endpoint:config.VIDYAGRAM_R2_ENDPOINT,region:'auto',credentials:{accessKeyId:config.VIDYAGRAM_R2_ACCESS_KEY_ID,secretAccessKey:config.VIDYAGRAM_R2_SECRET_ACCESS_KEY},maxAttempts:2});
  const output={at:new Date(),bucket:config.VIDYAGRAM_R2_BUCKET,assets:[]};
  const get=async key=>(await s3.send(new GetObjectCommand({Bucket:config.VIDYAGRAM_R2_BUCKET,Key:key}))).Body.transformToByteArray();
  try{for(const c of classes){const master=Buffer.from(await get(c.hlsAsset.key)).toString('utf8');if(!master.startsWith('#EXTM3U'))throw Error('invalid master');
   const refs=[...new Set(master.split(/\r?\n/).map(s=>s.trim()).filter(s=>s&&!s.startsWith('#')))];
   const renditions=[];for(const ref of refs){if(/^https?:/.test(ref))throw Error('external reference refused');const key=path.posix.join(path.posix.dirname(c.hlsAsset.key),ref),pl=Buffer.from(await get(key)).toString('utf8');const segs=pl.split(/\r?\n/).map(s=>s.trim()).filter(s=>s&&!s.startsWith('#'));
    if(!pl.startsWith('#EXTM3U')||!pl.includes('#EXT-X-ENDLIST')||!segs.length)throw Error('invalid rendition');
    const checked=[];for(const rel of new Set([segs[0],segs[Math.floor(segs.length/2)],segs.at(-1)])){if(/^https?:/.test(rel))throw Error('external segment refused');const segmentKey=path.posix.join(path.posix.dirname(key),rel),bytes=await get(segmentKey);if(!bytes.length||rel.endsWith('.ts')&&bytes[0]!==0x47)throw Error('invalid sampled segment');checked.push({key:segmentKey,bytes:bytes.length,transportStream:bytes[0]===0x47});}
    renditions.push({key,segments:segs.length,endList:true,checked});
   }if(!renditions.length)throw Error('empty master');output.assets.push({classId:String(c._id),masterKey:c.hlsAsset.key,ok:true,renditions});
  }}finally{s3.destroy();}save('storage-verification.ejson',output);
 }else throw Error('unknown mode');
 console.log(JSON.stringify({mode,classes:classes.length,ledger:ledger.length,placements:currentRows.length,newJobStatuses:preview.existingNewJobs.map(j=>j.status),proposed:proposed.length}));
 }finally{await client.close();}
}
main().catch(e=>{console.error('video_repair_failed',e.name,e.code||'guard');process.exitCode=1;});
