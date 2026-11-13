// Vidyagram only. Copies each AppX course's Links tab (cms.appx.co.in/paid_course4/overview/<id>?tab=3) into
// vidyagramdb courses.doubtGroupLink. Never overwrites a link already set.
//   default    DRY RUN: reads AppX (one course per GAP_MS, default 1000) and the DB, saves every AppX row to
//              OUT_DIR/appx-links.json, prints the plan. No DB write.
//   COMMIT=1   sets doubtGroupLink where the plan has one link, and records each course in OUT_DIR/applied.json.
//   PICKS='{"119":"<AppX link row id>"}'   picks the row for a course with several usable links.
//   SKIP=66,71   AppX course ids to leave out.
//   RESTORE=<applied.json>   clears exactly those courses, if each still holds the imported link.
//
// A link is usable when its row is enabled and it is https://t.me/... or https://telegram.me/..., which is what the
// course form accepts. updatedAt is left alone so nothing re-sorts.
// Run on webserver2-2 from the Vidyagram checkout: OUT_DIR=~/vg-appx-telegram-<date> node - < script
const path = require('path');
const fs = require('fs');
const https = require('https');
const { createRequire } = require('module');

const cwdRequire = createRequire(path.join(process.cwd(), 'noop.js'));
cwdRequire('dotenv').config({ path: path.join(process.cwd(), '.env.development') });
const mongoose = cwdRequire('mongoose');
const axios = cwdRequire('axios');

const COMMIT = process.env.COMMIT === '1';
const RESTORE = process.env.RESTORE;
const PICKS = JSON.parse(process.env.PICKS || '{}');
const SKIP = new Set(String(process.env.SKIP || '').split(',').map((s) => s.trim()).filter(Boolean));
const GAP_MS = Number(process.env.GAP_MS || 1000);
const OUT_DIR = process.env.OUT_DIR || path.join(process.env.HOME, `vg-appx-telegram-${new Date().toISOString().slice(0, 10)}`);
const CMS = 'https://cms.appx.co.in';
const ORG_ID = '2177599';
const CUSTOMER_ID = '781';
const DB_NAME = 'vidyagramdb';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36';
const USABLE = /^https:\/\/(t|telegram)\.me\/\S+$/;
const agent = new https.Agent({ family: 4 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function appxLinks(sessionId, apxId) {
  const body = new URLSearchParams({ draw: '1', start: '0', length: '100', 'search[value]': '', 'order[0][column]': '0', 'order[0][dir]': 'desc', course_id: String(apxId) });
  ['image_ai', 'group_name', 'sortingparam', 'action_button'].forEach((c, i) => body.append(`columns[${i}][data]`, c));
  const r = await axios.post(`${CMS}/telegram/get_telegram_by_foldercourseid`, body.toString(), {
    headers: {
      Cookie: `apx-aside-collapse=1; ci_session=${sessionId}`, 'User-Agent': UA, Referer: `${CMS}/paid_course4/overview/${apxId}?tab=3`,
      'X-Requested-With': 'XMLHttpRequest', 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    },
    maxRedirects: 0, validateStatus: () => true, httpsAgent: agent, timeout: 30000,
  });
  const rows = r.data && r.data.aaData;
  if (r.status !== 200 || !Array.isArray(rows)) throw new Error(`AppX course ${apxId}: HTTP ${r.status}; the stored session may be dead`);
  if (rows.length !== Number(r.data.iTotalRecords)) throw new Error(`AppX course ${apxId}: got ${rows.length} of ${r.data.iTotalRecords} rows`);
  return rows.map((x) => ({ id: String(x.id), name: x.group_name, link: String(x.link || '').trim(), status: String(x.status) }));
}

function decide(course, rows) {
  const enabled = rows.filter((x) => x.status === '1');
  const usable = enabled.filter((x) => USABLE.test(x.link));
  const other = rows.filter((x) => !usable.includes(x));
  if (SKIP.has(String(course.apxCourseId))) return { kind: 'skipped', other };
  if (!rows.length) return { kind: 'no-links', other };
  if (course.doubtGroupLink) return { kind: 'already-set', other };
  const pick = PICKS[String(course.apxCourseId)];
  if (pick) {
    const row = usable.find((x) => x.id === String(pick));
    if (!row) throw new Error(`PICKS: course ${course.apxCourseId} has no usable row ${pick}`);
    return { kind: 'set', link: row.link, row, other };
  }
  if (usable.length === 1) return { kind: 'set', link: usable[0].link, row: usable[0], other };
  if (usable.length > 1) {
    const distinct = [...new Set(usable.map((x) => x.link))];
    if (distinct.length === 1) return { kind: 'set', link: distinct[0], row: usable[0], other };
    return { kind: 'several', usable, other };
  }
  return { kind: 'none-usable', other };
}

(async () => {
  const conn = await mongoose.createConnection(process.env.MONGO_URI, { dbName: DB_NAME, serverSelectionTimeoutMS: 20000, readPreference: 'primary' }).asPromise();
  if (conn.db.databaseName !== DB_NAME) throw new Error(`refusing database ${conn.db.databaseName}`);
  const coursesCol = conn.db.collection('courses');
  try {
    if (RESTORE) {
      const { applied } = JSON.parse(fs.readFileSync(RESTORE, 'utf8'));
      let cleared = 0;
      for (const a of applied) {
        const res = await coursesCol.updateOne({ _id: new mongoose.Types.ObjectId(a.courseId), doubtGroupLink: a.link }, { $set: { doubtGroupLink: null } });
        cleared += res.modifiedCount;
      }
      console.log(`restored: ${cleared} of ${applied.length} courses cleared`);
      return;
    }
    const session = await conn.db.collection('apxsessions').findOne({ orgId: ORG_ID, customerId: CUSTOMER_ID, isActive: true }, { projection: { session_id: 1 } });
    if (!session) throw new Error('no active AppX session');
    const courses = await coursesCol.find({ apxCourseId: { $nin: [null, ''] } }, { projection: { apxCourseId: 1, title: 1, status: 1, doubtGroupLink: 1 } }).toArray();
    courses.sort((a, b) => Number(a.apxCourseId) - Number(b.apxCourseId));
    console.log(`our courses with an AppX id: ${courses.length}`);

    fs.mkdirSync(OUT_DIR, { recursive: true });
    const plan = [];
    for (const course of courses) {
      const rows = await appxLinks(session.session_id, course.apxCourseId);
      plan.push({ course, rows, ...decide(course, rows) });
      await sleep(GAP_MS);
    }
    fs.writeFileSync(path.join(OUT_DIR, 'appx-links.json'), JSON.stringify(plan.map((p) => ({ apxCourseId: p.course.apxCourseId, courseId: p.course._id, title: p.course.title, status: p.course.status, kind: p.kind, rows: p.rows })), null, 1));

    const short = (c) => `apx ${String(c.apxCourseId).padEnd(4)} status ${String(c.status).padEnd(2)} ${String(c.title).slice(0, 60)}`;
    const rowText = (x) => `    row ${x.id} status=${x.status} ${JSON.stringify(x.name)} ${x.link}`;
    const count = (k) => plan.filter((p) => p.kind === k).length;
    for (const kind of ['set', 'several', 'none-usable', 'already-set']) {
      const group = plan.filter((p) => p.kind === kind);
      if (group.length) console.log(`\n== ${kind} (${group.length})`);
      for (const p of group) {
        console.log(short(p.course));
        if (kind === 'set') console.log(`    -> ${p.link} (${JSON.stringify(p.row.name)})`);
        if (kind === 'several') p.usable.forEach((x) => console.log(rowText(x)));
        if (kind === 'none-usable' || kind === 'already-set') p.rows.forEach((x) => console.log(rowText(x)));
        if (kind === 'set' && p.other.length) p.other.forEach((x) => console.log(`  also${rowText(x)}`));
      }
    }
    console.log(`\ncourses ${plan.length}; skipped ${count('skipped')}; no links ${count('no-links')}; to set ${count('set')}; several ${count('several')}; none usable ${count('none-usable')}; already set ${count('already-set')}`);
    console.log(`saved AppX rows: ${path.join(OUT_DIR, 'appx-links.json')}`);
    if (!COMMIT) { console.log('DRY RUN, nothing written.'); return; }

    const ledger = path.join(OUT_DIR, 'applied.json');
    if (fs.existsSync(ledger)) throw new Error(`${ledger} already exists; use a new OUT_DIR`);
    const applied = [];
    for (const p of plan.filter((x) => x.kind === 'set')) {
      const res = await coursesCol.updateOne({ _id: p.course._id, doubtGroupLink: { $in: [null, ''] } }, { $set: { doubtGroupLink: p.link } });
      if (res.modifiedCount === 1) {
        applied.push({ courseId: String(p.course._id), apxCourseId: p.course.apxCourseId, link: p.link });
        fs.writeFileSync(ledger, JSON.stringify({ applied }, null, 1));
      }
    }
    console.log(`wrote ${applied.length} links. Undo: RESTORE=${ledger}`);
  } finally {
    await conn.close();
  }
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
