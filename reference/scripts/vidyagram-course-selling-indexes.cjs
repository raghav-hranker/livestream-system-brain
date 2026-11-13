// Builds the course-selling indexes on vidyagramdb (prod never autoIndexes). The specs mirror the backend models on
// feat/vg-course-selling: Plans courseSale (one of them unique, the guard against two plans for one course and key),
// Course selling.addons / selling.exchange, and orders upgraded_to_order. Task 06 and 18 of course-selling-rules.
// Refuses any database but vidyagramdb before connecting. Prints replica-set member health and refuses to build while
// a member is unhealthy. Refuses the unique index while two plans share a course and key. Dry run by default.
//   From the Mac through the tunnel: MONGO_URI='mongodb://...@127.0.0.1:27018/vidyagramdb?...&directConnection=true'
//   NODE_PATH=<backend>/node_modules/mongoose/node_modules:<backend>/node_modules node vidyagram-course-selling-indexes.cjs [--commit]
const { MongoClient } = require('mongodb');

const commit = process.argv.includes('--commit');
const INDEXES = {
  plans: [
    { key: { 'courseSale.courseId': 1 }, name: 'courseSale_courseId_1' },
    { key: { 'courseSale.key': 1 }, name: 'courseSale_key_1' },
    {
      key: { 'courseSale.courseId': 1, 'courseSale.key': 1 },
      name: 'courseSale_courseId_1_key_1_unique_partial',
      unique: true,
      partialFilterExpression: { 'courseSale.courseId': { $type: 'objectId' } },
    },
  ],
  courses: [
    { key: { 'selling.addons.courseId': 1 }, name: 'selling_addons_courseId_1' },
    { key: { 'selling.exchange.courseIds': 1 }, name: 'selling_exchange_courseIds_1' },
  ],
  orders: [
    { key: { upgradedToOrderId: 1 }, name: 'upgraded_to_order', partialFilterExpression: { upgradedToOrderId: { $exists: true } } },
  ],
};

(async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI is not set');
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 15000, readPreference: 'primary' });
  const db = client.db();
  if (db.databaseName !== 'vidyagramdb') throw new Error(`refusing: database is ${db.databaseName}`);
  await client.connect();
  const status = await client.db('admin').command({ replSetGetStatus: 1 });
  console.log(`database ${db.databaseName}\n${status.members.map((m) => `  ${m.name} ${m.stateStr} health=${m.health}`).join('\n')}`);
  const unhealthy = status.members.filter((m) => m.health !== 1 || !['PRIMARY', 'SECONDARY', 'ARBITER'].includes(m.stateStr));

  const duplicates = await db.collection('plans').aggregate([
    { $match: { 'courseSale.courseId': { $type: 'objectId' } } },
    { $group: { _id: { courseId: '$courseSale.courseId', key: '$courseSale.key' }, n: { $sum: 1 }, ids: { $push: '$_id' } } },
    { $match: { n: { $gt: 1 } } },
  ]).toArray();
  const linked = await db.collection('plans').countDocuments({ 'courseSale.courseId': { $type: 'objectId' } });
  console.log(`plans linked to a course: ${linked}; course+key shared by two plans: ${duplicates.length}`, duplicates.map((d) => d.ids.map(String)));

  for (const [collection, specs] of Object.entries(INDEXES)) {
    const existing = await db.collection(collection).indexes();
    const have = new Set(existing.map((i) => i.name));
    const missing = specs.filter((s) => !have.has(s.name));
    console.log(`${collection}: ${existing.length} present, ${missing.length} to build`, missing.map((s) => s.name));
    if (!commit || missing.length === 0) continue;
    if (unhealthy.length) throw new Error('refusing to build while a member is unhealthy');
    if (missing.some((s) => s.unique) && duplicates.length) throw new Error('refusing the unique index while two plans share a course and key');
    const started = Date.now();
    const names = await db.collection(collection).createIndexes(missing, { commitQuorum: 'majority' });
    console.log(`${collection}: built ${names.join(', ')} in ${Math.round((Date.now() - started) / 1000)} s`);
  }
  if (!commit) console.log('dry run: pass --commit to build');
  await client.close();
})().catch((error) => { console.error(error.message); process.exit(1); });
