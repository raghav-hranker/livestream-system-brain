// Read-only: live AppX CMS course list vs the Vidyagram mirror (apxcatalogcourses) and vidyagramdb courses.
// Prints live courses missing from the mirror, and for every live course id >= MIN_ID (default 150): our Course,
// its CourseClass/CoursePdf counts and the mirror row count. An empty course in AppX shows mirrorRows 0.
// Needs a live maintained session (run preflight.cjs first). Run from the nightly checkout on test-uday:
//   cd /home/raghav/vidyagram-nightly-20261019 && node - < vidyagram-new-courses-probe.cjs   (MIN_ID=160 to narrow)
require('dotenv').config({ path: '.env.development', quiet: true });
require('ts-node/register/transpile-only');
const mongoose = require('mongoose');
const { createHttpCatalogSource } = require(process.cwd() + '/src/services/apx/apxCatalogHttpSource');
const MIN_ID = Number(process.env.MIN_ID || 150);

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: 'vidyagramdb', readPreference: 'primary', autoIndex: false, autoCreate: false });
  try {
    const db = mongoose.connection.db;
    if (db.databaseName !== 'vidyagramdb') throw new Error('wrong db');
    const source = createHttpCatalogSource({ db, customerId: '781', orgId: '2177599', tenantApiBase: 'https://armathsapi.akamai.net.in', gapMs: 1000, studentGapMs: 1000 });
    const rows = [];
    for (let s = 0; ; s += 100) { const p = await source.courseListPage(s, 100); rows.push(...p.rows); if (p.rows.length < 100) break; }
    const id = (r) => String(r.id);
    const mirror = new Set((await db.collection('apxcatalogcourses').find({}, { projection: { apxCourseId: 1 } }).toArray()).map((c) => String(c.apxCourseId)));
    console.log('live CMS courses', rows.length, '| mirror', mirror.size);
    console.log('live, not in mirror:', JSON.stringify(rows.filter((r) => !mirror.has(id(r))).map((r) => ({ id: id(r), title: r.title, price: r.price }))));
    for (const r of rows.filter((r) => Number(id(r)) >= MIN_ID).sort((a, b) => Number(id(b)) - Number(id(a)))) {
      const k = id(r);
      const c = await db.collection('courses').findOne({ apxCourseId: { $in: [k, Number(k)] } }, { projection: { _id: 1, status: 1 } });
      const cc = c ? await db.collection('courseclasses').countDocuments({ course: c._id }) : '-';
      const cp = c ? await db.collection('coursepdfs').countDocuments({ $or: [{ course: c._id }, { courseId: c._id }] }) : '-';
      const mr = await db.collection('apxcatalogrows').countDocuments({ apxCourseId: { $in: [k, Number(k)] } });
      console.log(k, JSON.stringify(r.title).slice(0, 60), '| course', c ? String(c._id) : 'NONE', 'classes', cc, 'pdfs', cp, 'mirrorRows', mr);
    }
  } finally { await mongoose.disconnect(); }
})().catch((e) => { console.error(String(e.message).replace(/https?:\/\/\S+/g, '[url]')); process.exitCode = 1; });
