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


const out='vidyagram/reports/appx-backlog-survey-2026-10-27';
(async()=>{const c=new MongoClient(uri,{serverSelectionTimeoutMS:12000});try{
 await c.connect();const db=c.db('vidyagramdb');if(db.databaseName!=='vidyagramdb')throw Error('TenantGuard');
 const jobs=await db.collection('apxingestjobs').find({status:'dead'},{projection:{classId:1,status:1,attempts:1,updatedAt:1}}).toArray();
 const ids=jobs.map(x=>x.classId);
 const [classes,ledger,placements,session]=await Promise.all([
 db.collection('classes').find({_id:{$in:ids}},{projection:{title:1,apxAssetKey:1,status:1,hlsAsset:1}}).toArray(),
 db.collection('apxcatalogimports').find({classId:{$in:ids}},{projection:{assetKey:1,classId:1,sourceCourseId:1,sourceRowId:1}}).toArray(),
 db.collection('courseclasses').find({class:{$in:ids}},{projection:{class:1,course:1,isActive:1,status:1,apxTitle:1}}).toArray(),
 db.collection('apxsessions').findOne({orgId:'2177599'},{projection:{isActive:1,lastCheckedAt:1,lastHttpStatus:1}})
 ]);
 const prior=JSON.parse(fs.readFileSync('vidyagram/reports/appx-sync-repair-2026-10-26/media-video/dead-job-source-eligibility.json'));
 const rows=jobs.map(j=>{const cl=classes.find(x=>String(x._id)===String(j.classId)),l=ledger.find(x=>String(x.classId)===String(j.classId)),p=prior.jobs.find(x=>x.job===String(j._id)),cc=placements.filter(x=>String(x.class)===String(j.classId));return {job:String(j._id),classId:String(j.classId),title:cl?.title,assetKey:l?.assetKey??cl?.apxAssetKey,attempts:j.attempts,updatedAt:j.updatedAt,errorCategory:p?.errorCategory??'unclassified',currentOccurrences:p?.currentOccurrences??[],currentOccurrenceEvidenceDate:'2026-10-26',sourceCourseId:String(l?.sourceCourseId??''),sourceRowId:String(l?.sourceRowId??''),placementCount:cc.length,enabledPlacementCount:cc.filter(x=>x.isActive===true&&x.status===1).length,studentVisiblePlacementCount:cl?.status===1?cc.filter(x=>x.isActive===true&&x.status===1).length:0,hasDestinationHls:!!cl?.hlsAsset,sourceSurvey:'pending fresh authentication'};});
 const count=fn=>rows.filter(fn).length;
 const result={observedAt:new Date().toISOString(),readOnly:true,productionWrites:0,session,summary:{dead:rows.length,currentAccordingToOct26Mirror:count(x=>x.currentOccurrences.length>0),historicalAccordingToOct26Mirror:count(x=>!x.currentOccurrences.length),source404:count(x=>x.errorCategory==='source404'),noPlayableURL:count(x=>x.errorCategory==='noPlayableURL'),withStudentVisiblePlacements:count(x=>x.studentVisiblePlacementCount>0),studentVisiblePlacements:rows.reduce((n,x)=>n+x.studentVisiblePlacementCount,0),freshSourceProbed:0},jobs:rows};
 fs.mkdirSync(out,{recursive:true});fs.writeFileSync(out+'/inventory.json',JSON.stringify(result,null,2));console.log(JSON.stringify({observedAt:result.observedAt,summary:result.summary,storedSessionActive:session?.isActive,productionWrites:0}));
}finally{await c.close();}})().catch(e=>{console.error('backlog_inventory_failed',e.name,e.codeName||e.code||'unknown');process.exitCode=1;});
