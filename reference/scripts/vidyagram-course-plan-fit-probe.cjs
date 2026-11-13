// Read-only. Refuses any DB but vidyagramdb. Answers "can the course form own its plan?": for active courses, how many
// single-course plans sell each one, whether their days match the course validity label, whether prices agree, and
// which plan features those plans use. Run on webserver2-2 from the Vidyagram checkout:
// node -r dotenv/config - dotenv_config_path=.env.development < script   (DETAIL=1 lists the course titles)
const mongoose = require('mongoose');

const ids = v => (Array.isArray(v) ? v.map(String) : []);
const num = v => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const tally = (arr, key) => arr.reduce((m, x) => { const k = key(x); m[k] = (m[k] || 0) + 1; return m; }, {});

function validityDays(label) {
  const s = String(label || '').trim();
  if (!s) return { kind: 'blank' };
  if (/lifetime/i.test(s)) return { kind: 'lifetime' };
  if (/^end date/i.test(s)) return { kind: 'endDate' };
  const m = s.match(/^(\d+)\s*(day|month|year)/i);
  if (!m) return { kind: 'unparsed' };
  const factor = { day: 1, month: 30, year: 365 }[m[2].toLowerCase()];
  return { kind: 'set', days: Number(m[1]) * factor };
}

(async () => {
  await mongoose.connect(process.env.MONGO_URI || process.env.URI, { serverSelectionTimeoutMS: 8000, readPreference: 'secondaryPreferred' });
  const db = mongoose.connection.db;
  if (db.databaseName !== 'vidyagramdb') throw new Error('refusing: connected to ' + db.databaseName);

  const courses = await db.collection('courses').find({ status: 1 }, { projection: {
    title: 1, price: 1, discountPrice: 1, mrp: 1, validity: 1, isFree: 1, isCombo: 1, 'builder.enabled': 1,
  } }).toArray();
  const plans = await db.collection('plans').find({}, { projection: {
    name: 1, status: 1, amount: 1, discountPrice: 1, priceIOS: 1, duration: 1, course: 1, ebook: 1, packages: 1,
    practiceBatch: 1, batchCourse: 1, displayOn: 1, exchangeToPlanIds: 1, upgradationEnabled: 1, upgradationPlanIds: 1,
    inAppPurchaseProductId: 1, couponId: 1, image: 1, pointer: 1, createdAt: 1,
  } }).toArray();

  const single = p => ids(p.course).length === 1
    && !ids(p.ebook).length && !ids(p.packages).length && !ids(p.practiceBatch).length && !ids(p.batchCourse).length;
  const singlesActive = plans.filter(p => p.status === 1 && single(p));
  const singlesByCourse = new Map();
  for (const p of singlesActive) {
    const c = ids(p.course)[0];
    singlesByCourse.set(c, [...(singlesByCourse.get(c) || []), p]);
  }

  const orders = await db.collection('orders').aggregate([
    { $match: { planId: { $in: [...plans.map(p => p._id), ...plans.map(p => String(p._id))] } } },
    { $group: { _id: { $toString: '$planId' }, n: { $sum: 1 } } },
  ], { allowDiskUse: true }).toArray();
  const orderCount = new Map(orders.map(o => [o._id, o.n]));

  const out = { activeCourses: courses.length, plansTotal: plans.length, activePlans: plans.filter(p => p.status === 1).length };
  out.activeSingleCoursePlans = singlesActive.length;
  out.singleCoursePlansOnInactiveCourses = singlesActive.filter(p => !courses.some(c => String(c._id) === ids(p.course)[0])).length;

  const rows = courses.map(c => {
    const sellers = singlesByCourse.get(String(c._id)) || [];
    const validity = validityDays(c.validity);
    const shown = num(c.discountPrice) > 0 ? num(c.discountPrice) : num(c.price);
    return {
      title: c.title, shown, validity, sellers, isFree: !!c.isFree, isCombo: !!c.isCombo, builder: !!(c.builder && c.builder.enabled),
      durations: [...new Set(sellers.map(p => num(p.duration)))],
      amounts: [...new Set(sellers.map(p => num(p.amount)))],
    };
  });

  out.courseBySingleCoursePlanCount = tally(rows, r => (r.sellers.length >= 3 ? '3+' : String(r.sellers.length)));
  out.coursesFree = rows.filter(r => r.isFree).length;
  out.coursesIsCombo = rows.filter(r => r.isCombo).length;
  out.coursesBuilderOn = rows.filter(r => r.builder).length;
  out.validityLabelKinds = tally(rows, r => r.validity.kind);

  const multi = rows.filter(r => r.sellers.length > 1);
  out.multiPlan = {
    courses: multi.length,
    differentDurations: multi.filter(r => r.durations.length > 1).length,
    sameDurationDifferentPrice: multi.filter(r => r.durations.length === 1 && r.amounts.length > 1).length,
    identical: multi.filter(r => r.durations.length === 1 && r.amounts.length === 1).length,
  };

  const one = rows.filter(r => r.sellers.length === 1);
  out.onePlan = {
    courses: one.length,
    cardPriceEqualsPlanAmount: one.filter(r => r.shown === r.amounts[0]).length,
    labelDaysWithin5PctOfPlan: one.filter(r => r.validity.kind === 'set' && Math.abs(r.validity.days - r.durations[0]) <= r.durations[0] * 0.05).length,
    labelDaysDiffer: one.filter(r => r.validity.kind === 'set' && Math.abs(r.validity.days - r.durations[0]) > r.durations[0] * 0.05).length,
    labelNotDays: one.filter(r => r.validity.kind !== 'set').length,
  };

  out.singlePlanFeatures = {
    displayOn: tally(singlesActive, p => (Array.isArray(p.displayOn) ? [...p.displayOn].sort().join('+') || '(none)' : '(missing)')),
    haveExchangeTo: singlesActive.filter(p => ids(p.exchangeToPlanIds).length).length,
    upgradeOn: singlesActive.filter(p => p.upgradationEnabled).length,
    namedAsUpgradeSource: singlesActive.filter(p => plans.some(t => ids(t.upgradationPlanIds).includes(String(p._id)))).length,
    appleProductId: singlesActive.filter(p => p.inAppPurchaseProductId).length,
    priceIOS: singlesActive.filter(p => num(p.priceIOS) > 0).length,
    planCoupon: singlesActive.filter(p => num(p.couponId) > 0).length,
    discountPriceSet: singlesActive.filter(p => num(p.discountPrice) > 0).length,
    pointerSet: singlesActive.filter(p => p.pointer).length,
    withOrders: singlesActive.filter(p => orderCount.get(String(p._id))).length,
    withoutOrders: singlesActive.filter(p => !orderCount.get(String(p._id))).length,
  };

  const created = plans.filter(p => p.createdAt).sort((a, b) => b.createdAt - a.createdAt).slice(0, 8);
  out.newestPlans = created.map(p => ({ name: p.name, at: p.createdAt.toISOString().slice(0, 10), status: p.status, courses: ids(p.course).length }));

  if (process.env.DETAIL) {
    out.multiPlanDetail = multi.map(r => ({ title: r.title, shown: r.shown, validity: r.validity, plans: r.sellers.map(p => ({ name: p.name, amount: num(p.amount), days: num(p.duration), orders: orderCount.get(String(p._id)) || 0 })) }));
    out.noPlanDetail = rows.filter(r => !r.sellers.length).map(r => ({ title: r.title, shown: r.shown, free: r.isFree, builder: r.builder }));
  }
  console.log(JSON.stringify(out, null, 2));
  await mongoose.disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
