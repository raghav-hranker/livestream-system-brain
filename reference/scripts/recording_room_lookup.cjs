// READ-ONLY. Where do a class's room records live? Looks up CLASS_IDS in every `rooms` collection reachable through two Mongo URIs:
// the checkout's config.dbUri and the job manager's MONGO_URI. Prints database, recording count and dates, never the URIs.
// Run on the GPU box from a livestream backend checkout:
//   ssh ... 'cd /root/livestream/backend && CLASS_IDS=139750,145679 node -' < recording_room_lookup.cjs
const path = require('path');
const fs = require('fs');
const mongoose = require(path.join(process.cwd(), 'node_modules/mongoose'));
const { MongoClient } = mongoose.mongo;

const ids = (process.env.CLASS_IDS || '').split(',').filter(Boolean);
const ist = (d) => (d ? new Date(new Date(d).getTime() + 5.5 * 36e5).toISOString().slice(0, 16).replace('T', ' ') : '-');
const fromEnvFile = (file, name) => {
  if (!fs.existsSync(file)) return null;
  const line = fs.readFileSync(file, 'utf8').split('\n').find((l) => l.startsWith(`${name}=`));
  return line ? line.slice(name.length + 1).trim().replace(/^["']|["']$/g, '') : null;
};
const sources = {
  'config.dbUri': require(path.join(process.cwd(), 'config/config')).dbUri,
  'job-manager MONGO_URI': fromEnvFile('/root/video-transcoder/gpu-server/job-manager/.env', 'MONGO_URI'),
};

(async () => {
  for (const [label, uri] of Object.entries(sources)) {
    if (!uri) { console.log(`\n${label}: none`); continue; }
    let host = '?';
    try { host = new URL(uri.replace(/^mongodb\+srv/, 'http').replace(/^mongodb/, 'http')).hostname; } catch (e) { /* keep ? */ }
    console.log(`\n=== ${label} (${host})`);
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 20000, socketTimeoutMS: 90000 });
    try {
      await client.connect();
      const { databases } = await client.db('admin').admin().listDatabases();
      for (const { name } of databases) {
        if (['admin', 'local', 'config'].includes(name)) continue;
        const db = client.db(name);
        const has = await db.listCollections({ name: 'rooms' }, { nameOnly: true }).toArray();
        if (!has.length) continue;
        const rooms = db.collection('rooms');
        const total = await rooms.estimatedDocumentCount();
        const found = await rooms.find({ classId: { $in: ids } }, { projection: { classId: 1, status: 1, mp4Recordings: 1, createdAt: 1, updatedAt: 1 } }).toArray();
        const newest = await rooms.find({ 'mp4Recordings.0': { $exists: true } }, { projection: { classId: 1, updatedAt: 1, createdAt: 1 } }).sort({ _id: -1 }).limit(1).toArray();
        console.log(`db ${name}: rooms ${total}, asked found ${found.length}/${ids.length}, newest room with recordings ${newest[0]?.classId ?? '-'} created ${ist(newest[0]?.createdAt)}`);
        for (const r of found) console.log(`   ${r.classId}  status=${r.status}  recordings=${(r.mp4Recordings || []).length}  created ${ist(r.createdAt)}  updated ${ist(r.updatedAt)}`);
      }
    } catch (e) {
      console.log(`unreadable: ${e.message.slice(0, 120)}`);
    } finally {
      await client.close().catch(() => {});
    }
  }
})();
