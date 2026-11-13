// Read-only, refuses any DB but vidyagramdb. For one AppX course: each placement's current start and end next to
// the date on its own AppX row. Prints date fields only, because raw also holds links and stream keys.
// Run on webserver2-2 from the Vidyagram checkout: URI=<MONGO_URI> node - <apxCourseId> < script
const { MongoClient } = require('mongoose').mongo;

const IST_MS = 330 * 60 * 1000;
const ist = (d) => (d instanceof Date ? new Date(d.getTime() + IST_MS).toISOString().slice(0, 16).replace('T', ' ') : '-');

// AppX date_and_time is IST: "26-10-2024 at 09:10 pm".
function parseAppxDisplay(value) {
  const m = /^(\d{2})-(\d{2})-(\d{4}) at (\d{1,2}):(\d{2}) (am|pm)$/i.exec(String(value || '').trim());
  if (!m) return null;
  const hour = (Number(m[4]) % 12) + (m[6].toLowerCase() === 'pm' ? 12 : 0);
  const at = Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1]), hour, Number(m[5])) - IST_MS;
  return Number.isNaN(at) ? null : new Date(at);
}

(async () => {
  const client = await MongoClient.connect(process.env.URI);
  const db = client.db();
  if (db.databaseName !== 'vidyagramdb') throw new Error(`refusing db ${db.databaseName}`);

  const apxCourseId = String(process.argv[2] || '');
  const course = await db.collection('courses').findOne(
    { $or: [{ apxCourseId }, { apxCourseId: Number(apxCourseId) }] }, { projection: { title: 1 } });
  if (!course) throw new Error(`no course for AppX ${apxCourseId}`);

  const placements = await db.collection('courseclasses').aggregate([
    { $match: { course: course._id } },
    { $lookup: { from: 'classes', localField: 'class', foreignField: '_id', as: 'c' } },
    { $unwind: '$c' },
    { $project: {
      class: 1, startDate: 1, endDate: 1, createdAt: 1, isActive: 1, apxTitle: 1, priority: 1,
      actualStartAppliedAt: 1, title: '$c.title', actualStartedAt: '$c.actualStartedAt', streamStatus: '$c.streamStatus',
    } },
  ]).toArray();

  const ledger = await db.collection('apxcatalogimports').find(
    { classId: { $in: placements.map((p) => p.class) } }, { projection: { classId: 1, placements: 1 } }).toArray();
  const rowIdsByClass = new Map();
  for (const l of ledger) {
    const mine = (l.placements || []).filter((p) => String(p.apxCourseId ?? p.course) === apxCourseId);
    rowIdsByClass.set(String(l.classId), mine.map((p) => String(p.rowId ?? p.row)));
  }

  const rows = await db.collection('apxcatalogrows').find(
    { apxCourseId }, { projection: { rowId: 1, hiddenReason: 1, 'raw.date_and_time': 1, 'raw.event_date': 1, 'raw.event_date_modified': 1, 'raw.stream_status': 1, 'raw.type': 1, 'raw.Title': 1, 'raw.title': 1 } }).toArray();
  const rowById = new Map(rows.map((r) => [String(r.rowId), r]));
  console.log(`${course.title}\n${placements.length} placements, ${ledger.length} ledger rows, ${rows.length} AppX rows\n`);

  const tally = { update: 0, noLedger: 0, noRow: 0, ambiguous: 0, badDate: 0, future: 0, streamedHere: 0, editedByHand: 0 };
  const now = Date.now();
  const lines = [];
  for (const p of placements) {
    const rowIds = rowIdsByClass.get(String(p.class)) || [];
    const row = rowIds.length === 1 ? rowById.get(rowIds[0]) : null;
    const actual = row ? parseAppxDisplay(row.raw?.date_and_time) : null;
    const stampGapMin = p.startDate && p.createdAt ? Math.round((p.createdAt - p.startDate) / 60000) : null;

    let verdict = 'update';
    if (!rowIds.length) verdict = 'noLedger';
    else if (rowIds.length > 1) verdict = 'ambiguous';
    else if (!row) verdict = 'noRow';
    else if (!actual) verdict = 'badDate';
    else if (actual.getTime() > now) verdict = 'future';
    else if (p.actualStartedAt) verdict = 'streamedHere';
    else if (stampGapMin === null || Math.abs(stampGapMin) > 360) verdict = 'editedByHand';
    tally[verdict] += 1;

    if (rowIds.length > 1) {
      for (const id of rowIds) {
        const r = rowById.get(id);
        console.log(`two rows, ${p.title}: row ${id} | ${r?.raw?.type ?? '-'} | ${r?.raw?.date_and_time ?? '-'} | hidden ${r?.hiddenReason ?? '-'}`);
      }
    }
    lines.push({
      sort: actual ? actual.getTime() : Infinity,
      text: [verdict.padEnd(12), `now ${ist(p.startDate)}`, `end ${ist(p.endDate)}`, `appx ${actual ? ist(actual) : '-'}`,
        `event_date ${row?.raw?.event_date ?? '-'}`, `gap ${stampGapMin}m`, p.isActive ? 'on ' : 'off',
        `row ${rowIds.join('/') || '-'}`, row?.raw?.type ?? '-', `stream ${p.streamStatus ?? '-'}`,
        String(p.title || '').slice(0, 44)].join(' | '),
    });
  }
  lines.sort((a, b) => a.sort - b.sort);
  for (const l of lines) console.log(l.text);
  console.log('\n', tally);
  await client.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
