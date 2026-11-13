// Read-only, vidyagramdb only: current job, Class and placement state for the 33 AppX segment-gap videos.
// Run on webserver2-2 via `node -` with IDS='[{"job":..,"classId":..}]'. Prints one JSON line; URLs stripped.
const root='/var/www/backend.vidyagramar.com/vidyagram-backend';const req=require('module').createRequire(root+'/package.json');const fs=require('fs');
const env=req('dotenv').parse(fs.readFileSync(root+'/.env.development'));const {MongoClient,ObjectId}=req('mongoose').mongo;
const strip=s=>s==null?s:String(s).replace(/https?:\/\/\S+/g,'[url]').slice(0,200);
(async()=>{const ids=JSON.parse(process.env.IDS);const c=new MongoClient(env.MONGO_URI,{serverSelectionTimeoutMS:12000,readPreference:'primary'});
try{await c.connect();const db=c.db('vidyagramdb');if(db.databaseName!=='vidyagramdb')throw Error('wrong db');const out=[];
for(const {job,classId} of ids){const j=await db.collection('apxingestjobs').findOne({_id:new ObjectId(job)});const cl=await db.collection('classes').findOne({_id:new ObjectId(classId)},{projection:{title:1,status:1,hlsAsset:1,apxAssetKey:1,streamStatus:1,isYoutubeRedirect:1,updatedAt:1}});
const pl=await db.collection('courseclasses').find({class:new ObjectId(classId)},{projection:{status:1,isActive:1,course:1,waitingForRecordingSince:1}}).toArray();
out.push({job,classId,jobFound:!!j,jobStatus:j?.status,jobClassId:j?String(j.classId):null,attempts:j?.attempts,jobError:strip(j?.error),jobUpdatedAt:j?.updatedAt,jobKeys:j?Object.keys(j):[],levels:j?.levels,
classFound:!!cl,title:cl?.title,classStatus:cl?.status,hasHlsAsset:!!cl?.hlsAsset,apxAssetKey:cl?.apxAssetKey,streamStatus:cl?.streamStatus,placements:pl.length,placementsActive:pl.filter(p=>p.status===1||p.isActive===true).length,waiting:pl.filter(p=>p.waitingForRecordingSince).length});}
console.log(JSON.stringify(out));}finally{await c.close();}})().catch(e=>{console.error(String(e.message).replace(/mongodb[^ ]*/g,'[uri]'));process.exitCode=1;});
