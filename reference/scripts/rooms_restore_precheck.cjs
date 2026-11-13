// READ-ONLY. Before a full rooms restore: Atlas space used, the average size of a room, and how the rows meet the collection.
// The rows are prepended as `const ROWS = [...]` (full rows of rooms-rebuild-2026-11-02.ndjson) by the caller. Run on the GPU box from the checkout that serves the API:
//   (printf 'const ROWS = '; node -e '<rows>' ; printf ';\n'; cat rooms_restore_precheck.cjs) | ssh ... 'cd /root/livestream-futurekul/backend && node -'
const path = require('path');
const { MongoClient } = require(path.join(process.cwd(), 'node_modules/mongoose')).mongo;

(async () => {
  const client = new MongoClient(require(path.join(process.cwd(), 'config/config')).dbUri, { serverSelectionTimeoutMS: 20000, socketTimeoutMS: 120000 });
  await client.connect();
  const db = client.db('test');
  const stats = await db.command({ dbStats: 1 });
  const coll = await db.command({ collStats: 'rooms' });
  const mb = (n) => (n / 1048576).toFixed(1);
  console.log(`db test: data ${mb(stats.dataSize)} MB, storage ${mb(stats.storageSize)} MB, indexes ${mb(stats.indexSize)} MB, fsUsed ${stats.fsUsedSize ? mb(stats.fsUsedSize) : '?'} MB of ${stats.fsTotalSize ? mb(stats.fsTotalSize) : '?'} MB`);
  console.log(`rooms: ${coll.count} docs, avg ${Math.round(coll.avgObjSize || 0)} bytes, data ${mb(coll.size)} MB, indexes ${mb(coll.totalIndexSize)} MB`);
  const hello = await db.admin().command({ hello: 1 }).catch(() => ({}));
  console.log('primary:', hello.isWritablePrimary, 'setName:', hello.setName || '-');

  const ids = ROWS.map((r) => r.classId);
  const seen = new Map();
  for (const r of ROWS) (seen.get(r.classId) || seen.set(r.classId, []).get(r.classId)).push(r.clientId);
  const dup = [...seen.entries()].filter(([, c]) => c.length > 1);
  console.log(`rows ${ROWS.length}; class ids appearing twice: ${dup.length}`, JSON.stringify(dup.slice(0, 12)));

  const existing = new Map();
  for (let i = 0; i < ids.length; i += 500) {
    for (const d of await db.collection('rooms').find({ classId: { $in: ids.slice(i, i + 500) } }, { projection: { classId: 1, clientId: 1, mp4Recordings: 1 } }).toArray()) existing.set(d.classId, d);
  }
  const absent = ROWS.filter((r) => !existing.has(r.classId));
  const bytes = absent.reduce((s, r) => s + JSON.stringify(r.recordings).length + 200, 0);
  const otherClient = ROWS.filter((r) => existing.has(r.classId) && String(existing.get(r.classId).clientId) !== String(r.clientId));
  console.log(`absent ${absent.length}, about ${mb(bytes)} MB of new data; rows whose room belongs to another client: ${otherClient.length}`, JSON.stringify(otherClient.slice(0, 8).map((r) => [r.classId, r.clientId, existing.get(r.classId).clientId])));
  const shapes = {};
  for (const r of absent) { const k = r.check + '/' + r.recordings.length; shapes[k] = (shapes[k] || 0) + 1; }
  console.log('absent rows by check/recordings:', JSON.stringify(shapes));
  await client.close();
})().catch((e) => { console.error('FAILED', e.message.replace(/mongodb(\+srv)?:\/\/\S+/g, '<uri>')); process.exit(1); });
