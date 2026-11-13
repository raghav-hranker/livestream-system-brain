// READ-ONLY. Does any database named in any checkout's config still hold the lost rooms? Collects every Mongo URI from config and
// .env files under /root, connects to each distinct one, and for every `rooms` collection prints counts and whether CLASS_IDS exist.
// Prints hosts only, never logins. Run on the GPU box from a checkout with mongoose:
//   ssh ... 'cd /root/livestream-futurekul/backend && CLASS_IDS=139750,145055 node -' < rooms_uri_sweep.cjs
const path = require('path');
const fs = require('fs');
const { MongoClient } = require(path.join(process.cwd(), 'node_modules/mongoose')).mongo;
const ids = (process.env.CLASS_IDS || '').split(',').filter(Boolean);

const candidates = [];
for (const dir of fs.readdirSync('/root')) {
  for (const rel of ['backend/config/config.js', 'config/config.js', 'backend/.env', '.env', 'backend/.env.production', '.env.production', 'gpu-server/job-manager/.env', 'gpu-server/.env']) {
    candidates.push(path.join('/root', dir, rel));
  }
}
const uris = new Map();
for (const file of candidates) {
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch (e) { continue; }
  for (const m of text.matchAll(/mongodb(\+srv)?:\/\/[^\s"'`]+/g)) {
    if (/<|\$\{|localhost|127\.0\.0\.1|username|password:password/i.test(m[0])) continue;
    if (!uris.has(m[0])) uris.set(m[0], []);
    uris.get(m[0]).push(file.replace('/root/', ''));
  }
}
const hostOf = (u) => (u.split('@')[1] || '?').split('/')[0].split('?')[0];

(async () => {
  console.log(`distinct URIs: ${uris.size}`);
  let n = 0;
  for (const [uri, files] of uris) {
    n++;
    console.log(`\n[${n}] ${hostOf(uri)}  (${files.length} files, e.g. ${files[0]})`);
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 12000, socketTimeoutMS: 60000 });
    try {
      await client.connect();
      const { databases } = await client.db('admin').admin().listDatabases();
      let seen = 0;
      for (const { name } of databases) {
        if (['admin', 'local', 'config'].includes(name)) continue;
        const db = client.db(name);
        const has = await db.listCollections({ name: 'rooms' }).toArray().catch(() => []);
        if (!has.length) continue;
        seen++;
        const rooms = db.collection('rooms');
        const total = await rooms.estimatedDocumentCount();
        const recs = await rooms.countDocuments({ 'mp4Recordings.0': { $exists: true } }, { maxTimeMS: 40000 }).catch(() => '?');
        const found = await rooms.find({ classId: { $in: ids } }, { projection: { classId: 1, mp4Recordings: 1 } }).toArray();
        console.log(`  ${name}.rooms: ${total} docs, ${recs} with recordings; asked found ${found.map((r) => `${r.classId}/${(r.mp4Recordings || []).length}`).join(' ') || 'none'}`);
      }
      if (!seen) console.log('  no rooms collection');
    } catch (e) {
      console.log(`  unreadable: ${e.message.slice(0, 90)}`);
    } finally {
      await client.close().catch(() => {});
    }
  }
})();
