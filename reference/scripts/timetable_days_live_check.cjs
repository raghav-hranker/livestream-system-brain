// Read-only live check of GET /api/timetable (flat) and ?days=3 against a running backend, as a real student.
// Picks the student with a success order on the course that has the most placements in the IST
// yesterday..tomorrow window, mints a 5-minute user token with the backend's JWT_SECRET (no session_id,
// never printed) and calls the API on localhost. Run on the box from the backend checkout:
//   cd <checkout> && node ~/timetable_days_live_check.cjs [port=4100] [centerDate=today IST, YYYY-MM-DD] [userId]
const { createRequire } = require('module');
const fs = require('fs');
const r = createRequire(`${process.cwd()}/package.json`);
const { MongoClient } = r('mongoose').mongo;
const jwt = r('jsonwebtoken');

const env = fs.readFileSync(`${process.cwd()}/${process.env.ENV_FILE || '.env.development'}`, 'utf8');
const envVar = (k) => (env.match(new RegExp(`^${k}=(.*)$`, 'm')) || [])[1]?.trim().replace(/^['"]|['"]$/g, '');
const port = process.argv[2] || '4100';
const IST_MS = 330 * 60 * 1000;
const istToday = process.argv[3] || new Date(Date.now() + IST_MS).toISOString().slice(0, 10);
const dayStart = (offset) => new Date(Date.parse(`${istToday}T00:00:00Z`) - IST_MS + offset * 86400000);

(async () => {
  const client = new MongoClient(envVar('MONGO_URI'), { serverSelectionTimeoutMS: 15000 });
  await client.connect();
  const db = client.db();
  let userId = process.argv[4];
  if (!userId) {
    const busy = await db.collection('courseclasses').aggregate([
      { $match: { isActive: true, status: 1, startDate: { $gte: dayStart(-1), $lt: dayStart(2) } } },
      { $group: { _id: '$course', n: { $sum: 1 } } },
      { $sort: { n: -1 } },
      { $limit: 50 },
    ]).toArray();
    for (const { _id } of busy) {
      const order = await db.collection('orders').findOne(
        { orderStatus: 'success', status: { $ne: 0 }, courseId: { $in: [_id, String(_id)] } },
        { projection: { userId: 1 }, sort: { _id: -1 } },
      );
      if (order?.userId) { userId = String(order.userId); break; }
    }
  }
  await client.close();
  if (!userId) throw new Error('no student owns a course with placements in the window');

  const token = jwt.sign({ user_id: userId }, envVar('JWT_SECRET'), { expiresIn: 300 });
  const call = async (qs) => {
    const started = Date.now();
    const res = await fetch(`http://127.0.0.1:${port}/api/timetable${qs}`, { headers: { Authorization: `Bearer ${token}` } });
    return { status: res.status, ms: Date.now() - started, body: await res.json() };
  };

  const dateQs = process.argv[3] ? `date=${istToday}` : '';
  console.log(`IST center ${istToday}; student ${userId.slice(0, 6)}…`);
  const flat = await call(dateQs ? `?${dateQs}` : '');
  const flatIds = (flat.body.data || []).map((c) => String(c.classId));
  console.log(`flat: ${flat.status} ${flat.ms} ms, ${flatIds.length} rows, ${new Set(flatIds).size} distinct classes, msg "${flat.body.msg}"`);
  const three = await call(`?days=3${dateQs ? `&${dateQs}` : ''}`);
  console.log(`days=3: ${three.status} ${three.ms} ms, msg "${three.body.msg}", meta ${JSON.stringify({ ...three.body.meta, userId: undefined })}`);
  for (const day of three.body.data || []) {
    const ids = day.classes.map((c) => String(c.classId));
    const multi = day.classes.filter((c) => c.courses.length > 1).length;
    console.log(`  ${day.date} offset ${day.offset}: ${day.classes.length} classes (${new Set(ids).size} distinct), ${multi} in >1 course`);
    for (const c of day.classes.slice(0, 3)) {
      console.log(`    ${new Date(c.startDate).toISOString()} ${c.title} | courses ${c.courses.length} | videoPosition ${c.videoPosition}`);
    }
  }
  const today = (three.body.data || []).find((d) => d.offset === 0);
  console.log(`today distinct classes: flat ${new Set(flatIds).size} vs days=3 ${today ? today.classes.length : 'n/a'}`);
  const bad = await call('?days=5');
  console.log(`days=5: ${bad.status} "${bad.body.msg}"`);
})().catch((e) => { console.error(e.message); process.exit(1); });
