#!/usr/bin/env node
// Read-only, refuses any DB but vidyagramdb: one AppX course's class notes (AppX `pdf_link` / `pdf_link2` on video
// rows) against what reached Vidyagram. Per placed class: does it carry a Pdf, and what does the PDF ledger
// (`apxcatalogpdfimports`) say about its note sources (attached / waiting-class / pending / no ledger entry).
//
// Run on webserver2-2 from the VG checkout:
//   ssh -i ~/.ssh/hranker-webserver2-2 hranker@148.113.49.18 'export PATH=/home/hranker/.nvm/versions/node/v22.22.2/bin:$PATH; \
//     cd /var/www/backend.vidyagramar.com/vidyagram-backend && DOTENV_CONFIG_PATH=.env.development \
//     NODE_PATH=$PWD/node_modules/mongoose/node_modules:$PWD/node_modules node -r dotenv/config - 175' < reference/scripts/vidyagram-course-class-notes.cjs
//
// Usage: vidyagram-course-class-notes.cjs <apxCourseId>
const { MongoClient } = require('mongodb');

const DB_NAME = 'vidyagramdb';
const apxCourseId = process.argv.slice(2).find((a) => !a.startsWith('dotenv_config'));
if (!apxCourseId) {
  console.error('usage: vidyagram-course-class-notes.cjs <apxCourseId>');
  process.exit(2);
}
const ids = [apxCourseId, Number(apxCourseId)];
const count = (arr, key) => arr.reduce((m, x) => ((m[key(x)] = (m[key(x)] || 0) + 1), m), {});

(async () => {
  const client = new MongoClient(process.env.MONGO_URI, { readPreference: 'secondaryPreferred' });
  await client.connect();
  const db = client.db(DB_NAME);
  if (db.databaseName !== DB_NAME) throw new Error('wrong db');

  const course = await db.collection('courses').findOne({ apxCourseId: { $in: ids } }, { projection: { title: 1, status: 1, createdAt: 1 } });
  if (!course) throw new Error(`no Course for AppX ${apxCourseId}`);
  console.log('course', String(course._id), course.title, 'status', course.status);

  const placements = await db.collection('courseclasses').find({ course: course._id }, { projection: { class: 1, createdAt: 1 } }).toArray();
  const classes = await db
    .collection('classes')
    .find({ _id: { $in: placements.map((p) => p.class) } }, { projection: { title: 1, pdfIds: 1, pdfAssignments: 1, apxAssetKey: 1, createdAt: 1 } })
    .toArray();
  const withPdf = classes.filter((c) => (c.pdfIds || []).length || (c.pdfAssignments || []).length);
  console.log(`placements ${placements.length}, classes ${classes.length}, classes with a Pdf ${withPdf.length}`);
  console.log('class createdAt by day', count(classes, (c) => (c.createdAt ? c.createdAt.toISOString().slice(0, 10) : 'none')));

  // AppX side: video rows of this course with a note link, latest capture.
  const rowsColl = db.collection('apxcatalogrows');
  const latest = await rowsColl.find({ apxCourseId: { $in: ids } }).sort({ lastSeenRunId: -1 }).limit(1).project({ lastSeenRunId: 1 }).toArray();
  const runId = latest[0]?.lastSeenRunId;
  const rows = await rowsColl
    .find({ apxCourseId: { $in: ids }, ...(runId ? { lastSeenRunId: runId } : {}) }, { projection: { rowId: 1, 'raw.pdf_link': 1, 'raw.pdf_link2': 1, 'raw.material_type': 1, 'raw.Title': 1, 'raw.title': 1 } })
    .toArray();
  const noteRows = rows.filter((r) => r.raw?.pdf_link || r.raw?.pdf_link2);
  console.log(`AppX rows (run ${runId}): ${rows.length}, with pdf_link/pdf_link2: ${noteRows.length}`);

  // Ledger: note sources from this course.
  const ledger = await db
    .collection('apxcatalogpdfimports')
    .find({ 'sources.apxCourseId': { $in: ids } }, { projection: { status: 1, runId: 1, updatedAt: 1, pdfId: 1, sources: 1, error: 1 } })
    .toArray();
  const mine = ledger.flatMap((f) => (f.sources || []).filter((s) => ids.includes(s.apxCourseId)).map((s) => ({ ...s, file: f })));
  const notes = mine.filter((s) => s.kind === 'note');
  console.log(`ledger files touching course: ${ledger.length}; note sources ${notes.length}; standalone sources ${mine.length - notes.length}`);
  console.log('note source state', count(notes, (s) => s.state));
  console.log('note file status', count(notes, (s) => s.file.status));
  console.log('note file runId', count(notes, (s) => s.file.runId));
  console.log('note file has pdfId', count(notes, (s) => String(Boolean(s.file.pdfId))));
  const errors = count(notes.filter((s) => s.file.error), (s) => String(s.file.error).slice(0, 120));
  if (Object.keys(errors).length) console.log('note file errors', errors);

  const ledgerRowIds = new Set(notes.map((s) => String(s.rowId)));
  const noLedger = noteRows.filter((r) => !ledgerRowIds.has(String(r.rowId)));
  console.log(`AppX note rows with no ledger source: ${noLedger.length}`, noLedger.slice(0, 5).map((r) => r.rowId));

  // Which class each waiting/pending note points at, by asset key.
  const keys = notes.filter((s) => s.state !== 'attached').map((s) => s.classAssetKey).filter(Boolean);
  const keyed = await db.collection('classes').find({ apxAssetKey: { $in: keys } }, { projection: { _id: 1 } }).toArray();
  console.log(`not-attached note sources ${keys.length}; classes found now by apxAssetKey ${keyed.length}`);
  console.log('sample not-attached', notes.filter((s) => s.state !== 'attached').slice(0, 3).map((s) => ({ rowId: s.rowId, field: s.field, state: s.state, key: s.classAssetKey, status: s.file.status, run: s.file.runId })));
  await client.close();
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
