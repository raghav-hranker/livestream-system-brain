// READ-ONLY. Second pass on the test.rooms loss: every collection name in test with a count, any that could hold rooms (classId plus
// mp4Recordings), every oplog command op since the oplog starts, rooms inserts per day and whether those rooms still exist, and all deletes.
// Run on the GPU box from the checkout that serves the API:
//   ssh ... 'cd /root/livestream-futurekul/backend && node -' < rooms_wipe_evidence2.cjs
const path = require('path');
const { MongoClient } = require(path.join(process.cwd(), 'node_modules/mongoose')).mongo;
const ist = (d) => (d ? new Date(new Date(d).getTime() + 5.5 * 36e5).toISOString().slice(0, 16).replace('T', ' ') : '-');
const when = (o) => ist(new Date(o.ts.getHighBits() * 1000));

(async () => {
  const client = new MongoClient(require(path.join(process.cwd(), 'config/config')).dbUri, { serverSelectionTimeoutMS: 20000, socketTimeoutMS: 240000 });
  await client.connect();
  const { databases } = await client.db('admin').admin().listDatabases();
  for (const { name } of databases) {
    if (['admin', 'local', 'config'].includes(name)) continue;
    const db = client.db(name);
    for (const c of await db.listCollections().toArray()) {
      if (c.type === 'view') { console.log(`view ${name}.${c.name}`); continue; }
      const col = db.collection(c.name);
      const n = await col.estimatedDocumentCount();
      const hasRecs = await col.findOne({ 'mp4Recordings.0': { $exists: true }, classId: { $exists: true } }, { projection: { _id: 1 } });
      const nameLooksRoom = /room|backup|bak|old|archive|copy|tmp/i.test(c.name);
      if (hasRecs || nameLooksRoom) {
        const recs = hasRecs ? await col.countDocuments({ 'mp4Recordings.0': { $exists: true } }) : 0;
        console.log(`${name}.${c.name}: docs ${n}, with mp4Recordings ${recs}`);
      }
    }
  }

  const oplog = client.db('local').collection('oplog.rs');
  const cmds = await oplog.find({ op: 'c' }, { projection: { ts: 1, ns: 1, o: 1 } }).toArray();
  console.log(`\nall command ops in the oplog: ${cmds.length}`);
  for (const o of cmds.slice(-40)) {
    const inner = o.o.applyOps ? `applyOps ${o.o.applyOps.length}, first ${o.o.applyOps[0]?.ns} ${o.o.applyOps[0]?.op}` : JSON.stringify(o.o).slice(0, 110);
    console.log(`  ${when(o)}  ${o.ns}  ${inner}`);
  }

  const inserts = await oplog.find({ ns: 'test.rooms', op: 'i' }, { projection: { ts: 1, 'o._id': 1, 'o.classId': 1 } }).toArray();
  const rooms = client.db('test').collection('rooms');
  const alive = new Set((await rooms.find({}, { projection: { _id: 1 } }).toArray()).map((r) => String(r._id)));
  const perDay = {};
  for (const i of inserts) {
    const d = when(i).slice(0, 10);
    const r = (perDay[d] ||= { inserted: 0, stillThere: 0 });
    r.inserted++;
    if (alive.has(String(i.o._id))) r.stillThere++;
  }
  console.log('\nrooms inserted per IST day, and still present:', JSON.stringify(perDay));
  const dels = await oplog.find({ ns: 'test.rooms', op: 'd' }, { projection: { ts: 1, o: 1 } }).toArray();
  console.log('all deletes on test.rooms:', dels.map((d) => `${when(d)} ${JSON.stringify(d.o).slice(0, 50)}`).join(' | '));
  const updates = await oplog.find({ ns: 'test.rooms', op: 'u' }, { projection: { ts: 1, 'o2._id': 1 } }).sort({ $natural: -1 }).limit(400).toArray();
  console.log('newest updates target present rooms:', updates.filter((u) => alive.has(String(u.o2?._id))).length, 'of', updates.length);
  const hello = await client.db('admin').command({ hello: 1 });
  console.log('\nserver:', JSON.stringify({ setName: hello.setName, hosts: (hello.hosts || []).length, primary: Boolean(hello.isWritablePrimary) }));
  const info = await client.db('admin').command({ buildInfo: 1 }).catch(() => ({}));
  console.log('version:', info.version);
  await client.close();
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
