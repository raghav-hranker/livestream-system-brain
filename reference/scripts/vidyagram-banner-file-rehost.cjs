// Re-hosts one course banner from a LOCAL file (for an AppX image whose origin is gone but an edge cache still had it)
// and points the named courses at it. Refuses any DB but vidyagramdb.
//   FILE=<local image> SRC=<old AppX url> COURSES=<id,id> [EXPECT_MD5=<AppX etag>]
//   default    DRY RUN: checks the file (size, JPEG/PNG/GIF magic, md5), the target key (same naming as
//              uploadAssetFromUrlDeduped: 781/courses/banners/<sha1(SRC)><ext>) and that each course's banner is SRC.
//   COMMIT=1   puts the file in the R2 migration bucket (behind assets.hranker.org), checks the public URL serves the same
//              bytes, backs up to OUT_DIR/before.json, then sets banner with a compare-and-set on SRC.
//   RESTORE=<before.json>  puts the old banner back.
// Run on webserver2-2 from the Vidyagram checkout: FILE=… SRC=… COURSES=… node - < script
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(process.cwd(), '.env.development') });
const mongoose = require('mongoose');
const { S3Client, PutObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { EJSON } = mongoose.mongo.BSON;

const { FILE, SRC, COURSES = '', EXPECT_MD5, RESTORE } = process.env;
const COMMIT = process.env.COMMIT === '1';
const OUT_DIR = process.env.OUT_DIR || path.join(process.env.HOME, `vg-banner-file-rehost-${new Date().toISOString().slice(0, 10)}`);
const BUCKET = process.env.R2_MIGRATION_BUCKET_NAME;
const PUBLIC_BASE = (process.env.R2_MIGRATION_PUBLIC_BASE_URL || '').replace(/\/+$/, '');
const MAGIC = [['image/jpeg', 'ffd8ff'], ['image/png', '89504e47'], ['image/gif', '47494638']];

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 8000, readPreference: 'primary' });
  const db = mongoose.connection.db;
  if (db.databaseName !== 'vidyagramdb') throw new Error('refusing: connected to ' + db.databaseName);
  const courses = db.collection('courses');

  if (RESTORE) {
    let restored = 0;
    for (const b of EJSON.parse(fs.readFileSync(RESTORE, 'utf8'))) {
      const r = await courses.updateOne({ _id: b._id, banner: b.after }, { $set: { banner: b.before } });
      if (r.modifiedCount) restored++; else console.error('skip (changed since):', String(b._id));
    }
    console.log(JSON.stringify({ restored }));
    return mongoose.disconnect();
  }

  if (!FILE || !SRC || !COURSES) throw new Error('FILE, SRC and COURSES are required');
  const buf = fs.readFileSync(FILE);
  const md5 = crypto.createHash('md5').update(buf).digest('hex');
  const sha1 = crypto.createHash('sha1').update(buf).digest('hex');
  const type = (MAGIC.find(([, m]) => buf.subarray(0, m.length / 2).toString('hex') === m) || [])[0];
  const ext = path.extname(new URL(SRC).pathname).toLowerCase();
  const key = `781/courses/banners/${crypto.createHash('sha1').update(SRC).digest('hex')}${ext}`;
  const target = `${PUBLIC_BASE}/${key}`;
  const s3 = new S3Client({
    region: process.env.R2_MIGRATION_REGION || 'auto',
    endpoint: process.env.R2_MIGRATION_ENDPOINT,
    credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY },
  });
  let targetExists = false;
  try { await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key })); targetExists = true; } catch (e) { if (e.$metadata?.httpStatusCode !== 404) throw e; }

  const ids = COURSES.split(',').map((s) => new mongoose.Types.ObjectId(s.trim()));
  const docs = await courses.find({ _id: { $in: ids } }, { projection: { title: 1, status: 1, banner: 1 } }).toArray();
  const plan = {
    mode: COMMIT ? 'COMMIT' : 'DRY RUN',
    file: { bytes: buf.length, type, md5, md5MatchesExpected: EXPECT_MD5 ? md5 === EXPECT_MD5 : null },
    bucket: BUCKET, key, target, targetExists,
    courses: ids.map((id) => { const d = docs.find((x) => x._id.equals(id)); return d ? { id: String(id), title: d.title, status: d.status, bannerIsSrc: d.banner === SRC } : { id: String(id), missing: true }; }),
  };
  const ok = type && (!EXPECT_MD5 || md5 === EXPECT_MD5) && plan.courses.every((c) => c.bannerIsSrc);
  plan.ready = Boolean(ok);
  if (!COMMIT || !ok) { console.log(JSON.stringify(plan, null, 1)); return mongoose.disconnect(); }

  await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: buf, ContentType: type }));
  const r = await fetch(target, { signal: AbortSignal.timeout(30000) });
  const served = Buffer.from(await r.arrayBuffer());
  if (r.status !== 200 || crypto.createHash('sha1').update(served).digest('hex') !== sha1) throw new Error(`public url check failed: ${r.status} ${served.length} bytes`);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const backup = ids.map((id) => ({ _id: id, before: SRC, after: target }));
  const backupPath = path.join(OUT_DIR, 'before.json');
  fs.writeFileSync(backupPath, EJSON.stringify(backup, null, 1), { mode: 0o600 });
  let written = 0;
  for (const b of backup) {
    const u = await courses.updateOne({ _id: b._id, banner: b.before }, { $set: { banner: b.after } });
    if (u.modifiedCount) written++; else console.error('skip (changed since read):', String(b._id));
  }
  console.log(JSON.stringify({ ...plan, uploaded: true, written, backup: backupPath }, null, 1));
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
