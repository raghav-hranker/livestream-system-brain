// Refuses any DB but vidyagramdb. Sets each imported placement's startDate to the date on its own AppX row
// (raw.date_and_time, IST) and endDate to the end of that IST day. Dry run by default.
// Only placements still carrying the import stamp qualify: hand-edited dates, classes streamed on our platform,
// future dates and unreadable or disagreeing AppX dates are left alone. Safe to re-run.
// Run on webserver2-2 from the Vidyagram checkout, with URI=<MONGO_URI>:
//   node - <apxCourseId> [--expect N] [--commit] < script     one course; stops if any row is left alone
//   node - --all [--commit] < script                           every AppX course; skips and counts those rows
//   node - --undo <backup.json> < script                       restores rows still holding the written dates
const fs = require('fs');
const os = require('os');
const path = require('path');
const { MongoClient, ObjectId } = require('mongoose').mongo;

const IST_MS = 330 * 60 * 1000;
const DAY_MS = 86400000;
const STAMP_GAP_MS = 6 * 3600 * 1000;
const OLDEST_REAL_DATE = Date.UTC(2015, 0, 1);
const BATCH = 500;
const BATCH_PAUSE_MS = 500;

const ist = (d) => new Date(d.getTime() + IST_MS).toISOString().slice(0, 16).replace('T', ' ');
const endOfIstDay = (d) => new Date(Math.floor((d.getTime() + IST_MS) / DAY_MS) * DAY_MS + DAY_MS - 1 - IST_MS);
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

function parseAppxDisplay(value) {
  const m = /^(\d{2})-(\d{2})-(\d{4}) at (\d{1,2}):(\d{2}) (am|pm)$/i.exec(String(value || '').trim());
  if (!m) return null;
  const hour = (Number(m[4]) % 12) + (m[6].toLowerCase() === 'pm' ? 12 : 0);
  const at = Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1]), hour, Number(m[5])) - IST_MS;
  return Number.isNaN(at) || at < OLDEST_REAL_DATE ? null : new Date(at);
}

async function buildPlan(db, onlyApxId) {
  const courseFilter = onlyApxId
    ? { $or: [{ apxCourseId: onlyApxId }, { apxCourseId: Number(onlyApxId) }] }
    : { apxCourseId: { $nin: [null, ''] } };
  const courses = await db.collection('courses').find(courseFilter, { projection: { title: 1, apxCourseId: 1 } }).toArray();
  if (!courses.length) throw new Error('no matching course');
  const apxIdByCourse = new Map(courses.map((c) => [String(c._id), String(c.apxCourseId)]));

  const ledger = await db.collection('apxcatalogimports').find(
    { classId: { $ne: null } }, { projection: { classId: 1, placements: 1 } }).toArray();
  const rowIds = new Map();
  for (const l of ledger) {
    for (const p of l.placements || []) {
      const key = `${l.classId}|${p.apxCourseId ?? p.course}`;
      if (!rowIds.has(key)) rowIds.set(key, []);
      rowIds.get(key).push(String(p.rowId ?? p.row));
    }
  }
  const rows = await db.collection('apxcatalogrows').find(
    onlyApxId ? { apxCourseId: onlyApxId } : {}, { projection: { apxCourseId: 1, rowId: 1, 'raw.date_and_time': 1 } }).toArray();
  const dateByRow = new Map(rows.map((r) => [`${r.apxCourseId}|${r.rowId}`, parseAppxDisplay(r.raw?.date_and_time)]));
  const seenRows = new Set(rows.map((r) => `${r.apxCourseId}|${r.rowId}`));

  const classes = await db.collection('classes').find({}, { projection: { title: 1, actualStartedAt: 1 } }).toArray();
  const classById = new Map(classes.map((c) => [String(c._id), c]));

  const placements = await db.collection('courseclasses').find(
    { course: { $in: courses.map((c) => c._id) } },
    { projection: { course: 1, class: 1, startDate: 1, endDate: 1, createdAt: 1, actualStartAppliedAt: 1 } }).toArray();

  const now = Date.now();
  const plan = [];
  const tally = {};
  const samples = {};
  const note = (reason, p, apxId) => {
    tally[reason] = (tally[reason] || 0) + 1;
    if (!samples[reason]) samples[reason] = [];
    if (samples[reason].length < 5) samples[reason].push(`${apxId} | ${String(classById.get(String(p.class))?.title || '').slice(0, 44)}`);
  };
  for (const p of placements) {
    const apxId = apxIdByCourse.get(String(p.course));
    const ids = rowIds.get(`${p.class}|${apxId}`) || [];
    const dates = ids.filter((id) => seenRows.has(`${apxId}|${id}`)).map((id) => dateByRow.get(`${apxId}|${id}`));
    const distinct = new Set(dates.map((d) => d?.getTime() ?? null));
    const actual = dates[0];
    const cls = classById.get(String(p.class));
    if (!ids.length) note('not in the import ledger for this course', p, apxId);
    else if (!dates.length) note('AppX row missing', p, apxId);
    else if (distinct.size > 1) note('AppX rows disagree', p, apxId);
    else if (!actual) note('no readable AppX date', p, apxId);
    else if (p.startDate && p.startDate.getTime() === actual.getTime()) note('already correct', p, apxId);
    else if (actual.getTime() > now) note('AppX date in the future', p, apxId);
    else if (cls?.actualStartedAt || p.actualStartAppliedAt) note('streamed on our platform', p, apxId);
    else if (!p.startDate || !p.createdAt || Math.abs(p.createdAt - p.startDate) > STAMP_GAP_MS) note('date is not the import stamp', p, apxId);
    else {
      plan.push({ _id: p._id, apxId, title: cls?.title, oldStart: p.startDate, oldEnd: p.endDate, newStart: actual, newEnd: endOfIstDay(actual) });
    }
  }
  return { courses: courses.length, total: placements.length, plan, tally, samples };
}

async function writeInBatches(db, items, from, to) {
  let matched = 0;
  let modified = 0;
  for (let i = 0; i < items.length; i += BATCH) {
    const ops = items.slice(i, i + BATCH).map((item) => ({ updateOne: {
      filter: { _id: item._id, startDate: item[from.start], endDate: item[from.end] },
      update: { $set: { startDate: item[to.start], endDate: item[to.end], updatedAt: new Date() } },
    } }));
    const res = await db.collection('courseclasses').bulkWrite(ops, { ordered: false, writeConcern: { w: 'majority' } });
    matched += res.matchedCount;
    modified += res.modifiedCount;
    if (i % (BATCH * 10) === 0) console.log(`  written ${Math.min(i + BATCH, items.length)} of ${items.length}`);
    await sleep(BATCH_PAUSE_MS);
  }
  return { matched, modified };
}

async function readBack(db, plan) {
  let wrong = 0;
  for (let i = 0; i < plan.length; i += BATCH) {
    const chunk = plan.slice(i, i + BATCH);
    const after = await db.collection('courseclasses').find(
      { _id: { $in: chunk.map((c) => c._id) } }, { projection: { startDate: 1, endDate: 1 }, readPreference: 'primary' }).toArray();
    const byId = new Map(after.map((a) => [String(a._id), a]));
    for (const c of chunk) {
      const a = byId.get(String(c._id));
      if (!a || a.startDate?.getTime() !== c.newStart.getTime() || a.endDate?.getTime() !== c.newEnd.getTime()) wrong += 1;
    }
  }
  return wrong;
}

function summarize(plan) {
  const byYear = {};
  const clusters = {};
  const recent = [];
  const cutoff = Date.now() - 4 * DAY_MS;
  for (const i of plan) {
    const y = ist(i.newStart).slice(0, 4);
    byYear[y] = (byYear[y] || 0) + 1;
    const k = `${i.apxId}|${i.newStart.getTime()}`;
    clusters[k] = (clusters[k] || 0) + 1;
    if (i.newStart.getTime() >= cutoff) recent.push(i);
  }
  const shared = Object.values(clusters).filter((n) => n >= 5);
  const moved = plan.map((i) => Math.abs(i.oldStart - i.newStart) / DAY_MS);
  console.log('new dates by year', byYear);
  console.log(`rows sharing an exact time with 4+ others in their course (likely upload times): ${shared.reduce((a, b) => a + b, 0)}`);
  console.log(`rows moving under a day: ${moved.filter((d) => d < 1).length}`);
  console.log(`rows landing in the last 4 days (the timetable window): ${recent.length}`);
  for (const i of recent.slice(0, 8)) console.log(`  ${ist(i.oldStart)} -> ${ist(i.newStart)} | ${i.apxId} | ${String(i.title).slice(0, 44)}`);
  for (const i of plan.slice(0, 8)) console.log(`  sample ${ist(i.oldStart)} -> ${ist(i.newStart)} | ${i.apxId} | ${String(i.title).slice(0, 44)}`);
}

(async () => {
  const client = await MongoClient.connect(process.env.URI);
  const db = client.db();
  if (db.databaseName !== 'vidyagramdb') throw new Error(`refusing db ${db.databaseName}`);
  const args = process.argv.slice(2);

  if (args[0] === '--undo') {
    const saved = JSON.parse(fs.readFileSync(args[1], 'utf8'));
    const items = saved.plan.map((i) => ({ _id: new ObjectId(i._id), oldStart: new Date(i.oldStart), oldEnd: new Date(i.oldEnd), newStart: new Date(i.newStart), newEnd: new Date(i.newEnd) }));
    const res = await writeInBatches(db, items, { start: 'newStart', end: 'newEnd' }, { start: 'oldStart', end: 'oldEnd' });
    console.log(`undo: matched ${res.matched}, modified ${res.modified} of ${items.length}`);
    await client.close();
    return;
  }

  const all = args[0] === '--all';
  const apxCourseId = all ? null : String(args[0] || '');
  if (!all && !apxCourseId) throw new Error('give an AppX course id or --all');
  const commit = args.includes('--commit');
  const expect = args.includes('--expect') ? Number(args[args.indexOf('--expect') + 1]) : null;

  const { courses, total, plan, tally, samples } = await buildPlan(db, apxCourseId);
  console.log(`${courses} courses, ${total} placements, ${plan.length} to update`);
  console.log('left alone', tally);
  for (const [reason, list] of Object.entries(samples)) console.log(`  ${reason}: ${list.join(' ; ')}`);
  summarize(plan);

  const leftAlone = Object.entries(tally).filter(([reason]) => reason !== 'already correct').length;
  if (!all && leftAlone) throw new Error('stopping: rows left alone need a look');
  if (expect !== null && plan.length !== expect) throw new Error(`stopping: expected ${expect}, found ${plan.length}`);
  if (!commit) { console.log('dry run, nothing written'); await client.close(); return; }

  const label = all ? 'all' : `course-${apxCourseId}`;
  const file = path.join(os.homedir(), `vg-${label}-dates-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(file, JSON.stringify({ scope: label, at: new Date(), plan }), { mode: 0o600 });
  console.log(`backup ${file}`);
  const res = await writeInBatches(db, plan, { start: 'oldStart', end: 'oldEnd' }, { start: 'newStart', end: 'newEnd' });
  console.log(`matched ${res.matched}, modified ${res.modified} of ${plan.length}`);
  console.log(`read back on primary: ${plan.length - (await readBack(db, plan))} correct of ${plan.length}`);
  await client.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
