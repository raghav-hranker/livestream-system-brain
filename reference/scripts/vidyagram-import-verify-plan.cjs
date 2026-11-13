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

process.env.TS_NODE_PROJECT = root + "/tsconfig.json";
require(root + "/node_modules/ts-node/register/transpile-only");
const { loadMirrorCourses } = require(root + "/src/services/apx/apxCatalogMirrorReader.ts");
const { planCatalogue } = require(root + "/src/services/apx/apxCatalogPlanner.ts");
(async()=>{ const c=new MongoClient(uri,{serverSelectionTimeoutMS:10000});try{await c.connect();const db=c.db("vidyagramdb");const daily=await loadMirrorCourses(db,{customerId:"781",runId:"daily-2026-10-19"});const old=await loadMirrorCourses(db,{customerId:"781",runId:"full-2026-10-13",courseIds:["96"]});const inputs=[...daily.inputs,...old.inputs];const {plans,...summary}=planCatalogue(inputs,{offSale:["66"]});fs.writeFileSync("outputs/vidyagram-import-verify-2026-10-19/plans.json",JSON.stringify({plans,summary}));console.log("plans",plans.length); }finally{await c.close();}})().catch(e=>{console.error(e.name, e.codeName);process.exitCode=1;});
