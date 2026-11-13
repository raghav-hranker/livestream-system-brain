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

const out="vidyagram/reports/appx-sync-verify-2026-10-26";
(async()=>{const c=new MongoClient(uri,{serverSelectionTimeoutMS:12000});try{await c.connect();const db=c.db("vidyagramdb");const capturedAt=new Date().toISOString();const inventory=await db.listCollections({}, {nameOnly:true}).toArray();fs.writeFileSync(out+"/inventory.json",JSON.stringify({capturedAt,collections:inventory.map(x=>x.name)}));const specs={courses:{},courseclasses:{},classes:{title:1,status:1,updatedAt:1,createdAt:1,actualStartedAt:1,actualEndedAt:1,apxAssetKey:1,section:1,topic:1,subTopic:1,hlsAsset:1,pdf:1,notes:1},sections:{},topics:{},subtopics:{},coursetopics:{},maincategories:{},categories:{},facultydetails:{name:1,customer_id:1},apxcatalogimports:{},apxcatalogcourses:{customerId:1,apxCourseId:1,capture:1,captureAttempt:1,listRow:1,detail:1,folderPaths:1,updatedAt:1},apxcatalogrows:{customerId:1,apxCourseId:1,raw:{id:1,title:1,type:1,enable:1,deleted:1,parent_id:1},hiddenReason:1,lastSeenRunId:1,prevSeenRunId:1,seenInRunId:1,attempt:{raw:{id:1,title:1,type:1,enable:1,deleted:1,parent_id:1}},updatedAt:1},apxcatalogtree:{},apxnightlysyncruns:{},apxingestjobs:{status:1,classId:1,apxAssetKey:1,customerId:1,assetKey:1,updatedAt:1,createdAt:1,attempts:1,lastError:1,dest:1,result:1,bytes:1,source:1},pdfs:{title:1,pdfAsset:1,createdAt:1,updatedAt:1,apxPdfId:1,sourceHash:1},apxsessions:{orgId:1,customerId:1,isActive:1,lastHttpStatus:1,lastCheckedAt:1,updatedAt:1},courses_backup_20261019_apxunlink:{}};
for(const[name,projection]of Object.entries(specs)){const docs=await db.collection(name).find({},Object.keys(projection).length?{projection}:{}).toArray();fs.writeFileSync(out+"/"+name+".json",JSON.stringify(docs));console.log(name,docs.length);}console.log("capturedAt",capturedAt);}finally{await c.close();}})().catch(e=>{console.error("audit_failed",e.name,e.codeName||e.code||"unknown");process.exitCode=1;});
