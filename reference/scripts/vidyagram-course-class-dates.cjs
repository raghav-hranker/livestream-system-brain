// Read-only, refuses any DB but vidyagramdb. For courses matching a title regex: placement counts by IST day of
// CourseClass.startDate, Class.startDate, Class.createdAt, and which date-like fields the AppX catalogue rows carry.
// Usage: NODE_PATH=~/Projects/worktrees/vg-backend/node_modules URI=<mongo uri> node vidyagram-course-class-dates.cjs '<title regex>'
const { MongoClient } = require('mongoose').mongo;

const IST_MS = 330 * 60 * 1000;
const day = (d) => (d instanceof Date ? new Date(d.getTime() + IST_MS).toISOString().slice(0, 10) : 'none');

function countBy(rows, key) {
  const out = {};
  for (const r of rows) out[key(r)] = (out[key(r)] || 0) + 1;
  return Object.entries(out).sort((a, b) => b[1] - a[1]).slice(0, 6);
}

(async () => {
  const client = await MongoClient.connect(process.env.URI);
  const db = client.db();
  if (db.databaseName !== 'vidyagramdb') throw new Error(`refusing db ${db.databaseName}`);

  const pattern = new RegExp(process.argv[2] || 'champion', 'i');
  const courses = await db.collection('courses')
    .find({ title: pattern }, { projection: { title: 1, status: 1, apxCourseId: 1, createdAt: 1 } }).toArray();

  for (const course of courses) {
    const rows = await db.collection('courseclasses').aggregate([
      { $match: { course: course._id } },
      { $lookup: { from: 'classes', localField: 'class', foreignField: '_id', as: 'c' } },
      { $unwind: '$c' },
      { $project: {
        ccStart: '$startDate', ccCreated: '$createdAt', isActive: 1,
        classStart: '$c.startDate', classCreated: '$c.createdAt', actualStartedAt: '$c.actualStartedAt',
      } },
    ]).toArray();
    console.log(`\n${course.title} | status ${course.status} | apx ${course.apxCourseId} | ${rows.length} placements`);
    console.log('  courseclass.startDate ', countBy(rows, (r) => day(r.ccStart)));
    console.log('  courseclass.createdAt ', countBy(rows, (r) => day(r.ccCreated)));
    console.log('  class.startDate       ', countBy(rows, (r) => day(r.classStart)));
    console.log('  class.createdAt       ', countBy(rows, (r) => day(r.classCreated)));
  }

  // Field names and values only for date-like keys, so no signed links or secrets from raw are printed.
  const apxId = courses.find((c) => c.apxCourseId != null)?.apxCourseId;
  if (apxId != null) {
    const samples = await db.collection('apxcatalogrows')
      .find({ $or: [{ apxCourseId: apxId }, { courseId: apxId }, { courseId: String(apxId) }] }).limit(200).toArray();
    console.log(`\nAppX catalogue rows sampled for course ${apxId}: ${samples.length}`);
    if (samples[0]) console.log('  top-level keys', Object.keys(samples[0]).join(', '));
    const dateKey = /date|time|created|updated|publish|schedule|strto/i;
    const seen = {};
    for (const s of samples) {
      for (const [k, v] of Object.entries(s.raw || {})) {
        if (!dateKey.test(k) || v == null || v === '' || typeof v === 'object') continue;
        (seen[k] ||= new Set()).add(String(v));
      }
    }
    for (const [k, values] of Object.entries(seen)) {
      console.log(`  raw.${k}: ${values.size} distinct, e.g. ${[...values].slice(0, 4).join(' | ')}`);
    }
  }
  await client.close();
})().catch((e) => { console.error(e); process.exit(1); });
