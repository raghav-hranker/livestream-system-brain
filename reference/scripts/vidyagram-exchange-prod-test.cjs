// vidyagram-exchange-prod-test.cjs — course exchange end-to-end check on prod vidyagramdb with mock data.
// Run on webserver2-2 from /var/www/backend.vidyagramar.com/vidyagram-backend:  MODE=<mode> node - < this-file
//   MODE=seed     WRITES: one hidden test plan (status 0) holding SOURCE_COURSE with exchangeToPlanIds [TARGET_PLAN],
//                 and one ₹1 success order on it for a made-up user id that matches no real student. Idempotent.
//   MODE=test     calls the live API on localhost:4100 as that made-up student (and as a test admin for undo);
//                 needs EXCHANGE_ENABLED=true in the running process. Writes only through the API (swap, undo).
//   MODE=reset    WRITES: replace this user's test order with a fresh eligible one (each order swaps only once).
//                 Env for the app team: TAG=course-exchange-app-team USER_ID=<their test account id>; PLAN_ONLY=1 seeds just the plan.
//   MODE=swap     only the student swap through the API (to look at the admin badge and press Undo there).
//   MODE=verify   after an admin undo from the dashboard: back on source, undoneAt set, no second swap.
//   MODE=cleanup  WRITES: deletes the test order and the test plan (matched by testRun tag). Idempotent.
// Tokens are minted in memory from the box's JWT_SECRET and never printed. Nothing real is touched: only the
// tagged plan's buyers can see a swap, and the only buyer is the made-up user.
require('dotenv').config({ path: '.env.development' });
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const TAG = process.env.TAG || 'course-exchange-prod-test-2026-10-24';  // app team test data: TAG=course-exchange-app-team
const SOURCE_COURSE = '6ad5f78db4d74b982a7948e9';   // Grammer Pro Batch by Jai Sir (Recorded Batch), customer 781
const TARGET_PLAN = '6ad5c040a5b976f0a42f852d';     // UPSSSC PET 2026 Crash Course, customer 781 (existing, untouched)
// A target must be a customer-781 plan: the admin plan list hides the 472-tagged "… 2026" placeholders, so the picker can't show them.
const TEST_USER = process.env.USER_ID || '6a0000000000000000e1c7e5';  // default: no users document has this id; USER_ID = a real test account
const CUSTOMER_ID = 781;
const API = 'http://127.0.0.1:4100/api';
const DAY = 864e5;
const { ObjectId } = mongoose.Types;

const call = async (method, path, token, body) => {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(API + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch { json = text.slice(0, 200); }
  return { status: res.status, body: json };
};

let failures = 0;
const check = (ok, label, detail) => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${!ok && detail !== undefined ? '  -> ' + JSON.stringify(detail).slice(0, 300) : ''}`);
};

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 8000, readPreference: 'primary' });
  const db = mongoose.connection.db;
  if (db.databaseName !== 'vidyagramdb') throw new Error('refusing: connected to ' + db.databaseName);
  const plans = db.collection('plans'), orders = db.collection('orders');
  const mode = process.env.MODE;

  if (mode === 'reset') {
      const d = await orders.deleteMany({ testRun: TAG, userId: TEST_USER });
      console.log('deleted', d.deletedCount, 'old test order(s) for', TEST_USER);
    }
  if (mode === 'seed' || mode === 'reset') {
    if (!process.env.USER_ID && await db.collection('users').findOne({ _id: new ObjectId(TEST_USER) })) throw new Error('default TEST_USER exists as a real user');
    const target = await plans.findOne({ _id: new ObjectId(TARGET_PLAN) });
    if (!target || target.status !== 1 || (target.course || []).length !== 1) throw new Error('target plan is not an active single-course plan');
    let src = await plans.findOne({ testRun: TAG });
    if (!src) {
      const _id = new ObjectId();
      await plans.insertOne({
        _id, testRun: TAG, title: 'ZZ TEST course exchange source (delete)', name: 'ZZ TEST course exchange source (delete)',
        description: 'Course exchange prod test, removed after the test', status: 0, amount: '1', duration: 365,
        course: [new ObjectId(SOURCE_COURSE)], exchangeToPlanIds: [new ObjectId(TARGET_PLAN)], customer_id: CUSTOMER_ID,
        createdAt: new Date(), updatedAt: new Date(),
      });
      src = await plans.findOne({ _id });
    }
    if (process.env.PLAN_ONLY) { console.log('seeded plan', String(src._id), '(PLAN_ONLY, no order)'); await mongoose.disconnect(); process.exit(0); }
    if (!(await orders.findOne({ testRun: TAG, userId: TEST_USER }))) {
      const now = new Date();
      await orders.insertOne({
        _id: new ObjectId(), testRun: TAG, userId: TEST_USER, customer_id: CUSTOMER_ID,
        orderStatus: 'success', status: 1, grandTotal: 1, gateway: 'razorpay', orderVia: 'app',
        orderNumber: `ORD-TEST-EXCH-${now.getTime()}`, planId: String(src._id), planFor: src.title,
        courseId: [new ObjectId(SOURCE_COURSE)], latestCourseId: [], duration: 365, daysLeft: 365,
        expireDate: new Date(now.getTime() + 365 * DAY), createdAt: now, updatedAt: now,
      });
    }
    const o = await orders.findOne({ testRun: TAG, userId: TEST_USER });
    console.log('seeded plan', String(src._id), 'order', String(o._id), 'user', TEST_USER);
  } else if (mode === 'test') {
    const secret = process.env.JWT_SECRET; if (!secret) throw new Error('no JWT_SECRET');
    const student = jwt.sign({ user_id: TEST_USER, customer_id: CUSTOMER_ID }, secret, { expiresIn: '15m' });
    const admin = jwt.sign({ admin_id: '6a0000000000000000ad7e57', role: 'admin', customer_id: CUSTOMER_ID }, secret, { expiresIn: '15m' });
    const src = await plans.findOne({ testRun: TAG });
    const order = await orders.findOne({ testRun: TAG });
    if (!src || !order) throw new Error('run MODE=seed first');
    const O = String(order._id), S = String(src._id);
    const myCourseIds = async () => {
      const r = await call('POST', '/courses/my-courses', null, { userId: TEST_USER });
      const groups = Array.isArray(r.body?.data) ? r.body.data : [];
      return groups.flatMap(g => [...(g.liveCourses ?? []), ...(g.recordedCourses ?? [])]).map(c => String(c.id ?? c._id));
    };
    const targetCourse = String((await plans.findOne({ _id: new ObjectId(TARGET_PLAN) })).course[0]);

    const page = await call('POST', '/courses/by-id-2', student, { id: SOURCE_COURSE, userId: TEST_USER });
    check(page.body?.data?.exchange?.eligible === true && page.body.data.exchange.orderId === O, 'course page: exchange eligible with this order', page.body?.data?.exchange);
    const anon = await call('POST', '/courses/by-id-2', null, { id: SOURCE_COURSE, userId: TEST_USER });
    check(anon.body?.data?.exchange === null, 'course page without token: exchange null', anon.body?.data?.exchange);
    const before = await myCourseIds();
    check(before.includes(SOURCE_COURSE) && !before.includes(targetCourse), 'my-courses before: source only', before);

    const opts = await call('GET', `/orders/${O}/exchange-options`, student);
    const d = opts.body?.data;
    check(opts.status === 200 && d?.eligible === true && d.targets?.some(t => t.planId === TARGET_PLAN), 'options: eligible, target listed', opts.body);
    check(d?.daysSincePurchase === 0 && d?.daysLeftToExchange === 30 && d?.rule?.maxWatchPct === 5, 'options: banner numbers and rule', d && { days: d.daysSincePurchase, left: d.daysLeftToExchange, rule: d.rule });

    const bad = await call('POST', `/orders/${O}/exchange-self`, student, { targetPlanId: String(new ObjectId()) });
    check(bad.status === 400 && bad.body?.reason === 'target_not_allowed', 'swap to an unlisted plan: 400 target_not_allowed', bad);
    const swap = await call('POST', `/orders/${O}/exchange-self`, student, { targetPlanId: TARGET_PLAN });
    check(swap.status === 200, 'swap: 200', swap.status);
    const afterSwap = await orders.findOne({ _id: order._id });
    check(afterSwap.planId === TARGET_PLAN && afterSwap.exchange?.by === 'student' && afterSwap.exchange?.fromPlanId === S, 'db: order on target plan with exchange record', { planId: afterSwap.planId, exchange: afterSwap.exchange });
    check(afterSwap.grandTotal === 1 && +afterSwap.expireDate === +order.expireDate, 'db: amount and end date unchanged');
    const retry = await call('POST', `/orders/${O}/exchange-self`, student, { targetPlanId: TARGET_PLAN });
    check(retry.status === 200, 'retry same swap: 200 no-op', retry.status);
    const after = await myCourseIds();
    check(after.includes(targetCourse) && !after.includes(SOURCE_COURSE), 'my-courses after: target only', after);
    const hist = await call('GET', `/orders/my-orders?userId=${TEST_USER}`, student);
    const row = (hist.body?.data ?? []).find?.(r => r.id === O);
    check(row?.exchangedFrom?.courseId === SOURCE_COURSE, 'history: exchangedFrom names the source course', row?.exchangedFrom);
    const other = await call('GET', `/orders/${O}/exchange-options`, jwt.sign({ user_id: '6a0000000000000000e1c7e6', customer_id: CUSTOMER_ID }, secret, { expiresIn: '5m' }));
    check(other.status === 404, "another student's token: 404", other.status);

    const adminSwap = await call('PUT', `/orders/${O}/exchange`, admin, { planId: S });
    check(adminSwap.status === 409, 'admin PUT exchange on a live student swap: 409', adminSwap);
    const studentUndo = await call('POST', `/orders/${O}/exchange-undo`, student);
    check(studentUndo.status === 403, 'student calling undo: 403', studentUndo.status);
    const undo = await call('POST', `/orders/${O}/exchange-undo`, admin);
    check(undo.status === 200, 'admin undo: 200', undo);
    const afterUndo = await orders.findOne({ _id: order._id });
    check(afterUndo.planId === S && afterUndo.exchange?.undoneAt != null, 'db: back on source plan, undoneAt set', { planId: afterUndo.planId, exchange: afterUndo.exchange });
    const back = await myCourseIds();
    check(back.includes(SOURCE_COURSE) && !back.includes(targetCourse), 'my-courses after undo: source only', back);
    const reswap = await call('POST', `/orders/${O}/exchange-self`, student, { targetPlanId: TARGET_PLAN });
    check(reswap.status === 409 && reswap.body?.reason === 'already_exchanged', 'swap after undo: 409 already_exchanged', reswap);
    console.log(failures === 0 ? 'ALL PASS' : `${failures} FAILED`);
  } else if (mode === 'swap' || mode === 'verify') {
    const secret = process.env.JWT_SECRET; if (!secret) throw new Error('no JWT_SECRET');
    const student = jwt.sign({ user_id: TEST_USER, customer_id: CUSTOMER_ID }, secret, { expiresIn: '15m' });
    const src = await plans.findOne({ testRun: TAG });
    const order = await orders.findOne({ testRun: TAG });
    if (!src || !order) throw new Error('run MODE=seed first');
    const O = String(order._id), S = String(src._id);
    if (mode === 'swap') {
      const r = await call('POST', `/orders/${O}/exchange-self`, student, { targetPlanId: TARGET_PLAN });
      const after = await orders.findOne({ _id: order._id });
      check(r.status === 200 && after.planId === TARGET_PLAN && after.exchange?.by === 'student', 'swap: 200, order on target with exchange record', { status: r.status, body: r.body?.reason });
      console.log('order', O);
    } else {
      check(order.planId === S && order.exchange?.undoneAt != null && order.exchange?.undoneBy, 'db: back on source plan, undoneAt and undoneBy set (admin dashboard undo)', { planId: order.planId, exchange: order.exchange });
      const reswap = await call('POST', `/orders/${O}/exchange-self`, student, { targetPlanId: TARGET_PLAN });
      check(reswap.status === 409 && reswap.body?.reason === 'already_exchanged', 'swap after undo: 409 already_exchanged', reswap);
    }
    console.log(failures === 0 ? 'ALL PASS' : `${failures} FAILED`);
  } else if (mode === 'cleanup') {
    const o = await orders.deleteMany({ testRun: TAG });
    const p = await plans.deleteMany({ testRun: TAG });
    console.log('deleted orders', o.deletedCount, 'plans', p.deletedCount);
  } else {
    throw new Error('MODE must be seed, test or cleanup');
  }
  await mongoose.disconnect();
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('ERR', e.message); process.exit(2); });
