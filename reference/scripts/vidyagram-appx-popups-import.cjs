// Vidyagram only. Copies AppX pop-ups (cms.appx.co.in/marketing/sliders, tab 3) into vidyagramdb.inappbanners,
// always status inactive, so the data is here for an admin to switch on. Students see nothing from this script.
//   default    DRY RUN: reads AppX and the DB, prints the plan. No upload, no write.
//   COMMIT=1   re-hosts each image with the backend's uploadAssetFromUrlDeduped (781/in-app-banners/<sha1(url)><ext>),
//              checks the new URL serves the same bytes, inserts, and records the new ids in OUT_DIR/inserted.json.
//   RESTORE=<inserted.json>   deletes exactly those pop-ups, if they are still inactive.
// Re-running is safe: a pop-up already holding the re-hosted image is left alone.
// Run on webserver2-2 from the Vidyagram checkout: node - < script    COMMIT=1 OUT_DIR=~/vg-appx-popups-<date> node - < script
const path = require('path');
const fs = require('fs');
const https = require('https');
const crypto = require('crypto');
const { createRequire } = require('module');

const cwdRequire = createRequire(path.join(process.cwd(), 'noop.js'));
cwdRequire('dotenv').config({ path: path.join(process.cwd(), '.env.development') });
const mongoose = cwdRequire('mongoose');
const axios = cwdRequire('axios');
const { EJSON } = mongoose.mongo.BSON;

const COMMIT = process.env.COMMIT === '1';
const RESTORE = process.env.RESTORE;
const OUT_DIR = process.env.OUT_DIR || path.join(process.env.HOME, `vg-appx-popups-${new Date().toISOString().slice(0, 10)}`);
const CMS = 'https://cms.appx.co.in';
const ORG_ID = '2177599';
const CUSTOMER_ID = '781';
const DB_NAME = 'vidyagramdb';
const FOLDER = '781/in-app-banners';
const COURSE = '7';
const WEBSITE = '5';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36';

async function appxPopups(sessionId) {
  const body = new URLSearchParams({ draw: '1', start: '0', length: '500', 'search[value]': '', enable: '', app_category: '' });
  const r = await axios.post(`${CMS}/popup_slider/get_all_popup_sliders`, body.toString(), {
    headers: {
      Cookie: `apx-aside-collapse=1; ci_session=${sessionId}`, 'User-Agent': UA, Referer: `${CMS}/marketing/sliders?tab=3`,
      'X-Requested-With': 'XMLHttpRequest', 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    },
    maxRedirects: 0, validateStatus: () => true, httpsAgent: new https.Agent({ family: 4 }), timeout: 30000,
  });
  const rows = r.data && r.data.aaData;
  if (r.status !== 200 || !Array.isArray(rows)) throw new Error(`AppX list failed: HTTP ${r.status}; the stored session may be dead`);
  if (rows.length !== Number(r.data.iTotalRecords)) throw new Error(`AppX returned ${rows.length} of ${r.data.iTotalRecords} rows`);
  return rows;
}

function rehostedUrl(sourceUrl) {
  const ext = path.extname(new URL(sourceUrl).pathname).toLowerCase();
  const hash = crypto.createHash('sha1').update(sourceUrl).digest('hex');
  return `${process.env.R2_MIGRATION_PUBLIC_BASE_URL}/${FOLDER}/${hash}${ext}`;
}

// The record the admin's own form would save (upsertInAppBannerSchema): a course pop-up has courseId and no
// redirectUrl, an external one the reverse.
function toPopup(row, courseIdByApx) {
  const flag = String(row.TypeFlag);
  const title = String(row.title || '').trim().slice(0, 150);
  if (!title) throw new Error(`AppX pop-up ${row.id} has no title`);
  const base = { title, imageUrl: rehostedUrl(row.ImageLink), status: 'inactive', pages: ['home'], classId: null };
  if (flag === COURSE) {
    const courseId = courseIdByApx.get(String(row.Item_id));
    if (!courseId) throw new Error(`AppX pop-up ${row.id}: course ${row.Item_id} is not in Vidyagram`);
    return { ...base, type: 'course', courseId, redirectUrl: null };
  }
  if (flag === WEBSITE) {
    new URL(row.url); // throws on a bad link
    return { ...base, type: 'external', courseId: null, redirectUrl: row.url };
  }
  throw new Error(`AppX pop-up ${row.id}: unknown type ${flag}`);
}

async function rehost(sourceUrl, expected) {
  const { uploadAssetFromUrlDeduped } = require(path.join(process.cwd(), 'dist/src/config/s3Upload.js'));
  const url = await uploadAssetFromUrlDeduped(sourceUrl, FOLDER);
  if (url !== expected) throw new Error(`re-host URL ${url} differs from the plan`);
  const get = (u) => axios.get(u, { responseType: 'arraybuffer', timeout: 60000, headers: { 'User-Agent': UA } });
  const md5 = (r) => crypto.createHash('md5').update(Buffer.from(r.data)).digest('hex');
  const [source, target] = await Promise.all([get(sourceUrl), get(url)]);
  if (md5(source) !== md5(target)) throw new Error(`re-hosted bytes differ from AppX for ${sourceUrl}`);
}

(async () => {
  if (!process.env.R2_MIGRATION_PUBLIC_BASE_URL) throw new Error('R2_MIGRATION_PUBLIC_BASE_URL is not set; run from the Vidyagram checkout on the box');
  const conn = await mongoose.createConnection(process.env.MONGO_URI, { dbName: DB_NAME, serverSelectionTimeoutMS: 20000, readPreference: 'primary' }).asPromise();
  if (conn.db.databaseName !== DB_NAME) throw new Error(`refusing database ${conn.db.databaseName}`);
  const popups = conn.db.collection('inappbanners');
  try {
    if (RESTORE) {
      const { inserted } = EJSON.parse(fs.readFileSync(RESTORE, 'utf8'));
      const res = await popups.deleteMany({ _id: { $in: inserted }, status: 'inactive' });
      console.log(`restored: ${res.deletedCount} of ${inserted.length} pop-ups deleted`);
      return;
    }
    const session = await conn.db.collection('apxsessions').findOne({ orgId: ORG_ID, customerId: CUSTOMER_ID, isActive: true }, { projection: { session_id: 1 } });
    if (!session) throw new Error('no active AppX session');
    const rows = await appxPopups(session.session_id);
    const apxIds = rows.filter((r) => String(r.TypeFlag) === COURSE).map((r) => String(r.Item_id));
    const courses = await conn.db.collection('courses').find({ apxCourseId: { $in: apxIds } }, { projection: { apxCourseId: 1 } }).toArray();
    const courseIdByApx = new Map(courses.map((c) => [String(c.apxCourseId), c._id]));

    // Build all before writing any: one bad row stops the run with nothing written.
    const plan = rows.map((row) => ({ row, popup: toPopup(row, courseIdByApx) }));
    const held = new Set((await popups.find({ imageUrl: { $in: plan.map((p) => p.popup.imageUrl) } }, { projection: { imageUrl: 1 } }).toArray()).map((d) => d.imageUrl));
    const activeBefore = await popups.countDocuments({ status: 'active' });
    for (const { row, popup } of plan) {
      console.log(`appx#${row.id}`.padEnd(8), `enabled=${row.enable}`, popup.status, popup.type.padEnd(8), popup.pages.join(','), held.has(popup.imageUrl) ? 'ALREADY HERE' : 'new', '|', popup.title, '|', popup.redirectUrl || String(popup.courseId));
    }
    console.log(`AppX ${rows.length}; new ${plan.filter((p) => !held.has(p.popup.imageUrl)).length}; active pop-ups in Vidyagram now ${activeBefore}`);
    if (!COMMIT) { console.log('DRY RUN, nothing written.'); return; }

    fs.mkdirSync(OUT_DIR, { recursive: true });
    const ledger = path.join(OUT_DIR, 'inserted.json');
    if (fs.existsSync(ledger)) throw new Error(`${ledger} already exists; use a new OUT_DIR`);
    const todo = plan.filter((p) => !held.has(p.popup.imageUrl));
    for (const { row, popup } of todo) await rehost(row.ImageLink, popup.imageUrl);
    const inserted = [];
    const now = new Date();
    for (const { popup } of todo) {
      const { insertedId } = await popups.insertOne({ singletonKey: new mongoose.Types.ObjectId().toString(), ...popup, createdAt: now, updatedAt: now });
      inserted.push(insertedId);
      fs.writeFileSync(ledger, EJSON.stringify({ inserted }, null, 1));
    }
    const activeAfter = await popups.countDocuments({ status: 'active' });
    if (activeAfter !== activeBefore) throw new Error(`active pop-ups went from ${activeBefore} to ${activeAfter}`);
    console.log(`wrote ${inserted.length} inactive pop-ups; active pop-ups still ${activeAfter}. Undo: RESTORE=${ledger}`);
  } finally {
    await conn.close();
  }
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
