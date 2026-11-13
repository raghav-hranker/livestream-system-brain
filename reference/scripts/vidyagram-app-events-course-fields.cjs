#!/usr/bin/env node
// Read-only. For the events Home "Continue where you left" reads, how many in the window carry a
// top-level courseId, how many users sent them, and what PAYMENT_STARTED orderIds look like.
// Usage: node vidyagram-app-events-course-fields.cjs <backend-worktree> [days=30]
const path = require('path');
const worktree = process.argv[2];
const days = Number(process.argv[3] || 30);
if (!worktree) {
  console.error('usage: node vidyagram-app-events-course-fields.cjs <backend-worktree> [days]');
  process.exit(2);
}
const envFile = ['.env.development', '.env'].map((name) => path.join(worktree, name)).find((file) => require('fs').existsSync(file));
require(path.join(worktree, 'node_modules/dotenv')).config({ path: envFile });
const { MongoClient } = require(require.resolve('mongodb', { paths: [path.join(worktree, 'node_modules/mongoose')] }));

const uri = process.env.MONGO_URI;
if (!/\/vidyagramdb\b/.test(uri || '')) {
  console.error('MONGO_URI does not name vidyagramdb; refusing');
  process.exit(2);
}

(async () => {
  const client = new MongoClient(uri, { readPreference: 'secondaryPreferred', serverSelectionTimeoutMS: 15000 });
  await client.connect();
  const events = client.db('vidyagramdb').collection('appevents');
  const since = new Date(Date.now() - days * 86400000);
  const rows = await events.aggregate([
    {
      $match: {
        occurredAt: { $gte: since },
        $or: [
          { eventName: { $in: ['COURSE_VIEW', 'WATCH_DEMO', 'WATCH_VIDEO', 'PAYMENT_STARTED'] } },
          { eventName: 'SCREEN_VIEW', screenName: { $in: ['Checkout', 'ExplorePurchaseRoute'] } },
        ],
      },
    },
    {
      $group: {
        _id: { $cond: [{ $eq: ['$eventName', 'SCREEN_VIEW'] }, { $concat: ['SCREEN_VIEW:', { $ifNull: ['$screenName', '?'] }] }, '$eventName'] },
        total: { $sum: 1 },
        withCourseId: { $sum: { $cond: [{ $gt: [{ $strLenCP: { $ifNull: ['$courseId', ''] } }, 0] }, 1, 0] } },
        withOrderId: { $sum: { $cond: [{ $gt: [{ $strLenCP: { $ifNull: ['$orderId', ''] } }, 0] }, 1, 0] } },
        users: { $addToSet: '$userId' },
        lastAt: { $max: '$occurredAt' },
      },
    },
    { $project: { total: 1, withCourseId: 1, withOrderId: 1, users: { $size: '$users' }, lastAt: 1 } },
    { $sort: { total: -1 } },
    { $limit: 25 },
  ], { allowDiskUse: true, maxTimeMS: 120000 }).toArray();
  console.log(`window: last ${days} days (since ${since.toISOString()})`);
  console.table(rows.map((r) => ({ event: r._id, total: r.total, withCourseId: r.withCourseId, withOrderId: r.withOrderId, users: r.users, lastAt: r.lastAt && r.lastAt.toISOString() })));
  const orderIds = await events.find({ eventName: 'PAYMENT_STARTED', occurredAt: { $gte: since }, orderId: { $exists: true, $ne: '' } })
    .project({ _id: 0, orderId: 1 }).sort({ occurredAt: -1 }).limit(5).toArray();
  console.log('PAYMENT_STARTED orderId shapes:', orderIds.map((e) => String(e.orderId).replace(/[0-9a-zA-Z]{6}$/, '******')));
  await client.close();
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
