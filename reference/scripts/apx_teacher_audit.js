// READ-ONLY audit: does APX supply a per-asset teacher, and what would a
// teacherName rewrite break? Writes nothing. Copy into the backend checkout on
// the prod box and run there:
//   node ./.apx_teacher_audit.js
//
// Answers the open questions in handoff-apx-teacher-names-2026-09-21:
//   Q1 raw APX payloads: any teacher/faculty-like key anywhere in the stored raw rows?
//   Q2 which catch-up teacher default the running app resolves (.env files)
//   Q3 classes/pdfs/shorts split by teacherName x APX-ported (apxAssetKey) x month
//   Q5 admins whose facultyId dangles / whose class list depends on "Sahil Sir"
const fs = require("fs");
const dotenv = require("dotenv");
dotenv.config({ path: ".env.development" });
const mongoose = require("mongoose");

const KEY_RE = /teacher|faculty|instructor|educator|tutor|mentor|author|staff|presenter|host/i;
const RAW_SOURCES = [
  // collection, raw field(s) to walk
  ["apxcourses", ["courseData"]],
  ["apxcoursebackups", null], // whole doc
  ["apxingestjobs", null],
];
const MAX_DOCS_PER_SOURCE = 50000;

function walk(o, path, out, depth = 0) {
  if (depth > 12 || o === null || typeof o !== "object") return;
  if (Array.isArray(o)) { for (const x of o) walk(x, path + "[]", out, depth + 1); return; }
  for (const [k, v] of Object.entries(o)) {
    const p = path ? `${path}.${k}` : k;
    if (KEY_RE.test(k)) {
      const e = out.get(p) || { n: 0, values: new Map() };
      e.n++;
      const sv = typeof v === "object" ? JSON.stringify(v)?.slice(0, 80) : String(v).slice(0, 80);
      e.values.set(sv, (e.values.get(sv) || 0) + 1);
      out.set(p, e);
    }
    walk(v, p, out, depth + 1);
  }
}

(async () => {
  // ---------- Q2 ----------
  console.log("================ Q2: catch-up teacher default ================");
  for (const f of [".env.production", ".env.development", ".env"]) {
    if (!fs.existsSync(f)) { console.log(`${f}: (absent)`); continue; }
    const env = dotenv.parse(fs.readFileSync(f));
    for (const k of ["APX_CATCHUP_TEACHER_NAME", "PDF_PORT_TEACHER_NAME", "PDF_NOTE_PORT_TEACHER_NAME", "APX_DAILY_CATCHUP_DISABLED"]) {
      console.log(`${f}: ${k} = ${k in env ? JSON.stringify(env[k]) : "(unset)"}`);
    }
  }
  console.log("(production loads .env.production first; dotenv never overrides, so first file that sets a key wins; unset everywhere => code default 'Sahil Sir')");

  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;

  // ---------- Q1 ----------
  console.log("\n================ Q1: teacher-like keys in raw APX rows ================");
  console.log("key regex:", KEY_RE);
  for (const [coll, fields] of RAW_SOURCES) {
    const total = await db.collection(coll).estimatedDocumentCount().catch(() => 0);
    const proj = fields ? Object.fromEntries(fields.map((f) => [f, 1])) : {};
    const cur = db.collection(coll).find({}, { projection: proj }).limit(MAX_DOCS_PER_SOURCE);
    const out = new Map();
    let scanned = 0;
    const allTopKeys = new Set();
    for await (const d of cur) {
      scanned++;
      const root = fields ? Object.fromEntries(fields.map((f) => [f, d[f]])) : d;
      walk(root, "", out);
      if (fields) for (const f of fields) if (d[f] && typeof d[f] === "object") Object.keys(d[f]).forEach((k) => allTopKeys.add(`${f}.${k}`));
    }
    console.log(`\n-- ${coll}: scanned ${scanned}/${total}`);
    if (allTopKeys.size) console.log("   top-level raw keys:", [...allTopKeys].sort().join(", "));
    if (!out.size) console.log("   NO teacher-like key found");
    for (const [p, e] of [...out.entries()].sort((a, b) => b[1].n - a[1].n)) {
      const top = [...e.values.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
        .map(([v, n]) => `${JSON.stringify(v)} x${n}`).join(", ");
      console.log(`   ${p}  (${e.n} hits)  ${top}`);
    }
  }

  // ---------- Q3 ----------
  console.log("\n================ Q3: teacherName x APX-ported x created month ================");
  for (const coll of ["classes", "pdfs", "shorts"]) {
    const rows = await db.collection(coll).aggregate([
      { $group: {
          _id: {
            t: "$teacherName",
            apx: { $cond: [{ $gt: [{ $strLenCP: { $ifNull: ["$apxAssetKey", ""] } }, 0] }, "apx", "hand"] },
            m: { $dateToString: { format: "%Y-%m", date: { $ifNull: ["$createdAt", { $toDate: "$_id" }] } } },
          },
          n: { $sum: 1 } } },
      { $sort: { "_id.t": 1, "_id.apx": 1, "_id.m": 1 } },
    ]).toArray();
    console.log(`\n-- ${coll}`);
    for (const r of rows) console.log(`   ${String(JSON.stringify(r._id.t)).padEnd(28)} ${r._id.apx.padEnd(5)} ${r._id.m}  x${r.n}`);
  }

  // ---------- Q5 ----------
  console.log("\n================ Q5: admins linked to faculty / teacher names ================");
  const faculty = new Map((await db.collection("facultydetails").find({}).project({ name: 1, status: 1, customer_id: 1 }).toArray())
    .map((f) => [String(f._id), f]));
  const admins = await db.collection("admins").find({
    $or: [{ facultyId: { $exists: true, $ne: null } }, { Name: /sahil/i }],
  }).project({ Name: 1, Email: 1, admin_mobile: 1, facultyId: 1, status: 1, role: 1 }).toArray();
  for (const a of admins) {
    const fid = a.facultyId ? String(a.facultyId) : null;
    const f = fid && faculty.get(fid);
    const state = !fid ? "no facultyId" : f ? `-> ${JSON.stringify(f.name)} (status ${f.status}, cust ${f.customer_id})` : "-> DANGLING (faculty row deleted)";
    const aliases = [a.Name, a.Email, a.admin_mobile, f && f.name].filter(Boolean).map((s) => String(s).trim());
    const counts = {};
    for (const name of ["Sahil Sir", "Sahil Khandelwal Sir"]) {
      counts[name] = aliases.some((x) => x.toLowerCase() === name.toLowerCase()) ? "matches" : "-";
    }
    console.log(`   ${String(a._id)} ${JSON.stringify(a.Name)} role=${a.role ?? "?"} status=${a.status ?? "?"} ${state}`);
    console.log(`      class-list aliases: ${JSON.stringify(aliases)}  | "Sahil Sir": ${counts["Sahil Sir"]}  "Sahil Khandelwal Sir": ${counts["Sahil Khandelwal Sir"]}`);
  }
  if (!admins.length) console.log("   no admin has a facultyId or a Sahil-like Name");

  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
