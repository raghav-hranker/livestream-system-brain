// Reassign content stuck on a faculty name the admin picker cannot offer.
// Copy into the backend checkout on the prod box and run there:
//   node ./.reassign_pdf_teacher.js                    -> report only, pdfs
//   node ./.reassign_pdf_teacher.js --all              -> report only, pdfs + classes + shorts
//   node ./.reassign_pdf_teacher.js --all --commit     -> rewrite teacherName on all three
//   node ./.reassign_pdf_teacher.js --classes --commit -> classes only
// Collection flags: --pdfs (default when none given), --classes, --shorts, --all.
//
// Why this exists: Pdf/Class/Short.teacherName is a free String with no ref to
// facultydetails, and the admin picker offers only faculty with status 1 AND
// customer_id in {472, 1} (facultyController.getFaculty). "Sahil Sir"
// (customer_id 695, since deleted) was never offerable, so the stored string
// renders as a synthetic "(Inactive)" option (PdfForm.tsx:131, ClassForm.tsx:174).
// Point that content at the faculty the picker does offer. There is no id to
// assign - the name string is the only link that exists.
require("dotenv").config({ path: ".env.development" });
const mongoose = require("mongoose");

const FROM = /^\s*sahil\s+sir\s*$/i;   // trim/case tolerant, will NOT match "Sahil Khandelwal Sir"
const TO = "Sahil Khandelwal Sir";
const ACTIVE_CUSTOMERS = [472, 1];
const COMMIT = process.argv.includes("--commit");
const ALL = process.argv.includes("--all");
const PICKED = ["pdfs", "classes", "shorts"].filter((c) => ALL || process.argv.includes(`--${c}`));
const TARGETS = PICKED.length ? PICKED : ["pdfs"];

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  console.log(COMMIT ? "MODE: commit" : "MODE: report only (add --commit to write)");
  console.log("collections:", TARGETS.join(", "));

  // 1. Confirm the target is really offerable by the picker before writing to it.
  const target = await db.collection("facultydetails").findOne({ name: TO });
  if (!target || target.status !== 1 || !ACTIVE_CUSTOMERS.includes(target.customer_id)) {
    console.log("ABORT: target faculty is not offerable by the admin picker:", target && {
      _id: String(target._id), name: target.name, status: target.status, customer_id: target.customer_id,
    });
    return mongoose.disconnect();
  }
  console.log("target faculty OK:", String(target._id), target.name, "status", target.status, "customer_id", target.customer_id);

  const offerable = new Set(
    (await db.collection("facultydetails")
      .find({ status: 1, customer_id: { $in: ACTIVE_CUSTOMERS } })
      .project({ name: 1 }).toArray()).map((f) => f.name)
  );
  const filter = { teacherName: { $regex: FROM } };

  for (const coll of TARGETS) {
    console.log(`\n================ ${coll} ================`);

    // 2. Every teacherName here the picker cannot offer - so nothing else is missed.
    const used = await db.collection(coll).aggregate([
      { $group: { _id: "$teacherName", n: { $sum: 1 } } }, { $sort: { n: -1 } },
    ]).toArray();
    console.log(`teacherName values on ${coll} (* = picker cannot offer it -> renders as "(Inactive)"):`);
    for (const r of used) {
      console.log(`  ${offerable.has(r._id) ? " " : "*"} ${JSON.stringify(r._id)}  x${r.n}`);
    }

    // 3. The reassignment itself.
    const hits = await db.collection(coll).find(filter).project({ title: 1, teacherName: 1 }).toArray();
    console.log(`\n${hits.length} ${coll} doc(s) matched ${FROM} ->`, COMMIT ? `rewriting to ${JSON.stringify(TO)}` : "would rewrite");
    for (const d of hits) console.log("   ", String(d._id), JSON.stringify(d.teacherName), "|", d.title);

    if (COMMIT && hits.length) {
      const res = await db.collection(coll).updateMany(filter, { $set: { teacherName: TO } });
      console.log("updateMany:", res.matchedCount, "matched,", res.modifiedCount, "modified");
      const left = await db.collection(coll).countDocuments(filter);
      console.log("remaining on the old name:", left, left === 0 ? "(clean)" : "(CHECK)");
    }
  }

  // 4. Anything left on the old name in a collection this run did not touch.
  const skipped = ["pdfs", "classes", "shorts"].filter((c) => !TARGETS.includes(c));
  for (const coll of skipped) {
    const n = await db.collection(coll).countDocuments(filter);
    console.log(`\n${coll}: ${n} doc(s) still on the old name (not selected this run)`);
  }

  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
