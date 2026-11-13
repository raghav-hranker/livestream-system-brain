// Read-only. Refuses any DB but vidyagramdb. Answers "do we need Plans?" with real shape:
// what active plans contain, which courses are sold by several plans and how those plans
// differ, top-selling plans, and orders by month x source x plan size (AppX import = orderNumber APX-*).
// Run on webserver2-2 from the Vidyagram checkout: URI=$MONGO_URI node - < script
const mongoose = require('mongoose');
const len = f => ({ $size: { $cond: [{ $isArray: f }, f, []] } });
const str = id => String(id);

(async () => {
  await mongoose.connect(process.env.URI, { serverSelectionTimeoutMS: 8000, readPreference: 'secondaryPreferred' });
  const db = mongoose.connection.db;
  if (db.databaseName !== 'vidyagramdb') throw new Error('refusing: connected to ' + db.databaseName);
  const out = {};

  const plans = await db.collection('plans').find({}, { projection: {
    title: 1, name: 1, status: 1, amount: 1, discountPrice: 1, priceIOS: 1, inAppPurchaseProductId: 1, duration: 1,
    course: 1, ebook: 1, packages: 1, practiceBatch: 1, batchCourse: 1, couponId: 1, displayOn: 1,
    isExtension: 1, extensionEnabled: 1, upgradationEnabled: 1, isExploreTestSeries: 1, isTopperPass: 1,
    isGrammar: 1, isVocab: 1, isEditorial: 1, unmatchedMigratedItem: 1, createdAt: 1,
  } }).toArray();
  const courses = await db.collection('courses').find({}, { projection: { title: 1, status: 1, price: 1, discountPrice: 1, mrp: 1, validity: 1 } }).toArray();
  const courseById = new Map(courses.map(c => [str(c._id), c]));
  const ids = v => (Array.isArray(v) ? v.map(str) : []);
  const planById = new Map(plans.map(p => [str(p._id), p]));

  // 1. Plan contents and flags
  const active = plans.filter(p => p.status === 1);
  const bucket = n => (n === 0 ? '0' : n === 1 ? '1' : n === 2 ? '2' : n <= 4 ? '3-4' : '5+');
  const tally = (arr, key) => arr.reduce((m, x) => ((m[key(x)] = (m[key(x)] || 0) + 1), m), {});
  out.plansTotal = plans.length;
  out.plansActive = active.length;
  out.activeByCourseCount = tally(active, p => bucket(ids(p.course).length));
  out.inactiveByCourseCount = tally(plans.filter(p => p.status !== 1), p => bucket(ids(p.course).length));
  out.activeWithNonCourseItems = {
    ebook: active.filter(p => ids(p.ebook).length).length,
    packages: active.filter(p => ids(p.packages).length).length,
    practiceBatch: active.filter(p => ids(p.practiceBatch).length).length,
    batchCourse: active.filter(p => ids(p.batchCourse).length).length,
    onlyNonCourse: active.filter(p => !ids(p.course).length && (ids(p.ebook).length || ids(p.packages).length || ids(p.practiceBatch).length)).length,
  };
  const flags = ['isExtension', 'extensionEnabled', 'upgradationEnabled', 'isExploreTestSeries', 'isTopperPass', 'isGrammar', 'isVocab', 'isEditorial'];
  out.activeFlags = Object.fromEntries(flags.map(f => [f, active.filter(p => p[f]).length]));
  out.activeOther = {
    priceIOS: active.filter(p => p.priceIOS > 0).length,
    appleProductId: active.filter(p => p.inAppPurchaseProductId).length,
    couponIdSet: active.filter(p => p.couponId > 0).length,
    discountPriceSet: active.filter(p => p.discountPrice > 0).length,
    amountZero: active.filter(p => !(Number(p.amount) > 0)).length,
    appxMigrated: active.filter(p => p.unmatchedMigratedItem).length,
    durations: tally(active, p => String(p.duration)),
  };
  out.coursesTotal = courses.length;
  out.coursesActive = courses.filter(c => c.status === 1).length;

  // 2. Courses sold by more than one active plan: how those plans differ
  const plansOfCourse = new Map();
  for (const p of active) for (const c of ids(p.course)) {
    if (!plansOfCourse.has(c)) plansOfCourse.set(c, []);
    plansOfCourse.get(c).push(p);
  }
  const activeCourseIds = courses.filter(c => c.status === 1).map(c => str(c._id));
  out.activeCoursesByActivePlanCount = tally(activeCourseIds, c => String((plansOfCourse.get(c) || []).length));
  const kinds = { onlySingleCoursePlans: 0, singlePlusCombos: 0, onlyCombos: 0 };
  const diff = { sameDurationSamePrice: 0, durationDiffers: 0, priceDiffersSameDuration: 0 };
  const multi = [];
  for (const [cid, ps] of plansOfCourse) {
    if (ps.length < 2) continue;
    const singles = ps.filter(p => ids(p.course).length === 1);
    if (singles.length === ps.length) kinds.onlySingleCoursePlans++;
    else if (singles.length) kinds.singlePlusCombos++;
    else kinds.onlyCombos++;
    const durs = new Set(ps.map(p => p.duration));
    const prices = new Set(ps.map(p => String(p.amount)));
    if (durs.size > 1) diff.durationDiffers++;
    else if (prices.size > 1) diff.priceDiffersSameDuration++;
    else diff.sameDurationSamePrice++;
    multi.push({ course: courseById.get(cid)?.title, courseStatus: courseById.get(cid)?.status, plans: ps.map(p => ({ title: p.title, courses: ids(p.course).length, amount: p.amount, duration: p.duration })) });
  }
  out.multiPlanCourses = { count: multi.length, kinds, diff };
  out.multiPlanSamples = multi.slice(0, 12);

  // 3. Orders by month x source x plan size
  const ordersAgg = await db.collection('orders').aggregate([
    { $match: { orderStatus: 'success', status: { $ne: 0 } } },
    { $project: {
      month: { $dateToString: { format: '%Y-%m', date: '$createdAt', timezone: 'Asia/Kolkata' } },
      planId: 1, userId: 1, gateway: 1, orderVia: 1, givenForFree: 1, assignedByAdmin: 1, build: 1,
      apx: { $regexMatch: { input: { $ifNull: ['$orderNumber', ''] }, regex: /^APX-/ } },
      paid: { $gt: [{ $toDouble: { $ifNull: ['$grandTotal', 0] } }, 0] },
      grandTotal: { $toDouble: { $ifNull: ['$grandTotal', 0] } },
      itemCourses: len('$courseId'),
      expired: { $lt: ['$expireDate', '$$NOW'] },
    } },
  ]).toArray();
  const planSize = o => { const p = planById.get(str(o.planId)); return p ? bucket(ids(p.course).length) : 'noPlan'; };
  const src = o => (o.apx ? 'appx' : o.build && o.build.courseId ? 'build' : o.assignedByAdmin || o.givenForFree ? 'admin/free' : o.paid ? 'paid-here' : 'zero-here');
  out.ordersTotal = ordersAgg.length;
  out.ordersBySourceXPlanSize = tally(ordersAgg, o => `${src(o)} | plan ${planSize(o)}`);
  out.ordersBySourceXMonth = tally(ordersAgg, o => `${o.month} | ${src(o)}`);
  out.ordersPlanVsItems = tally(ordersAgg, o => {
    const p = planById.get(str(o.planId));
    const n = p ? ids(p.course).length : -1;
    return n === o.itemCourses ? 'items = plan courses' : `items ${o.itemCourses} vs plan ${n}`;
  });
  out.unexpiredBySourceXPlanSize = tally(ordersAgg.filter(o => !o.expired), o => `${src(o)} | plan ${planSize(o)}`);
  out.gatewaysNonAppx = tally(ordersAgg.filter(o => !o.apx), o => `${o.gateway || '-'} / ${o.orderVia || '-'}`);

  // 4. Top plans by paid orders made here (not AppX), and by AppX orders
  const top = (filter, n) => {
    const m = new Map();
    for (const o of ordersAgg.filter(filter)) {
      const k = str(o.planId);
      const r = m.get(k) || { orders: 0, revenue: 0 };
      r.orders++; r.revenue += o.grandTotal; m.set(k, r);
    }
    return [...m.entries()].sort((a, b) => b[1].orders - a[1].orders).slice(0, n).map(([pid, r]) => {
      const p = planById.get(pid);
      return { plan: p ? p.title : `(missing ${pid})`, status: p?.status, amount: p?.amount, duration: p?.duration,
        courses: p ? ids(p.course).map(c => courseById.get(c)?.title || c) : [], orders: r.orders, revenue: Math.round(r.revenue) };
    });
  };
  out.topPlansPaidHere = top(o => !o.apx && o.paid, 10);
  out.topPlansAppx = top(o => o.apx && o.paid, 10);

  // 5. Students holding the same course through two live orders
  const live = ordersAgg.filter(o => !o.expired && planById.get(str(o.planId)));
  const userOrders = live;
  const seen = new Map(); let overlapUsers = new Set();
  for (const o of userOrders) for (const c of ids(planById.get(str(o.planId))?.course)) {
    const k = o.userId + '|' + c;
    if (seen.has(k) && seen.get(k) !== str(o._id)) overlapUsers.add(o.userId);
    seen.set(k, str(o._id));
  }
  // 7. Card price vs checkout price: the app shows Course price/discountPrice, checkout charges the plan's amount
  const shown = c => (c.discountPrice > 0 ? c.discountPrice : c.price || 0);
  const priceRows = courses.filter(c => c.status === 1).map(c => {
    const singles = (plansOfCourse.get(str(c._id)) || []).filter(p => ids(p.course).length === 1);
    return { course: c.title, card: shown(c), price: c.price, discountPrice: c.discountPrice, validity: c.validity,
      singlePlans: singles.map(p => ({ amount: Number(p.amount), duration: p.duration })) };
  });
  out.cardVsCheckout = tally(priceRows, r => !r.singlePlans.length ? 'no single-course plan'
    : r.singlePlans.some(p => p.amount === r.card) ? 'card matches a plan' : 'card differs from every plan');
  out.cardVsCheckoutSamples = priceRows.filter(r => r.singlePlans.length && !r.singlePlans.some(p => p.amount === r.card)).slice(0, 10);
  out.liveOrderUsers = new Set(userOrders.map(o => o.userId)).size;
  out.usersHoldingACourseTwice = overlapUsers.size;

  console.log(JSON.stringify(out, null, 1));
  // 6. DETAIL=1: what the combos hold, where admin/free orders sit, why students hold a course twice
  if (process.env.DETAIL) {
    const d = {};
    const ordersOfPlan = tally(ordersAgg, o => `${str(o.planId)}|${src(o)}`);
    const cdesc = c => { const x = courseById.get(c); return x ? `${x.title} [st ${x.status}, price ${x.price}, ${x._id.getTimestamp().toISOString().slice(0, 10)}]` : c; };
    d.activeCombos = active.filter(p => ids(p.course).length >= 2).map(p => ({
      plan: p.title, amount: p.amount, duration: p.duration, created: p._id.getTimestamp().toISOString().slice(0, 10),
      courses: ids(p.course).map(cdesc),
      orders: Object.fromEntries(Object.entries(ordersOfPlan).filter(([k]) => k.startsWith(str(p._id) + '|')).map(([k, v]) => [k.split('|')[1], v])),
    }));
    d.cheapSinglePlans = active.filter(p => ids(p.course).length === 1 && Number(p.amount) > 0 && Number(p.amount) < 100)
      .map(p => `${p.title} | ${p.amount} | ${p._id.getTimestamp().toISOString().slice(0, 10)} | course ${cdesc(ids(p.course)[0])}`);
    const adminByPlan = tally(ordersAgg.filter(o => src(o) === 'admin/free'), o => str(o.planId));
    d.adminFreeByPlan = Object.entries(adminByPlan).sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([pid, n]) => ({ plan: planById.get(pid)?.title, amount: planById.get(pid)?.amount, courses: ids(planById.get(pid)?.course).map(cdesc).slice(0, 3), n }));
    d.itemsDifferFromPlan = Object.entries(tally(ordersAgg.filter(o => { const p = planById.get(str(o.planId)); return p && ids(p.course).length !== o.itemCourses && o.itemCourses > 0; }), o => str(o.planId)))
      .sort((a, b) => b[1] - a[1]).slice(0, 8).map(([pid, n]) => ({ plan: planById.get(pid)?.title, courses: ids(planById.get(pid)?.course).map(cdesc), n }));
    const firstSrc = new Map(); const pairs = {};
    for (const o of live) for (const c of ids(planById.get(str(o.planId))?.course)) {
      const k = o.userId + '|' + c;
      if (firstSrc.has(k)) { const a = firstSrc.get(k); const pk = [a.src, src(o)].sort().join('+') + (a.plan === str(o.planId) ? ' same plan' : ' other plan'); pairs[pk] = (pairs[pk] || 0) + 1; }
      else firstSrc.set(k, { src: src(o), plan: str(o.planId) });
    }
    d.doubleHoldPairs = pairs;
    console.log(JSON.stringify(d, null, 1));
  }

  await mongoose.disconnect();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
