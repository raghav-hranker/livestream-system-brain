// Local fixtures for the automatic-plan-extension Postman collection (tasks 01–03, 12).
// mongosh "mongodb://127.0.0.1:27027/qt_autoext_test?directConnection=true" seed.js
//
// Idempotent: deletes and re-inserts only the fixture ids below, and wipes orders created by
// earlier Postman runs for the fixture users. Dates are relative to "now", so re-seed before
// each run. Refuses to run against anything but localhost.

const uri = db.getMongo().getURI();
const hosts = uri.replace(/^mongodb(\+srv)?:\/\/([^@]*@)?/, '').split(/[/?]/)[0].split(',');
if (!hosts.every(h => /^(127\.0\.0\.1|localhost)(:\d+)?$/.test(h))) {
  throw new Error(`refusing to seed non-local host(s): ${hosts.join(',')}`);
}
if (db.getName() !== 'qt_autoext_test') throw new Error(`refusing to seed db ${db.getName()}`);

const CUSTOMER_ID = 472;
const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();
const at = (days) => new Date(now + days * DAY);

// ── ids (Postman environment mirrors these) ──────────────────────────────────
const P = {
  P:  'a0e000000000000000000001', // Plan P — list ₹1000 / 365d
  S:  'a0e000000000000000000002', // upgrade SOURCE plan
  T1: 'a0e000000000000000000003', // upgrade TARGET, list ₹2000, upgrade ₹600  (cheaper than ext ₹1000)
  T2: 'a0e000000000000000000004', // upgrade TARGET, list ₹2000, upgrade ₹1000 (tie with ext ₹1000)
  R:  'a0e000000000000000000005', // carries the RETIRED per-plan config (₹10 / 30d) — must be ignored
  W:  'a0e000000000000000000006', // Extension window (task 12) — list ₹1000 / 365d
  I:  'a0e000000000000000000007', // INACTIVE (status 0), list ₹599 — window cases for D16
};
const U = {
  LAPSED:     'b0e000000000000000000001', // paid ₹499, lapsed 10d ago           ⇒ ₹250 / 183d
  ACTIVE:     'b0e000000000000000000002', // lapsed ₹800 + active ₹1000          ⇒ list, is_buy 1
  STRANGER:   'b0e000000000000000000003', // never held                           ⇒ list
  RENEWED:    'b0e000000000000000000004', // paid ₹900 then lapsed ext ₹450       ⇒ ₹450 (no halving), source = ext order
  GRANTED:    'b0e000000000000000000005', // only a ₹0 order                      ⇒ ₹500 (half of list)
  ZERO_PAID:  'b0e000000000000000000006', // paid ₹700 then a newer ₹0            ⇒ ₹350 (paid wins)
  ROUND:      'b0e000000000000000000007', // paid ₹333                            ⇒ ₹167 (halves up)
  COUPONED:   'b0e000000000000000000008', // paid ₹800 (coupon-reduced)           ⇒ ₹400
  PREC:       'b0e000000000000000000009', // active on S, lapsed ₹2000 on T1 + T2 ⇒ T1 upgrade ₹600, T2 ext ₹1000
  RETIRED:    'b0e00000000000000000000a', // paid ₹1000 on plan R, lapsed         ⇒ ₹500 / 183d, not ₹10 / 30d
  TWO_PAID:   'b0e00000000000000000000b', // paid ₹600 (old) then ₹800 (recent)   ⇒ ₹400 (most recent wins)
  // ── task 12, the Extension window (server 3109 = window 30; 3106 = window 0) ──
  IN_WINDOW:  'b0e00000000000000000000c', // paid ₹800 on W, 20d LEFT               ⇒ 3109: ₹400/183d, is_buy 1, is_expire 1; 3106: list, is_buy 1
  FAR:        'b0e00000000000000000000d', // paid ₹800 on W, 40d left               ⇒ list, is_buy 1 on both
  IW_PAID:    'b0e00000000000000000000e', // paid ₹799 on INACTIVE I, 20d left      ⇒ 3109: ₹300 (half of list ₹599); 3106: not listed
  IW_ZERO:    'b0e00000000000000000000f', // ₹0 grant on INACTIVE I, 20d left       ⇒ never listed, checkout 403
};
const O = {
  LAPSED:          'c0e000000000000000000001',
  ACTIVE_OLD:      'c0e000000000000000000002',
  ACTIVE_NOW:      'c0e000000000000000000003',
  RENEWED_PAID:    'c0e000000000000000000004',
  RENEWED_EXT:     'c0e000000000000000000005',
  GRANTED:         'c0e000000000000000000006',
  ZERO_PAID_PAID:  'c0e000000000000000000007',
  ZERO_PAID_ZERO:  'c0e000000000000000000008',
  ROUND:           'c0e000000000000000000009',
  COUPONED:        'c0e00000000000000000000a',
  PREC_S:          'c0e00000000000000000000b',
  PREC_T1:         'c0e00000000000000000000c',
  PREC_T2:         'c0e00000000000000000000d',
  RETIRED:         'c0e00000000000000000000e',
  TWO_PAID_OLD:    'c0e00000000000000000000f',
  TWO_PAID_NEW:    'c0e000000000000000000010',
  IN_WINDOW:       'c0e000000000000000000011',
  FAR:             'c0e000000000000000000012',
  IW_PAID:         'c0e000000000000000000013',
  IW_ZERO:         'c0e000000000000000000014',
};
const COUPON_ID = 'd0e000000000000000000001';

const oid = (h) => ObjectId(h);
const userIds = Object.values(U);

// ── reset ────────────────────────────────────────────────────────────────────
db.plans.deleteMany({ _id: { $in: Object.values(P).map(oid) } });
db.users.deleteMany({ _id: { $in: userIds.map(oid) } });
db.orders.deleteMany({ userId: { $in: userIds } }); // fixtures + every order a Postman run created
db.coupons.deleteMany({ $or: [{ _id: oid(COUPON_ID) }, { couponCode: 'WINBACK20' }] });

// ── plans ────────────────────────────────────────────────────────────────────
const plan = (id, name, amount, extra = {}) => ({
  _id: oid(id), name, title: name, description: name, amount: String(amount), duration: 365, status: 1,
  priority: 0, customer_id: CUSTOMER_ID, packages: ['6a4cd4383aed5ba9f322cbf7'], course: [], ebook: [], batchCourse: [], practiceBatch: [],
  upgradationEnabled: false, upgradationPlanIds: [], createdAt: new Date(), updatedAt: new Date(), ...extra,
});
db.plans.insertMany([
  plan(P.P, 'AutoExt Plan P', 1000),
  plan(P.S, 'AutoExt Source S', 500),
  plan(P.T1, 'AutoExt Target T1 (upgrade 600)', 2000, { upgradationEnabled: true, upgradationPlanIds: [P.S], upgradationPrice: 600 }),
  plan(P.T2, 'AutoExt Target T2 (upgrade 1000)', 2000, { upgradationEnabled: true, upgradationPlanIds: [P.S], upgradationPrice: 1000 }),
  plan(P.R, 'AutoExt Retired-config R', 1000, { extensionEnabled: true, extensionPrice: 10, extensionValidity: 30 }),
  plan(P.W, 'AutoExt Window W', 1000),
  plan(P.I, 'AutoExt Inactive I', 599, { status: 0 }),
]);

// ── users ────────────────────────────────────────────────────────────────────
db.users.insertMany(Object.entries(U).map(([key, id], i) => ({
  _id: oid(id), first_name: `AutoExt ${key}`, password: 'x', customer_id: CUSTOMER_ID,
  mobile: 9300000001 + i, email: `autoext-${key.toLowerCase()}@example.test`, total_coins: 0,
  createdAt: new Date(), updatedAt: new Date(),
})));

// ── orders (successful purchases only; expireDate drives lapsed/active) ──────
const order = (id, userId, planId, grandTotal, expireDays, extra = {}) => {
  const duration = extra.duration ?? 365;
  return {
    _id: oid(id), userId, planId, grandTotal, orderStatus: 'success', status: 1, duration,
    orderDate: at(expireDays - duration), expireDate: at(expireDays), customer_id: CUSTOMER_ID,
    orderNumber: `AUTOEXT-${id.slice(-4)}`, createdAt: at(expireDays - duration), updatedAt: new Date(), ...extra,
  };
};
db.orders.insertMany([
  order(O.LAPSED, U.LAPSED, P.P, 499, -10),
  order(O.ACTIVE_OLD, U.ACTIVE, P.P, 800, -400),
  order(O.ACTIVE_NOW, U.ACTIVE, P.P, 1000, 20),
  order(O.RENEWED_PAID, U.RENEWED, P.P, 900, -200),
  order(O.RENEWED_EXT, U.RENEWED, P.P, 450, -17, { duration: 183, isExtensionOrder: true, extendsOrderId: O.RENEWED_PAID }),
  order(O.GRANTED, U.GRANTED, P.P, 0, -3),
  order(O.ZERO_PAID_PAID, U.ZERO_PAID, P.P, 700, -300),
  order(O.ZERO_PAID_ZERO, U.ZERO_PAID, P.P, 0, -5),
  order(O.ROUND, U.ROUND, P.P, 333, -10),
  order(O.COUPONED, U.COUPONED, P.P, 800, -10, { couponCode: 'OLD20' }),
  order(O.PREC_S, U.PREC, P.S, 500, 100),
  order(O.PREC_T1, U.PREC, P.T1, 2000, -10),
  order(O.PREC_T2, U.PREC, P.T2, 2000, -10),
  order(O.RETIRED, U.RETIRED, P.R, 1000, -10),
  order(O.TWO_PAID_OLD, U.TWO_PAID, P.P, 600, -435),
  order(O.TWO_PAID_NEW, U.TWO_PAID, P.P, 800, -10),
  order(O.IN_WINDOW, U.IN_WINDOW, P.W, 800, 20),
  order(O.FAR, U.FAR, P.W, 800, 40),
  order(O.IW_PAID, U.IW_PAID, P.I, 799, 20),
  order(O.IW_ZERO, U.IW_ZERO, P.I, 0, 20),
]);

// ── coupon: 20 % off, stacks on the offer price ──────────────────────────────
db.coupons.insertOne({
  _id: oid(COUPON_ID), couponCode: 'WINBACK20', couponType: 'percent', couponValue: '20', usage: 'multiple',
  uses: 0, status: 1, startDate: at(-1), expireDate: at(30), customer_id: CUSTOMER_ID, subscriptionsIds: [],
  createdAt: new Date(), updatedAt: new Date(),
});

print(`seeded: ${db.plans.countDocuments({ _id: { $in: Object.values(P).map(oid) } })} plans, ` +
  `${db.users.countDocuments({ _id: { $in: userIds.map(oid) } })} users, ` +
  `${db.orders.countDocuments({ userId: { $in: userIds } })} orders, 1 coupon`);
