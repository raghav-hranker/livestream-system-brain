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

const out="vidyagram/plans/appx-sync-remediation-2026-10-26";
(async()=>{const c=new MongoClient(uri,{serverSelectionTimeoutMS:12000});try{await c.connect();const db=c.db("vidyagramdb");const validation=JSON.parse(fs.readFileSync("vidyagram/reports/appx-sync-repair-2026-10-26/pdf-capture-backup/full-pdf-validation.json"));const ObjectId=require(root+"/node_modules/mongoose").mongo.ObjectId;const entries=await db.collection("apxcatalogpdfimports").find({_id:{$in:validation.map(x=>new ObjectId(x.id))}},{projection:{status:1,pdfId:1,sha256:1,updatedAt:1,kind:1,runId:1}}).toArray();const twins=await db.collection("pdfs").find({"pdfAsset.sha256":{$in:validation.map(x=>x.sha256)}},{projection:{"pdfAsset.sha256":1,"pdfAsset.sizeBytes":1,updatedAt:1}}).toArray();const result={checkedAt:new Date().toISOString(),readOnly:true,pdfLedger:entries,pdfHashTwins:twins,sourceBytes:validation.map(x=>({ledgerId:x.id,bytes:x.bytes,sha256:x.sha256})),productionWrites:0};fs.writeFileSync(out+"/phase-state-refresh.json",JSON.stringify(result,null,2));console.log(JSON.stringify({checkedAt:result.checkedAt,selectedLedger:entries.length,statuses:entries.map(x=>x.status),withPdfId:entries.filter(x=>x.pdfId).length,hashTwins:twins.length,productionWrites:0}));}finally{await c.close();}})().catch(e=>{console.error("blast_check_failed",e.name,e.codeName||e.code||"unknown");process.exitCode=1;});
