// mongosh, vidyagramdb, read-only. One row per AppX course: AppX title, on/off, price/mrp,
// classes and PDFs AppX lists (shown / hidden) for the course's capture run, and what we copied:
// the Course (status, price), its CourseClass rows (active / inactive) and the PDFs the PDF
// import made from it (standalone vs class notes).
//   OUT=/path/report.json mongosh "$URI" --quiet --file vidyagram-appx-course-report.js
const OUT = process.env.OUT;
const CLASS_TYPES = ['VIDEO', 'LIVE_STREAM'];
const n = (v) => (v === undefined || v === null || v === '' ? null : Number(v));

const mirror = db.apxcatalogcourses.find({ customerId: '781' },
  { apxCourseId: 1, 'listRow.title': 1, 'listRow.course_name': 1, 'listRow.enable': 1, 'detail.price': 1, 'detail.mrp': 1, 'listRow.price': 1, 'detail.validity': 1, 'detail.validity_type': 1, 'capture.runId': 1, 'capture.status': 1, 'captureAttempt.status': 1 }).toArray();

const rowStats = new Map(db.apxcatalogrows.aggregate([
  { $match: { customerId: '781' } },
  { $project: { apxCourseId: 1, lastSeenRunId: 1, type: { $toUpper: '$raw.type' }, shown: { $and: [{ $eq: ['$hiddenReason', null] }, { $ne: ['$raw.deleted', '1'] }, { $ne: ['$raw.enable', '0'] }] } } },
  { $group: { _id: { c: '$apxCourseId', r: '$lastSeenRunId', t: '$type', s: '$shown' }, n: { $sum: 1 } } },
]).toArray().map((g) => [`${g._id.c}|${g._id.r}|${g._id.t}|${g._id.s}`, g.n]));
const rows = (c, run, types, shown) => types.reduce((sum, t) => sum + (rowStats.get(`${c}|${run}|${t}|${shown}`) ?? 0), 0);

const courses = new Map(db.courses.find({ apxCourseId: { $exists: true } }, { apxCourseId: 1, title: 1, status: 1, price: 1, discountPrice: 1, isFree: 1, description: { $slice: 1 }, assignedPdfs: 1 }).toArray().map((c) => [String(c.apxCourseId), c]));
const ccStats = new Map(db.courseclasses.aggregate([{ $group: { _id: '$course', active: { $sum: { $cond: [{ $eq: ['$isActive', false] }, 0, 1] } }, inactive: { $sum: { $cond: [{ $eq: ['$isActive', false] }, 1, 0] } }, topics: { $addToSet: '$topic' } } }]).toArray().map((g) => [String(g._id), g]));
const pdfStats = new Map(db.apxcatalogpdfimports.aggregate([
  { $match: { customerId: '781', status: 'done', pdfId: { $ne: null } } },
  { $unwind: '$sources' },
  { $group: { _id: { c: '$sources.apxCourseId', k: '$sources.kind' }, pdfs: { $addToSet: '$pdfId' } } },
  { $project: { n: { $size: '$pdfs' } } },
]).toArray().map((g) => [`${g._id.c}|${g._id.k}`, g.n]));
const placeholders = new Map(db.courses.find({ apxUnlinked: { $exists: true } }, { title: 1, 'apxUnlinked.apxCourseId': 1 }).toArray().map((c) => [String(c.apxUnlinked.apxCourseId), c.title]));

const report = mirror.map((m) => {
  const id = String(m.apxCourseId);
  const run = m.capture?.runId;
  const ours = courses.get(id);
  const cc = ours ? ccStats.get(String(ours._id)) : null;
  return {
    apxCourseId: id,
    title: (m.listRow?.course_name || m.listRow?.title || '').trim(),
    appxOn: m.listRow?.enable === '1',
    appxPrice: n(m.detail?.price ?? m.listRow?.price),
    appxMrp: n(m.detail?.mrp),
    validity: m.detail?.validity ? `${m.detail.validity} ${m.detail.validity_type ?? ''}`.trim() : null,
    captureRun: run ?? null,
    captureFailing: m.captureAttempt?.status === 'failed',
    appxClassesShown: rows(id, run, CLASS_TYPES, true),
    appxClassesHidden: rows(id, run, CLASS_TYPES, false),
    appxPdfsShown: rows(id, run, ['PDF'], true),
    appxPdfsHidden: rows(id, run, ['PDF'], false),
    imported: Boolean(ours),
    ourStatus: ours ? (ours.status === 1 ? 'on sale' : 'off sale') : null,
    ourPrice: ours?.discountPrice ?? null,
    ourMrp: ours?.price ?? null,
    hasDescription: Boolean(ours?.description?.length),
    classesActive: cc?.active ?? 0,
    classesInactive: cc?.inactive ?? 0,
    topics: cc?.topics?.length ?? 0,
    pdfsStandalone: pdfStats.get(`${id}|pdf`) ?? pdfStats.get(`${id}|standalone`) ?? 0,
    pdfsNotes: pdfStats.get(`${id}|note`) ?? 0,
    pdfsInCourse: ours?.assignedPdfs?.length ?? 0,
    placeholderOnId: placeholders.get(id) ?? null,
  };
}).sort((a, b) => Number(a.apxCourseId) - Number(b.apxCourseId));

const pdfKinds = db.apxcatalogpdfimports.distinct('sources.kind');
print(JSON.stringify({ courses: report.length, pdfKinds }));
if (OUT) require('fs').writeFileSync(OUT, JSON.stringify(report, null, 1));
