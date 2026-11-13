// Read-only, refuses any DB but vidyagramdb. Course selling drift: every Course with `selling` against the Plans
// its save should have made (services/courseSelling: price.ts, plans.ts, offerRows.ts, combo.ts, attach.ts).
// Checks, per course: one on-sale-or-off main plan per priced option with the option's amount, MRP and days; the
// course first on each main plan's course list; onSale = Status Active + Allow Payment; no stray main plan on sale;
// combo sub courses, inside courses and attached items on every main plan; each add-on / upgrade row's plan on its
// destination with the row's price, days and the source's main plans as its only buyers; the card price fields.
// JSON lines for every problem on stdout, then totals. Run from a Vidyagram backend checkout (.env.development):
//   cd ~/Projects/worktrees/vg-backend && node - < ~/Projects/system-brain/reference/scripts/vidyagram-selling-integrity-probe.cjs
require('dotenv').config({ path: '.env.development', quiet: true });
const mongoose = require('mongoose');

const out = (o) => console.log(JSON.stringify(o));
const ids = (list) => (Array.isArray(list) ? list.map(String) : []);
const days = ({ n, unit }) => (unit === 'Days' ? n : Math.round(n * (unit === 'Months' ? 30.4375 : 365.25)));
const hasPrice = (o) => Number(o.price) > 0;

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { readPreference: 'secondaryPreferred' });
  try {
    const db = mongoose.connection.db;
    if (db.databaseName !== 'vidyagramdb') throw new Error(`refusing: ${db.databaseName}`);
    const courses = await db.collection('courses').find({ selling: { $type: 'object' } },
      { projection: { title: 1, status: 1, isFree: 1, 'builder.enabled': 1, price: 1, discountPrice: 1, selling: 1 } }).toArray();
    const plans = await db.collection('plans').find({ 'courseSale.courseId': { $exists: true } },
      { projection: { name: 1, status: 1, amount: 1, mrp: 1, duration: 1, course: 1, packages: 1, ebook: 1, displayOn: 1, courseSale: 1, upgradationEnabled: 1, upgradationPlanIds: 1, upgradationPrice: 1 } }).toArray();
    const byCourse = new Map();
    for (const p of plans) {
      const k = String(p.courseSale.courseId);
      if (!byCourse.has(k)) byCourse.set(k, []);
      byCourse.get(k).push(p);
    }
    const courseById = new Map(courses.map((c) => [String(c._id), c]));
    const totals = { courses: courses.length, plans: plans.length, mainPlans: 0, offerPlans: 0, problems: 0, byKind: {} };
    const problem = (kind, c, detail) => {
      totals.problems++;
      totals.byKind[kind] = (totals.byKind[kind] || 0) + 1;
      out({ kind, course: String(c._id), title: String(c.title || '').slice(0, 50), status: c.status, ...detail });
    };
    const makesNoPlans = (c) => c.isFree === true || c.builder?.enabled === true;
    const onSale = (c) => Number(c.status) === 1 && c.selling.allowPayment === true;
    const mainPlansOf = (id) => (byCourse.get(id) || []).filter((p) => String(p.courseSale.key).startsWith('main:'));

    for (const c of courses) {
      const id = String(c._id);
      const s = c.selling;
      const options = Array.isArray(s.options) ? s.options : [];
      const priced = options.filter(hasPrice);
      const mine = byCourse.get(id) || [];
      const mains = mine.filter((p) => String(p.courseSale.key).startsWith('main:'));
      totals.mainPlans += mains.length;

      // Plan status must stay 1: most orders get access only through an active plan.
      for (const p of mine) if (Number(p.status) !== 1) problem('plan-status-not-1', c, { plan: String(p._id), key: p.courseSale.key, planStatus: p.status });

      if (makesNoPlans(c)) {
        for (const p of mains) if (p.courseSale.onSale) problem('free-or-builder-plan-on-sale', c, { plan: String(p._id), key: p.courseSale.key });
      } else {
        for (const o of priced) {
          const p = mains.find((m) => m.courseSale.key === `main:${o.id}`);
          if (!p) { problem('missing-main-plan', c, { option: o.id, price: o.price }); continue; }
          if (String(p.amount) !== String(o.price)) problem('amount-differs', c, { plan: String(p._id), planAmount: p.amount, optionPrice: o.price });
          if ((p.mrp ?? null) !== (o.mrp ?? null)) problem('mrp-differs', c, { plan: String(p._id), planMrp: p.mrp ?? null, optionMrp: o.mrp ?? null });
          if (o.validity?.n && Number(p.duration) !== days(o.validity)) problem('duration-differs', c, { plan: String(p._id), planDays: p.duration, optionDays: days(o.validity), validity: o.validity });
          if (ids(p.course)[0] !== id) problem('course-not-first-on-plan', c, { plan: String(p._id), first: ids(p.course)[0] || null });
          if (p.courseSale.onSale !== onSale(c)) problem('on-sale-differs', c, { plan: String(p._id), planOnSale: p.courseSale.onSale, wanted: onSale(c), allowPayment: s.allowPayment });
        }
        const durations = priced.filter((o) => o.validity?.n).map((o) => days(o.validity));
        if (new Set(durations).size !== durations.length) problem('two-options-same-days', c, { durations });
      }
      // A main plan no priced option names should be off sale.
      for (const p of mains) {
        const optionId = String(p.courseSale.key).slice(5);
        if (!priced.some((o) => o.id === optionId) && p.courseSale.onSale) problem('stray-main-plan-on-sale', c, { plan: String(p._id), key: p.courseSale.key, amount: p.amount });
      }

      // Combo and attached items sit on every main plan.
      const combo = s.combo && s.combo.on ? [...ids(s.combo.subCourses), ...ids(s.combo.inside)] : [];
      const att = s.attached && s.attached.on !== false ? s.attached : null;
      for (const p of mains) {
        const have = new Set(ids(p.course));
        const missing = combo.filter((x) => !have.has(x));
        if (missing.length) problem('combo-course-missing-on-plan', c, { plan: String(p._id), missing });
        if (att) {
          const mc = ids(att.courses).filter((x) => !have.has(x));
          const mt = ids(att.tests || att.testSeries || att.packages).filter((x) => !new Set(ids(p.packages)).has(x));
          const mb = ids(att.books || att.ebooks || att.ebook).filter((x) => !new Set(ids(p.ebook)).has(x));
          if (mc.length || mt.length || mb.length) problem('attached-missing-on-plan', c, { plan: String(p._id), courses: mc, tests: mt, books: mb });
        }
      }
      for (const x of combo) {
        if (x === id) problem('combo-holds-itself', c, {});
        const sub = courseById.get(x);
        if (sub && sub.selling?.combo?.on && [...ids(sub.selling.combo.subCourses), ...ids(sub.selling.combo.inside)].includes(id)) problem('combo-loop', c, { with: x });
      }

      // Add-on and upgrade rows: a plan on the destination, sold to this course's owners only.
      for (const [kind, field] of [['addon', 'addons'], ['upgrade', 'upgrades']]) {
        const rows = Array.isArray(s[field]) ? s[field] : [];
        const sourceMainIds = mains.map((m) => String(m._id)).sort();
        for (const row of rows) {
          const p = (byCourse.get(String(row.courseId)) || []).find((x) => x.courseSale.key === `${kind}:${id}`);
          if (makesNoPlans(c)) continue;
          if (!p) { problem(`${kind}-plan-missing`, c, { destination: row.courseId, price: row.price }); continue; }
          totals.offerPlans++;
          if (String(p.amount) !== String(row.price) || Number(p.upgradationPrice) !== Number(row.price)) problem(`${kind}-price-differs`, c, { plan: String(p._id), planAmount: p.amount, upgradationPrice: p.upgradationPrice, rowPrice: row.price });
          if (Number(p.duration) !== days(row.validity)) problem(`${kind}-duration-differs`, c, { plan: String(p._id), planDays: p.duration, rowDays: days(row.validity) });
          if (p.upgradationEnabled !== true) problem(`${kind}-open-to-everyone`, c, { plan: String(p._id), upgradationEnabled: p.upgradationEnabled ?? null });
          const buyers = ids(p.upgradationPlanIds).sort();
          if (p.courseSale.onSale && (buyers.length === 0 || buyers.join() !== sourceMainIds.join())) problem(`${kind}-buyers-differ`, c, { plan: String(p._id), planBuyers: buyers, sourceMainPlans: sourceMainIds });
          if (!ids(p.course).includes(String(row.courseId))) problem(`${kind}-plan-lacks-destination`, c, { plan: String(p._id) });
          if (ids(p.course).includes(id)) problem(`${kind}-plan-holds-source`, c, { plan: String(p._id) });
        }
      }
      // An offer plan keyed to this course whose row is gone should be off sale.
      for (const p of plans) {
        const m = /^(addon|upgrade):([a-f\d]{24})$/i.exec(String(p.courseSale.key));
        if (!m || m[2] !== id) continue;
        const rows = Array.isArray(s[m[1] === 'addon' ? 'addons' : 'upgrades']) ? s[m[1] === 'addon' ? 'addons' : 'upgrades'] : [];
        if (!rows.some((r) => String(r.courseId) === String(p.courseSale.courseId)) && p.courseSale.onSale) problem('offer-plan-on-sale-without-row', c, { plan: String(p._id), key: p.courseSale.key, destination: String(p.courseSale.courseId) });
      }

      // The card price the app and website read.
      if (c.isFree === true) {
        if (Number(c.price) !== 0 || Number(c.discountPrice) !== 0) problem('free-card-price-not-0', c, { price: c.price ?? null, discountPrice: c.discountPrice ?? null });
      } else {
        const first = priced[0];
        const wantDiscount = first ? first.price : 0;
        const wantPrice = !first || s.allowPayment === false ? null : (Number(first.mrp) > 0 ? first.mrp : first.price);
        if ((c.price ?? null) !== wantPrice || Number(c.discountPrice || 0) !== Number(wantDiscount)) problem('card-price-differs', c, { price: c.price ?? null, discountPrice: c.discountPrice ?? null, wantPrice, wantDiscount });
      }
    }
    // A course-made plan whose course has no selling, or is gone.
    for (const p of plans) if (!courseById.has(String(p.courseSale.courseId))) { totals.problems++; totals.byKind['plan-of-unconnected-course'] = (totals.byKind['plan-of-unconnected-course'] || 0) + 1; out({ kind: 'plan-of-unconnected-course', plan: String(p._id), course: String(p.courseSale.courseId), key: p.courseSale.key, onSale: p.courseSale.onSale }); }
    out({ totals });
  } finally {
    await mongoose.disconnect();
  }
})().catch((e) => { console.error(e.message); process.exit(1); });
