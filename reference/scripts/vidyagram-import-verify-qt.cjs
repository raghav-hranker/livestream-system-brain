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

(async()=>{const c=new MongoClient(uri,{serverSelectionTimeoutMS:10000});try{await c.connect();const db=c.db("quicktricksdb");const courses=await db.collection("courses").find({apxCourseId:{$exists:true}}).limit(3).toArray();const rows=await db.collection("courseclasses").find({course:{$in:courses.map(x=>x._id)}}).toArray();fs.writeFileSync("outputs/vidyagram-import-verify-2026-10-19/quicktricks-sample.json",JSON.stringify({db:"quicktricksdb",courses,rows}));console.log("sample",courses.length,rows.length);}finally{await c.close();}})().catch(e=>{console.error(e.name,e.codeName);process.exitCode=1;});
