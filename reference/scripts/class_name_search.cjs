// READ-ONLY. Is there a class with this name? Searches the livestream Atlas (config.dbUri) and the job log (job manager MONGO_URI) for
// NAME (a case-insensitive regex). Every string field of transcoder.videos and of each Atlas collection is checked, capped per collection.
// quicktricks and vidyagramdb are skipped: they have their own lookups. Prints fields only, never URIs.
// Run on the GPU box from the checkout that serves the API:
//   ssh ... 'cd /root/livestream-futurekul/backend && NAME=arjun node -' < class_name_search.cjs
const path = require('path');
const fs = require('fs');
const { MongoClient } = require(path.join(process.cwd(), 'node_modules/mongoose')).mongo;

const NAME = new RegExp(process.env.NAME || '', 'i');
if (!process.env.NAME) { console.error('NAME is required'); process.exit(2); }
const SKIP_DB = new Set(['admin', 'local', 'config', 'quicktricksdb', 'vidyagramdb']);
const SCAN = Number(process.env.SCAN) || 400000;
const SHOW = Number(process.env.SHOW) || 40;
const jm = fs.readFileSync('/root/video-transcoder/gpu-server/job-manager/.env', 'utf8').split('\n').find((l) => l.startsWith('MONGO_URI='));
const sources = {
  atlas: require(path.join(process.cwd(), 'config/config')).dbUri,
  jobLog: jm && jm.slice('MONGO_URI='.length).trim().replace(/^["']|["']$/g, ''),
};

// Paths of string values that match, walking nested objects and arrays. Signed URLs are cut at the query string.
const hits = (v, at = '', out = []) => {
  if (typeof v === 'string') { if (NAME.test(v)) out.push(`${at}=${v.split('?')[0].slice(0, 140)}`); return out; }
  if (Array.isArray(v)) { v.slice(0, 50).forEach((x, i) => hits(x, `${at}[${i}]`, out)); return out; }
  if (v && typeof v === 'object' && v.constructor === Object) for (const [k, x] of Object.entries(v)) hits(x, at ? `${at}.${k}` : k, out);
  return out;
};

(async () => {
  for (const [label, uri] of Object.entries(sources)) {
    if (!uri) { console.log(`${label}: no uri`); continue; }
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 20000, socketTimeoutMS: 240000, readPreference: 'secondaryPreferred' });
    try {
      await client.connect();
      const { databases } = await client.db('admin').admin().listDatabases();
      for (const { name: dbName } of databases) {
        if (SKIP_DB.has(dbName)) continue;
        if (label === 'jobLog' && dbName !== (process.env.JOB_DB || 'transcoder')) continue;
        const db = client.db(dbName);
        for (const { name: coll, type } of await db.listCollections({}, { nameOnly: true }).toArray()) {
          // People's names and chat would match a first name without being a class.
          if (type === 'view' || coll.startsWith('system.') || /user|chat|message|comment|report|block|ban/i.test(coll)) continue;
          const c = db.collection(coll);
          const total = await c.estimatedDocumentCount();
          if (label === 'jobLog' && coll !== 'videos') continue;
          let scanned = 0; let matched = 0; const shown = [];
          for await (const d of c.find({}).limit(SCAN)) {
            scanned++;
            const h = hits(d);
            if (!h.length) continue;
            matched++;
            if (shown.length < SHOW) shown.push(`   ${String(d._id).slice(0, 60)} client=${d.clientId ?? '-'} class=${d.classId ?? '-'} status=${d.status ?? '-'} | ${h.slice(0, 3).join(' ; ')}`);
          }
          console.log(`${label} ${dbName}.${coll}: ${total} docs, scanned ${scanned}, matched ${matched}`);
          if (shown.length) console.log(shown.join('\n'));
        }
      }
    } catch (e) {
      console.log(`${label} failed: ${e.message.replace(/mongodb(\+srv)?:\/\/\S+/g, '<uri>').slice(0, 160)}`);
    } finally {
      await client.close().catch(() => {});
    }
  }
})();
