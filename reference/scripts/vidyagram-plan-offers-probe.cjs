// Read-only. Refuses any DB but vidyagramdb. Are the client team's offer plans (Plans.offer) in use: how many, which kinds,
// and how many orders sit on them. Run on webserver2-2 from the Vidyagram checkout:
// node -r dotenv/config - dotenv_config_path=.env.development < script
const mongoose = require('mongoose');
(async () => {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 8000, readPreference: 'secondaryPreferred' });
  const db = mongoose.connection.db;
  if (db.databaseName !== 'vidyagramdb') throw new Error('refusing: connected to ' + db.databaseName);
  const plans = await db.collection('plans').find({ offer: { $nin: [null] }, 'offer.kind': { $exists: true } })
    .project({ name: 1, amount: 1, duration: 1, status: 1, offer: 1, createdAt: 1 }).toArray();
  const ids = plans.map(p => p._id);
  const orders = ids.length ? await db.collection('orders').aggregate([
    { $match: { planId: { $in: [...ids, ...ids.map(String)] } } },
    { $group: { _id: { plan: { $toString: '$planId' }, status: '$orderStatus' }, n: { $sum: 1 } } },
  ]).toArray() : [];
  const upgrades = await db.collection('plans').countDocuments({ upgradationEnabled: true });
  const upgradesActive = await db.collection('plans').countDocuments({ upgradationEnabled: true, status: 1 });
  console.log(JSON.stringify({
    offerPlans: plans.length,
    plans: plans.map(p => ({ name: p.name, kind: p.offer.kind, amount: p.amount, duration: p.duration, status: p.status, sources: (p.offer.sourcePlanIds || []).length, at: p.createdAt })),
    orders,
    upgradationEnabled: upgrades,
    upgradationEnabledActive: upgradesActive,
  }, null, 1));
  await mongoose.disconnect();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
