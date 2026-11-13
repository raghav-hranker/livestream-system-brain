#!/usr/bin/env node
// Read-only, counts only: what AppX data landed in quicktricks vs vidyagramdb. Prints collection sizes for AppX mirror
// and target collections, then per-feature field counts on both DBs. Never prints a document or a credential.
// Run on webserver2-2 from the Vidyagram checkout:
//   cd /var/www/backend.vidyagramar.com/vidyagram-backend && node - < apx-import-parity-probe.cjs
const fs = require('fs');
const path = require('path');
const cwd = process.cwd();
const { MongoClient } = require(path.join(cwd, 'node_modules/mongoose')).mongo;
const dotenv = require(path.join(cwd, 'node_modules/dotenv'));

const uri = dotenv.parse(fs.readFileSync(path.join(cwd, '.env.development'))).MONGO_URI;
const MAX_MS = Number(process.env.MAX_MS || 45000);

const TARGETS = /^(apx|users$|orders$|plans$|coupons$|couponusages$|courses$|classes$|courseclasses$|pdfs$|coursepdfs$|ebooks$|testimonials$|packages$|packageseries$|series$|questions$|sections$|topics$|subtopics$|testsectionquestionmaps$|usertestdatas$|scores$|userquestionanswers$|classprogresses$|savedquestions$|facultydetails$|usercoinshistories$|subsessions$)/i;

const FEATURES = [
  ['classes', 'all', {}],
  ['classes', 'apxAssetKey', { apxAssetKey: { $exists: true } }],
  ['classes', 'duration>0', { duration: { $gt: 0 } }],
  ['classes', 'image', { image: { $nin: [null, ''] } }],
  ['classes', 'hlsAsset', { hlsAsset: { $exists: true } }],
  ['classes', 'mp4Recordings', { 'mp4Recordings.0': { $exists: true } }],
  ['classes', 'isYoutubeRedirect', { isYoutubeRedirect: true }],
  ['classes', 'isFree', { isFree: true }],
  ['classes', 'uniqueViewCount>0', { uniqueViewCount: { $gt: 0 } }],
  ['classes', 'pdfAssignments', { 'pdfAssignments.0': { $exists: true } }],
  ['classes', 'apxDurationSeconds', { apxDurationSeconds: { $gt: 0 } }],
  ['courseclasses', 'all', {}],
  ['courseclasses', 'apxTitle', { apxTitle: { $exists: true } }],
  ['courseclasses', 'apxScheduledAt', { apxScheduledAt: { $exists: true } }],
  ['courseclasses', 'startDate', { startDate: { $ne: null } }],
  ['courseclasses', 'isFree', { isFree: true }],
  ['courses', 'all', {}],
  ['courses', 'apxCourseId', { apxCourseId: { $exists: true } }],
  ['courses', 'banner', { banner: { $nin: [null, ''] } }],
  ['pdfs', 'all', {}],
  ['pdfs', 'pdfAsset', { pdfAsset: { $exists: true } }],
  ['coursepdfs', 'all', {}],
  ['ebooks', 'all', {}],
  ['testimonials', 'all', {}],
  ['coupons', 'all', {}],
  ['plans', 'all', {}],
  ['packages', 'all', {}],
  ['packageseries', 'all', {}],
  ['series', 'all', {}],
  ['questions', 'all', {}],
  ['users', 'usersApxId', { usersApxId: { $exists: true } }],
  ['users', 'signup_device', { signup_device: { $exists: true } }],
  ['users', 'password_setup_required', { password_setup_required: true }],
  ['orders', 'all', {}],
  ['orders', 'orderNumber APX-', { orderNumber: /^APX-/ }],
  ['orders', 'orderNumber CM-', { orderNumber: /^CM-/ }],
  ['orders', 'orderNumber OT-', { orderNumber: /^OT-/ }],
  ['classprogresses', 'manualCompleted', { manualCompleted: true }],
  ['classprogresses', 'apxMigrated', { apxMigrated: true }],
  ['usertestdatas', 'all', {}],
  ['scores', 'all', {}],
  ['savedquestions', 'all', {}],
  ['apx_usertest_raw', 'processed', { processed: true }],
  ['apx_user_course_test_detail', 'classProgressSyncedAt', { classProgressSyncedAt: { $exists: true } }],
  ['apx_user_course_test_detail', 'courseTestDetailFetchedAt', { courseTestDetailFetchedAt: { $exists: true } }],
  ['apx_user', 'courseTestDetailFetchedAt', { courseTestDetailFetchedAt: { $exists: true } }],
];

async function sizes(db) {
  const out = {};
  for (const { name } of await db.listCollections({}, { nameOnly: true }).toArray()) {
    if (TARGETS.test(name)) out[name] = await db.collection(name).estimatedDocumentCount();
  }
  return out;
}

async function count(db, coll, filter) {
  if (Object.keys(filter).length === 0) return db.collection(coll).estimatedDocumentCount();
  try {
    return await db.collection(coll).countDocuments(filter, { maxTimeMS: MAX_MS });
  } catch (e) {
    return e.codeName === 'MaxTimeMSExpired' ? 'timeout' : 'error';
  }
}

(async () => {
  const client = new MongoClient(uri, { readPreference: 'secondaryPreferred', serverSelectionTimeoutMS: 15000 });
  await client.connect();
  const names = (await client.db('admin').admin().listDatabases({ nameOnly: true })).databases.map((d) => d.name);
  const qtName = names.find((n) => /^quicktricks(db)?$/i.test(n));
  console.log('databases: qt=%s vg=vidyagramdb', qtName);
  const qt = client.db(qtName);
  const vg = client.db('vidyagramdb');

  const [qs, vs] = [await sizes(qt), await sizes(vg)];
  console.log('\n# collection sizes (estimated): name | qt | vg');
  for (const name of [...new Set([...Object.keys(qs), ...Object.keys(vs)])].sort()) {
    console.log([name, qs[name] ?? '-', vs[name] ?? '-'].join(' | '));
  }

  console.log('\n# feature counts: coll.field | qt | vg');
  for (const [coll, label, filter] of FEATURES) {
    const [a, b] = await Promise.all([count(qt, coll, filter), count(vg, coll, filter)]);
    console.log([`${coll}.${label}`, a, b].join(' | '));
  }
  await client.close();
})().catch((e) => {
  console.error('probe failed:', e.message.replace(/mongodb:\/\/[^\s]+/g, '<uri>'));
  process.exit(1);
});
