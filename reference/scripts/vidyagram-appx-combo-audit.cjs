// Read-only, refuses any DB but vidyagramdb. Every AppX combo ("Make this a combo" → Sub Courses = detail.allotment_id,
// which lists the combo itself too) against our side: does the combo have a Course, is it set up as a combo
// (Course.selling.combo), which Plans sell it (by AppX title, or holding the combo's Course), what they hold against AppX's
// sub courses, their price against AppX's, whether they are on sale, and their orders. Each combo gets one case:
//   sold-no-course      AppX sells it (enable 1, price > 0), no Course here: needs a combo course
//   sold-course-no-combo AppX sells it, Course here but not set up with sub courses
//   sold-combo          AppX sells it, Course set up as a combo here
//   stopped-*           AppX does not sell it (enable 0 or price -1/-3), same split
// JSON lines on stdout, then totals. Run from a Vidyagram backend checkout (its .env.development holds MONGO_URI):
//   cd ~/Projects/worktrees/vg-backend && node - < ~/Projects/system-brain/reference/scripts/vidyagram-appx-combo-audit.cjs
require('dotenv').config({ path: '.env.development', quiet: true });
const mongoose = require('mongoose');

const str = (v) => (v === null || v === undefined ? '' : String(v).trim());
const num = (v) => { const n = Number(String(v ?? '').replace(/[^\d.-]/g, '')); return str(v) === '' || !Number.isFinite(n) ? null : n; };
const idList = (v) => str(v).split(',').map((s) => s.trim()).filter((s) => s && s !== '-1');
const key = (s) => str(s).normalize('NFKC').toLowerCase().replace(/\s+/g, ' ');
const out = (o) => console.log(JSON.stringify(o));

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { readPreference: 'secondaryPreferred' });
  try {
    const db = mongoose.connection.db;
    if (db.databaseName !== 'vidyagramdb') throw new Error(`refusing: ${db.databaseName}`);
    const mirror = await db.collection('apxcatalogcourses').find({ customerId: '781' }, { projection: { apxCourseId: 1, detail: 1, listRow: 1, 'capture.runId': 1 } }).toArray();
    const mirrorById = new Map(mirror.map((m) => [str(m.apxCourseId), m]));
    const courses = await db.collection('courses').find({}, { projection: { apxCourseId: 1, title: 1, status: 1, 'selling.combo': 1, 'selling.attached': 1, isCombo: 1, discountPrice: 1 } }).toArray();
    const byApx = new Map(courses.filter((c) => c.apxCourseId).map((c) => [str(c.apxCourseId), c]));
    const byId = new Map(courses.map((c) => [String(c._id), c]));
    const apxOf = (id) => str(byId.get(String(id))?.apxCourseId) || `ours:${String(id).slice(-6)}`;
    const plans = await db.collection('plans').find({}, { projection: { name: 1, status: 1, amount: 1, duration: 1, course: 1, packages: 1, displayOn: 1, courseSale: 1 } }).toArray();
    const ordersOn = async (id) => db.collection('orders').countDocuments({ planId: { $in: [id, String(id)] } }, { maxTimeMS: 30000 }).catch(() => null);
    const since = new Date(Date.now() - 30 * 864e5);
    const recentOn = async (id) => db.collection('orders').countDocuments({ planId: { $in: [id, String(id)] }, createdAt: { $gte: since } }, { maxTimeMS: 30000 }).catch(() => null);

    const totals = {};
    for (const m of mirror) {
      const d = m.detail || {};
      const apx = str(m.apxCourseId);
      const subs = idList(d.allotment_id).filter((x) => x !== apx);
      if (!subs.length) continue;
      const title = str(d.title || m.listRow?.title);
      const enable = str(d.enable ?? m.listRow?.enable);
      const price = num(d.price ?? m.listRow?.price);
      const sold = enable === '1' && price > 0;
      const course = byApx.get(apx);
      const combo = course?.selling?.combo?.on ? course.selling.combo.subCourses.map(apxOf) : null;
      const ourSelling = course?.selling ? 'course selling' : course ? 'course, no selling' : 'no course';
      const sellers = plans.filter((p) => key(p.name) === key(title) || (course && (p.course || []).map(String).includes(String(course._id)) && (p.course || []).length > 1));
      const planRows = [];
      for (const p of sellers) {
        const has = (p.course || []).map(apxOf);
        planRows.push({
          plan: String(p._id), name: str(p.name).slice(0, 50), status: p.status, onSale: p.courseSale ? p.courseSale.onSale !== false : Array.isArray(p.displayOn) ? p.displayOn.length > 0 : true,
          amount: num(p.amount), days: p.duration, orders: await ordersOn(p._id), last30d: await recentOn(p._id),
          missing: subs.filter((s) => !has.includes(s)), extra: has.filter((h) => h !== apx && !subs.includes(h)), packages: (p.packages || []).length,
        });
      }
      const caseName = `${sold ? 'sold' : 'stopped'}-${!course ? 'no-course' : combo ? 'combo' : 'course-no-combo'}`;
      totals[caseName] = (totals[caseName] || 0) + 1;
      out({
        apxCourseId: apx, case: caseName, title: title.slice(0, 60),
        appx: { enable, price, mrp: num(d.mrp), validity: `${str(d.validity)} ${str(d.validity_type)}`, folder: str(d.parent_id), subCourses: subs.join(','), deleted: str(d.deleted) === '1', classes: m.capture ? undefined : 'never captured' },
        subsWithoutCourse: subs.filter((s) => !byApx.has(s)).map((s) => `${s} ${str(mirrorById.get(s)?.detail?.title).slice(0, 30)}`),
        ours: { course: course ? { id: String(course._id), status: course.status, card: course.discountPrice, setup: ourSelling, subCourses: combo, isCombo: !!course.isCombo } : null },
        plans: planRows,
      });
    }
    out({ totals });
  } finally { await mongoose.disconnect(); }
})().catch((e) => { console.error(String(e.message).replace(/mongodb(\+srv)?:\/\/\S+/g, '[uri]')); process.exitCode = 1; });
