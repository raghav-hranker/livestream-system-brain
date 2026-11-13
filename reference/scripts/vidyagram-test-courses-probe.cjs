// Read-only, refuses any DB but vidyagramdb: every active Course with no apxCourseId (the May-June test courses and the
// Course Builder demo) with what hangs off it: plans that list it, orders on it or on those plans, enrollments, content.
// Prints JSON lines, no student data. Run from the nightly checkout on test-uday: nice -n 10 node - < script
require('dotenv').config({ path: '.env.development', quiet: true });
const mongoose = require('mongoose');
(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: 'vidyagramdb', readPreference: 'secondaryPreferred', autoIndex: false, autoCreate: false });
  const db = mongoose.connection.db;
  if (db.databaseName !== 'vidyagramdb') throw new Error('wrong db');
  const all = await db.collection('courses').find({}, { projection: { apxCourseId: 1, title: 1, status: 1, price: 1, discountPrice: 1, isFree: 1, isLive: 1, isRecorded: 1, showInBatchFilter: 1, createdAt: 1, updatedAt: 1, 'selling.options': 1 } }).toArray();
  const apx = new Map(all.map((c) => [String(c._id), c.apxCourseId || null]));
  const flags = {}; for (const c of all.filter((c) => c.status === 1)) { const k = `${c.apxCourseId ? 'appx' : 'ours'} isLive=${c.isLive} isRecorded=${c.isRecorded} free=${Boolean(c.isFree)}`; flags[k] = (flags[k] || 0) + 1; }
  console.log(JSON.stringify({ activeCourseFlags: flags }));
  const sample = await db.collection('orders').findOne({}, { projection: { _id: 0 } });
  console.log(JSON.stringify({ orderKeys: Object.keys(sample || {}) }));
  for (const c of all.filter((c) => !c.apxCourseId && c.status === 1)) {
    const ids = [c._id, String(c._id)];
    const plans = await db.collection('plans').find({ $or: [{ course: { $in: ids } }, { 'courseSale.courseId': { $in: ids } }] }, { projection: { name: 1, status: 1, amount: 1, course: 1, courseSale: 1 } }).toArray();
    const planIds = plans.flatMap((p) => [p._id, String(p._id)]);
    const count = (f) => db.collection('orders').countDocuments(f, { maxTimeMS: 60000 }).catch((e) => 'timeout');
    const direct = await count({ $or: [{ courseId: { $in: ids } }, { latestCourseId: { $in: ids } }, { 'build.courseId': { $in: ids } }] });
    const onlyHere = plans.filter((p) => (p.course || []).every((x) => !apx.get(String(x))));
    const onlyIds = onlyHere.flatMap((p) => [p._id, String(p._id)]);
    const planOrders = onlyIds.length ? await count({ $or: [{ planId: { $in: onlyIds } }, { plan: { $in: onlyIds } }, { plan_id: { $in: onlyIds } }] }) : 0;
    console.log(JSON.stringify({ id: String(c._id), title: c.title, price: c.price, discountPrice: c.discountPrice, isFree: Boolean(c.isFree), isLive: c.isLive, isRecorded: c.isRecorded, created: c.createdAt?.toISOString().slice(0, 10), updated: c.updatedAt?.toISOString().slice(0, 10), options: (c.selling?.options || []).length,
      classes: await db.collection('courseclasses').countDocuments({ course: c._id }), pdfs: await db.collection('coursepdfs').countDocuments({ course: c._id }), tests: await db.collection('coursetests').countDocuments({ course: c._id }), enrollments: await db.collection('courseenrollments').countDocuments({ $or: [{ course: { $in: ids } }, { courseId: { $in: ids } }] }),
      ordersOnCourse: direct, ordersOnItsOwnPlans: planOrders,
      plans: plans.map((p) => ({ id: String(p._id), name: String(p.name).slice(0, 60), status: p.status, amount: p.amount, courses: (p.course || []).length, realCourses: (p.course || []).map((x) => apx.get(String(x))).filter(Boolean).join(','), sellsThisCourse: String(p.courseSale?.courseId || '') === String(c._id) })) }));
  }
  await mongoose.disconnect();
})().catch((e) => { console.error(e.message); process.exitCode = 1; });
