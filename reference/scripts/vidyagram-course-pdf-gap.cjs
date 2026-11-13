// Read-only, refuses any DB but vidyagramdb: AppX standalone PDFs (course-folder PDF rows) vs the course PDF
// placements (CoursePdf) they should have. Per AppX course: standalone sources in the PDF ledger, how many have a
// Pdf, how many CoursePdf rows the course holds. COURSE=<apxCourseId> also prints that course's sources.
// Run on webserver2-2 from the Vidyagram checkout: URI=<MONGO_URI from .env.development> node - < script
const mongoose = require('mongoose');
(async () => {
  await mongoose.connect(process.env.URI, { serverSelectionTimeoutMS: 8000, readPreference: 'secondaryPreferred' });
  const db = mongoose.connection.db;
  if (db.databaseName !== 'vidyagramdb') throw new Error('refusing: connected to ' + db.databaseName);

  const ledger = db.collection('apxcatalogpdfimports');
  console.log('ledger by kind x status:', JSON.stringify(await ledger.aggregate([
    { $group: { _id: { kind: '$kind', status: '$status', hasPdf: { $gt: ['$pdfId', null] } }, n: { $sum: 1 } } },
    { $sort: { '_id.kind': 1, '_id.status': 1 } },
  ]).toArray()));
  console.log('Pdf total:', await db.collection('pdfs').countDocuments(), ' CoursePdf total:', await db.collection('coursepdfs').countDocuments());

  const perCourse = await ledger.aggregate([
    { $unwind: '$sources' },
    { $match: { 'sources.kind': 'standalone' } },
    { $group: {
      _id: '$sources.apxCourseId',
      sources: { $sum: 1 },
      activeSources: { $sum: { $cond: ['$sources.active', 1, 0] } },
      withPdf: { $sum: { $cond: [{ $gt: ['$pdfId', null] }, 1, 0] } },
      pdfIds: { $addToSet: '$pdfId' },
    } },
  ]).toArray();
  const courses = await db.collection('courses').find({ apxCourseId: { $exists: true } }, { projection: { title: 1, apxCourseId: 1, status: 1 } }).toArray();
  const byApx = new Map(courses.map((c) => [String(c.apxCourseId), c]));
  const cpCounts = new Map((await db.collection('coursepdfs').aggregate([{ $group: { _id: '$course', n: { $sum: 1 } } }]).toArray()).map((r) => [String(r._id), r.n]));

  let tot = { sources: 0, withPdf: 0, courseRows: 0, noCourse: 0 };
  const rows = perCourse.map((r) => {
    const c = byApx.get(String(r._id));
    const coursePdfs = c ? cpCounts.get(String(c._id)) || 0 : null;
    tot.sources += r.sources; tot.withPdf += r.withPdf; tot.courseRows += coursePdfs || 0; if (!c) tot.noCourse += r.sources;
    return { apx: r._id, course: c ? String(c._id) : null, title: c ? c.title.slice(0, 50) : '(no Course)', status: c?.status, sources: r.sources, active: r.activeSources, withPdf: r.withPdf, uniquePdfs: r.pdfIds.filter(Boolean).length, coursePdfs };
  }).sort((a, b) => Number(a.apx) - Number(b.apx));
  console.log('courses with standalone sources:', rows.length, 'totals:', JSON.stringify(tot));
  console.table(rows);

  if (process.env.COURSE) {
    const docs = await ledger.find({ sources: { $elemMatch: { kind: 'standalone', apxCourseId: process.env.COURSE } } }, { projection: { fileKey: 0 } }).toArray();
    for (const d of docs) {
      const s = d.sources.filter((x) => x.apxCourseId === process.env.COURSE && x.kind === 'standalone');
      console.log(JSON.stringify({ status: d.status, pdfId: d.pdfId, title: d.title, rows: s.map((x) => ({ rowId: x.rowId, active: x.active, file: x.fileName })) }));
    }
  }
  await mongoose.disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
