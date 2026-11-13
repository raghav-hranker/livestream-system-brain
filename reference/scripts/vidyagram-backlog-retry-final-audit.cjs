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



const out='vidyagram/reports/appx-backlog-retry-2026-10-27';const {ObjectId,BSON}=require(root+'/node_modules/mongoose').mongo;const before=BSON.EJSON.parse(fs.readFileSync(out+'/before.ejson','utf8'));const ids=before.jobs.map(x=>x._id),classes=before.classes.map(x=>x._id);const chosen=new Set(BSON.EJSON.parse(fs.readFileSync(out+'/queue-canary.ejson','utf8')).jobs);const stable=a=>BSON.EJSON.stringify(a.slice().sort((a,b)=>String(a._id).localeCompare(String(b._id))),{relaxed:false});
(async()=>{const c=new MongoClient(uri,{serverSelectionTimeoutMS:12000});try{await c.connect();const db=c.db('vidyagramdb');const [jobs,cl,ledger,placements]=await Promise.all([db.collection('apxingestjobs').find({_id:{$in:ids}}).toArray(),db.collection('classes').find({_id:{$in:classes}}).toArray(),db.collection('apxcatalogimports').find({customerId:'781',classId:{$in:classes}}).toArray(),db.collection('courseclasses').find({class:{$in:classes}},{projection:{class:1,course:1,isActive:1,status:1,updatedAt:1}}).toArray()]);
 const untouched=jobs.filter(x=>!chosen.has(String(x._id)));const oldUntouched=before.jobs.filter(x=>!chosen.has(String(x._id)));
 const result={at:new Date().toISOString(),selected:46,retried:3,unretried:43,states:jobs.reduce((o,x)=>{o[x.status]=(o[x.status]||0)+1;return o},{}),recovered:cl.filter(x=>x.hlsAsset).map(x=>({id:String(x._id),title:x.title,visiblePlacements:placements.filter(p=>String(p.class)===String(x._id)&&p.isActive===true&&p.status===1&&x.status===1).length})),all43UnretriedJobsByteUnchanged:stable(untouched)===stable(oldUntouched),coursePlacementsUnchanged:stable(placements)===stable(before.placements),catalogLedgersUnchanged:stable(ledger)===stable(before.ledgers),changedClassFields:cl.flatMap(x=>{const old=before.classes.find(y=>String(y._id)===String(x._id));const changed=[...new Set([...Object.keys(x),...Object.keys(old)])].filter(k=>BSON.EJSON.stringify(x[k],{relaxed:false})!==BSON.EJSON.stringify(old[k],{relaxed:false}));return changed.length?[{classId:String(x._id),fields:changed}]:[];}),activeSelectedJobs:jobs.filter(x=>!['dead','done'].includes(x.status)).length};
 fs.writeFileSync(process.env.VIDYAGRAM_AUDIT_OUTPUT||out+'/final-audit.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));if(!result.all43UnretriedJobsByteUnchanged||!result.coursePlacementsUnchanged||!result.catalogLedgersUnchanged||result.activeSelectedJobs)process.exitCode=1;
 }finally{await c.close();}})().catch(e=>{console.error('retry_final_audit_failed',e.name,e.codeName||e.code||'guard');process.exitCode=1;});
