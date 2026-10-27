// Re-hosts the AppX images students still load: courses.banner, ebooks.image1, and <img> URLs inside questions
// (question/solution/options…) and their copies in testsectionquestionmaps.test[]. Refuses any DB but vidyagramdb.
//   default    DRY RUN: finds every AppX image URL, GETs it from AppX, prints the planned target and the docs it
//              would rewrite. No upload, no write.
//   COMMIT=1   uploads each source with the backend's uploadAssetFromUrlDeduped (R2 migration bucket behind
//              assets.hranker.org, key <folder>/<sha1(url)><ext>, idempotent), checks the new URL serves the same
//              bytes, backs up every doc to OUT_DIR/before.json, then rewrites each field with a compare-and-set on
//              its old value. A source that fails any check is left as it is.
//   RESTORE=<before.json>  puts the backed-up fields back (compare-and-set on the re-hosted value).
// Run on webserver2-2 from the Vidyagram checkout (needs its dist/ and .env.development):
//   node - < script        COMMIT=1 OUT_DIR=~/vg-appx-image-rehost-<date> node - < script
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(process.cwd(), '.env.development') });
const mongoose = require('mongoose');
const { EJSON } = mongoose.mongo.BSON;

const COMMIT = process.env.COMMIT === '1';
const RESTORE = process.env.RESTORE;
const OUT_DIR = process.env.OUT_DIR || path.join(process.env.HOME, `vg-appx-image-rehost-${new Date().toISOString().slice(0, 10)}`);
const APPX_URL = /https?:\/\/[a-z0-9.-]*(?:classx\.co\.in|akamai\.net\.in|kaxa\.in|securevideo\.in|appx\.co\.in)\/[^\s"'<>()\\]+/gi;
const APPX_HOST = /(?:classx\.co\.in|akamai\.net\.in|kaxa\.in|securevideo\.in|appx\.co\.in)\//i; // for Mongo filters (no g flag)
const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg', '.bmp']);
const PUBLIC_BASE = process.env.R2_MIGRATION_PUBLIC_BASE_URL;

// collection -> top-level fields to scan, the doc filter, and the destination folder.
const TARGETS = [
  { coll: 'courses', fields: ['banner'], filter: { banner: APPX_HOST }, folder: '781/courses/banners' },
  { coll: 'ebooks', fields: ['image1'], filter: { image1: APPX_HOST }, folder: '781/ebooks' },
  {
    coll: 'questions',
    fields: ['question', 'description', 'solution', 'answer', 'comprehension', 'options'],
    filter: { $or: ['question.en', 'question.hi', 'description.en', 'description.hi', 'solution.en', 'solution.hi',
      'answer.en', 'answer.hi', 'comprehension.en', 'comprehension.hi', 'options.en', 'options.hi'].map((f) => ({ [f]: APPX_HOST })) },
    folder: '781/questions',
  },
  { coll: 'testsectionquestionmaps', fields: ['test'], filter: null, folder: '781/questions' },
];

const urlsIn = (v, out = new Set()) => {
  if (typeof v === 'string') for (const u of v.match(APPX_URL) || []) out.add(u);
  else if (Array.isArray(v)) v.forEach((x) => urlsIn(x, out));
  else if (v && typeof v === 'object' && v._bsontype === undefined && !(v instanceof Date)) Object.values(v).forEach((x) => urlsIn(x, out));
  return out;
};
const replaceIn = (v, map) => {
  if (typeof v === 'string') return v.replace(APPX_URL, (u) => map.get(u) || u);
  if (Array.isArray(v)) return v.map((x) => replaceIn(x, map));
  if (v && typeof v === 'object' && v._bsontype === undefined && !(v instanceof Date)) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, replaceIn(x, map)]));
  return v;
};
const predictedTarget = (src, folder) => {
  const ext = path.extname(new URL(src).pathname).toLowerCase();
  return IMAGE_EXT.has(ext) ? `${PUBLIC_BASE}/${folder}/${crypto.createHash('sha1').update(src).digest('hex')}${ext}` : '(extension decided at upload)';
};
async function get(url) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(30000) });
    const buf = r.ok ? Buffer.from(await r.arrayBuffer()) : null;
    return { status: r.status, type: r.headers.get('content-type'), bytes: buf ? buf.length : 0, sha1: buf ? crypto.createHash('sha1').update(buf).digest('hex') : null };
  } catch (e) { return { status: 'error', error: String(e.message || e) }; }
}

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 8000, readPreference: 'primary' });
  const db = mongoose.connection.db;
  if (db.databaseName !== 'vidyagramdb') throw new Error('refusing: connected to ' + db.databaseName);

  if (RESTORE) {
    const backup = EJSON.parse(fs.readFileSync(RESTORE, 'utf8'));
    let restored = 0, skipped = 0;
    for (const b of backup) {
      const r = await db.collection(b.coll).updateOne({ _id: b._id, [b.field]: b.after }, { $set: { [b.field]: b.before } });
      if (r.modifiedCount) restored++; else { skipped++; console.error('skip (changed since):', b.coll, String(b._id), b.field); }
    }
    console.log(JSON.stringify({ restored, skipped }));
    return mongoose.disconnect();
  }

  // 1. Find every doc and field that holds an AppX URL.
  const hits = []; // { coll, _id, field, value, urls, folder }
  for (const t of TARGETS) {
    const cursor = db.collection(t.coll).find(t.filter || {}, { projection: Object.fromEntries(t.fields.map((f) => [f, 1])) });
    for await (const doc of cursor) {
      for (const field of t.fields) {
        const urls = urlsIn(doc[field]);
        if (urls.size) hits.push({ coll: t.coll, _id: doc._id, field, value: doc[field], urls: [...urls], folder: t.folder });
      }
    }
  }

  // 2. One entry per (folder, source URL).
  const sources = new Map();
  for (const h of hits) for (const u of h.urls) {
    const k = h.folder + '\t' + u;
    if (!sources.has(k)) sources.set(k, { src: u, folder: h.folder, refs: [] });
    sources.get(k).refs.push(`${h.coll}:${h._id}:${h.field}`);
  }
  for (const s of sources.values()) {
    s.source = await get(s.src);
    s.ok = s.source.status === 200 && /^image\//.test(s.source.type || '') && s.source.bytes > 0;
    s.target = predictedTarget(s.src, s.folder);
  }

  const byColl = {};
  for (const h of hits) byColl[h.coll] = (byColl[h.coll] || 0) + 1;
  const list = [...sources.values()];
  const summary = {
    mode: COMMIT ? 'COMMIT' : 'DRY RUN',
    fieldsToRewrite: byColl,
    sourceUrls: list.length,
    sourcesReadable: list.filter((s) => s.ok).length,
    sourcesNotReadable: list.filter((s) => !s.ok).map((s) => ({ src: s.src.slice(0, 140), ...s.source, refs: s.refs })),
  };

  if (!COMMIT) {
    console.log(JSON.stringify({ summary, sources: list.map((s) => ({ src: s.src, ok: s.ok, status: s.source.status, type: s.source.type, bytes: s.source.bytes, target: s.target, refs: s.refs })) }, null, 1));
    return mongoose.disconnect();
  }

  // 3. Upload, then prove the new URL serves the same bytes.
  const { uploadAssetFromUrlDeduped } = require(path.join(process.cwd(), 'dist/src/config/s3Upload.js'));
  const mapByFolder = new Map();
  for (const s of list) {
    if (!s.ok) continue;
    try {
      const url = await uploadAssetFromUrlDeduped(s.src, s.folder);
      const check = await get(url);
      if (check.status !== 200 || check.sha1 !== s.source.sha1) throw new Error(`new url check failed: ${check.status} sha1 ${check.sha1} vs ${s.source.sha1}`);
      s.uploaded = url;
      if (!mapByFolder.has(s.folder)) mapByFolder.set(s.folder, new Map());
      mapByFolder.get(s.folder).set(s.src, url);
    } catch (e) { s.uploadError = String(e.message || e); console.error('upload failed:', s.src, s.uploadError); }
  }

  // 4. Back up, then compare-and-set each field.
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const backup = [];
  for (const h of hits) {
    const after = replaceIn(h.value, mapByFolder.get(h.folder) || new Map());
    if (EJSON.stringify(after) !== EJSON.stringify(h.value)) backup.push({ coll: h.coll, _id: h._id, field: h.field, before: h.value, after });
  }
  const backupPath = path.join(OUT_DIR, 'before.json');
  fs.writeFileSync(backupPath, EJSON.stringify(backup, null, 1), { mode: 0o600 });
  let written = 0, raced = 0;
  for (const b of backup) {
    const r = await db.collection(b.coll).updateOne({ _id: b._id, [b.field]: b.before }, { $set: { [b.field]: b.after } });
    if (r.modifiedCount) written++; else { raced++; console.error('skip (changed since read):', b.coll, String(b._id), b.field); }
  }
  fs.writeFileSync(path.join(OUT_DIR, 'sources.json'), JSON.stringify(list, null, 1));
  console.log(JSON.stringify({ summary, uploaded: list.filter((s) => s.uploaded).length, uploadFailed: list.filter((s) => s.uploadError).length,
    fieldsWritten: written, fieldsSkipped: raced, backup: backupPath, restore: `RESTORE=${backupPath} node - < vidyagram-appx-image-rehost.cjs` }, null, 1));
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
