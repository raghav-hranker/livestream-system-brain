const mongoose = require('mongoose');
(async () => {
  await mongoose.connect(process.env.URI, { serverSelectionTimeoutMS: 8000 });
  const db = mongoose.connection.db;
  const { ObjectId } = mongoose.Types;
  const proj = { title:1, name:1, amount:1, status:1, customer_id:1, isExploreTestSeries:1, isUpgradeOnly:1, upgradeOnly:1, packages:1, priority:1, createdAt:1 };
  const trim = p => ({ ...p, packages: (p.packages || []).length });
  const flagged = await db.collection('plans').find({ isExploreTestSeries: true }).project(proj).sort({ priority: -1, createdAt: -1 }).toArray();
  console.log('flagged isExploreTestSeries (' + flagged.length + '):');
  flagged.forEach(p => console.log(' ', JSON.stringify(trim(p))));
  for (const id of ['6a9c1bd52b37bca201a57f3d', '6abe9f0538270f991f36fb77']) {
    const p = await db.collection('plans').findOne({ _id: new ObjectId(id) }, { projection: proj });
    console.log(id, '=>', p ? JSON.stringify(trim(p)) : 'NOT FOUND');
  }
  await mongoose.disconnect();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
