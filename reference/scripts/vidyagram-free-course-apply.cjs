// **WRITES with COMMIT=1**, refuses any DB but vidyagramdb. Sets Course.isFree on the 12 published courses AppX files
// under "Free Courses" (parent_id 62), which the import left false because they carry price -3, not -10. Touches isFree only;
// their price and discountPrice are already 0. Dry run by default; every course's before-state was isFree false.
// Each id is re-checked against the mirror (parent 62, enable 1) and our row (status 1, apxPrice -3) before writing.
// Run on webserver2-2 from the Vidyagram checkout: URI=<MONGO_URI from .env.development> [COMMIT=1] [UNDO=1] node - < script
const mongoose = require('mongoose');

const APX_IDS = ['63', '78', '79', '81', '111', '112', '113', '140', '141', '142', '147', '166'];
const COMMIT = process.env.COMMIT === '1';
const UNDO = process.env.UNDO === '1';

(async () => {
  await mongoose.connect(process.env.URI, { serverSelectionTimeoutMS: 8000, readPreference: 'primary' });
  const db = mongoose.connection.db;
  if (db.databaseName !== 'vidyagramdb') throw new Error('refusing: connected to ' + db.databaseName);
  const courses = db.collection('courses');

  const ids = [];
  for (const apx of APX_IDS) {
    const m = await db.collection('apxcatalogcourses').findOne({ customerId: '781', apxCourseId: { $in: [apx, Number(apx)] } },
      { projection: { 'listRow.enable': 1, 'detail.parent_id': 1 } });
    const c = await courses.findOne({ apxCourseId: { $in: [apx, Number(apx)] } },
      { projection: { title: 1, status: 1, isFree: 1, price: 1, discountPrice: 1, apxPrice: 1 } });
    const ok = c && m?.detail?.parent_id === '62' && m?.listRow?.enable === '1' && c.status === 1 && c.apxPrice === -3
      && !c.price && !c.discountPrice;
    const plans = c ? await db.collection('plans').find({ course: c._id, status: 1 }).project({ amount: 1, course: 1 }).toArray() : [];
    console.log(JSON.stringify({ apx, id: c && String(c._id), title: c?.title?.trim(), isFree: c?.isFree ?? null, ok: Boolean(ok),
      plans: plans.map((p) => ({ amount: p.amount, courses: (p.course || []).length })) }));
    if (!ok) throw new Error(`refusing: AppX ${apx} no longer matches; nothing written`);
    ids.push(c._id);
  }

  const [from, to] = UNDO ? [true, false] : [false, true];
  const filter = { _id: { $in: ids }, isFree: from };
  console.log('would change:', await courses.countDocuments(filter), 'of', ids.length, `(isFree ${from} -> ${to})`);
  if (COMMIT) {
    const r = await courses.updateMany(filter, { $set: { isFree: to } }, { writeConcern: { w: 'majority' } });
    console.log('matched', r.matchedCount, 'modified', r.modifiedCount);
    console.log('now on primary, isFree true:', await courses.countDocuments({ _id: { $in: ids }, isFree: true }), 'of', ids.length);
    console.log('all courses with isFree true:', await courses.countDocuments({ isFree: true }));
  }
  await mongoose.disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
