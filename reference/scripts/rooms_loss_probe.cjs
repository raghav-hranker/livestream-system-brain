// READ-ONLY. When and how did Atlas test.rooms lose its history? Prints the serving process's database host, every database and
// collection with counts, rooms' oldest and newest documents, its indexes (a TTL would show), per-day creation counts, any
// ransom-style collection, the oplog's rooms deletes or drop if this login may read it, and how many jobs could rebuild rooms.
// Run on the GPU box from the checkout that serves the API:
//   ssh ... 'cd /root/livestream-futurekul/backend && node -' < rooms_loss_probe.cjs
const path = require('path');
const fs = require('fs');
try { require(path.join(process.cwd(), 'node_modules/dotenv')).config(); } catch (e) { /* no dotenv here */ }
const mongoose = require(path.join(process.cwd(), 'node_modules/mongoose'));
const { MongoClient } = mongoose.mongo;
const ist = (d) => (d ? new Date(new Date(d).getTime() + 5.5 * 36e5).toISOString().slice(0, 16).replace('T', ' ') : '-');
const idTime = (id) => new Date(parseInt(String(id).slice(0, 8), 16) * 1000);

(async () => {
  const uri = require(path.join(process.cwd(), 'config/config')).dbUri;
  console.log('serving db host:', new URL(uri.replace(/^mongodb(\+srv)?/, 'http')).hostname);
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 20000, socketTimeoutMS: 120000 });
  await client.connect();

  const { databases } = await client.db('admin').admin().listDatabases();
  for (const { name, sizeOnDisk } of databases) {
    if (['admin', 'local', 'config'].includes(name)) continue;
    const cols = await client.db(name).listCollections().toArray();
    const counts = [];
    for (const c of cols) counts.push(`${c.name}=${await client.db(name).collection(c.name).estimatedDocumentCount()}`);
    console.log(`db ${name} (${Math.round(sizeOnDisk / 1e6)} MB): ${counts.join(' ').slice(0, 700)}`);
  }

  const rooms = client.db('test').collection('rooms');
  const oldest = await rooms.find({}, { projection: { classId: 1, status: 1 } }).sort({ _id: 1 }).limit(5).toArray();
  const newest = await rooms.find({}, { projection: { classId: 1, status: 1 } }).sort({ _id: -1 }).limit(2).toArray();
  console.log('\noldest rooms:');
  for (const r of oldest) console.log(`  ${ist(idTime(r._id))}  ${r.classId}  ${r.status}`);
  console.log('newest rooms:');
  for (const r of newest) console.log(`  ${ist(idTime(r._id))}  ${r.classId}  ${r.status}`);

  const indexes = await rooms.indexes();
  console.log('\nindexes:', JSON.stringify(indexes.map((i) => ({ key: i.key, ttl: i.expireAfterSeconds }))));

  const perDay = {};
  for (const r of await rooms.find({}, { projection: { _id: 1 } }).toArray()) {
    const d = ist(idTime(r._id)).slice(0, 10);
    perDay[d] = (perDay[d] || 0) + 1;
  }
  console.log('rooms by day created:', JSON.stringify(perDay));

  try {
    const oplog = client.db('local').collection('oplog.rs');
    const first = await oplog.find({}, { projection: { ts: 1 } }).sort({ $natural: 1 }).limit(1).toArray();
    console.log('\noplog starts', first[0] ? ist(new Date(first[0].ts.getHighBits() * 1000)) : '-');
    const drops = await oplog.find({ ns: 'test.$cmd', $or: [{ 'o.drop': 'rooms' }, { 'o.renameCollection': /rooms/ }, { 'o.dropDatabase': 1 }] }).limit(5).toArray();
    const deletes = await oplog.countDocuments({ ns: 'test.rooms', op: 'd' });
    console.log(`oplog: drops/renames ${drops.length}, single deletes ${deletes}`);
    for (const d of drops) console.log(' ', ist(new Date(d.ts.getHighBits() * 1000)), JSON.stringify(d.o).slice(0, 120));
  } catch (e) {
    console.log('\noplog unreadable:', e.message.slice(0, 90));
  }
  await client.close();

  const envFile = '/root/video-transcoder/gpu-server/job-manager/.env';
  const line = fs.readFileSync(envFile, 'utf8').split('\n').find((l) => l.startsWith('MONGO_URI='));
  if (line) {
    const jm = new MongoClient(line.slice(10).trim().replace(/^["']|["']$/g, ''), { serverSelectionTimeoutMS: 20000, socketTimeoutMS: 120000 });
    await jm.connect();
    const videos = jm.db('transcoder').collection('videos');
    const withOutputs = { status: 'completed', 'outputs.0': { $exists: true } };
    const total = await videos.countDocuments(withOutputs);
    const first = await videos.find(withOutputs, { projection: { completedAt: 1 } }).sort({ completedAt: 1 }).limit(1).toArray();
    console.log(`\nrebuild source, transcoder.videos completed with outputs: ${total}, oldest ${ist(first[0]?.completedAt)}`);
    for (const c of ['514', '135']) console.log(`  client ${c}: ${await videos.countDocuments({ ...withOutputs, clientId: { $in: [c, Number(c)] } })}`);
    await jm.close();
  }
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
