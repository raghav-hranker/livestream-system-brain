// Read-only production impact census. Run from quicktricks-backend with the
// readonly-guard.cjs preload and MONGO_URI pointing at a secondary.
// Writes user IDs and course/plan IDs only; no contact details or payment refs.
//
//   node -r /abs/path/readonly-guard.cjs /abs/path/count-renewal-and-access.cjs
//
// This script intentionally follows the deployed prod predicates, not a guess at
// entitlement: courseUtils.addIsPaidToCourses and classAccessAuthz.ts are cited
// at each implementation point. The report includes pair-level flags so causes
// can overlap without being double-counted in the headline.

'use strict';
const fs = require('fs');
const path = require('path');
const Module = require('module');
const backendRequire = Module.createRequire(path.join(process.cwd(), 'noop.js'));
const mongoose = backendRequire('mongoose');
if (!process.env.MONGO_URI) backendRequire('dotenv').config({ path: path.join(process.cwd(), '.env.development') });
const OUT_DIR = __dirname;
const NOW = new Date();

const id = value => {
  if (value == null) return '';
  if (typeof value === 'object' && !(value instanceof mongoose.Types.ObjectId)) {
    if (value._id != null || value.id != null) return id(value._id ?? value.id);
    return '';
  }
  return String(value).trim();
};
const ids = values => Array.isArray(values) ? values.map(id).filter(Boolean) : [];
const fmt = value => value == null ? '' : String(value).replace(/["\n\r,]/g, match => match === '"' ? '""' : match);
const csv = values => values.map(value => /["\n\r,]/.test(String(value ?? '')) ? `"${fmt(value)}"` : String(value ?? '')).join(',') + '\n';
const activeExtension = o => (o.expireDate && new Date(o.expireDate) >= NOW) || Number(o.daysLeft ?? 0) > 0;
const expiredExtension = o => (o.expireDate && new Date(o.expireDate) < NOW) || (!o.expireDate && Number(o.daysLeft ?? 0) <= 0);
// addIsPaidToCourses: absent/null expiry is active; daysLeft is ignored.
const activeApp = o => !o.expireDate || new Date(o.expireDate) >= NOW;
const purchaseAt = o => { const n = new Date(o.orderDate ?? o.createdAt ?? 0).getTime(); return Number.isFinite(n) ? n : -Infinity; };
// src/services/appleRevenueReporting.ts: positive grandTotal on an admin
// assignment or Apple sandbox/pending row is not evidence of payment.
const revenueEligible = o => Number(o.grandTotal) > 0
  && o.assignedByAdmin !== true
  && o.gateway !== 'admin-assigned'
  && !['admin_assignment', 'free_admin_assignment'].includes(o.type)
  && !(o.gateway === 'apple' && (o.appleEnvironment === 'Sandbox' || o.appleAmountStatus === 'pending'));
const category = (map, name, userId) => {
  if (!map.has(name)) map.set(name, { pairs: 0, users: new Set() });
  const item = map.get(name); item.pairs++; item.users.add(userId);
};
const summary = map => Object.fromEntries([...map].sort(([a], [b]) => a.localeCompare(b)).map(([key, v]) => [key, { pairs: v.pairs, users: v.users.size }]));

const q1Columns = ['user_id','plan_id','course_ids','classification','plan_status','plan_amount','offer_price','last_gateway','expired_order_count','active_plan_order_count','covered_course_count','same_plan_app_covered_course_count','uncovered_course_count','total_course_count'];
const q2Columns = ['user_id','course_id','revenue_paid_order_count','positive_non_revenue_order_count','zero_order_count','app_is_buy','content_course_gate','course_exists','course_status','active_class_placements','all_class_placements','inactive_plan_empty_snapshot','qr_empty_snapshot','no_snapshot','missing_plan','expired_in_app_but_days_left','access_until_expired','classification'];

const main = async () => {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI required');
  if (!process.execArgv.join(' ').includes('readonly-guard.cjs')) throw new Error('readonly-guard.cjs preload required');
  await mongoose.connect(process.env.MONGO_URI, { readPreference: 'secondary', serverSelectionTimeoutMS: 20000, autoIndex: false });
  const db = mongoose.connection.db;

  const [plansRaw, coursesRaw, placementsRaw] = await Promise.all([
    db.collection('plans').find({}, { projection: { status: 1, amount: 1, course: 1, isExtension: 1 } }).toArray(),
    db.collection('courses').find({}, { projection: { status: 1, isFree: 1 } }).toArray(),
    db.collection('courseclasses').find({}, { projection: { course: 1, class: 1, isActive: 1, status: 1 } }).toArray(),
  ]);
  const plans = new Map(plansRaw.map(p => [id(p._id), { ...p, courseIds: ids(p.course) }]));
  const courses = new Map(coursesRaw.map(c => [id(c._id), c]));
  const placements = new Map();
  for (const p of placementsRaw) {
    const courseId = id(p.course); if (!courseId) continue;
    const v = placements.get(courseId) ?? { all: 0, active: 0 };
    v.all++;
    if (p.isActive === true && p.status === 1) v.active++;
    placements.set(courseId, v);
  }
  const q1Path = path.join(OUT_DIR, `renewal-impact-${NOW.toISOString().slice(0,10)}.csv`);
  const q2Path = path.join(OUT_DIR, `paid-access-impact-${NOW.toISOString().slice(0,10)}.csv`);
  const q1 = fs.createWriteStream(q1Path, { mode: 0o600 });
  const q2 = fs.createWriteStream(q2Path, { mode: 0o600 });
  q1.write(csv(q1Columns)); q2.write(csv(q2Columns));
  const q1Summary = new Map(), q2Summary = new Map();
  let orderCount = 0, userCount = 0, multiLapsedUsers = 0;
  const noCourseOrders = { paid: { orders: 0, users: new Set() }, admin: { orders: 0, users: new Set() }, grant: { orders: 0, users: new Set() } };
  let missingPlanIdLapsedPairs = 0, missingPlanIdLapsedUsers = new Set();

  const processUser = (userId, allOrders) => {
    if (!userId || !allOrders.length) return;
    userCount++;
    const good = allOrders.filter(o => o.status !== 0);
    const byPlan = new Map();
    for (const o of good) {
      const p = id(o.planId);
      if (p) { if (!byPlan.has(p)) byPlan.set(p, []); byPlan.get(p).push(o); }
    }
    const appCovered = new Set(), contentCovered = new Set();
    const courseOf = (o, includeInactivePlan) => {
      const set = new Set([...ids(o.courseId), ...ids(o.latestCourseId)]);
      const plan = plans.get(id(o.planId));
      if (plan && (includeInactivePlan || Number(plan.status) === 1)) for (const c of plan.courseIds) set.add(c);
      return set;
    };
    // mongoAuthorizationDeps.findActiveOrdersForUser uses every successful
    // order, including status:0; joins plan.course only for status:1 plans.
    // accessUntil is the only expiry it supplies to authorizeCourseAccess.
    for (const o of allOrders) {
      if (!o.accessUntil || new Date(o.accessUntil) > NOW) {
        for (const c of courseOf(o, false)) contentCovered.add(c);
      }
    }
    for (const o of good) {
      if (activeApp(o)) for (const c of courseOf(o, false)) appCovered.add(c);
    }

    let lapsedPlanPairs = 0;
    for (const [planId, os] of byPlan) {
      const active = os.filter(activeExtension);
      const expired = os.filter(expiredExtension);
      if (active.length || !expired.length) continue;
      const plan = plans.get(planId);
      const planCourses = plan?.courseIds ?? [];
      const otherActiveCoverage = new Set();
      const samePlanAppCoverage = new Set();
      for (const o of good) {
        if (!activeApp(o)) continue;
        const target = id(o.planId) === planId ? samePlanAppCoverage : otherActiveCoverage;
        for (const c of courseOf(o, false)) target.add(c);
      }
      const selfCovered = planCourses.filter(c => samePlanAppCoverage.has(c)).length;
      const covered = planCourses.filter(c => samePlanAppCoverage.has(c) || otherActiveCoverage.has(c)).length;
      const uncovered = planCourses.length - covered;
      const last = [...os].sort((a,b) => purchaseAt(a) - purchaseAt(b)).at(-1);
      let classification;
      if (!plan) classification = 'deleted_plan';
      else if (planCourses.length === 0) classification = 'plan_has_no_courses';
      else if (uncovered === 0 && selfCovered === planCourses.length) classification = 'already_accessible_same_plan_app';
      else if (uncovered === 0) classification = 'already_covered_other_order';
      else if (Number(plan.status) === 1) classification = 'active_plan_cheaper';
      else classification = 'inactive_plan_newly_renewable';
      const list = Number(plan?.amount);
      const paid = os.filter(o => o.isExtensionOrder !== true && Number(o.grandTotal) > 0).sort((a,b) => purchaseAt(a) - purchaseAt(b));
      const base = paid.length ? (Number.isFinite(list) && list >= 0 ? Math.min(Number(paid[0].grandTotal), list) : Number(paid[0].grandTotal)) : list;
      const offer = Number.isFinite(base) && base >= 0 ? Math.round(Number((base * 0.5).toFixed(6))) : '';
      category(q1Summary, classification, userId);
      if (classification === 'inactive_plan_newly_renewable' || classification === 'active_plan_cheaper') {
        if (String(last?.gateway ?? '').toLowerCase() === 'apple') category(q1Summary, `${classification}_last_order_apple`, userId);
        if (plan?.amount == null || !Number.isFinite(list)) category(q1Summary, `${classification}_invalid_list_amount`, userId);
        else if (list <= 0) category(q1Summary, `${classification}_zero_list_amount`, userId);
        if (covered > 0) category(q1Summary, `${classification}_partially_covered`, userId);
        lapsedPlanPairs++;
      }
      q1.write(csv([userId,planId,planCourses.join('|'),classification,plan?.status ?? '',plan?.amount ?? '',offer,last?.gateway ?? '',expired.length,active.length,covered,selfCovered,uncovered,planCourses.length]));
    }
    if (lapsedPlanPairs > 1) multiLapsedUsers++;

    // Course-only legacy orders have no plan to buy again. Count lapsed
    // user/course pairs separately, only where no current app access exists.
    const planless = new Map();
    for (const o of good) {
      if (id(o.planId)) continue;
      for (const c of courseOf(o, true)) {
        if (!planless.has(c)) planless.set(c, []);
        planless.get(c).push(o);
      }
    }
    for (const [courseId, os] of planless) {
      if (!os.some(expiredExtension) || os.some(activeExtension) || appCovered.has(courseId)) continue;
      missingPlanIdLapsedPairs++; missingPlanIdLapsedUsers.add(userId);
      q1.write(csv([userId,'',courseId,'no_plan_id_course_only','','','','',os.filter(expiredExtension).length,0,0,0,1,1]));
    }

    // Intended coverage is snapshot + latestCourseId + plan.course,
    // including inactive plans. Payment classification uses the deployed
    // revenue predicate, so positive admin assignments are separate.
    const intended = new Map();
    for (const o of good) {
      if (!activeExtension(o)) continue;
      const group = revenueEligible(o) ? 'paid' : Number(o.grandTotal) > 0 ? 'admin' : 'grant';
      const snapshotEmpty = ids(o.courseId).length === 0 && ids(o.latestCourseId).length === 0;
      const planId = id(o.planId), plan = plans.get(planId);
      const qr = o.orderVia === 'qr_code' || o.type === 'qr_code_payment';
      const expApp = !activeApp(o);
      const expected = courseOf(o, true);
      if (expected.size === 0) {
        noCourseOrders[group].orders++;
        noCourseOrders[group].users.add(userId);
      }
      for (const c of expected) {
        const emptyFlags = () => ({ count: 0, inactiveEmpty: false, qrEmpty: false, noSnapshot: false, missingPlan: false, expAppDays: false, untilExpired: false });
        const v = intended.get(c) ?? { paid: emptyFlags(), admin: emptyFlags(), grant: emptyFlags() };
        const flags = v[group];
        flags.count++;
        if (plan && Number(plan.status) !== 1 && snapshotEmpty) flags.inactiveEmpty = true;
        if (qr && snapshotEmpty) flags.qrEmpty = true;
        if (snapshotEmpty) flags.noSnapshot = true;
        if (planId && !plan) flags.missingPlan = true;
        if (expApp) flags.expAppDays = true;
        if (o.accessUntil && new Date(o.accessUntil) <= NOW) flags.untilExpired = true;
        intended.set(c, v);
      }
    }
    for (const [courseId, v] of intended) {
      const course = courses.get(courseId);
      const placed = placements.get(courseId) ?? { active: 0, all: 0 };
      const app = appCovered.has(courseId);
      const content = Boolean(course?.isFree) || contentCovered.has(courseId);
      const group = v.paid.count ? 'paid' : v.admin.count ? 'admin' : 'grant';
      const flags = v[group];
      category(q2Summary, `${group}_intended`, userId);
      if (!app) category(q2Summary, `${group}_app_denied`, userId);
      if (!content) category(q2Summary, `${group}_content_denied`, userId);
      if (!app || !content || !course) category(q2Summary, `${group}_any_denial_or_deleted`, userId);
      if (app && !content) category(q2Summary, `${group}_app_yes_content_no`, userId);
      if (!app && content) category(q2Summary, `${group}_app_no_content_yes`, userId);
      if (!course) category(q2Summary, `${group}_deleted_course`, userId);
      if (course && placed.all > 0 && placed.active === 0) category(q2Summary, `${group}_only_inactive_class_placements`, userId);
      if (course && placed.all === 0) category(q2Summary, `${group}_no_class_placements`, userId);
      if (flags.inactiveEmpty) category(q2Summary, `${group}_inactive_plan_empty_snapshot`, userId);
      if (flags.qrEmpty) category(q2Summary, `${group}_qr_empty_snapshot`, userId);
      if (flags.noSnapshot) category(q2Summary, `${group}_any_empty_snapshot`, userId);
      if (flags.expAppDays) category(q2Summary, `${group}_expired_in_app_but_days_left`, userId);
      if (flags.untilExpired) category(q2Summary, `${group}_access_until_expired`, userId);
      if (!content && flags.inactiveEmpty) category(q2Summary, `${group}_content_denied_inactive_empty_snapshot`, userId);
      if (!content && flags.qrEmpty) category(q2Summary, `${group}_content_denied_qr_empty_snapshot`, userId);
      q2.write(csv([userId,courseId,v.paid.count,v.admin.count,v.grant.count,Number(app),Number(content),Number(Boolean(course)),course?.status ?? '',placed.active,placed.all,Number(flags.inactiveEmpty),Number(flags.qrEmpty),Number(flags.noSnapshot),Number(flags.missingPlan),Number(flags.expAppDays),Number(flags.untilExpired),group]));
    }
  };

  const cursor = db.collection('orders').find(
    { orderStatus: 'success' },
    { projection: { userId: 1, status: 1, planId: 1, courseId: 1, latestCourseId: 1, grandTotal: 1, expireDate: 1, daysLeft: 1, accessUntil: 1, gateway: 1, orderVia: 1, type: 1, assignedByAdmin: 1, appleEnvironment: 1, appleAmountStatus: 1, isExtensionOrder: 1, orderDate: 1, createdAt: 1 }, batchSize: 2000 }
  ).sort({ userId: 1 }).hint({ userId: 1, orderStatus: 1 });
  let currentUser = null, userOrders = [];
  for await (const o of cursor) {
    orderCount++;
    const u = id(o.userId);
    if (currentUser !== null && u !== currentUser) {
      processUser(currentUser, userOrders);
      userOrders = [];
    }
    currentUser = u; userOrders.push(o);
    if (orderCount % 200000 === 0) console.error(`scanned ${orderCount} orders, ${userCount} users`);
  }
  if (currentUser !== null) processUser(currentUser, userOrders);
  await Promise.all([new Promise(resolve => q1.end(resolve)), new Promise(resolve => q2.end(resolve))]);
  await mongoose.disconnect();
  console.log(JSON.stringify({ at: NOW.toISOString(), orderCount, userCount, plans: plans.size, courses: courses.size, placements: placementsRaw.length,
    q1: summary(q1Summary), multiLapsedUsers, missingPlanIdLapsedPairs, missingPlanIdLapsedUsers: missingPlanIdLapsedUsers.size,
    q2: summary(q2Summary), noCourseOrders: Object.fromEntries(Object.entries(noCourseOrders).map(([k,v]) => [k,{orders:v.orders,users:v.users.size}])), q1Path, q2Path }, null, 2));
};

main().catch(async e => { console.error(e.stack || e); try { await mongoose.disconnect(); } catch {} process.exitCode = 1; });
