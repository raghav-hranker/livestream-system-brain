// Read-only Mongo snapshot for the 2026-10-19 import audit. Never prints credentials.
const fs = require("fs");
const root = "/Users/raghav/Projects/worktrees/vg-backend";
const {MongoClient} = require(root + "/node_modules/mongoose").mongo;
const dotenv = require(root + "/node_modules/dotenv");
const env = dotenv.parse(fs.readFileSync("/Users/raghav/Projects/worktrees/vg-class-import/.env.development"));
const match = env.MONGO_URI.match(/^(mongodb:\/\/)([^/]+)(\/[^?]*)?(?:\?(.*))?$/);
if (!match) throw new Error("Unsupported URI form");
const params = new URLSearchParams(match[4] || "");
params.set("directConnection", "true"); params.set("readPreference", "primary");
const authority = match[2];
const uri = match[1] + authority.slice(0, authority.lastIndexOf("@")+1) + "127.0.0.1:27019" + (match[3]||"/vidyagramdb") + "?" + params;



const out='vidyagram/reports/appx-seven-retry-2026-10-27';
const source=JSON.parse(fs.readFileSync('vidyagram/reports/appx-candidate-complete-check-2026-10-27/summary.json'));
const targets=source.candidates.filter(x=>x.outcome==='all required segment references readable');
const baseline=require(root+'/node_modules/mongoose').mongo.BSON.EJSON.parse(fs.readFileSync('vidyagram/reports/appx-backlog-retry-2026-10-27/before.ejson','utf8'));
const {ObjectId,BSON}=require(root+'/node_modules/mongoose').mongo;
const mode=process.argv[2]||'--preview';
const save=(name,value)=>fs.writeFileSync(out+'/'+name,BSON.EJSON.stringify(value,null,2,{relaxed:false}),{mode:0o600});
(async()=>{if(targets.length!==7||new Set(targets.map(x=>x.job)).size!==7)throw Error('TargetScope');const client=new MongoClient(uri,{serverSelectionTimeoutMS:12000});try{await client.connect();const db=client.db('vidyagramdb');if(db.databaseName!=='vidyagramdb')throw Error('TenantGuard');fs.mkdirSync(out,{recursive:true});
 const jobIds=targets.map(x=>new ObjectId(x.job)),classIds=targets.map(x=>new ObjectId(x.classId));
 const jobs=await db.collection('apxingestjobs').find({_id:{$in:jobIds}}).toArray();
 const classes=await db.collection('classes').find({_id:{$in:classIds}}).toArray();
 const ledgers=await db.collection('apxcatalogimports').find({customerId:'781',classId:{$in:classIds}}).toArray();
 const placements=await db.collection('courseclasses').find({class:{$in:classIds}},{projection:{class:1,course:1,isActive:1,status:1,updatedAt:1}}).toArray();
 const rows=targets.map(t=>{const j=jobs.find(x=>String(x._id)===t.job),cl=classes.find(x=>String(x._id)===t.classId),l=ledgers.find(x=>String(x.classId)===t.classId);if(!j||!cl||!l||String(j.classId)!==t.classId||l.assetKey!==t.oldAssetKey||cl.apxAssetKey!==t.oldAssetKey)throw Error('IdentityGuard');return {job:t.job,classId:t.classId,title:cl.title,status:j.status,attempts:j.attempts,progress:{phase:j.progress?.phase,segmentsDone:Object.values(j.progress?.rungs||{}).reduce((n,x)=>n+(x.segsDone||0),0),segmentsTotal:Object.values(j.progress?.rungs||{}).reduce((n,x)=>n+(x.segsTotal||0),0)},errorSummary:typeof j.error==='string'?j.error.replace(/https?:\/\/\S+/g,'[URL omitted]').slice(0,220):null,hasHls:!!cl.hlsAsset,sameUpdatedAt:new Date(j.updatedAt).toISOString()===new Date(baseline.jobs.find(x=>String(x._id)===t.job).updatedAt).toISOString(),sameSourcePair:String(j.course_id)===t.course&&String(j.video_id)===t.rowId,jobSourceCourse:String(j.course_id),jobSourceRow:String(j.video_id),surveyCourse:t.course,surveyRow:t.rowId,visiblePlacements:placements.filter(p=>String(p.class)===t.classId&&p.isActive===true&&p.status===1&&cl.status===1).length};});
 if(mode==='--preview') {if(!fs.existsSync(out+'/before.ejson'))save('before.ejson',{at:new Date(),jobs,classes,ledgers,placements});fs.writeFileSync(out+'/preview.json',JSON.stringify({at:new Date().toISOString(),tenant:'781',database:'vidyagramdb',targets:rows,summary:{jobs:rows.length,statuses:rows.reduce((o,x)=>{o[x.status]=(o[x.status]||0)+1;return o},{}),alreadyHls:rows.filter(x=>x.hasHls).length,changed:rows.filter(x=>!x.sameUpdatedAt).length,sourcePairDifferences:rows.filter(x=>!x.sameSourcePair).length,visiblePlacements:rows.reduce((n,x)=>n+x.visiblePlacements,0)},writes:0},null,2));console.log(JSON.stringify({mode,targets:rows.length,statuses:rows.reduce((o,x)=>{o[x.status]=(o[x.status]||0)+1;return o},{}),alreadyHls:rows.filter(x=>x.hasHls).length,changed:rows.filter(x=>!x.sameUpdatedAt).length,sourcePairDifferences:rows.filter(x=>!x.sameSourcePair).length,visiblePlacements:rows.reduce((n,x)=>n+x.visiblePlacements,0),writes:0}));}
 else if(mode==='--status'){const result={at:new Date().toISOString(),rows};fs.writeFileSync(out+'/status.json',JSON.stringify(result,null,2));console.log(JSON.stringify({mode,statuses:rows.reduce((o,x)=>{o[x.status]=(o[x.status]||0)+1;return o},{}),hls:rows.filter(x=>x.hasHls).length,active:rows.filter(x=>x.status!=='dead').map(x=>({job:x.job,title:x.title,status:x.status,progress:x.progress,error:x.errorSummary}))}));}


 else if(mode==='--queue-canary'||mode==='--queue-rest'){
  const canary=[targets.find(x=>x.source.title.trim()==='Glands 02').job,targets.find(x=>x.source.title.trim()==='Internet').job];
  const phase=mode==='--queue-canary'?'canary':'rest';
  const proof=JSON.parse(fs.readFileSync(out+'/source-preflight.json'));
  if(!proof.completedAt||proof.sessionLost||Date.now()-Date.parse(proof.completedAt)>30*60*1000)throw Error('FreshSourceProofRequired');
  if(phase==='rest'){const v=JSON.parse(fs.readFileSync(out+'/storage-canary.json'));const pv=JSON.parse(fs.readFileSync(out+'/playback-canary.json'));if(!v.ok||v.assets.length!==2||!pv.ok||pv.assets.length!==2)throw Error('VerifiedCanaryRequired');const cj=jobs.filter(x=>canary.includes(String(x._id)));if(cj.length!==2||cj.some(x=>x.status!=='done'))throw Error('CanaryNotDone');const expected=cj.map(x=>String(x.classId));if(v.assets.some(x=>!expected.includes(x.classId))||pv.assets.some(x=>!expected.includes(x.classId))||new Set(v.assets.map(x=>x.classId)).size!==2||new Set(pv.assets.map(x=>x.classId)).size!==2)throw Error('CanaryProofIdentity');}
  const selected=targets.filter(x=>phase==='canary'?canary.includes(x.job):!canary.includes(x.job));
  const approved=selected.filter(t=>{const pr=proof.candidates.find(x=>x.job===t.job);return pr&&pr.source?.sameAsset&&pr.oldAssetKey===t.oldAssetKey&&String(pr.source?.enabled)==='1'&&String(pr.source?.deleted)!=='1'&&pr.fullInventoryHashesUnchanged&&pr.outcome==='unchanged complete inventory and fresh samples passed';});
  if(phase==='canary'&&approved.length!==2)throw Error('BothCanarySourcesRequired');
  if(!approved.length)throw Error('NoQualifiedTargets');
  if(fs.existsSync(out+'/queue-'+phase+'.ejson'))throw Error('PhaseAlreadyQueued');
  const catalogRepo='/Users/raghav/Projects/system-brain/.worktrees/vg-media-video-repair';require(catalogRepo+'/node_modules/ts-node').register({transpileOnly:true,project:catalogRepo+'/tsconfig.json'});
  const {deriveApxAssetKey}=require(catalogRepo+'/src/services/apx/apxAssetKey');
  const {usableClassLink}=require(catalogRepo+'/src/services/apx/apxCatalogPlanner');
  const operations=[];const stamp=new Date();
  for(const t of approved){const j=jobs.find(x=>String(x._id)===t.job),cl=classes.find(x=>String(x._id)===t.classId),r=rows.find(x=>x.job===t.job);if(j.status!=='dead'||cl.hlsAsset||cl.status!==1||!r.sameUpdatedAt||!r.visiblePlacements)throw Error('CurrentStateChanged');
   const raw=await db.collection('apxcatalogrows').findOne({customerId:'781',apxCourseId:t.course,'raw.id':t.rowId});
   const link=raw&&usableClassLink(raw.raw);if(!link||deriveApxAssetKey(link)!==t.oldAssetKey)throw Error('MirrorInputIdentity');
   operations.push({target:t.job,filter:{_id:j._id,classId:j.classId,status:'dead',attempts:j.attempts,updatedAt:j.updatedAt},set:{status:'pending',attempts:0,error:null,updatedAt:stamp,course_id:t.course,video_id:t.rowId,video_url:link},before:j});
  }
  save('operations-'+phase+'.ejson',operations);
  const session=client.startSession();try{await session.withTransaction(async()=>{for(const op of operations){const r=await db.collection('apxingestjobs').updateOne(op.filter,{$set:op.set},{session});if(r.matchedCount!==1)throw Error('JobCASGuard');}},{readPreference:'primary',readConcern:{level:'snapshot'},writeConcern:{w:'majority'}});}finally{await session.endSession();}
  save('queue-'+phase+'.ejson',{queuedAt:stamp,jobs:operations.map(x=>x.target),held:selected.filter(t=>!approved.some(a=>a.job===t.job)).map(x=>x.job),count:operations.length});
  console.log(JSON.stringify({mode,queued:operations.length,held:selected.length-operations.length,uniquePairsUnchanged:true,courseStructureWrites:0}));
 }
 else throw Error('UnsupportedMode');
}finally{await client.close();}})().catch(e=>{console.error('backlog_retry_failed',e.name,e.codeName||e.code||'guard');process.exitCode=1;});
