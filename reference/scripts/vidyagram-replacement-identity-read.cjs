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

const out="vidyagram/reports/appx-sync-resume-2026-10-27";
(async()=>{const c=new MongoClient(uri,{serverSelectionTimeoutMS:12000});try{await c.connect();const db=c.db("vidyagramdb");const {ObjectId}=require(root+"/node_modules/mongoose").mongo;const oldIds=["6ad6995fe36abd47ea38d533","6adaafe4d8a68cd04b9b6618"].map(x=>new ObjectId(x));const courseIds=["160","161"];const courses=await db.collection("courses").find({apxCourseId:{$in:courseIds}},{projection:{apxCourseId:1,title:1,status:1}}).toArray();const placements=await db.collection("courseclasses").find({class:{$in:oldIds}},{projection:{class:1,course:1,priority:1,isActive:1,status:1,apxTitle:1,updatedAt:1,createdAt:1}}).toArray();const ledger=await db.collection("apxcatalogimports").find({classId:{$in:oldIds}},{projection:{classId:1,assetKey:1,placements:{apxCourseId:1,rowId:1,apxTitle:1,active:1,priority:1}}}).toArray();const classes=await db.collection("classes").find({_id:{$in:oldIds}},{projection:{title:1,apxAssetKey:1,hlsAsset:1,status:1}}).toArray();const plans=JSON.parse(fs.readFileSync("vidyagram/reports/appx-sync-verify-2026-10-26/plans.json")).plans;const currentOccurrences=classes.map(cl=>({classId:cl._id,assetKey:cl.apxAssetKey,occurrences:plans.filter(p=>courseIds.includes(p.course.apxCourseId)).flatMap(p=>p.items.filter(i=>i.assetKey===cl.apxAssetKey).map(i=>({course:p.course.apxCourseId,rowId:i.rowId,title:i.apxTitle,active:i.active,priority:i.priority})))}));const result={checkedAt:new Date().toISOString(),sourceScope:"Oct26 completed per-course mirror plans; not Oct27 live AppX",courses,classes,ledger,placements,currentOccurrences,productionWrites:0};fs.writeFileSync(out+"/replacement-identity.json",JSON.stringify(result,null,2));console.log(JSON.stringify(result));}finally{await c.close();}})().catch(e=>{console.error("identity_read_failed",e.name,e.codeName||e.code||"unknown");process.exitCode=1;});
