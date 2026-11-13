// READ-ONLY, refuses any DB but vidyagramdb. AppX marks a course free by filing it under the parent "Free Courses"
// (detail.parent_id 62) at price -3; the -10 sentinel the planner looks for is unused on this tenant, so the import left
// isFree false. For each such course: AppX enable, our Course flags, and what isFree would change: classes and PDFs that
// also sit in paid courses (playback's OR makes them free everywhere), buyers whose my-courses would drop it.
// Run on webserver2-2 from the Vidyagram checkout:
//   URI=<MONGO_URI from .env.development> nice -n 10 node - < script
const mongoose = require('mongoose');

const FREE_PARENT = '62';

(async () => {
  await mongoose.connect(process.env.URI, { serverSelectionTimeoutMS: 8000, readPreference: 'secondaryPreferred' });
  const db = mongoose.connection.db;
  if (db.databaseName !== 'vidyagramdb') throw new Error('refusing: connected to ' + db.databaseName);

  const mirror = await db.collection('apxcatalogcourses').find({ customerId: '781', 'detail.parent_id': FREE_PARENT })
    .project({ apxCourseId: 1, 'listRow.enable': 1, 'detail.price': 1, 'detail.title': 1, 'capture.runId': 1 }).toArray();
  const all = await db.collection('courses').find({ apxCourseId: { $ne: null } })
    .project({ apxCourseId: 1, isFree: 1 }).toArray();
  const paidIds = new Set(all.filter((c) => c.isFree !== true && !mirror.some((m) => String(m.apxCourseId) === String(c.apxCourseId))).map((c) => String(c._id)));

  const totals = { courses: 0, classes: 0, sharedClasses: 0, pdfs: 0, sharedPdfs: 0 };
  const sharedClassSet = new Set();
  for (const m of mirror) {
    const id = String(m.apxCourseId);
    const c = await db.collection('courses').findOne({ apxCourseId: { $in: [id, Number(id)] } },
      { projection: { title: 1, status: 1, isFree: 1, isLive: 1, isRecorded: 1, isOld: 1, price: 1, discountPrice: 1, apxPrice: 1, showInBatchFilter: 1 } });
    const base = { apx: id, title: (m.detail?.title || '').trim(), appxEnable: m.listRow?.enable, appxPrice: m.detail?.price, run: m.capture?.runId };
    if (!c) { console.log(JSON.stringify({ ...base, ours: null })); continue; }

    const classIds = await db.collection('courseclasses').distinct('class', { course: c._id, isActive: { $ne: false } });
    const placementsElsewhere = await db.collection('courseclasses').aggregate([
      { $match: { class: { $in: classIds }, course: { $ne: c._id }, isActive: { $ne: false } } },
      { $group: { _id: { class: '$class', course: '$course' } } },
    ]).toArray();
    const sharedClasses = new Set(placementsElsewhere.filter((p) => paidIds.has(String(p._id.course))).map((p) => String(p._id.class)));
    sharedClasses.forEach((x) => sharedClassSet.add(x));

    const pdfIds = await db.collection('coursepdfs').distinct('pdf', { course: c._id, isActive: { $ne: false } });
    const pdfElsewhere = await db.collection('coursepdfs').aggregate([
      { $match: { pdf: { $in: pdfIds }, course: { $ne: c._id }, isActive: { $ne: false } } },
      { $group: { _id: { pdf: '$pdf', course: '$course' } } },
    ]).toArray();
    const sharedPdfs = new Set(pdfElsewhere.filter((p) => paidIds.has(String(p._id.course))).map((p) => String(p._id.pdf)));

    const orderMatch = { orderStatus: 'success', status: { $ne: 0 }, courseId: { $in: [c._id, String(c._id)] } };
    const holders = await db.collection('orders').countDocuments(orderMatch);
    const soloOrders = await db.collection('orders').countDocuments({ ...orderMatch, courseId: { $in: [c._id, String(c._id)], $size: 1 } });
    const activePlans = await db.collection('plans').find({ course: c._id, status: 1 }).project({ course: 1 }).toArray();

    totals.courses += 1;
    totals.classes += classIds.length;
    totals.sharedClasses += sharedClasses.size;
    totals.pdfs += pdfIds.length;
    totals.sharedPdfs += sharedPdfs.size;
    console.log(JSON.stringify({
      ...base,
      ours: {
        id: String(c._id), status: c.status, isFree: c.isFree ?? null, isLive: c.isLive ?? null, isRecorded: c.isRecorded ?? null, isOld: c.isOld ?? null,
        price: c.price ?? null, discountPrice: c.discountPrice ?? null, apxPrice: c.apxPrice ?? null,
        classes: classIds.length, classesAlsoInPaid: sharedClasses.size, pdfs: pdfIds.length, pdfsAlsoInPaid: sharedPdfs.size,
        orders: holders, soloOrders, activePlans: activePlans.map((p) => (p.course || []).length),
      },
    }));
  }
  console.log('totals', JSON.stringify({ ...totals, distinctClassesAlsoInPaid: sharedClassSet.size }));
  await mongoose.disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
