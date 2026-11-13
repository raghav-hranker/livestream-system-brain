// Read-only, aggregate only. Compares quicktricksdb and vidyagramdb for a scale-readiness check:
// collection row counts and sizes, and every index quicktricksdb has that vidyagramdb lacks
// (autoIndex never builds here, so a fresh tenant DB misses indexes that were hand-built on the other).
// Also prints rs0 member state. Prints names, counts and index keys only: no documents.
//
// Run on webserver2-2 from the quicktricks backend checkout:
//   ssh ... 'cd /var/www/backend.quicktricksbysahilsir.com/quicktricks-backend && \
//     nice -n 10 node -r dotenv/config - dotenv_config_path=.env.development' < tenant-scale-compare.cjs
// Env: MIN_ROWS (default 5000) = ignore missing indexes on VG collections smaller than this.
const mongoose = require('mongoose');

const MIN_ROWS = Number(process.env.MIN_ROWS || 5000);
const A = 'quicktricksdb';
const B = 'vidyagramdb';
const mb = (n) => Math.round((n || 0) / 1048576);
const keyOf = (ix) => JSON.stringify(ix.key) + (ix.unique ? ' unique' : '') + (ix.partialFilterExpression ? ' partial' : '') + (ix.expireAfterSeconds != null ? ' ttl' : '');
const bareKey = (ix) => JSON.stringify(ix.key);

async function survey(db) {
  const out = new Map();
  const cols = await db.listCollections({ type: 'collection' }, { nameOnly: true }).toArray();
  for (const { name } of cols) {
    if (name.startsWith('system.')) continue;
    try {
      const [st] = await db.collection(name).aggregate([{ $collStats: { storageStats: {} } }]).toArray();
      const ix = await db.collection(name).indexes();
      out.set(name, {
        count: st.storageStats.count || 0,
        dataMB: mb(st.storageStats.size),
        storageMB: mb(st.storageStats.storageSize),
        indexMB: mb(st.storageStats.totalIndexSize),
        indexes: ix,
      });
    } catch (e) {
      out.set(name, { count: -1, dataMB: 0, storageMB: 0, indexMB: 0, indexes: [], err: e.codeName || e.message });
    }
  }
  return out;
}

(async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI not set');
  const conn = await mongoose.createConnection(uri, { autoIndex: false, serverSelectionTimeoutMS: 15000 }).asPromise();
  const client = conn.getClient();

  try {
    const rs = await client.db('admin').command({ replSetGetStatus: 1 });
    console.log('=== rs0');
    for (const m of rs.members) console.log(`  ${m.name}  ${m.stateStr}  health ${m.health}`);
  } catch (e) {
    console.log('rs status unavailable:', e.codeName || e.message);
  }

  const a = await survey(client.db(A));
  const b = await survey(client.db(B));

  for (const [label, s] of [[A, a], [B, b]]) {
    let rows = 0, data = 0, idx = 0;
    for (const v of s.values()) { rows += Math.max(v.count, 0); data += v.dataMB; idx += v.indexMB; }
    console.log(`\n=== ${label}: ${s.size} collections, data ${data} MB, indexes ${idx} MB`);
    const top = [...s.entries()].sort((x, y) => y[1].dataMB - x[1].dataMB).slice(0, 45);
    for (const [name, v] of top) {
      console.log(`  ${String(v.count).padStart(11)} rows  ${String(v.dataMB).padStart(7)} MB data  ${String(v.indexMB).padStart(6)} MB idx  ${String(v.indexes.length).padStart(2)} ix  ${name}`);
    }
  }

  console.log(`\n=== side by side, collections that matter for load (rows ${A} | ${B})`);
  const watch = ['users', 'orders', 'classprogresses', 'appevents', 'notifications', 'notificationdeliverylogs', 'usernotifications',
    'devicetokens', 'fcmtokens', 'userdevices', 'userloginsessions', 'views', 'classes', 'courseclasses', 'courses', 'pdfs',
    'userquestionanswers', 'usertestdatas', 'scores', 'searchlogs', 'searchclicklogs', 'savedquestions', 'plans', 'transactions',
    'coursepdfs', 'feedbacks', 'auditlogs', 'chatmessages', 'supportmessages', 'shorts', 'shortwatches'];
  for (const n of watch) {
    if (!a.has(n) && !b.has(n)) continue;
    console.log(`  ${n.padEnd(28)} ${String(a.get(n)?.count ?? '-').padStart(11)} | ${String(b.get(n)?.count ?? '-').padStart(11)}`);
  }

  console.log(`\n=== indexes ${A} has and ${B} lacks (VG collection >= ${MIN_ROWS} rows)`);
  let missing = 0;
  const names = [...a.keys()].filter((n) => b.has(n)).sort((x, y) => b.get(y).count - b.get(x).count);
  for (const n of names) {
    const va = a.get(n), vb = b.get(n);
    if (vb.count < MIN_ROWS) continue;
    const have = new Set(vb.indexes.map(bareKey));
    const lack = va.indexes.filter((ix) => !have.has(bareKey(ix)));
    if (!lack.length) continue;
    console.log(`  ${n}  (VG ${vb.count} rows, QT ${va.count})`);
    for (const ix of lack) { missing++; console.log(`      missing ${keyOf(ix)}`); }
  }
  console.log(`  total missing: ${missing}`);

  console.log(`\n=== VG collections >= ${MIN_ROWS} rows with only the _id index`);
  for (const [n, v] of [...b.entries()].sort((x, y) => y[1].count - x[1].count)) {
    if (v.count >= MIN_ROWS && v.indexes.length <= 1) console.log(`  ${String(v.count).padStart(11)} rows  ${n}`);
  }

  console.log(`\n=== VG-only big collections (not in ${A})`);
  for (const [n, v] of [...b.entries()].sort((x, y) => y[1].dataMB - x[1].dataMB)) {
    if (!a.has(n) && v.dataMB >= 100) console.log(`  ${String(v.count).padStart(11)} rows  ${String(v.dataMB).padStart(7)} MB  ${v.indexes.length} ix  ${n}`);
  }

  await conn.close();
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
