// Read-only, refuses any DB but vidyagramdb: AppX course-folder PDFs that are imported (ledger status done) but have no
// CoursePdf in their course, split by AppX state (live / disabled / gone), then the live ones per PDF with their AppX courses.
// Edit the two lastSeenRunId literals to the latest daily run. Run on webserver2-2 from the Vidyagram checkout: URI=<MONGO_URI> node - < script
const mongoose = require('mongoose');
(async () => {
  await mongoose.connect(process.env.URI, { serverSelectionTimeoutMS: 8000, readPreference: 'secondaryPreferred' });
  const db = mongoose.connection.db;
  if (db.databaseName !== 'vidyagramdb') throw new Error('refusing: ' + db.databaseName);
  const courses = new Map((await db.collection('courses').find({ apxCourseId: { $exists: true } }).project({ apxCourseId: 1, title: 1 }).toArray()).map((c) => [String(c.apxCourseId), c]));
  const placed = new Set((await db.collection('coursepdfs').find({}).project({ course: 1, pdf: 1 }).toArray()).map((r) => `${r.course}|${r.pdf}`));
  const led = await db.collection('apxcatalogpdfimports').find({ status: 'done', pdfId: { $ne: null }, 'sources.kind': 'standalone' }).project({ pdfId: 1, sources: 1, runId: 1, createdAt: 1 }).toArray();
  const rowsLive = new Map();
  const R = db.collection('apxcatalogrows');
  const out = []; const byPdf = new Map();
  for (const d of led) for (const s of d.sources.filter((x) => x.kind === 'standalone')) {
    const c = courses.get(String(s.apxCourseId)); if (!c) continue;
    if (placed.has(`${c._id}|${d.pdfId}`)) continue;
    out.push({ pdf: String(d.pdfId), course: s.apxCourseId, rowId: s.rowId, runId: d.runId });
  }
  const rows = await R.find({ $or: out.map((o) => ({ apxCourseId: o.course, rowId: o.rowId })) }).project({ apxCourseId: 1, rowId: 1, lastSeenRunId: 1, hiddenReason: 1, 'raw.title': 1, 'raw.enable': 1, 'raw.created_at': 1 }).toArray();
  const rm = new Map(rows.map((r) => [`${r.apxCourseId}|${r.rowId}`, r]));
  const pdfs = new Map((await db.collection('pdfs').find({ _id: { $in: [...new Set(out.map((o) => o.pdf))].map((x) => new mongoose.Types.ObjectId(x)) } }).project({ title: 1, status: 1 }).toArray()).map((p) => [String(p._id), p]));
  const buckets = {}; const live = [];
  for (const o of out) {
    const r = rm.get(`${o.course}|${o.rowId}`);
    const state = !r ? 'row not in mirror' : r.hiddenReason ? `hidden: ${r.hiddenReason}` : (r.lastSeenRunId === 'daily-2026-10-30') ? 'live in AppX' : `gone (last ${r.lastSeenRunId})`;
    buckets[state] = (buckets[state] || 0) + 1;
    if (state === 'live in AppX') live.push({ ...o, title: r.raw.title, created: r.raw.created_at, pdfStatus: pdfs.get(o.pdf)?.status });
  }
  console.log('unplaced (course,pdf) sources by AppX state:', JSON.stringify(buckets));
  const lp = new Map(); for (const l of live) { const k = l.pdf; if (!lp.has(k)) lp.set(k, { title: l.title, created: l.created, courses: new Set(), pdfStatus: l.pdfStatus }); lp.get(k).courses.add(l.course); }
  const pairs = new Set(live.map((l) => `${l.course}|${l.pdf}`));
  console.log('LIVE unplaced: rows', live.length, 'distinct (course,pdf)', pairs.size, 'distinct PDFs', lp.size, 'courses', new Set(live.map((l) => l.course)).size);
  const list = [...lp.entries()].sort((a, b) => String(a[1].created).localeCompare(String(b[1].created)));
  for (const [id, v] of list) console.log(`${v.created}  ${id}  st${v.pdfStatus}  [${[...v.courses].sort((a,b)=>a-b).join(',')}]  ${v.title}`);
  await mongoose.disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
