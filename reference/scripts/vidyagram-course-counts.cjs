// Read-only, refuses any DB but vidyagramdb: how many courses AppX has against the mirror and our Course collection.
// Live AppX CMS list by enable, mirror size, our Courses by status and AppX link, and each side's leftovers.
// Needs a live maintained session. Run from the nightly checkout on test-uday:
//   cd /home/raghav/vidyagram-nightly-20261019 && node - < vidyagram-course-counts.cjs
require('dotenv').config({ path: '.env.development', quiet: true });
require('ts-node/register/transpile-only');
const mongoose = require('mongoose');
const { createHttpCatalogSource } = require(process.cwd() + '/src/services/apx/apxCatalogHttpSource');

const tally = (rows, get) => rows.reduce((m, r) => { const k = String(get(r)); m[k] = (m[k] || 0) + 1; return m; }, {});

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: 'vidyagramdb', readPreference: 'secondaryPreferred', autoIndex: false, autoCreate: false });
  try {
    const db = mongoose.connection.db;
    if (db.databaseName !== 'vidyagramdb') throw new Error('wrong db');

    const source = createHttpCatalogSource({ db, customerId: '781', orgId: '2177599', tenantApiBase: 'https://armathsapi.akamai.net.in', gapMs: 1000, studentGapMs: 1000 });
    const live = [];
    for (let s = 0; ; s += 100) { const p = await source.courseListPage(s, 100); live.push(...p.rows); if (p.rows.length < 100) break; }
    const liveIds = new Set(live.map((r) => String(r.id)));
    console.log('AppX live CMS list:', live.length, 'rows,', liveIds.size, 'distinct ids');
    console.log('AppX enable:', JSON.stringify(tally(live, (r) => r.enable)));

    const mirror = await db.collection('apxcatalogcourses').find({}, { projection: { apxCourseId: 1 } }).toArray();
    const mirrorIds = new Set(mirror.map((c) => String(c.apxCourseId)));
    console.log('Mirror apxcatalogcourses:', mirror.length, '| live not in mirror:', [...liveIds].filter((i) => !mirrorIds.has(i)).length, '| mirror not in live:', [...mirrorIds].filter((i) => !liveIds.has(i)).length);

    const courses = await db.collection('courses').find({}, { projection: { apxCourseId: 1, status: 1, title: 1, createdAt: 1 } }).toArray();
    const linked = courses.filter((c) => c.apxCourseId !== undefined && c.apxCourseId !== null && c.apxCourseId !== '');
    const ourIds = new Set(linked.map((c) => String(c.apxCourseId)));
    console.log('Our courses:', courses.length, '| by status', JSON.stringify(tally(courses, (c) => c.status)));
    console.log('Linked to AppX:', linked.length, ', distinct ids', ourIds.size, '| by status', JSON.stringify(tally(linked, (c) => c.status)));
    const native = courses.filter((c) => !linked.includes(c));
    console.log('Ours only, no AppX id:', native.length, '| by status', JSON.stringify(tally(native, (c) => c.status)));
    for (const c of native) {
      const classes = await db.collection('courseclasses').countDocuments({ course: c._id });
      const orders = await db.collection('orders').countDocuments({ courseId: c._id });
      console.log(' ', c.status, String(c.createdAt).slice(0, 15), 'classes', classes, 'orders', orders, JSON.stringify(c.title).slice(0, 70));
    }
    const statusById = new Map(linked.map((c) => [String(c.apxCourseId), c.status]));
    console.log('AppX enable x our status:', JSON.stringify(tally(live, (r) => `enable ${r.enable} / status ${statusById.has(String(r.id)) ? statusById.get(String(r.id)) : 'no Course'}`)));

    const noCourse = live.filter((r) => !ourIds.has(String(r.id)));
    console.log('AppX live with no Course here:', noCourse.length);
    for (const r of noCourse) console.log(' ', r.id, 'enable', r.enable, 'price', r.price, JSON.stringify(r.title).slice(0, 70));
    const gone = linked.filter((c) => !liveIds.has(String(c.apxCourseId)));
    console.log('Our linked courses not in the AppX live list:', gone.length, JSON.stringify(gone.map((c) => ({ id: String(c.apxCourseId), title: c.title, status: c.status }))));
    const onSale = live.filter((r) => String(r.enable) === '1' && statusById.get(String(r.id)) !== 1);
    console.log('Enabled in AppX, not status 1 here:', onSale.length);
    for (const r of onSale) console.log(' ', r.id, 'price', r.price, 'status', statusById.has(String(r.id)) ? statusById.get(String(r.id)) : 'no Course', JSON.stringify(r.title).slice(0, 70));
    const offHere = live.filter((r) => String(r.enable) !== '1' && statusById.get(String(r.id)) === 1);
    console.log('Disabled in AppX, status 1 here:', offHere.length);
    for (const r of offHere) console.log(' ', r.id, 'price', r.price, JSON.stringify(r.title).slice(0, 70));
  } finally { await mongoose.disconnect(); }
})().catch((e) => { console.error(String(e.message).replace(/https?:\/\/\S+/g, '[url]')); process.exitCode = 1; });
