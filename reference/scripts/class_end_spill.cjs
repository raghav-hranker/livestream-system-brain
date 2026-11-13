// read-only: classes whose saved end falls on a later IST day than their start (Duplicate carried the
//   original's start-to-end length until admin ed76c704). Lists each with its start, end and span.
//   run on webserver2-2 from either tenant's backend checkout, over ssh stdin:
//   [SINCE=2026-10-01] DOTENV_CONFIG_PATH=.env.development NODE_PATH=$PWD/node_modules node -r dotenv/config - < class_end_spill.cjs
const mongoose = require('mongoose');
const OFF = 330 * 60000;
const ist = d => (d ? new Date(new Date(d).getTime() + OFF).toISOString().replace('T', ' ').slice(0, 19) : null);
const day = d => Math.floor((new Date(d).getTime() + OFF) / 86400000);
(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const since = new Date(process.env.SINCE || '2026-10-01');
  const rows = await db.collection('classes').find({ createdAt: { $gte: since }, startDate: { $ne: null }, endDate: { $ne: null } })
    .project({ title: 1, startDate: 1, endDate: 1, createdAt: 1, actualStartedAt: 1, actualEndedAt: 1, status: 1 }).sort({ createdAt: 1 }).toArray();
  const spill = rows.filter(r => day(r.endDate) > day(r.startDate));
  console.log('db:', db.databaseName, '| classes with both dates since', since.toISOString().slice(0, 10) + ':', rows.length, '| end on a later IST day:', spill.length);
  for (const r of spill) {
    const hours = ((new Date(r.endDate) - new Date(r.startDate)) / 3600000).toFixed(2);
    console.log(JSON.stringify({ id: String(r._id), title: r.title, created: ist(r.createdAt), start: ist(r.startDate), end: ist(r.endDate), spanHours: hours, wentLive: !!r.actualStartedAt, status: r.status }));
  }
  await mongoose.disconnect();
})();
