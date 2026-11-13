// Read-only Mongo snapshot for the 2026-10-19 import audit. Never prints credentials.
const fs = require("fs");
const root = "/Users/raghav/Projects/worktrees/vg-course-import";
const {MongoClient} = require(root + "/node_modules/mongoose").mongo;
const dotenv = require(root + "/node_modules/dotenv");
const env = dotenv.parse(fs.readFileSync("/Users/raghav/Projects/worktrees/vg-class-import/.env.development"));
const match = env.MONGO_URI.match(/^(mongodb:\/\/)([^/]+)(\/[^?]*)?(?:\?(.*))?$/);
if (!match) throw new Error("Unsupported URI form");
const params = new URLSearchParams(match[4] || "");
params.set("directConnection", "true"); params.set("readPreference", "primary");
const authority = match[2];
const uri = match[1] + authority.slice(0, authority.lastIndexOf("@")+1) + "127.0.0.1:27019" + (match[3]||"/vidyagramdb") + "?" + params;

(async()=>{const c=new MongoClient(uri,{serverSelectionTimeoutMS:10000});try{await c.connect();const out="outputs/vidyagram-import-verify-2026-10-19";for(const name of ["courses","courseclasses","classes","sections","topics","subtopics","coursetopics","maincategories","categories","facultydetails","apxcatalogimports","apxcatalogcourses","apxcatalogrows","apxcatalogtree","courses_backup_20261019_apxunlink"]){const docs=await c.db("vidyagramdb").collection(name).find({}, {projection: name==="apxcatalogrows"?{customerId:1,apxCourseId:1,raw:{id:1,title:1,type:1,enable:1,deleted:1,parent_id:1},hiddenReason:1,lastSeenRunId:1}:name==="classes"?{title:1,status:1,updatedAt:1,actualStartedAt:1,actualEndedAt:1,apxAssetKey:1}:undefined}).toArray();fs.writeFileSync(out+"/"+name+".json",JSON.stringify(docs));console.log(name,docs.length);} const q=c.db("quicktricks");const courses=await q.collection("courses").find({apxCourseId:{$exists:true}}).limit(3).toArray();fs.writeFileSync(out+"/quicktricks-sample.json",JSON.stringify({courses,rows:await q.collection("courseclasses").find({course:{$in:courses.map(x=>x._id)}}).toArray()}));}finally{await c.close();}})().catch(e=>{console.error(e.name, e.code, e.codeName, e.message.replace(/mongodb[^ ]+/g,"[redacted]"));process.exitCode=1;});
