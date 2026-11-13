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



const out='vidyagram/reports/appx-seven-retry-2026-10-27';const phase=process.argv[2]||'--canary';if(!['--canary','--rest'].includes(phase))throw Error('PhaseGuard');const part=phase.slice(2);
const {ObjectId,BSON}=require(root+'/node_modules/mongoose').mongo;
const queued=BSON.EJSON.parse(fs.readFileSync(out+'/queue-'+part+'.ejson','utf8'));
const {S3Client,GetObjectCommand}=require(root+'/node_modules/@aws-sdk/client-s3');
const config=dotenv.parse(fs.readFileSync('.env.development'));if(config.VIDYAGRAM_R2_BUCKET!=='recordedvideos-vidyagram')throw Error('BucketGuard');
const s3=new S3Client({endpoint:config.VIDYAGRAM_R2_ENDPOINT,region:'auto',credentials:{accessKeyId:config.VIDYAGRAM_R2_ACCESS_KEY_ID,secretAccessKey:config.VIDYAGRAM_R2_SECRET_ACCESS_KEY},maxAttempts:2});
const path=require('path');
async function get(key,range){const r=await s3.send(new GetObjectCommand({Bucket:config.VIDYAGRAM_R2_BUCKET,Key:key,...(range?{Range:range}:{})}));return r.Body.transformToByteArray();}
function refs(text){return [...new Set(text.split(/\r?\n/).map(x=>x.trim()).filter(x=>x&&!x.startsWith('#')))];}
function relativeKey(parent,ref){if(/^[a-z]+:|^\/|\.\./i.test(ref))throw Error('UnexpectedReference');return path.posix.join(path.posix.dirname(parent),ref);}
(async()=>{const client=new MongoClient(uri,{serverSelectionTimeoutMS:12000});try{await client.connect();const db=client.db('vidyagramdb');const jobs=await db.collection('apxingestjobs').find({_id:{$in:queued.jobs.map(x=>new ObjectId(x))}},{projection:{classId:1,status:1}}).toArray();if(jobs.length!==queued.count)throw Error('JobScope');const allDone=jobs.every(x=>x.status==='done');const classes=await db.collection('classes').find({_id:{$in:jobs.filter(x=>x.status==='done').map(x=>x.classId)}},{projection:{hlsAsset:1,title:1}}).toArray();const result={at:new Date().toISOString(),phase:part,readOnly:true,bucket:config.VIDYAGRAM_R2_BUCKET,assets:[],allDone,expectedJobs:queued.count,ok:allDone};
 for(const cl of classes){const a={classId:String(cl._id),title:cl.title,masterKey:cl.hlsAsset?.key,renditions:[],ok:true};try{if(!a.masterKey||!a.masterKey.startsWith('781/'+cl._id+'/hls/'))throw Error('MediaKeyGuard');const master=Buffer.from(await get(a.masterKey)).toString();if(!master.startsWith('#EXTM3U'))throw Error('InvalidMaster');const playlists=refs(master);if(!playlists.length)throw Error('EmptyMaster');for(const ref of playlists){const key=relativeKey(a.masterKey,ref),text=Buffer.from(await get(key)).toString();if(!text.startsWith('#EXTM3U'))throw Error('InvalidRendition');const segments=refs(text);const r={key,segments:segments.length,endList:text.includes('#EXT-X-ENDLIST'),samples:[],ok:segments.length>0&&text.includes('#EXT-X-ENDLIST')};for(const index of [...new Set([0,Math.floor(segments.length/2),segments.length-1])].filter(x=>segments.length&&x>=0)){try{const bytes=Buffer.from(await get(relativeKey(key,segments[index]),'bytes=0-1023'));const sync=bytes.length>376&&bytes[0]===71&&bytes[188]===71&&bytes[376]===71;r.samples.push({index,bytes:bytes.length,tsSync:sync});if(!sync)r.ok=false;}catch(e){r.samples.push({index,error:e.name,http:e.$metadata?.httpStatusCode});r.ok=false;}}a.renditions.push(r);if(!r.ok)a.ok=false;}}catch(e){a.error=e.name;a.http=e.$metadata?.httpStatusCode;a.ok=false;}result.assets.push(a);if(!a.ok)result.ok=false;}
 fs.writeFileSync(out+'/storage-'+part+'.json',JSON.stringify(result,null,2));console.log(JSON.stringify({phase:part,assets:result.assets.length,renditions:result.assets.reduce((n,x)=>n+x.renditions.length,0),sampledSegments:result.assets.reduce((n,x)=>n+x.renditions.reduce((n,y)=>n+y.samples.length,0),0),ok:result.ok}));if(!result.ok)process.exitCode=1;
 }finally{await client.close();s3.destroy();}})().catch(e=>{console.error('retry_storage_failed',e.name,e.codeName||e.code||'guard');s3.destroy();process.exitCode=1;});
