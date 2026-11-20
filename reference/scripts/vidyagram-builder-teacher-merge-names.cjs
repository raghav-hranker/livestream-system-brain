// Dry run by default, refuses any DB but vidyagramdb. Follow-up to vidyagram-builder-teacher-merge.cjs: a placement
// carries its own chapter-name stamp (`CourseClass.topicName`, the per-course name), and the student class lists group
// by topic id AND that name. Placements moved into a merged chapter that kept the old chapter's stamp show as a second
// group. For each pair `keep` topic of PLAN, the chapter's name = the stamp most of the keep topic's own (unmoved,
// KEEP_TEACHER) placements carry; every placement of COURSE in that topic with a different non-null stamp gets it.
// COMMIT=1 EXPECT=<n>: backup to ~/vg-backups/, updates guarded on the old stamp. RESTORE=<backup> COMMIT=1 undoes.
// Run on webserver2-2 from the Vidyagram checkout:
//   COURSE=6aff1280d8f488b0916b2f98 KEEP_TEACHER=6af82ced78ca0c03c5968bb8 PLAN=/tmp/plan.json \
//   node -r dotenv/config - dotenv_config_path=.env.development < script
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const os = require('os');

const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!uri || !/\/vidyagramdb(\?|$)/.test(uri)) { console.error('refusing: MONGO_URI does not name vidyagramdb'); process.exit(1); }
const oid = (s) => new mongoose.Types.ObjectId(String(s));

(async () => {
  await mongoose.connect(uri);
  const col = mongoose.connection.db.collection('courseclasses');
  if (process.env.RESTORE) {
    const b = JSON.parse(fs.readFileSync(process.env.RESTORE, 'utf8'));
    const ops = b.changes.map((c) => ({ updateOne: { filter: { _id: oid(c._id), topicName: c.to }, update: { $set: { topicName: c.from, updatedAt: new Date() } } } }));
    if (process.env.COMMIT !== '1') console.log(JSON.stringify({ wouldRestore: ops.length }));
    else console.log(JSON.stringify({ restored: (await col.bulkWrite(ops, { ordered: false })).modifiedCount, of: ops.length }));
    await mongoose.disconnect();
    return;
  }
  const course = oid(process.env.COURSE);
  const keepTeacher = String(process.env.KEEP_TEACHER);
  const plan = JSON.parse(fs.readFileSync(process.env.PLAN, 'utf8'));
  const changes = [];
  const chapters = [];
  for (const pair of plan.pairs) {
    const rows = await col.find({ course, topic: oid(pair.keep) }, { projection: { topicName: 1, teacher: 1 } }).toArray();
    const tally = new Map();
    for (const r of rows) if (String(r.teacher) === keepTeacher && r.topicName) tally.set(r.topicName, (tally.get(r.topicName) || 0) + 1);
    const name = [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    if (!name) { chapters.push({ chapter: pair.name, skipped: 'no stamp on the keep teacher\'s placements' }); continue; }
    const off = rows.filter((r) => r.topicName && r.topicName !== name);
    for (const r of off) changes.push({ _id: String(r._id), from: r.topicName, to: name });
    chapters.push({ chapter: pair.name, name, stamps: Object.fromEntries(tally), fix: off.length, fromNames: [...new Set(off.map((r) => r.topicName))] });
  }
  let applied = null;
  if (process.env.COMMIT === '1') {
    if (changes.length !== Number(process.env.EXPECT)) { console.error(`refusing: ${changes.length} changes, EXPECT=${process.env.EXPECT}`); process.exit(2); }
    const dir = path.join(os.homedir(), 'vg-backups');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `builder-teacher-merge-names-${process.env.COURSE}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    fs.writeFileSync(file, JSON.stringify({ course: process.env.COURSE, at: new Date().toISOString(), changes }));
    const r = await col.bulkWrite(changes.map((c) => ({ updateOne: { filter: { _id: oid(c._id), course, topicName: c.from }, update: { $set: { topicName: c.to, updatedAt: new Date() } } } })), { ordered: false });
    applied = { backup: file, matched: r.matchedCount, modified: r.modifiedCount };
  }
  console.log(JSON.stringify({ applied, changes: changes.length, chapters }, null, 1));
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
