// Read-only progress report for Vidyagram's AppX video migration (vidyagramdb).
// Prints job counts by status, completions in the last hour, an ETA at that rate,
// jobs claimed for over an hour (likely stuck), the top failure reasons, and the
// AppX session state. Writes nothing.
//
//   cd ~/Projects/worktrees/vg-backend && \
//   NODE_PATH=$PWD/node_modules DOTENV_CONFIG_PATH=.env.development \
//   node -r dotenv/config ~/Projects/system-brain/reference/scripts/vidyagram-ingest-status.cjs
const mongoose = require('mongoose');

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: 'vidyagramdb', readPreference: 'primary', autoIndex: false });
  const db = mongoose.connection.db;
  if (db.databaseName !== 'vidyagramdb') throw new Error(`connected to ${db.databaseName}`);
  const jobs = db.collection('apxingestjobs');
  const now = Date.now();
  const hourAgo = new Date(now - 3600e3);

  const byStatus = Object.fromEntries(
    (await jobs.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]).toArray()).map((r) => [r._id, r.n]),
  );
  const total = Object.values(byStatus).reduce((a, b) => a + b, 0);
  const done = byStatus.done || 0;
  const doneLastHour = await jobs.countDocuments({ status: 'done', updatedAt: { $gte: hourAgo } });
  const remaining = (byStatus.pending || 0) + (byStatus.failed || 0) + (byStatus.claimed || 0) +
    (byStatus.downloading || 0) + (byStatus.uploading || 0);
  const etaHours = doneLastHour ? (remaining / doneLastHour).toFixed(1) : 'n/a';
  const stuck = await jobs.countDocuments({
    status: { $in: ['claimed', 'downloading', 'uploading'] },
    updatedAt: { $lt: hourAgo },
  });
  const reasons = await jobs.aggregate([
    { $match: { status: { $in: ['failed', 'dead'] } } },
    { $group: { _id: { $substrCP: [{ $ifNull: ['$lastError', '(none)'] }, 0, 90] }, n: { $sum: 1 } } },
    { $sort: { n: -1 } },
    { $limit: 5 },
  ]).toArray();
  const s = await db.collection('apxsessions').findOne(
    { orgId: '2177599' },
    { projection: { isActive: 1, lastHttpStatus: 1, lastCheckedAt: 1 } },
  );

  console.log(new Date().toISOString());
  console.log(`jobs ${total}  done ${done} (${total ? ((100 * done) / total).toFixed(1) : 0}%)  by status ${JSON.stringify(byStatus)}`);
  console.log(`done in the last hour ${doneLastHour}  remaining ${remaining}  ETA at this rate ${etaHours} h`);
  console.log(`claimed but untouched for over an hour: ${stuck}`);
  for (const r of reasons) console.log(`  ${String(r.n).padStart(5)}  ${r._id}`);
  console.log(`AppX session isActive=${s && s.isActive} lastHttpStatus=${s && s.lastHttpStatus} lastCheckedAt=${s && s.lastCheckedAt && s.lastCheckedAt.toISOString()}`);
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
