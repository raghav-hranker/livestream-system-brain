// Vidyagram: a course AppX sells at several lengths (Access Duration Based Pricing) is sold here on one plan per length,
// through course selling (Course.selling.options → syncCoursePlans), the same path the admin course form takes.
// User, 2026-11-09: "add the course to both plans … a plan builds via courses itself, based on duration".
// Dry run by default; --commit writes; --only <apxCourseId> (repeatable) limits it. Refuses any DB but vidyagramdb.
//
// Source: the AppX mirror's last done capture, refused when older than MAX_AGE_H (30) (detail.enable_pricing_plan +
// price_planningData, options with status 0 or no price dropped). Handled here: a course AppX sells (enable 1, price > 0)
// at 2+ priced lengths, or at one when the Course is already on course selling (its one option follows AppX's price,
// MRP and validity); and a course on course selling that AppX stopped selling (enable 0 or price -1) goes off sale
// (status 0; plans off sale, never status 0). Our Course must be Active, not free and not on the Course Builder; a course
// is never put back on sale. Single-length courses not on course selling are vidyagram-appx-price-sync.cjs's. Options are ordered AppX's own price first, so the card keeps
// showing what AppX shows; each option gets AppX's price, MRP (blank when not above the price) and validity.
// Our side, per course:
//   already on course selling → its options are replaced, keeping the id of an option whose days match (its plan stays).
//   one single-course plan    → that plan is adopted as the option whose days match its duration (courseSale written,
//                                the connect step's write), so its orders stay on it; the other lengths get new plans.
//   no plan                   → selling is written fresh; every length gets a new plan.
//   anything else             → skipped and listed (several single-course plans, a plan whose days match no length).
// Plans are named the course title (the AppX order importer matches by name), shown on the course page only.
// Backup: ~/vidyagram-length-plans-backup-<stamp>.json (course fields + adopted plans as read, created plan ids).
//
// Run from a vidyagram-admin backend checkout (course selling deployed 11-07), MONGO_URI = prod rs0 in its .env.development:
//   APP_ROOT=~/Projects/worktrees/vg-backend node reference/scripts/vidyagram-appx-length-plans.cjs [--commit] [--only 101]
const path = require('path');
const fs = require('fs');
const os = require('os');

const APP_ROOT = path.resolve(process.env.APP_ROOT || '.');
const args = process.argv.slice(2);
const COMMIT = args.includes('--commit');
const ONLY = args.flatMap((a, i) => (a === '--only' ? [String(args[i + 1])] : []));
const MAX_AGE_H = Number(process.env.MAX_AGE_H || 30);
process.env.DURATION_PRICING_ENABLED = 'on'; // the local branch guards lengths; the deployed one has no guard
process.env.DISABLE_CRONS = 'true';
require(path.join(APP_ROOT, 'node_modules/dotenv')).config({ path: path.join(APP_ROOT, '.env.development'), quiet: true });
process.env.TS_NODE_PROJECT = path.join(APP_ROOT, 'tsconfig.json');
process.env.TS_NODE_TRANSPILE_ONLY = 'true';
require(path.join(APP_ROOT, 'node_modules/ts-node')).register({ transpileOnly: true, project: process.env.TS_NODE_PROJECT });
const src = (p) => require(path.join(APP_ROOT, 'src', p));
const mongoose = require(path.join(APP_ROOT, 'node_modules/mongoose'));
src('services/audit/register');
const { runAs } = src('services/audit/requestContext');
const Course = src('models/Course').default;
const Plans = src('models/Plans').default;
const { sellingSchema, plansForCourse, courseFieldsFromSelling } = src('services/courseSelling/plans');
const { syncCoursePlans, applySellingToCourse, planChanges } = src('services/courseSelling/sync');
const { daysFromValidity } = src('services/courseSelling/price');
const { comboSubCourseIssues } = src('services/courseSelling/combo');

const str = (v) => (v === null || v === undefined ? '' : String(v).trim());
const num = (v) => { const n = Number(String(v ?? '').replace(/[^\d.-]/g, '')); return str(v) === '' || !Number.isFinite(n) ? null : n; };
const out = (o) => console.log(JSON.stringify(o));
const UNIT = { DAY: 'Days', DAYS: 'Days', MONTH: 'Months', MONTHS: 'Months', YEAR: 'Years', YEARS: 'Years' };
const ids = (v) => (Array.isArray(v) ? v.map(String) : []);
const near = (a, b) => Math.abs(Number(a) - Number(b)) <= 3;

const appxOptions = (d) => {
  if (str(d.enable_pricing_plan) !== '1') return [];
  let raw = [];
  try { raw = typeof d.price_planningData === 'string' ? JSON.parse(d.price_planningData) : d.price_planningData || []; } catch { raw = []; }
  if (!Array.isArray(raw)) return [];
  const opts = raw.filter((o) => str(o.status) !== '0' && num(o.price) > 0 && num(o.validity) > 0 && UNIT[str(o.validity_type).toUpperCase()])
    .map((o) => {
      const price = num(o.price); const mrp = num(o.mrp);
      const validity = { n: num(o.validity), unit: UNIT[str(o.validity_type).toUpperCase()] };
      return { price, mrp: mrp !== null && mrp > price ? mrp : null, validity, days: daysFromValidity(validity) };
    });
  const header = num(d.price);
  return [...opts.filter((o) => o.price === header), ...opts.filter((o) => o.price !== header)];
};

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI, { autoIndex: false, autoCreate: false, readPreference: 'primary' });
  const db = mongoose.connection.db;
  if (db.databaseName !== 'vidyagramdb') throw new Error(`refusing: connected to ${db.databaseName}`);
  try {
    const mirror = await db.collection('apxcatalogcourses').find({ customerId: '781', 'capture.status': 'done' }, { projection: { apxCourseId: 1, detail: 1, 'capture.runId': 1, 'capture.finishedAt': 1 } }).toArray();
    const runStarted = new Map((await db.collection('apxnightlysyncruns').find({ customerId: '781' }, { projection: { startedAt: 1 } }).toArray()).map((r) => [String(r._id), r.startedAt]));
    const placeholders = new Set((await db.collection('courses').find({ $or: [{ apxCourseId: { $exists: false } }, { apxCourseId: null }, { apxCourseId: '' }] }, { projection: { _id: 1 } }).toArray()).map((c) => String(c._id)));
    const backup = { at: new Date().toISOString(), courses: [] };
    const totals = {};
    const tally = (k) => { totals[k] = (totals[k] || 0) + 1; };
    for (const m of mirror) {
      const apx = str(m.apxCourseId); const d = m.detail || {};
      if (ONLY.length && !ONLY.includes(apx)) continue;
      let options = appxOptions(d);
      const sellable = str(d.enable) === '1' && num(d.price) > 0;
      if (options.length < 2 && !sellable && !(str(d.enable) === '0' || num(d.price) === -1)) continue;
      const course = await Course.findOne({ apxCourseId: apx });
      // AppX combo ("Make this a combo" → Sub Courses = allotment_id, which lists the combo itself too): its sub courses
      // that have a Course here. Unknown ones are skipped and listed; the order sync adds them once their Course exists.
      const subApx = str(d.allotment_id).split(',').map((x) => x.trim()).filter((x) => x && x !== '-1' && x !== apx);
      const subCourses = [];
      const subsMissing = [];
      for (const s of subApx) { const sc = await Course.findOne({ apxCourseId: s }).select('_id').lean(); if (sc) subCourses.push(String(sc._id)); else subsMissing.push(s); }
      // Single-length AppX courses are the price sync's, unless on course selling or a combo: then here.
      if (options.length < 2 && !course?.selling && !subCourses.length) continue;
      const at = m.capture?.finishedAt || runStarted.get(str(m.capture?.runId));
      if (!at || Date.now() - new Date(at).getTime() > MAX_AGE_H * 3600e3) { tally('skip: capture too old'); out({ apxCourseId: apx, skip: `capture ${str(m.capture?.runId)} older than ${MAX_AGE_H} h` }); continue; }
      if (!sellable) {
        // AppX stopped selling it (enable 0 or price -1): off sale here. Status 0 only; the sync takes its plans off sale
        // and never sets a plan's status, so buyers keep access. A course is never put back on sale from here.
        if (!course || !course.selling || course.status !== 1) { tally('skip: AppX does not sell it'); continue; }
        tally('off sale (AppX stopped selling)');
        out({ apxCourseId: apx, title: course.title, case: 'off sale', appx: { enable: str(d.enable), price: num(d.price) } });
        if (COMMIT) {
          backup.courses.push({ courseId: String(course._id), apx, before: { status: course.status, selling: course.selling }, offSale: true });
          fs.writeFileSync(backupFile, JSON.stringify(backup, null, 1)); fs.chmodSync(backupFile, 0o600);
          course.status = 0;
          await course.save();
          out({ apxCourseId: apx, written: await syncCoursePlans(course), status: 0 });
        }
        continue;
      }
      if (options.length < 2) {
        const validity = { n: num(d.validity), unit: UNIT[str(d.validity_type).toUpperCase()] };
        if (!(validity.n > 0) || !validity.unit) { tally('skip: AppX validity unreadable'); continue; }
        const price = num(d.price); const mrp = num(d.mrp);
        options = [{ price, mrp: mrp !== null && mrp > price ? mrp : null, validity, days: daysFromValidity(validity) }];
      }
      const base = { apxCourseId: apx, title: course?.title, capture: m.capture?.runId, appx: options.map((o) => `${o.validity.n} ${o.validity.unit} ₹${o.price}${o.mrp ? ` (MRP ${o.mrp})` : ''}`) };
      if (!course) { tally('skip: no Course'); out({ ...base, skip: 'no Course' }); continue; }
      if (course.status !== 1 || course.isFree || course.builder?.enabled) { tally('skip: course not Active / free / builder'); out({ ...base, skip: `status ${course.status}, free ${!!course.isFree}, builder ${!!course.builder?.enabled}` }); continue; }

      const linked = await Plans.find({ 'courseSale.courseId': course._id }).lean();
      // Plans that sell this course today outside course selling: single-course plans, and plans that list it next to
      // placeholder courses only (Courses with no AppX id; the AppX order import put one, ₹12–46, first on many own plans).
      const title = str(course.title);
      const candidates = (await Plans.find({ status: 1, courseSale: { $exists: false } }).lean())
        .filter((p) => ids(p.course).includes(String(course._id)) || str(p.name) === title)
        .filter((p) => !ids(p.ebook).length && !ids(p.packages).length && (
          ids(p.course).filter((x) => x !== String(course._id)).every((x) => placeholders.has(x))
          // A combo's own plan: named as the combo and holding its sub courses (the order sync made it before the Course).
          || (subCourses.length > 0 && str(p.name) === title && subCourses.every((x) => ids(p.course).includes(x)))));
      const stored = course.selling && Array.isArray(course.selling.options) ? course.selling.options : [];
      let ids0 = options.map((o) => stored.find((x) => x.validity?.n && near(daysFromValidity(x.validity), o.days))?.id || null);
      // One AppX length and one stored option: the same option (and plan) takes AppX's price and validity.
      if (options.length === 1 && stored.length === 1 && !ids0[0]) ids0[0] = stored[0].id;
      const adopt = [];
      const unmatched = [];
      const notes = [];
      for (const p of candidates) {
        const idx = options.findIndex((o) => near(o.days, p.duration));
        if (course.selling && idx >= 0 && ids0[idx]) { notes.push(`plan ${p._id} (${p.duration} d, ₹${p.amount}) also sells it, outside course selling: left alone`); continue; }
        if (idx < 0) { unmatched.push(`${p._id} (${p.duration} d, ₹${p.amount})`); continue; }
        if (adopt.some((a) => a.idx === idx)) { unmatched.push(`${p._id} (second plan for ${options[idx].validity.n} ${options[idx].validity.unit})`); continue; }
        adopt.push({ idx, plan: p });
        ids0[idx] = `p${p._id}`; // its own key: (courseId, key) is unique, so a plan made earlier for this length is the one turned off
      }
      if (unmatched.length) { tally('skip: plan(s) match no AppX length'); out({ ...base, skip: `plans selling it match no AppX length or share one: ${unmatched.join(', ')}` }); continue; }
      const kase = course.selling ? (adopt.length ? 'on course selling, adopt plan' : 'on course selling') : adopt.length ? 'adopt its plan' : 'no plan';
      const used = new Set(ids0.filter(Boolean));
      const optionIds = ids0.map((id, i) => {
        if (id) return id;
        let candidate = `appx-${options[i].validity.n}${options[i].validity.unit[0].toLowerCase()}`;
        while (used.has(candidate)) candidate += 'x';
        used.add(candidate); return candidate;
      });
      const parsed = sellingSchema.safeParse({
        ...(course.selling || {}),
        options: options.map((o, i) => ({ id: optionIds[i], price: o.price, mrp: o.mrp, validity: o.validity })),
        allowPayment: course.selling ? course.selling.allowPayment !== false : true,
        // AppX's sub courses; a removal is the sync's call (it holds removals while anyone owns the course).
        ...(subCourses.length ? { combo: { on: true, subCourses } } : {}),
      });
      if (!parsed.success) { tally('skip: selling would not parse'); out({ ...base, skip: `selling would not parse: ${parsed.error.issues[0]?.message}` }); continue; }
      const selling = parsed.data;
      const comboIssues = subCourses.length ? await comboSubCourseIssues(String(course._id), selling, course.selling ?? null) : [];
      if (comboIssues.length) { tally('skip: combo check failed'); out({ ...base, skip: `combo: ${comboIssues.map((i) => i.message).join('; ')}` }); continue; }
      const desired = plansForCourse({ ...course.toObject(), _id: course._id, selling }); // Course.toObject drops _id
      const keyOf = (idx) => `main:${optionIds[idx]}`;
      const plansNow = [...linked, ...adopt.map((a) => ({ ...a.plan, courseSale: { courseId: course._id, key: keyOf(a.idx), onSale: true } }))];
      const planRows = desired.filter((p) => p.key.startsWith('main:')).map((p) => {
        const twins = plansNow.filter((x) => String(x.courseSale?.key) === p.key);
        const twin = twins.find((x) => adopt.some((a) => String(a.plan._id) === String(x._id))) || twins[0];
        return { key: p.key, amount: p.fields.amount, mrp: p.fields.mrp, days: p.fields.duration, plan: twin ? String(twin._id) : 'new', changes: twin ? planChanges(twin, p) : null };
      });
      const unchanged = course.selling && JSON.stringify(course.selling.options) === JSON.stringify(selling.options) && JSON.stringify(course.selling.combo ?? null) === JSON.stringify(selling.combo ?? null);
      if (unchanged && planRows.every((r) => r.plan !== 'new' && !Object.keys(r.changes || {}).length)) { tally('in sync'); continue; }
      tally(kase);
      out({ ...base, case: kase, notes, subCourses: subApx.filter((x) => !subsMissing.includes(x)).join(','), subsMissing, adopt: adopt.map((a) => `${a.plan._id} → ${optionIds[a.idx]}`), course: Object.fromEntries(Object.entries(courseFieldsFromSelling(selling)).map(([k, v]) => [k, [course[k] ?? null, v]])), plans: planRows });

      if (COMMIT) {
        backup.courses.push({ courseId: String(course._id), apx, before: { selling: course.selling ?? null, price: course.price ?? null, discountPrice: course.discountPrice ?? null, validity: course.validity ?? null }, adoptedPlans: adopt.map((a) => a.plan), linkedBefore: linked.map((p) => String(p._id)) });
        fs.writeFileSync(backupFile, JSON.stringify(backup, null, 1)); fs.chmodSync(backupFile, 0o600);
        for (const a of adopt) await Plans.updateOne({ _id: a.plan._id, courseSale: { $exists: false } }, { $set: { courseSale: { courseId: course._id, key: keyOf(a.idx), onSale: true } } });
        course.selling = selling;
        course.markModified('selling');
        await applySellingToCourse(course);
        await course.save();
        const result = await syncCoursePlans(course);
        const after = await Plans.find({ 'courseSale.courseId': course._id }).lean();
        backup.courses[backup.courses.length - 1].createdPlans = after.map((p) => String(p._id)).filter((id) => !linked.some((l) => String(l._id) === id) && !adopt.some((a) => String(a.plan._id) === id));
        fs.writeFileSync(backupFile, JSON.stringify(backup, null, 1));
        out({ apxCourseId: apx, written: result, course: { price: course.price, discountPrice: course.discountPrice, validity: course.validity }, plans: after.map((p) => ({ plan: String(p._id), key: p.courseSale?.key, amount: p.amount, days: p.duration, status: p.status, onSale: p.courseSale?.onSale })) });
      }
    }
    out({ mode: COMMIT ? 'commit' : 'dry run', totals, backup: COMMIT && backup.courses.length ? backupFile : null });
  } finally { await mongoose.disconnect(); }
};
const backupFile = path.join(os.homedir(), `vidyagram-length-plans-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);

runAs('script:vidyagram-appx-length-plans', run).catch((e) => { console.error(String(e.stack || e.message).replace(/mongodb(\+srv)?:\/\/\S+/g, '[uri]').replace(/https?:\/\/\S+/g, '[url]')); process.exitCode = 1; });
