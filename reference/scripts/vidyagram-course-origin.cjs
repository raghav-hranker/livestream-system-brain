// Read-only, refuses any DB but vidyagramdb: how one Course came to exist. COURSES=<AppX ids>: dates and non-content fields of the Course,
// its placements, purchases by item type with first purchase date, and same-titled Plans. Also every PDF-only AppX course (active PDFs,
// no active class) and whether it has a Course. Prints no student data.
// Run from the nightly checkout on test-uday: COURSES=117 node --max-old-space-size=3072 - < vidyagram-course-origin.cjs
require('dotenv').config({ path: '.env.development', quiet: true });
require('ts-node/register/transpile-only');
const mongoose = require('mongoose');
const { loadMirrorCourses } = require(process.cwd() + '/src/services/apx/apxCatalogMirrorReader');
const { planCatalogue } = require(process.cwd() + '/src/services/apx/apxCatalogPlanner');

const IDS = String(process.env.COURSES || '').split(',').filter(Boolean);

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: 'vidyagramdb', readPreference: 'secondaryPreferred', autoIndex: false, autoCreate: false });
  try {
    const db = mongoose.connection.db;
    if (db.databaseName !== 'vidyagramdb') throw new Error('wrong db');
    const courses = await db.collection('courses').find({ apxCourseId: { $exists: true, $nin: [null, ''] } }, { projection: { apxCourseId: 1, createdAt: 1, status: 1 } }).toArray();
    const byApx = new Map(courses.map((c) => [String(c.apxCourseId), c]));

    for (const id of IDS) {
      const c = await db.collection('courses').findOne({ apxCourseId: { $in: [id, Number(id)] } });
      if (!c) { console.log(JSON.stringify({ id, course: null })); continue; }
      const keep = Object.entries(c).filter(([k, v]) => /creat|updat|source|import|apx|migrat|status|price|isFree/i.test(k) && typeof v !== 'object').map(([k, v]) => [k, String(v).slice(0, 40)]);
      const dates = { createdAt: c.createdAt, updatedAt: c.updatedAt, idTime: c._id.getTimestamp() };
      const classes = await db.collection('courseclasses').countDocuments({ course: c._id });
      const pdfs = await db.collection('coursepdfs').countDocuments({ course: c._id });
      const pdfDates = await db.collection('coursepdfs').find({ course: c._id }, { projection: { createdAt: 1 } }).sort({ createdAt: 1 }).limit(1).toArray();
      const bought = await db.collection('apx_orders_new').aggregate([
        { $match: { item_id: { $in: [id, Number(id)] } } },
        { $group: { _id: { type: '$item_type', processed: { $eq: ['$processed', true] }, tx: { $substrBytes: [{ $toString: { $ifNull: ['$transaction_id', ''] } }, 0, 4] } }, n: { $sum: 1 }, firstSync: { $min: '$syncedAt' } } },
      ], { maxTimeMS: 90000 }).toArray();
      const orders = await db.collection('orders').countDocuments({ $or: [{ courseId: c._id }, { courseId: String(c._id) }] }, { maxTimeMS: 60000 }).catch(() => 'timeout');
      console.log(JSON.stringify({ id, fields: keep, dates, classes, pdfs, firstPdfPlaced: pdfDates[0]?.createdAt ?? null, purchases: bought.map((b) => [b._id.type, b._id.processed, b._id.tx, b.n, b.firstSync]), ordersOnCourse: orders }));
    }

    const { inputs } = await loadMirrorCourses(db, { customerId: '781', runId: null });
    const { plans } = planCatalogue(inputs);
    const pdfOnly = plans.filter((p) => { const k = p.items.filter((i) => i.active); return k.length > 0 && k.every((i) => i.kind === 'PDF'); });
    for (const p of pdfOnly) {
      const id = String(p.course.apxCourseId);
      const c = byApx.get(id);
      const paid = await db.collection('apx_orders_new').countDocuments({ item_id: { $in: [id, Number(id)] }, item_type: 'Digital Products' }, { maxTimeMS: 60000 }).catch(() => 'timeout');
      console.log(JSON.stringify({ pdfOnlyCourse: id, title: String(p.course.title).slice(0, 40), pdfs: p.counts.active, price: p.course.price, sentinel: p.course.priceSentinel, enabled: p.course.enabled, plannerStatus: p.course.status, course: c ? String(c.createdAt).slice(0, 24) : null, digitalPurchases: paid }));
    }
  } finally { await mongoose.disconnect(); }
})().catch((e) => { console.error(String(e.stack || e.message).replace(/https?:\/\/\S+/g, '[url]')); process.exitCode = 1; });
