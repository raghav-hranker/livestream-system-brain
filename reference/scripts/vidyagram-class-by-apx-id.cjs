#!/usr/bin/env node
// Read-only, vidyagramdb: how one AppX content row (the ID in the AppX CMS Content table) landed in Vidyagram.
// Prints the catalogue rows, the import ledger, the Class, its placements and the ingest job. Query strings and
// stream secrets are stripped from every URL.
//
// Run on webserver2-2 from the VG checkout (the Mac timed out on 27017, 2026-11-05):
//   ssh -i ~/.ssh/hranker-webserver2-2 hranker@148.113.49.18 'export PATH=/home/hranker/.nvm/versions/node/v22.22.2/bin:$PATH; \
//     cd /var/www/backend.vidyagramar.com/vidyagram-backend && DOTENV_CONFIG_PATH=.env.development \
//     NODE_PATH=$PWD/node_modules/mongoose/node_modules:$PWD/node_modules node -r dotenv/config - 196870 "Reading Comprehension"' \
//     < reference/scripts/vidyagram-class-by-apx-id.cjs
//
// Usage: vidyagram-class-by-apx-id.cjs <apxRowId> [titleFallback]
const { MongoClient } = require('mongodb');

const DB_NAME = 'vidyagramdb';
const [apxId, titleFallback] = process.argv.slice(2).filter((a) => !a.startsWith('dotenv_config'));
if (!apxId) {
  console.error('usage: vidyagram-class-by-apx-id.cjs <apxRowId> [titleFallback]');
  process.exit(2);
}

const stripUrl = (value) =>
  typeof value === 'string' ? value.replace(/\?.*$/s, '?<query stripped>').replace(/(txSecret=)[^&\s]+/g, '$1<stripped>') : value;

const SECRET_KEY = /secret|token|rtmp|signature|cookie/i;
function clean(value, depth = 0) {
  if (value === null || typeof value !== 'object') return stripUrl(value);
  if (depth > 6) return '<deep>';
  if (value instanceof Date) return value.toISOString();
  if (value._bsontype === 'ObjectId') return String(value);
  if (Array.isArray(value)) return value.slice(0, 40).map((item) => clean(item, depth + 1));
  const out = {};
  for (const [key, item] of Object.entries(value)) out[key] = SECRET_KEY.test(key) ? '<stripped>' : clean(item, depth + 1);
  return out;
}

const show = (label, value) => console.log(`\n== ${label}\n${JSON.stringify(clean(value), null, 1)}`);

(async () => {
  const client = new MongoClient(process.env.MONGO_URI, { readPreference: 'secondaryPreferred' });
  await client.connect();
  const db = client.db(DB_NAME);
  const names = (await db.listCollections().toArray()).map((c) => c.name);
  console.log('apx catalogue collections:', names.filter((n) => /^apxcatalog|^apxingest/i.test(n)).join(', '));

  const idValues = [apxId, Number(apxId)];
  const rowQuery = { $or: ['id', 'apxId', 'rowId', 'itemId', 'raw.id', 'apxRowId', 'sourceId'].map((f) => ({ [f]: { $in: idValues } })) };
  const rows = await db.collection('apxcatalogrows').find(rowQuery).limit(40).toArray();
  console.log(`\ncatalogue rows for ${apxId}: ${rows.length}`);
  const RAW_FIELDS = ['id', 'title', 'type', 'status', 'enable', 'deleted', 'live_type', 'stream_status', 'link', 'live_link', 'image', 'pdf_link', 'event_date', 'duration', 'views', 'course_id', 'course_name'];
  if (rows[0]) {
    const raw = Object.fromEntries(RAW_FIELDS.map((f) => [f, rows[0].raw?.[f]]));
    show('first catalogue row', { rowId: rows[0].rowId, apxCourseId: rows[0].apxCourseId, lastSeenRunId: rows[0].lastSeenRunId, hiddenReason: rows[0].hiddenReason, raw });
  }
  if (rows.length > 1) {
    show(
      'all rows, short',
      rows.map((r) => ({ course: r.courseId ?? r.apxCourseId, runId: r.runId ?? r.captureId, title: r.title ?? r.raw?.Title ?? r.raw?.title }))
    );
  }

  const ledgerQuery = { $or: [{ sourceRowId: { $in: idValues } }, { 'placements.row': { $in: idValues } }, { 'placements.rowId': { $in: idValues } }] };
  const ledger = await db.collection('apxcatalogimports').find(ledgerQuery).limit(5).toArray();
  console.log(`\nledger docs for ${apxId}: ${ledger.length}`);
  ledger.forEach((doc, i) => show(`ledger ${i}`, { ...doc, placements: (doc.placements || []).slice(0, 12), placementCount: (doc.placements || []).length }));

  let classIds = ledger.map((doc) => doc.classId ?? doc.targetId ?? doc.localId).filter(Boolean);
  if (!classIds.length && titleFallback) {
    const byTitle = await db
      .collection('classes')
      .find({ title: new RegExp(titleFallback.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') })
      .project({ _id: 1 })
      .limit(20)
      .toArray();
    console.log(`\nno ledger class, title fallback matched ${byTitle.length} classes`);
    classIds = byTitle.map((c) => c._id);
  }

  for (const classId of classIds) {
    const cls = await db.collection('classes').findOne({ _id: classId });
    if (!cls) {
      console.log(`\nclass ${classId} missing`);
      continue;
    }
    const { description, ...rest } = cls;
    show(`class ${classId}`, rest);
    const placements = await db.collection('courseclasses').find({ class: cls._id }).limit(30).toArray();
    const courses = await db
      .collection('courses')
      .find({ _id: { $in: placements.map((p) => p.course) } })
      .project({ title: 1, status: 1, apxCourseId: 1, isFree: 1 })
      .toArray();
    const courseOf = new Map(courses.map((c) => [String(c._id), c]));
    const nameIds = placements.flatMap((p) => [p.section, p.topic, p.subTopic]).filter(Boolean);
    const names = new Map();
    for (const coll of ['sections', 'topics', 'subtopics']) {
      for (const doc of await db.collection(coll).find({ _id: { $in: nameIds } }).project({ name: 1, title: 1 }).toArray()) {
        names.set(String(doc._id), doc.name ?? doc.title);
      }
    }
    show(`placements of ${classId}`, placements.map((p) => {
      const { _id, class: _class, course, section, topic, subTopic, ...rest } = p;
      return { course: courseOf.get(String(course)) ?? course, section: names.get(String(section)) ?? section, topic: names.get(String(topic)) ?? topic, subTopic: names.get(String(subTopic)) ?? subTopic, ...rest };
    }));
    const pdfs = await db.collection('pdfs').find({ _id: { $in: cls.pdfIds || [] } }).project({ title: 1, status: 1, pdfAsset: 1, apxAssetKey: 1 }).toArray();
    show(`pdfs of ${classId}`, pdfs);
    const jobs = await db.collection('apxingestjobs').find({ classId: cls._id }).limit(5).toArray();
    show(`ingest jobs of ${classId}`, jobs);
  }
  const yt = await db.collection('classes').countDocuments({ isYoutubeRedirect: true });
  const ytNoHls = await db.collection('classes').countDocuments({ isYoutubeRedirect: true, hlsAsset: { $exists: false } });
  console.log(`\nyoutube redirect classes in ${DB_NAME}: ${yt}, without hlsAsset: ${ytNoHls}`);
  await client.close();
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
