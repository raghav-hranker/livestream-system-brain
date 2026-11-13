// Read-only, counts and index names only. For quicktricksdb and vidyagramdb: index lists on users,
// notificationdeliverylogs, advancenotificationdeliverylogs, devicetokens, dailyquizreminders, orders,
// classprogresses, scores, userquestionanswers; users holding a push token (fcmToken / device_token /
// token_id); users per customer_id; mobiles held by more than one user (blocks the unique mobile index).
// Run on webserver2-2 from the quicktricks backend checkout:
//   nice -n 10 node -r dotenv/config - dotenv_config_path=.env.development < tenant-push-audience-check.cjs
const mongoose = require('mongoose');
(async () => {
  const conn = await mongoose.createConnection(process.env.MONGO_URI, { autoIndex: false }).asPromise();
  const c = conn.getClient();
  for (const [label, name] of [['QT', 'quicktricksdb'], ['VG', 'vidyagramdb']]) {
    const db = c.db(name);
    console.log('==', label);
    for (const n of ['users', 'notificationdeliverylogs', 'advancenotificationdeliverylogs', 'devicetokens', 'dailyquizreminders', 'orders', 'classprogresses', 'scores', 'userquestionanswers']) {
      let ix = [];
      try { ix = await db.collection(n).indexes(); } catch {}
      console.log(` ${n} (${ix.length}): ` + ix.map((x) => Object.keys(x.key).join('+') + (x.unique ? '!' : '') + (x.expireAfterSeconds != null ? '~ttl' : '')).join(' | '));
    }
    const u = db.collection('users');
    const t0 = Date.now();
    for (const f of ['fcmToken', 'device_token', 'token_id']) {
      const n = await u.countDocuments({ [f]: { $type: 'string', $ne: '' } }, { maxTimeMS: 60000 }).catch((e) => 'ERR ' + e.codeName);
      console.log(` users with ${f}: ${n}`);
    }
    console.log(` token counts took ${Date.now() - t0} ms`);
    const cust = await u.aggregate([{ $group: { _id: '$customer_id', n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 4 }], { maxTimeMS: 60000 }).toArray().catch((e) => [{ err: e.codeName }]);
    console.log(' users by customer_id:', JSON.stringify(cust));
    const dupM = await u.aggregate([{ $match: { mobile: { $type: 'string', $ne: '' } } }, { $group: { _id: '$mobile', n: { $sum: 1 } } }, { $match: { n: { $gt: 1 } } }, { $count: 'dups' }], { maxTimeMS: 120000, allowDiskUse: true }).toArray().catch((e) => [{ err: e.codeName }]);
    console.log(' mobiles held by >1 user:', JSON.stringify(dupM));
  }
  await conn.close();
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
