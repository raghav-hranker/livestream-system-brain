// Read-only. Vidyagram course placements whose effective start (CourseClass.startDate ?? Class.startDate)
// falls on today's IST day, with stream state, so the "new class" rule can be checked against real rows.
// Run on webserver2-2 from the Vidyagram checkout: URI=$MONGO_URI node - < script
const { MongoClient } = require('mongoose').mongo;

(async () => {
  const client = await MongoClient.connect(process.env.URI);
  const db = client.db();
  if (db.databaseName !== 'vidyagramdb') throw new Error(`refusing db ${db.databaseName}`);

  const IST_MS = 330 * 60 * 1000;
  const now = new Date();
  const dayStart = new Date(Math.floor((now.getTime() + IST_MS) / 86400000) * 86400000 - IST_MS);
  const dayEnd = new Date(dayStart.getTime() + 86400000);

  const rows = await db.collection('courseclasses').aggregate([
    { $match: { isActive: true } },
    { $lookup: { from: 'classes', localField: 'class', foreignField: '_id', as: 'c' } },
    { $unwind: '$c' },
    { $addFields: { start: { $ifNull: ['$startDate', '$c.startDate'] } } },
    { $match: { start: { $gte: dayStart, $lt: dayEnd } } },
    { $lookup: { from: 'courses', localField: 'course', foreignField: '_id', as: 'co' } },
    { $project: {
      course: { $arrayElemAt: ['$co.title', 0] }, title: '$c.title', start: 1, created: '$c.createdAt',
      isLive: '$c.isLive', streamStatus: '$c.streamStatus', startedAt: '$c.actualStartedAt', endedAt: '$c.actualEndedAt',
      overrideStart: { $ne: [{ $ifNull: ['$startDate', null] }, null] },
    } },
    { $sort: { start: 1 } },
  ]).toArray();

  const ist = (d) => (d ? new Date(d.getTime() + IST_MS).toISOString().slice(11, 16) : '-');
  console.log(`now ${ist(now)} IST, day ${dayStart.toISOString()} .. ${dayEnd.toISOString()}, ${rows.length} placements`);
  const byState = {};
  for (const r of rows) {
    const k = `${r.isLive ? 'live-class' : 'recorded'}/${r.streamStatus ?? 'none'}/${r.start <= now ? 'started' : 'later-today'}`;
    byState[k] = (byState[k] || 0) + 1;
  }
  console.log(byState);
  for (const r of rows.slice(0, 60)) {
    console.log([ist(r.start), r.overrideStart ? 'cc' : 'cls', r.isLive ? 'L' : 'R', r.streamStatus ?? '-',
      `on ${ist(r.startedAt)} off ${ist(r.endedAt)}`, `created ${r.created?.toISOString().slice(0, 16)}`,
      (r.course || '').slice(0, 30), '|', (r.title || '').slice(0, 50)].join('  '));
  }
  await client.close();
})().catch((e) => { console.error(e); process.exit(1); });
