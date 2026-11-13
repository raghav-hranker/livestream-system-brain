// Notification duplicate probe — READ-ONLY.
//
// For every Notification / AdvanceNotification created in the last DAYS days, tells
// which of the three ways a user can get the same push twice happened:
//   A. twin documents   — two notifications with the same title+message within 15 min
//   B. double run       — one notification, the same tokenHash logged twice; the gap
//                          between the two rows says same run (ms) or a second run (minutes)
//   C. shared token     — one notification, one token, rows under several userIds
// Field names and counts only; titles are truncated, no tokens or user ids are printed.
//
// Run on the box from the quicktricks-backend checkout:
//   DAYS=4 DOTENV_CONFIG_PATH=.env.development node -r dotenv/config - < notification_duplicate_probe.js
const mongoose = require(require.resolve('mongoose', { paths: [process.cwd()] }));

const DAYS = Number(process.env.DAYS || 4);
const IST = (d) => (d ? new Date(new Date(d).getTime() + 5.5 * 36e5).toISOString().slice(0, 19).replace('T', ' ') : '-');
const short = (s) => String(s || '').replace(/\s+/g, ' ').slice(0, 40);
const kindOf = (n) =>
  n.classLifecycleEvent ? `class-${n.classLifecycleEvent}` : n.classId ? 'class-reminder' : n.channelId ? 'chat' : n.journeyKey ? 'journey' : n.scheduleType || 'manual';

const probe = async (db, label, notifColl, logColl) => {
  const since = new Date(Date.now() - DAYS * 864e5);
  const notifs = await db
    .collection(notifColl)
    .find({ createdAt: { $gte: since } })
    .project({ title: 1, message: 1, status: 1, scheduleType: 1, scheduledTime: 1, classId: 1, classLifecycleEvent: 1, channelId: 1, journeyKey: 1, createdAt: 1, sentAt: 1, recipientCount: 1, createdBy: 1 })
    .sort({ createdAt: 1 })
    .toArray();
  console.log(`\n===== ${label}: ${notifs.length} created since ${IST(since)} IST =====`);

  // A. twin documents
  const twins = [];
  for (let i = 0; i < notifs.length; i++) {
    for (let j = i + 1; j < notifs.length; j++) {
      const a = notifs[i], b = notifs[j];
      if (b.createdAt - a.createdAt > 15 * 60e3) break;
      if (a.title === b.title && a.message === b.message) twins.push([a, b]);
    }
  }
  console.log(`\n-- A. twin documents (same title+message, created <=15 min apart): ${twins.length}`);
  for (const [a, b] of twins) {
    console.log(`  ${IST(a.createdAt)} ${a._id} ${kindOf(a)} ${a.status}  |  ${IST(b.createdAt)} ${b._id} ${kindOf(b)} ${b.status}  gap ${Math.round((b.createdAt - a.createdAt) / 1000)}s  "${short(a.title)}" createdBy=${a.createdBy ?? '-'}/${b.createdBy ?? '-'}`);
  }

  // B + C per notification
  console.log(`\n-- B/C per notification (only rows with any duplicate shown)`);
  console.log('  createdAt IST        id                        kind            status   logs  dupTok  maxGap   sharedTok  title');
  let clean = 0;
  for (const n of notifs) {
    const [row] = await db
      .collection(logColl)
      .aggregate(
        [
          { $match: { notificationId: n._id } },
          { $group: { _id: '$tokenHash', rows: { $sum: 1 }, users: { $addToSet: '$userId' }, first: { $min: '$sentAt' }, last: { $max: '$sentAt' } } },
          {
            $group: {
              _id: null,
              logs: { $sum: '$rows' },
              dupTok: { $sum: { $cond: [{ $gt: ['$rows', 1] }, 1, 0] } },
              maxGap: { $max: { $cond: [{ $gt: ['$rows', 1] }, { $subtract: ['$last', '$first'] }, 0] } },
              sharedTok: { $sum: { $cond: [{ $gt: [{ $size: '$users' }, 1] }, 1, 0] } },
            },
          },
        ],
        { allowDiskUse: true }
      )
      .toArray();
    if (!row || (row.dupTok === 0 && row.sharedTok === 0)) {
      clean++;
      continue;
    }
    const gap = row.maxGap >= 60e3 ? `${Math.round(row.maxGap / 60e3)}m` : `${Math.round(row.maxGap / 1000)}s`;
    console.log(`  ${IST(n.createdAt)}  ${n._id}  ${kindOf(n).padEnd(14)}  ${String(n.status).padEnd(7)}  ${String(row.logs).padStart(5)}  ${String(row.dupTok).padStart(6)}  ${gap.padStart(6)}  ${String(row.sharedTok).padStart(9)}  "${short(n.title)}"`);
  }
  console.log(`  (${clean} notifications with no duplicate token rows)`);
};

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.DB_NAME, readPreference: 'secondaryPreferred' });
  const db = mongoose.connection.db;
  const names = new Set((await db.listCollections().toArray()).map((c) => c.name));
  const pick = (...c) => c.find((x) => names.has(x));
  await probe(db, 'Notification', pick('notifications'), pick('notificationdeliverylogs'));
  if (pick('advancenotifications')) await probe(db, 'AdvanceNotification', 'advancenotifications', pick('advancenotificationdeliverylogs'));
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
