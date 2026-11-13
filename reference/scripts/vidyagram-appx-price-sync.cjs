// Vidyagram: keep course prices in step with AppX (user, 2026-11-09: "we should keep the prices in sync with appx").
// Dry run by default. --commit writes; --undo <backup.json> restores what a commit changed. Refuses any DB but vidyagramdb.
//
// Source: price and enable from AppX's live CMS course list (2 paced calls, needs the maintained session; LIVE=0 reads the
// mirror instead and then skips captures older than MAX_AGE_H, 48). MRP comes from the course's last done capture, used only
// while that capture's price equals the live one (else no MRP: price = selling price, no strike-through).
// Rules are the importer's (apxCourseStatusSync.priceFieldsFor, ADR-0009):
//   AppX price > 0  → Course.discountPrice = price, Course.price = mrp when higher else price, isFree false, apxPrice = price;
//                     every live plan that sells this course gets amount = price: plans listing it next to placeholder
//                     courses only (no AppX id), the plan named exactly as the course. Course-selling courses are left to
//                     their form and to vidyagram-appx-length-plans.cjs.
//   AppX -10 (free) → price 0, discountPrice 0, isFree true.   -1 (stopped selling) → off sale.   -3 → apxPrice only.
//   AppX enable 0 or price -1 → Course.status 0 (off sale; buyers keep access, inactive-course-keeps-buyer-access).
// Never: puts a course back on sale, touches a plan's status, writes a course on the course-selling form (Course.selling;
// the form owns its plans), or writes a field a live Bulk Sale holds. Those are listed as skipped. Second lengths
// (Access Duration Based Pricing) are reported only: the length switch is off until course-selling task 01.
//
// Run from the nightly checkout on test-uday (nvm PATH as in vidyagram-nightly-gcp-run.sh):
//   cd <nightly checkout> && node - [--commit | --undo <file>] < vidyagram-appx-price-sync.cjs   (LIVE=0: mirror only)
// The backup goes to ~/vidyagram-price-sync-backup-<stamp>.json on the box (mode 600). Ledger the commit in prod-data-changes.
require('dotenv').config({ path: '.env.development', quiet: true });
const fs = require('fs');
const mongoose = require('mongoose');

const args = process.argv.slice(2);
const COMMIT = args.includes('--commit');
const UNDO = args.includes('--undo') ? args[args.indexOf('--undo') + 1] : null;
const MAX_AGE_H = Number(process.env.MAX_AGE_H || 48);
const str = (v) => (v === null || v === undefined ? '' : String(v).trim());
const num = (v) => { const n = Number(String(v ?? '').replace(/[^\d.-]/g, '')); return str(v) === '' || !Number.isFinite(n) ? null : n; };
const out = (o) => console.log(JSON.stringify(o));

const priceFieldsFor = (apxPrice, apxMrp) => {
  const set = { apxPrice };
  if (apxPrice > 0) { set.price = apxMrp !== null && apxMrp > apxPrice ? apxMrp : apxPrice; set.discountPrice = apxPrice; set.isFree = false; }
  else if (apxPrice === -10) { set.price = 0; set.discountPrice = 0; set.isFree = true; }
  else if (apxPrice === -1) set.isFree = false;
  return set;
};

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: 'vidyagramdb', autoIndex: false, autoCreate: false, ...(COMMIT || UNDO ? {} : { readPreference: 'secondaryPreferred' }) });
  try {
    const db = mongoose.connection.db;
    if (db.databaseName !== 'vidyagramdb') throw new Error('wrong db');
    const coursesC = db.collection('courses');
    const plansC = db.collection('plans');

    if (UNDO) {
      const backup = JSON.parse(fs.readFileSync(UNDO, 'utf8'));
      let n = 0;
      for (const b of backup.courses) { await coursesC.updateOne({ _id: new mongoose.Types.ObjectId(b._id) }, b.unset.length ? { $set: b.before, $unset: Object.fromEntries(b.unset.map((k) => [k, ''])) } : { $set: b.before }); n += 1; }
      for (const b of backup.plans) { await plansC.updateOne({ _id: new mongoose.Types.ObjectId(b._id) }, { $set: { amount: b.amount } }); n += 1; }
      out({ undone: n, from: UNDO });
      return;
    }

    const all = (c, f = {}, p = {}) => db.collection(c).find(f, { projection: p }).toArray();
    let liveById = null;
    if (process.env.LIVE !== '0') {
      require('ts-node/register/transpile-only');
      const { createHttpCatalogSource } = require(process.cwd() + '/src/services/apx/apxCatalogHttpSource');
      const source = createHttpCatalogSource({ db, customerId: '781', orgId: '2177599', tenantApiBase: 'https://armathsapi.akamai.net.in', gapMs: 1000, studentGapMs: 1000 });
      const rows = [];
      for (let s = 0; ; s += 100) { const p = await source.courseListPage(s, 100); rows.push(...p.rows); if (p.rows.length < 100) break; }
      if (rows.length < 100) throw new Error(`live AppX list has only ${rows.length} courses: refusing`);
      liveById = new Map(rows.map((r) => [str(r.id), r]));
      out({ liveAppxCourses: rows.length });
    }
    const runs = new Map((await all('apxnightlysyncruns', { customerId: '781' }, { startedAt: 1 })).map((r) => [String(r._id), r.startedAt]));
    const mirror = await all('apxcatalogcourses', { customerId: '781', 'capture.status': 'done' }, { apxCourseId: 1, listRow: 1, detail: 1, 'capture.runId': 1, 'capture.finishedAt': 1 });
    const courses = await all('courses', { apxCourseId: { $exists: true, $nin: [null, ''] } }, { apxCourseId: 1, title: 1, status: 1, price: 1, discountPrice: 1, apxPrice: 1, isFree: 1, selling: 1 });
    const byApx = new Map(courses.map((c) => [str(c.apxCourseId), c]));
    const plans = await all('plans', { status: 1 }, { name: 1, amount: 1, course: 1, courseSale: 1, ebook: 1, packages: 1, duration: 1 });
    const placeholders = new Set((await all('courses', { $or: [{ apxCourseId: { $exists: false } }, { apxCourseId: null }, { apxCourseId: '' }] }, { _id: 1 })).map((x) => String(x._id)));
    const liveSales = new Set((await all('bulksales', { $or: [{ state: 'running' }, { state: 'pending', endDate: { $gt: new Date() } }] }, { _id: 1 })).map((s) => String(s._id)));
    const held = new Set();
    for (const s of await all('bulksaleplansnapshots', { status: { $in: ['captured', 'applied'] } }, { bulkSaleId: 1, planId: 1, field: 1 })) {
      if (liveSales.has(String(s.bulkSaleId))) held.add(`${s.planId}:${s.field}`);
    }

    const backup = { at: new Date().toISOString(), courses: [], plans: [] };
    const totals = {};
    const tally = (k) => { totals[k] = (totals[k] || 0) + 1; };
    for (const m of mirror) {
      const id = str(m.apxCourseId); const c = byApx.get(id); const d = m.detail || {};
      if (!c) continue;
      const at = m.capture?.finishedAt || runs.get(str(m.capture?.runId));
      const fresh = at && Date.now() - new Date(at).getTime() <= MAX_AGE_H * 3600e3;
      const live = liveById ? liveById.get(id) : null;
      if (liveById && !live) { tally('skipped: not in the live AppX list'); continue; }
      if (!liveById && !fresh) { tally('skipped: capture too old'); out({ apxCourseId: id, title: c.title, skipped: `capture ${str(m.capture?.runId)} older than ${MAX_AGE_H} h` }); continue; }
      const enable = str(live ? live.enable : d.enable ?? m.listRow?.enable);
      const apxPrice = num(live ? live.price : d.price ?? m.listRow?.price);
      const apxMrp = live && num(d.price) !== apxPrice ? null : num(d.mrp);
      if (apxPrice === null) { tally('skipped: no AppX price'); continue; }

      const target = priceFieldsFor(apxPrice, apxMrp);
      if ((enable === '0' || apxPrice === -1) && c.status !== 0) target.status = 0;
      const skipped = [];
      if (enable === '1' && apxPrice !== -1 && c.status === 0) skipped.push('AppX sells it, ours off sale: left off (never put back on sale)');
      for (const f of Object.keys(target)) if (held.has(`${c._id}:${f}`)) { skipped.push(`course.${f} held by a live Bulk Sale`); delete target[f]; }
      const set = Object.fromEntries(Object.entries(target).filter(([k, v]) => c[k] !== v));

      // The plans that sell this course: course-selling plans, plans listing it next to placeholder courses only (Courses
      // with no AppX id, which the AppX order import put on many own plans), and the plan named exactly as the course.
      // A test series or ebook on such a plan is part of what AppX's price buys.
      const sells = apxPrice > 0 ? plans.filter((p) => {
        if (p.courseSale) return String(p.courseSale.courseId) === String(c._id);
        const list = (p.course || []).map(String);
        if (!list.includes(String(c._id))) return false;
        return list.every((x) => x === String(c._id) || placeholders.has(x)) || str(p.name) === str(c.title);
      }) : [];
      const planSet = [];
      for (const p of sells) {
        if (num(p.amount) === apxPrice) continue;
        if (held.has(`${p._id}:amount`)) { skipped.push(`plan ${p._id} amount held by a live Bulk Sale`); continue; }
        planSet.push(p);
      }
      if (c.selling && (Object.keys(set).length || planSet.length)) {
        tally('skipped: on the course-selling form');
        out({ apxCourseId: id, title: c.title, skipped: 'on the course-selling form: change the price there', wouldSet: set, plans: planSet.map((p) => ({ plan: String(p._id), amount: [p.amount, apxPrice] })) });
        continue;
      }
      if (!Object.keys(set).length && !planSet.length) { tally(skipped.length ? 'in sync, with notes' : 'in sync'); if (skipped.length) out({ apxCourseId: id, title: c.title, notes: skipped }); continue; }

      tally('changed');
      out({ apxCourseId: id, title: c.title, course: Object.fromEntries(Object.entries(set).map(([k, v]) => [k, [c[k] ?? null, v]])), plans: planSet.map((p) => ({ plan: String(p._id), name: p.name, days: p.duration, courses: (p.course || []).length, packages: (p.packages || []).length, ebook: (p.ebook || []).length, amount: [p.amount, String(apxPrice)] })), notes: skipped });
      if (COMMIT) {
        const before = {}; const unset = [];
        for (const k of Object.keys(set)) { if (k in c) before[k] = c[k]; else unset.push(k); }
        backup.courses.push({ _id: String(c._id), apxCourseId: id, before, unset, set });
        for (const p of planSet) backup.plans.push({ _id: String(p._id), courseId: String(c._id), amount: p.amount, to: String(apxPrice) });
      }
    }

    if (COMMIT && (backup.courses.length || backup.plans.length)) {
      const file = `${process.env.HOME}/vidyagram-price-sync-backup-${backup.at.replace(/[:.]/g, '-')}.json`;
      fs.writeFileSync(file, JSON.stringify(backup, null, 1));
      fs.chmodSync(file, 0o600);
      out({ backup: file });
      const now = new Date();
      for (const b of backup.courses) await coursesC.updateOne({ _id: new mongoose.Types.ObjectId(b._id) }, { $set: { ...b.set, updatedAt: now } });
      for (const b of backup.plans) await plansC.updateOne({ _id: new mongoose.Types.ObjectId(b._id), status: 1 }, { $set: { amount: b.to, updatedAt: now } });
    }
    out({ mode: COMMIT ? 'commit' : 'dry run', totals, liveBulkSales: liveSales.size, coursesWritten: COMMIT ? backup.courses.length : 0, plansWritten: COMMIT ? backup.plans.length : 0 });
  } finally { await mongoose.disconnect(); }
})().catch((e) => { console.error(String(e.stack || e.message).replace(/https?:\/\/\S+/g, '[url]')); process.exitCode = 1; });
