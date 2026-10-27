// Read-only, refuses any DB but vidyagramdb: every http(s) URL in every collection, counted by
// collection x field path x host. Query strings are dropped from examples (signed tokens never print).
// Collections over SAMPLE_OVER docs (default 300000) are $sample'd at SAMPLE_N (default 50000) and marked sampled.
// SKIP=<regex> leaves collections out. Prints JSON on stdout, progress on stderr.
// Run on webserver2-2 from the Vidyagram checkout: URI=<MONGO_URI from .env.development> node - < script > out.json
const mongoose = require('mongoose');
const SAMPLE_OVER = Number(process.env.SAMPLE_OVER || 300000);
const SAMPLE_N = Number(process.env.SAMPLE_N || 50000);
const SKIP = process.env.SKIP ? new RegExp(process.env.SKIP) : null;
const URL_RE = /https?:\/\/[^\s"'<>()\\]+/gi;

function walk(v, path, out) {
  if (typeof v === 'string') {
    const m = v.match(URL_RE);
    if (m) for (const u of m) out.push([path, u]);
  } else if (Array.isArray(v)) {
    for (const x of v) walk(x, path + '[]', out);
  } else if (v && typeof v === 'object' && !(v instanceof Date) && v._bsontype === undefined) {
    for (const [k, x] of Object.entries(v)) walk(x, path ? path + '.' + k : k, out);
  }
}

(async () => {
  await mongoose.connect(process.env.URI, { serverSelectionTimeoutMS: 8000, readPreference: 'secondaryPreferred' });
  const db = mongoose.connection.db;
  if (db.databaseName !== 'vidyagramdb') throw new Error('refusing: connected to ' + db.databaseName);

  const colls = (await db.listCollections({ type: 'collection' }).toArray()).map((c) => c.name).sort();
  const result = { at: new Date().toISOString(), collections: {} };
  for (const name of colls) {
    if (SKIP && SKIP.test(name)) continue;
    const coll = db.collection(name);
    const total = await coll.estimatedDocumentCount();
    const sampled = total > SAMPLE_OVER;
    const cursor = sampled
      ? coll.aggregate([{ $sample: { size: SAMPLE_N } }], { allowDiskUse: true })
      : coll.find({}, { batchSize: 2000 });
    const cells = new Map();
    let scanned = 0;
    for await (const doc of cursor) {
      scanned++;
      const hits = [];
      walk(doc, '', hits);
      const seen = new Set();
      for (const [path, url] of hits) {
        let host;
        try { host = new URL(url).host.toLowerCase(); } catch { host = '(unparseable)'; }
        const key = path + '\t' + host;
        let c = cells.get(key);
        if (!c) cells.set(key, (c = { path, host, docs: 0, urls: 0, exampleId: String(doc._id), example: url.split('?')[0].slice(0, 160) }));
        c.urls++;
        if (!seen.has(key)) { seen.add(key); c.docs++; }
      }
    }
    result.collections[name] = { total, scanned, sampled, cells: [...cells.values()].sort((a, b) => b.docs - a.docs) };
    console.error(`${name}: ${scanned}/${total}${sampled ? ' (sampled)' : ''}, ${cells.size} path x host cells`);
  }
  console.log(JSON.stringify(result, null, 1));
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
