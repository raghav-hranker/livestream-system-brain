// vidyagramdb only, run on webserver2-2 via `node -` (env MODE, IDS / JOB...). Used by vidyagram-gap-recovery-apply.cjs.
//   MODE=snapshot IDS='[{"job","classId"}]'  read-only: full job, Class and CourseClass documents as EJSON, URLs replaced by [url]
//   MODE=state    IDS=...                    read-only: one JSON line per video (job status/attempts/updatedAt, Class status/hlsAsset, placements)
//   MODE=claim    JOB ATTEMPTS UPDATED_AT    WRITES: compare-and-set dead -> claimed (attempts+1, error null). Prints {matched}
//   MODE=release  JOB ATTEMPTS               WRITES: claimed/downloading/uploading -> dead again, only while the Class has no hlsAsset
const root='/var/www/backend.vidyagramar.com/vidyagram-backend';const req=require('module').createRequire(root+'/package.json');const fs=require('fs');
const env=req('dotenv').parse(fs.readFileSync(root+'/.env.development'));const {MongoClient,ObjectId,BSON}=req('mongoose').mongo;
const strip=v=>JSON.parse(JSON.stringify(v),(k,x)=>typeof x==='string'?x.replace(/(https?|rtmps?):\/\/\S+/g,'[url]'):x);
(async()=>{const c=new MongoClient(env.MONGO_URI,{serverSelectionTimeoutMS:12000,readPreference:'primary'});
try{await c.connect();const db=c.db('vidyagramdb');if(db.databaseName!=='vidyagramdb'||!/vidyagramdb/.test(env.MONGO_URI))throw Error('TenantGuard');
const mode=process.env.MODE;
if(mode==='snapshot'||mode==='state'){const ids=JSON.parse(process.env.IDS);const out=[];
 for(const {job,classId} of ids){const j=await db.collection('apxingestjobs').findOne({_id:new ObjectId(job)});const cl=await db.collection('classes').findOne({_id:new ObjectId(classId)});
  const pl=await db.collection('courseclasses').find({class:new ObjectId(classId)}).toArray();
  if(mode==='snapshot')out.push({job:j,class:cl,placements:pl});
  else out.push({job,classId,jobStatus:j?.status,jobClassId:j?String(j.classId):null,attempts:j?.attempts,jobUpdatedAt:j?.updatedAt?.toISOString(),jobError:j?.error?String(j.error).replace(/https?:\/\/\S+/g,'[url]').slice(0,160):null,
   classStatus:cl?.status,hasHlsAsset:!!cl?.hlsAsset,hlsAssetKind:cl?.hlsAsset?.kind??null,hlsAssetKey:cl?.hlsAsset?.key??null,streamStatus:cl?.streamStatus??null,apxAssetKey:cl?.apxAssetKey,
   placements:pl.length,placementsActive:pl.filter(p=>p.status===1||p.isActive===true).length,placementsHash:require('crypto').createHash('sha256').update(BSON.EJSON.stringify(pl.map(p=>({_id:p._id,status:p.status,isActive:p.isActive,course:p.course})))).digest('hex')});}
 if(mode==='snapshot'){const docs=out.map(x=>({job:x.job,class:x.class,placements:x.placements}));process.stdout.write(BSON.EJSON.stringify(docs.map(d=>({job:d.job,class:d.class,placements:d.placements})),{relaxed:true}).replace(/(https?|rtmps?):\/\/[^"\\]+/g,'[url]'));}
 else console.log(JSON.stringify(out));return;}
const job=new ObjectId(process.env.JOB),attempts=Number(process.env.ATTEMPTS);if(!Number.isInteger(attempts))throw Error('AttemptsRequired');
if(mode==='claim'){const at=new Date(process.env.UPDATED_AT);if(isNaN(at))throw Error('UpdatedAtRequired');
 const r=await db.collection('apxingestjobs').updateOne({_id:job,status:'dead',attempts,updatedAt:at},{$set:{status:'claimed',attempts:attempts+1,error:null,updatedAt:new Date()}});
 console.log(JSON.stringify({matched:r.matchedCount,modified:r.modifiedCount}));return;}
if(mode==='release'){const j=await db.collection('apxingestjobs').findOne({_id:job});const cl=j&&await db.collection('classes').findOne({_id:j.classId},{projection:{hlsAsset:1}});
 if(cl?.hlsAsset){console.log(JSON.stringify({released:false,reason:'class has hlsAsset'}));return;}
 const r=await db.collection('apxingestjobs').updateOne({_id:job,status:{$in:['claimed','downloading','uploading']},attempts:attempts+1},{$set:{status:'dead',error:'Gap recovery (complete AppX qualities) failed; held for review',updatedAt:new Date()}});
 console.log(JSON.stringify({released:r.modifiedCount===1}));return;}
throw Error('UnknownMode');
}finally{await c.close();}})().catch(e=>{console.error(JSON.stringify({error:e.name,reason:String(e.message).replace(/mongodb\S*/g,'[uri]').slice(0,120)}));process.exitCode=1;});
