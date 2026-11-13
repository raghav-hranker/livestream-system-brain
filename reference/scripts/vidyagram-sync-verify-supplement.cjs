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
(async()=>{const c=new MongoClient(uri,{serverSelectionTimeoutMS:12000});try{await c.connect();const db=c.db("vidyagramdb");for(const[name,projection]of [["apxcatalogpdfimports",{signedUrl:0,token:0,cookie:0}],["apxingestjobs",{status:1,classId:1,assetKey:1,customerId:1,updatedAt:1,createdAt:1,attempts:1,error:1,levels:1,progress:1,phase:1,doneAt:1,manifestKey:1,target:1}],["apx_user_raw_migration_state",{}],["apx_orders_new_migration_state",{}],["apx_transactions_migration_state",{}],["apx_user_course_test_detail_migration_state",{}]]){const docs=await db.collection(name).find({},Object.keys(projection).length?{projection}:{}).toArray();fs.writeFileSync(out+"/"+name+".json",JSON.stringify(docs));console.log(name,docs.length);}}finally{await c.close();}})().catch(e=>{console.error("supplement_failed",e.name,e.codeName||e.code);process.exitCode=1;});
