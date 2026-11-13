// Read-only Mongo snapshot for the 2026-10-19 import audit. Never prints credentials.
const fs = require("fs");
const root = "/Users/raghav/Projects/worktrees/vg-nightly-sync";
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
(async()=>{const c=new MongoClient(uri,{serverSelectionTimeoutMS:12000});try{await c.connect();const {inputs,missing}=await loadMirrorCourses(c.db("vidyagramdb"),{customerId:"781",runId:null});const {plans,...summary}=planCatalogue(inputs,{offSale:["66"]});fs.writeFileSync("vidyagram/reports/appx-sync-verify-2026-10-26/plans.json",JSON.stringify({capturedAt:new Date().toISOString(),plans,summary,missing}));console.log("plans",plans.length);}finally{await c.close();}})().catch(e=>{console.error("plan_failed",e.name,e.codeName||e.code);process.exitCode=1;});
