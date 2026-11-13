// Read-only. For live placements (placement, class and course all on) whose class is scheduled
// (Class.startDate) inside the window, compares the IST day the class is scheduled for with the
// IST day /api/timetable files it under (placement startDate, else the class's). A different
// day means the timetable shows the class on the wrong day.
// Usage: node reference/scripts/timetable_day_mismatch.cjs [daysBack=14] [daysAhead=7]
// On the prod box: BACKEND=<checkout> ENV_FILE=.env node timetable_day_mismatch.cjs
const { createRequire } = require('module');
const fs = require('fs');
const BACKEND = process.env.BACKEND || '/Users/raghav/Projects/quicktricks-backend';
const r = createRequire(`${BACKEND}/package.json`);
const { MongoClient } = r('mongoose').mongo;

const uri = fs.readFileSync(`${BACKEND}/${process.env.ENV_FILE || '.env.development'}`, 'utf8').match(/^MONGO_URI=(.*)$/m)[1].trim();
const daysBack = Number(process.argv[2] ?? 14);
const daysAhead = Number(process.argv[3] ?? 7);
const IST_MS = 330 * 60 * 1000;
const istDay = (d) => (d ? new Date(new Date(d).getTime() + IST_MS).toISOString().slice(0, 10) : null);
const istMidnight = (offsetDays) => {
  const today = istDay(new Date());
  return new Date(new Date(`${today}T00:00:00Z`).getTime() - IST_MS + offsetDays * 86400000);
};

(async () => {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 15000 });
  await client.connect();
  const db = client.db();
  const from = istMidnight(-daysBack);
  const to = istMidnight(daysAhead + 1);

  const rows = await db.collection('courseclasses').aggregate([
    { $lookup: { from: 'classes', localField: 'class', foreignField: '_id', as: 'c' } },
    { $unwind: '$c' },
    { $match: { isActive: true, status: 1, 'c.status': 1, 'c.startDate': { $gte: from, $lt: to } } },
    { $lookup: { from: 'courses', localField: 'course', foreignField: '_id', as: 'co', pipeline: [{ $project: { status: 1 } }] } },
    { $unwind: '$co' },
    { $match: { 'co.status': 1 } },
    {
      $project: {
        classId: '$c._id', title: '$c.title', classStart: '$c.startDate', placementStart: '$startDate',
        actualStartedAt: '$c.actualStartedAt', placementCreatedAt: '$createdAt',
      },
    },
  ]).toArray();

  const today = istDay(new Date());
  const byDay = new Map();
  const wrong = [];
  for (const row of rows) {
    const scheduled = istDay(row.classStart);
    const filed = istDay(row.placementStart ?? row.classStart);
    const bucket = byDay.get(scheduled) ?? { placements: 0, sameDay: 0, classes: new Set(), wrongClasses: new Set() };
    bucket.placements += 1;
    bucket.classes.add(String(row.classId));
    if (scheduled === filed) bucket.sameDay += 1;
    else {
      bucket.wrongClasses.add(String(row.classId));
      wrong.push({ scheduled, filed, streamed: Boolean(row.actualStartedAt), title: row.title, classId: String(row.classId) });
    }
    byDay.set(scheduled, bucket);
  }

  console.log(`IST today ${today}; window ${istDay(from)} .. ${istDay(new Date(to.getTime() - 1))}`);
  console.log('scheduled day | placements | filed same day | classes | classes filed elsewhere');
  for (const day of [...byDay.keys()].sort()) {
    const b = byDay.get(day);
    const tag = day === today ? ' (today)' : day > today ? ' (future)' : '';
    console.log(`${day}${tag} | ${b.placements} | ${b.sameDay} | ${b.classes.size} | ${b.wrongClasses.size}`);
  }
  const filedEarlier = wrong.filter((w) => w.filed < w.scheduled).length;
  console.log(`\nfiled on another day: ${wrong.length} placements (${filedEarlier} earlier than scheduled, ${wrong.length - filedEarlier} later)`);
  console.log(`of those, class already streamed: ${wrong.filter((w) => w.streamed).length}`);
  for (const w of wrong.filter((x) => x.scheduled >= today).slice(0, 25)) {
    console.log(`  scheduled ${w.scheduled} filed ${w.filed} streamed=${w.streamed} ${w.classId} ${w.title}`);
  }
  await client.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
