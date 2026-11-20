// WRITES to a LOCAL preview DB only: refuses any URI that is not localhost/127.0.0.1 or whose DB is not vidyagramdb.
// Loads a vidyagram-builder-course-dump.cjs file (EJSON lines) with upserts by _id. Run from a backend checkout:
//   MONGO_URI=mongodb://127.0.0.1:27037/vidyagramdb node vidyagram-builder-course-load.cjs dump.ejsonl
const fs = require('fs');
const { MongoClient } = require('mongoose').mongo;
const { EJSON } = require('mongoose').mongo.BSON;

const uri = process.env.MONGO_URI;
if (!uri || !/^mongodb:\/\/(localhost|127\.0\.0\.1)[:/]/.test(uri) || !/\/vidyagramdb(\?|$)/.test(uri)) { console.error('refusing: MONGO_URI must be a local vidyagramdb'); process.exit(1); }

(async () => {
  const client = await MongoClient.connect(uri);
  const db = client.db('vidyagramdb');
  const byCollection = new Map();
  for (const line of fs.readFileSync(process.argv[2], 'utf8').split('\n')) {
    if (!line.trim()) continue;
    const { c, d } = EJSON.parse(line, { relaxed: false });
    byCollection.set(c, [...(byCollection.get(c) || []), d]);
  }
  const counts = {};
  for (const [c, docs] of byCollection) {
    const r = await db.collection(c).bulkWrite(docs.map((d) => ({ replaceOne: { filter: { _id: d._id }, replacement: d, upsert: true } })), { ordered: false });
    counts[c] = { docs: docs.length, upserted: r.upsertedCount, modified: r.modifiedCount };
  }
  console.log(JSON.stringify(counts));
  await client.close();
})().catch((e) => { console.error(e); process.exit(1); });
