// Read-only. "Would course-only selling cover what students actually buy?" for quicktricks or vidyagramdb.
// Own-checkout paid orders (not AppX import, not admin/free, grandTotal > 0) in the last DAYS (default 180),
// split by what the plan sells: one course, a combo, test series/ebook/study plan only, or a course + extras.
// Also: courses sold at more than one validity/price (the "price ladder" a course-only model must carry).
// Run on webserver2-2 from the tenant's backend checkout: URI=$MONGO_URI DAYS=180 node - < script
const mongoose = require('mongoose');
const str = id => String(id);
const ids = v => (Array.isArray(v) ? v.map(str) : v ? [str(v)] : []);

(async () => {
  await mongoose.connect(process.env.URI, { serverSelectionTimeoutMS: 8000, readPreference: 'secondaryPreferred' });
  const db = mongoose.connection.db;
  if (!['quicktricksdb', 'vidyagramdb'].includes(db.databaseName)) throw new Error('refusing: connected to ' + db.databaseName);
  const days = Number(process.env.DAYS || 180);
  const since = new Date(Date.now() - days * 864e5);

  const plans = await db.collection('plans').find({}, { projection: {
    title: 1, status: 1, amount: 1, duration: 1, course: 1, ebook: 1, packages: 1, practiceBatch: 1,
    upgradationPrice: 1, isTopperPass: 1, isGrammar: 1, isVocab: 1, isEditorial: 1, inAppPurchaseProductId: 1,
  } }).toArray();
  const planById = new Map(plans.map(p => [str(p._id), p]));
  const shape = p => {
    if (!p) return 'no plan';
    const c = ids(p.course).length;
    const extras = ids(p.packages).length || ids(p.ebook).length || ids(p.practiceBatch).length
      || p.isTopperPass || p.isGrammar || p.isVocab || p.isEditorial;
    if (c === 0) return extras ? 'non-course only (tests/ebook/study plan/pass)' : 'empty';
    if (c === 1) return extras ? '1 course + extras' : '1 course';
    return extras ? 'combo + extras' : 'combo (2+ courses)';
  };

  const orders = await db.collection('orders').aggregate([
    { $match: { orderStatus: 'success', status: { $ne: 0 }, createdAt: { $gte: since } } },
    { $project: {
      planId: 1, assignedByAdmin: 1, givenForFree: 1, isExtensionOrder: 1, isUpgradeOrder: 1, gateway: 1,
      apx: { $regexMatch: { input: { $ifNull: ['$orderNumber', ''] }, regex: /^APX-/ } },
      gt: { $toDouble: { $ifNull: ['$grandTotal', 0] } },
    } },
  ]).toArray();
  const paid = orders.filter(o => !o.apx && !o.assignedByAdmin && !o.givenForFree && o.gt > 0);

  const out = { db: db.databaseName, days, ordersInWindow: orders.length, paidOwnCheckout: paid.length };
  const add = (m, k, o) => { const r = m[k] || (m[k] = { orders: 0, revenue: 0 }); r.orders++; r.revenue += o.gt; };
  const byShape = {}; const byKind = {};
  for (const o of paid) {
    add(byShape, shape(planById.get(str(o.planId))), o);
    add(byKind, o.isExtensionOrder ? 'extension' : o.isUpgradeOrder ? 'upgrade' : 'new purchase', o);
  }
  const total = paid.reduce((s, o) => s + o.gt, 0);
  const fmt = m => Object.fromEntries(Object.entries(m).sort((a, b) => b[1].revenue - a[1].revenue)
    .map(([k, r]) => [k, { orders: r.orders, revenue: Math.round(r.revenue), revenuePct: +(100 * r.revenue / (total || 1)).toFixed(1) }]));
  out.revenueTotal = Math.round(total);
  out.byPlanShape = fmt(byShape);
  out.byOrderKind = fmt(byKind);

  // Top 12 plans by revenue, with shape
  const byPlan = {};
  for (const o of paid) add(byPlan, str(o.planId), o);
  out.topPlans = Object.entries(byPlan).sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 12).map(([pid, r]) => {
    const p = planById.get(pid);
    return { plan: p?.title, shape: shape(p), amount: p?.amount, duration: p?.duration, courses: ids(p?.course).length,
      orders: r.orders, revenue: Math.round(r.revenue) };
  });

  // Price ladder: active single-course plans that share a course
  const singlesByCourse = {};
  for (const p of plans.filter(p => p.status === 1 && ids(p.course).length === 1)) (singlesByCourse[ids(p.course)[0]] ||= []).push(p);
  const ladders = Object.values(singlesByCourse).filter(ps => ps.length > 1);
  out.activeSingleCoursePlans = Object.values(singlesByCourse).flat().length;
  out.coursesWithSeveralSinglePlans = ladders.length;
  out.ladderSamples = ladders.slice(0, 6).map(ps => ps.map(p => `${p.title} ₹${p.amount}/${p.duration}d`));

  console.log(JSON.stringify(out, null, 1));
  await mongoose.disconnect();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
