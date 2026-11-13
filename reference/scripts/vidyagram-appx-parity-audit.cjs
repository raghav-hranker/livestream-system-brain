// Read-only, refuses any DB but vidyagramdb: is everything in AppX in Vidyagram? Walks the planner's view of every course in
// the live AppX list, from each course's last done capture, and traces each item to its Class or Pdf and its course placement.
// Prints totals by outcome, one line per course with a gap, the AppX courses with no Course and what they hold, and stranded
// purchases. The full per-item gap list goes to OUT (default ~/vidyagram-appx-parity-gaps.json, on the box).
// Needs a live maintained session. Run from the nightly checkout on test-uday:
//   cd /home/raghav/vidyagram-nightly-20261019 && nice -n 10 node --max-old-space-size=3072 - < vidyagram-appx-parity-audit.cjs
require('dotenv').config({ path: '.env.development', quiet: true });
require('ts-node/register/transpile-only');
const fs = require('fs');
const mongoose = require('mongoose');
const root = process.cwd() + '/src/services/apx/';
const { createHttpCatalogSource } = require(root + 'apxCatalogHttpSource');
const { loadMirrorCourses } = require(root + 'apxCatalogMirrorReader');
const { planCatalogue } = require(root + 'apxCatalogPlanner');

const OUT = process.env.OUT || `${process.env.HOME}/vidyagram-appx-parity-gaps.json`;
const CUSTOMER = '781';
const bump = (m, k, n = 1) => { m[k] = (m[k] || 0) + n; return m; };
const short = (s) => JSON.stringify(String(s ?? '')).slice(0, 70);

const videoOutcome = (item, ledger, cls, placed, job) => {
  if (!ledger) return item.noUsableLink ? 'no class: AppX row has no usable link' : 'no class: not in import ledger';
  if (!ledger.classId) return item.noUsableLink ? 'no class: AppX row has no usable link' : 'no class: ledger row without class';
  if (!cls) return 'no class: ledger points at a missing Class';
  if (!placed) return 'class exists, not placed in this course';
  if (cls.isYoutubeRedirect) return 'ok: placed, YouTube';
  if (cls.hlsAsset) return 'ok: placed, video in our storage';
  if (item.kind === 'VIDEO_MP4') return 'placed, MP4 not copied';
  return `placed, no video: job ${job ? job.status : 'none'}`;
};

const pdfOutcome = (ledger, placed) => {
  if (!ledger) return 'no pdf: not in import ledger';
  if (ledger.status !== 'done' || !ledger.pdfId) return `no pdf: ledger ${ledger.status}`;
  return placed ? 'ok: pdf placed' : 'pdf exists, not placed in this course';
};

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: 'vidyagramdb', readPreference: 'secondaryPreferred', autoIndex: false, autoCreate: false });
  try {
    const db = mongoose.connection.db;
    if (db.databaseName !== 'vidyagramdb') throw new Error('wrong db');

    const source = createHttpCatalogSource({ db, customerId: CUSTOMER, orgId: '2177599', tenantApiBase: 'https://armathsapi.akamai.net.in', gapMs: 1000, studentGapMs: 1000 });
    const live = [];
    for (let s = 0; ; s += 100) { const p = await source.courseListPage(s, 100); live.push(...p.rows); if (p.rows.length < 100) break; }
    const liveById = new Map(live.map((r) => [String(r.id), r]));

    const { inputs } = await loadMirrorCourses(db, { customerId: CUSTOMER, runId: null, courseIds: [...liveById.keys()] });
    const { plans } = planCatalogue(inputs);
    const planById = new Map(plans.map((p) => [String(p.course.apxCourseId), p]));
    const runs = bump({}, 'x', 0); delete runs.x;
    for (const i of inputs) bump(runs, String(i.runId ?? i.capture?.runId ?? 'unknown'));
    console.log('AppX live', live.length, '| with a done capture', plans.length, '| no done capture:', JSON.stringify([...liveById.keys()].filter((k) => !planById.has(k))));

    const courses = await db.collection('courses').find({}, { projection: { apxCourseId: 1, title: 1, status: 1 } }).toArray();
    const courseByApx = new Map(courses.filter((c) => c.apxCourseId).map((c) => [String(c.apxCourseId), c]));

    const ledgerByKey = new Map((await db.collection('apxcatalogimports').find({ customerId: CUSTOMER }, { projection: { assetKey: 1, classId: 1 } }).toArray()).map((l) => [l.assetKey, l]));
    const pdfBySource = new Map();
    for (const l of await db.collection('apxcatalogpdfimports').find({ customerId: CUSTOMER }, { projection: { status: 1, pdfId: 1, sources: 1 } }).toArray()) {
      for (const s of l.sources || []) pdfBySource.set(`${s.apxCourseId}:${s.rowId}`, l);
    }
    const classes = new Map((await db.collection('classes').find({}, { projection: { isYoutubeRedirect: 1, hlsAsset: 1 } }).toArray()).map((c) => [String(c._id), c]));
    const jobs = new Map((await db.collection('apxingestjobs').find({}, { projection: { classId: 1, status: 1 } }).toArray()).map((j) => [String(j.classId), j]));
    const placedClass = new Set((await db.collection('courseclasses').find({}, { projection: { course: 1, class: 1 } }).toArray()).map((p) => `${p.course}:${p.class}`));
    const placedPdf = new Set((await db.collection('coursepdfs').find({}, { projection: { course: 1, pdf: 1 } }).toArray()).map((p) => `${p.course}:${p.pdf}`));

    const totals = {};
    const totalsInactive = {};
    const perCourse = [];
    const gaps = [];
    const noCourse = [];
    for (const [id, row] of liveById) {
      const plan = planById.get(id);
      const course = courseByApx.get(id);
      const tally = {};
      for (const item of plan ? plan.items : []) {
        const isPdf = item.kind === 'PDF';
        let outcome;
        if (isPdf) {
          const l = pdfBySource.get(`${id}:${item.rowId}`);
          outcome = pdfOutcome(l, course && l?.pdfId ? placedPdf.has(`${course._id}:${l.pdfId}`) : false);
        } else {
          const l = ledgerByKey.get(item.assetKey);
          const cid = l?.classId ? String(l.classId) : null;
          outcome = videoOutcome(item, l, cid && classes.get(cid), course && cid ? placedClass.has(`${course._id}:${cid}`) : false, cid && jobs.get(cid));
        }
        bump(item.active ? totals : totalsInactive, `${isPdf ? 'PDF' : 'VIDEO'} | ${outcome}`);
        if (item.active) bump(tally, outcome);
        if (!outcome.startsWith('ok')) gaps.push({ apxCourseId: id, rowId: item.rowId, kind: item.kind, active: item.active, title: item.apxTitle, path: (item.path || []).join(' > '), host: item.urlHost, outcome });
      }
      const active = plan ? plan.counts.active : 0;
      const bad = Object.entries(tally).filter(([k]) => !k.startsWith('ok'));
      if (!course) noCourse.push({ id, row, plan, tally });
      else if (bad.length) perCourse.push({ id, status: course.status, enable: row.enable, active, bad });
    }

    console.log('\nACTIVE items in AppX, by outcome:');
    for (const [k, v] of Object.entries(totals).sort()) console.log(' ', v, k);
    console.log('\nDISABLED-in-AppX items, by outcome:');
    for (const [k, v] of Object.entries(totalsInactive).sort()) console.log(' ', v, k);
    console.log('\nUnfiled + AppX-unavailable + excluded across plans:', JSON.stringify(plans.reduce((m, p) => { bump(m, 'unfiled', p.counts.unfiled); bump(m, 'appxUnavailable', p.counts.appxUnavailable); for (const e of p.excluded) bump(m, `excluded: ${e.reason}`); return m; }, {})));

    console.log('\nCOURSES WITH GAPS in active items (course status, AppX enable, active items, gaps):', perCourse.length);
    for (const c of perCourse.sort((a, b) => Number(a.id) - Number(b.id))) console.log(' ', c.id, 'st', c.status, 'en', c.enable, 'items', c.active, JSON.stringify(Object.fromEntries(c.bad)), short(liveById.get(c.id).title));

    console.log('\nAPPX COURSES WITH NO COURSE:', noCourse.length);
    const planDocs = await db.collection('plans').find({}, { projection: { name: 1, title: 1, status: 1, isActive: 1, courses: 1 } }).toArray();
    let stranded = null;
    try {
      stranded = await db.collection('apx_orders_new').aggregate([
        { $match: { processed: { $ne: true }, item_type: 'Digital Products' } },
        { $group: { _id: { $toString: '$item_id' }, n: { $sum: 1 } } },
      ], { maxTimeMS: 90000 }).toArray();
    } catch (e) { console.log('stranded order count failed:', e.codeName || e.message); }
    const strandedBy = new Map((stranded || []).map((s) => [s._id, s.n]));
    for (const { id, row, plan, tally } of noCourse) {
      const t = String(row.title || '').trim().toLowerCase();
      const plansSame = planDocs.filter((p) => [p.name, p.title].some((x) => String(x || '').trim().toLowerCase() === t));
      console.log(' ', id, 'en', row.enable, 'price', row.price, short(row.title),
        '| captured', Boolean(plan), '| active', plan ? plan.counts.active : '-', 'inactive', plan ? plan.counts.inactive : '-',
        '| kinds', plan ? JSON.stringify(plan.items.reduce((m, i) => bump(m, i.kind), {})) : '-',
        '| samePlans', plansSame.length, '| strandedOrders', stranded ? strandedBy.get(id) || 0 : '?');
    }
    if (stranded) {
      const known = stranded.filter((s) => !courseByApx.has(s._id)).sort((a, b) => b.n - a.n);
      console.log('\nUnprocessed Digital Products orders with no Course, by item_id:', JSON.stringify(known.map((s) => [s._id, s.n])));
      console.log('Unprocessed Digital Products orders whose Course exists:', stranded.filter((s) => courseByApx.has(s._id)).reduce((n, s) => n + s.n, 0));
    }

    fs.writeFileSync(OUT, JSON.stringify(gaps));
    fs.chmodSync(OUT, 0o600);
    console.log('\nItem gaps written:', gaps.length, OUT);
  } finally { await mongoose.disconnect(); }
})().catch((e) => { console.error(String(e.stack || e.message).replace(/https?:\/\/\S+/g, '[url]')); process.exitCode = 1; });
