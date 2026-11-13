// Vidyagram only. Copies AppX banners (cms.appx.co.in/marketing/sliders) into vidyagramdb.banners, always status inactive,
// so the data is here for an admin to switch on. Students see nothing from this script, and it never changes an
// existing banner.
//   SOURCE=app (default)   App Banners tab, into mobileBannerImage
//   SOURCE=website         Website Banners tab, into bannerImage
//   default    DRY RUN: reads AppX and the DB, prints the plan. No upload, no write.
//   COMMIT=1   re-hosts each image with the backend's uploadAssetFromUrlDeduped (781/banners/<mobile|desktop>/<sha1(url)><ext>),
//              checks the new URL serves the same bytes, inserts, and records the new ids in OUT_DIR/inserted.json.
//   RESTORE=<inserted.json>   deletes exactly those banners, if they are still inactive.
//
// Priorities continue after the highest existing one, in AppX's sort order. A banner links to our course when we have
// it. App banners without a course keep AppX's name in title; website banners always do (their names are their own
// labels). AppX's website links point at AppX's own site, so they are read for the course id and not stored.
// Re-running is safe: a banner already holding the re-hosted image is left alone.
// Run on webserver2-2 from the Vidyagram checkout: SOURCE=website node - < script
//   SOURCE=website COMMIT=1 OUT_DIR=~/vg-appx-website-banners-<date> node - < script
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
const OUT_DIR = process.env.OUT_DIR || path.join(process.env.HOME, `vg-appx-banners-${new Date().toISOString().slice(0, 10)}`);
const CMS = 'https://cms.appx.co.in';
const ORG_ID = '2177599';
const CUSTOMER_ID = 781;
const DB_NAME = 'vidyagramdb';
const COURSE_BANNER = '7';
const TITLE_MAX = 100; // Banner.title maxLength
const SOURCES = {
  app: {
    route: 'slider/get_all_sliders',
    field: 'mobileBannerImage',
    folder: '781/banners/mobile',
    image: (row) => row.ImageLink,
    name: (row) => row.item_name,
    apxCourseId: (row) => (String(row.TypeFlag) === COURSE_BANNER ? String(row.Item_id) : null),
    alwaysTitle: false,
  },
  website: {
    route: 'website_slider/get_all_website_sliders',
    field: 'bannerImage',
    folder: '781/banners/desktop',
    image: (row) => row.image_link,
    name: (row) => row.name,
    apxCourseId: (row) => (String(row.connected_link || '').match(/\/new-courses\/(\d+)/) || [])[1] || null,
    alwaysTitle: true,
  },
};
const SOURCE = SOURCES[process.env.SOURCE || 'app'];
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36';

async function appxBanners(sessionId) {
  const body = new URLSearchParams({ draw: '1', start: '0', length: '500', 'search[value]': '', 'order[0][column]': '4', 'order[0][dir]': 'asc', enable: '', app_category: '' });
  ['Sr_no', 'ImageLink_a', 'item_type', 'item_name', 'sortingparam', 'action_button'].forEach((c, i) => body.append(`columns[${i}][data]`, c));
  const r = await axios.post(`${CMS}/${SOURCE.route}`, body.toString(), {
    headers: {
      Cookie: `apx-aside-collapse=1; ci_session=${sessionId}`, 'User-Agent': UA, Referer: `${CMS}/marketing/sliders`,
      'X-Requested-With': 'XMLHttpRequest', 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    },
    maxRedirects: 0, validateStatus: () => true, httpsAgent: new https.Agent({ family: 4 }), timeout: 30000,
  });
  const rows = r.data && r.data.aaData;
  if (r.status !== 200 || !Array.isArray(rows)) throw new Error(`AppX list failed: HTTP ${r.status}; the stored session may be dead`);
  if (rows.length !== Number(r.data.iTotalRecords)) throw new Error(`AppX returned ${rows.length} of ${r.data.iTotalRecords} rows`);
  return rows;
}

// App rows carry the sort value inside a button's HTML, website rows as a plain number.
const appxOrder = (row) => Number((String(row.sortingparam).match(/value="([^"]+)"/) || [])[1] ?? row.sortingparam);

function rehostedUrl(sourceUrl) {
  const ext = path.extname(new URL(sourceUrl).pathname).toLowerCase();
  const hash = crypto.createHash('sha1').update(sourceUrl).digest('hex');
  return `${process.env.R2_MIGRATION_PUBLIC_BASE_URL}/${SOURCE.folder}/${hash}${ext}`;
}

async function rehost(sourceUrl, expected) {
  const { uploadAssetFromUrlDeduped } = require(path.join(process.cwd(), 'dist/src/config/s3Upload.js'));
  const url = await uploadAssetFromUrlDeduped(sourceUrl, SOURCE.folder);
  if (url !== expected) throw new Error(`re-host URL ${url} differs from the plan`);
  const get = (u) => axios.get(u, { responseType: 'arraybuffer', timeout: 60000, headers: { 'User-Agent': UA } });
  const md5 = (r) => crypto.createHash('md5').update(Buffer.from(r.data)).digest('hex');
  const [source, target] = await Promise.all([get(sourceUrl), get(url)]);
  if (md5(source) !== md5(target)) throw new Error(`re-hosted bytes differ from AppX for ${sourceUrl}`);
}

(async () => {
  if (!SOURCE) throw new Error('SOURCE must be app or website');
  if (!process.env.R2_MIGRATION_PUBLIC_BASE_URL) throw new Error('R2_MIGRATION_PUBLIC_BASE_URL is not set; run from the Vidyagram checkout on the box');
  const conn = await mongoose.createConnection(process.env.MONGO_URI, { dbName: DB_NAME, serverSelectionTimeoutMS: 20000, readPreference: 'primary' }).asPromise();
  if (conn.db.databaseName !== DB_NAME) throw new Error(`refusing database ${conn.db.databaseName}`);
  const banners = conn.db.collection('banners');
  try {
    if (RESTORE) {
      const { inserted } = EJSON.parse(fs.readFileSync(RESTORE, 'utf8'));
      const res = await banners.deleteMany({ _id: { $in: inserted }, status: 'inactive', customer_id: CUSTOMER_ID });
      console.log(`restored: ${res.deletedCount} of ${inserted.length} banners deleted`);
      return;
    }
    const session = await conn.db.collection('apxsessions').findOne({ orgId: ORG_ID, customerId: String(CUSTOMER_ID), isActive: true }, { projection: { session_id: 1 } });
    if (!session) throw new Error('no active AppX session');
    const rows = await appxBanners(session.session_id);
    rows.sort((a, b) => appxOrder(a) - appxOrder(b) || Number(a.id) - Number(b.id));
    const courses = await conn.db.collection('courses').find({ apxCourseId: { $in: rows.map(SOURCE.apxCourseId).filter(Boolean) } }, { projection: { apxCourseId: 1, title: 1 } }).toArray();
    const courseByApx = new Map(courses.map((c) => [String(c.apxCourseId), c]));
    const existing = await banners.find({ customer_id: CUSTOMER_ID }, { projection: { [SOURCE.field]: 1, priority: 1 } }).toArray();
    const held = new Set(existing.map((b) => b[SOURCE.field]));
    let rank = Math.max(0, ...existing.map((b) => b.priority || 0));
    const activeBefore = await banners.countDocuments({ status: 'active' });

    const plan = rows.map((row) => {
      const course = courseByApx.get(SOURCE.apxCourseId(row));
      const name = String(SOURCE.name(row) || '').trim();
      const image = rehostedUrl(SOURCE.image(row));
      const doc = {
        ...((SOURCE.alwaysTitle || !course) && name ? { title: name.slice(0, TITLE_MAX) } : {}),
        [SOURCE.field]: image, courseId: course ? course._id : null, classId: null, planId: null, practiceBatchId: null,
        redirectTo: null, externalUrl: null, customer_id: CUSTOMER_ID, status: 'inactive',
        priority: held.has(image) ? null : (rank += 1),
      };
      return { row, doc, image, label: course ? course.title : `${name || '(no name)'} [AppX course ${SOURCE.apxCourseId(row) || 'none'} not linked]` };
    });
    for (const { row, doc, image, label } of plan) {
      console.log(String(doc.priority ?? '-').padStart(3), doc.status, `appx#${row.id}`.padEnd(8), `sort ${appxOrder(row)}`.padEnd(10), `enabled=${row.enable}`, doc.courseId ? 'course' : 'no-link', held.has(image) ? 'ALREADY HERE' : 'new', '|', label.slice(0, 50));
    }
    const todo = plan.filter((p) => !held.has(p.image));
    console.log(`AppX ${rows.length}; new ${todo.length}; linked to a course ${plan.filter((p) => p.doc.courseId).length}; active banners now ${activeBefore}`);
    if (!COMMIT) { console.log('DRY RUN, nothing written.'); return; }

    fs.mkdirSync(OUT_DIR, { recursive: true });
    const ledger = path.join(OUT_DIR, 'inserted.json');
    if (fs.existsSync(ledger)) throw new Error(`${ledger} already exists; use a new OUT_DIR`);
    // Every image is checked before the first insert: one bad image stops the run with nothing written.
    for (const { row, image } of todo) await rehost(SOURCE.image(row), image);
    const inserted = [];
    const now = new Date();
    for (const { doc } of todo) {
      const { insertedId } = await banners.insertOne({ ...doc, createdAt: now, updatedAt: now });
      inserted.push(insertedId);
      fs.writeFileSync(ledger, EJSON.stringify({ inserted }, null, 1));
    }
    const activeAfter = await banners.countDocuments({ status: 'active' });
    if (activeAfter !== activeBefore) throw new Error(`active banners went from ${activeBefore} to ${activeAfter}`);
    console.log(`wrote ${inserted.length} inactive banners; active banners still ${activeAfter}. Undo: RESTORE=${ledger}`);
  } finally {
    await conn.close();
  }
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
