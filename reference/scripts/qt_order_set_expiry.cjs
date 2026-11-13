// One student's orders (by EMAIL), and a one-year expiry for one of them (ORDER_NUMBER). Dry run unless COMMIT=1.
// New expiry = order createdAt + 1 calendar year; duration becomes that span in days, daysLeft the days remaining.
// Refuses unless: quicktricks DB, order is success, purchase day (IST) = PURCHASE_DAY, current expiry is more
// than 2 years away, new expiry is still in the future.
// Run on webserver2-2 from the quicktricks checkout, with the script on stdin:
//   EMAIL=a@b.c ORDER_NUMBER=APX-1 PURCHASE_DAY=2026-08-21 [COMMIT=1] node -r dotenv/config - dotenv_config_path=.env.development < qt_order_set_expiry.cjs
// Undo: EMAIL=a@b.c ORDER_NUMBER=APX-1 UNDO=<backup file> COMMIT=1, same command.
'use strict';

const fs = require('fs');
const path = require('path');
const mongoose = require(require.resolve('mongoose', { paths: [process.cwd()] }));

const EMAIL = String(process.env.EMAIL || '').trim();
const ORDER_NUMBER = String(process.env.ORDER_NUMBER || '').trim();
const PURCHASE_DAY = process.env.PURCHASE_DAY;
const COMMIT = process.env.COMMIT === '1';
const UNDO = process.env.UNDO;
const DAY_MS = 86400000;
if (!EMAIL || !ORDER_NUMBER) throw new Error('set EMAIL and ORDER_NUMBER');
if (!UNDO && !PURCHASE_DAY) throw new Error('set PURCHASE_DAY (YYYY-MM-DD, IST)');

const istDay = (d) => new Date(new Date(d).getTime() + 5.5 * 3600000).toISOString().slice(0, 10);
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const fail = (m) => { throw new Error(`REFUSED: ${m}`); };

(async () => {
  const conn = await mongoose.createConnection(process.env.MONGO_URI, { readPreference: 'primary' }).asPromise();
  const db = conn.db;
  if (!/^quicktricks/.test(db.databaseName)) fail(`DB is ${db.databaseName}`);
  const users = await db.collection('users').find(
    { email: new RegExp(`^${escapeRe(EMAIL)}$`, 'i') }, { projection: { name: 1, status: 1 } }).toArray();
  if (users.length !== 1) fail(`${users.length} users match this email`);
  const user = users[0];
  const userId = String(user._id);
  const orders = db.collection('orders');
  const now = Date.now();
  const view = (o) => ({
    id: String(o._id), orderNumber: o.orderNumber, orderId: o.orderId, grandTotal: o.grandTotal,
    orderStatus: o.orderStatus, status: o.status, givenForFree: o.givenForFree, planId: o.planId,
    orderDate: o.orderDate, createdAt: o.createdAt, expireDate: o.expireDate, duration: o.duration, storedDaysLeft: o.daysLeft,
    daysLeftNow: o.expireDate ? Math.ceil((new Date(o.expireDate).getTime() - now) / DAY_MS) : null,
  });

  const all = await orders.find({ $or: [{ userId }, { userId: user._id }] }).sort({ createdAt: -1 }).toArray();
  console.log(JSON.stringify({ db: db.databaseName, userId, name: user.name, userStatus: user.status, orders: all.length }));
  all.forEach((o) => console.log(JSON.stringify(view(o))));

  const matches = all.filter((o) => o.orderNumber === ORDER_NUMBER);
  if (matches.length !== 1) fail(`${matches.length} of this user's orders have orderNumber ${ORDER_NUMBER}`);
  const order = matches[0];

  let update;
  let backupFile = null;
  if (UNDO) {
    const saved = JSON.parse(fs.readFileSync(UNDO, 'utf8'));
    if (saved.id !== String(order._id)) fail('backup is for a different order');
    const $set = {};
    const $unset = {};
    if (saved.expireDate) $set.expireDate = new Date(saved.expireDate); else $unset.expireDate = '';
    for (const k of ['duration', 'daysLeft']) { if (saved[k] != null) $set[k] = saved[k]; else $unset[k] = ''; }
    update = { $set, ...(Object.keys($unset).length ? { $unset } : {}) };
  } else {
    if (order.orderStatus !== 'success') fail(`orderStatus is ${order.orderStatus}`);
    const day = istDay(order.createdAt);
    if (day !== PURCHASE_DAY) fail(`createdAt is ${day} IST, expected ${PURCHASE_DAY}`);
    if (!order.expireDate || new Date(order.expireDate).getTime() < now + 2 * 365 * DAY_MS) fail(`current expiry ${order.expireDate} is not over 2 years away`);
    const next = new Date(order.createdAt);
    next.setUTCFullYear(next.getUTCFullYear() + 1);
    if (next.getTime() <= now) fail(`new expiry ${next.toISOString()} is already past`);
    const span = Math.round((next.getTime() - new Date(order.createdAt).getTime()) / DAY_MS);
    // Stored daysLeft holds days remaining, not the total span (it equals the remaining count on this student's other orders).
    update = { $set: { expireDate: next, duration: span, daysLeft: Math.ceil((next.getTime() - now) / DAY_MS) } };
  }
  console.log(JSON.stringify({ mode: COMMIT ? 'COMMIT' : 'DRY RUN', order: String(order._id), update }));

  if (COMMIT) {
    if (!UNDO) {
      const dir = path.join(process.env.HOME, 'prod-backups');
      fs.mkdirSync(dir, { recursive: true });
      backupFile = path.join(dir, `order-expiry-${ORDER_NUMBER}-${new Date().toISOString().replace(/[:.]/g, '')}.json`);
      fs.writeFileSync(backupFile, JSON.stringify({
        id: String(order._id), userId, orderNumber: ORDER_NUMBER,
        expireDate: order.expireDate, duration: order.duration, daysLeft: order.daysLeft,
      }, null, 1), { mode: 0o600 });
    }
    const res = await orders.updateOne({ _id: order._id, expireDate: order.expireDate }, { ...update, $currentDate: { updatedAt: true } });
    const after = await orders.findOne({ _id: order._id });
    console.log(JSON.stringify({ matched: res.matchedCount, modified: res.modifiedCount, backupFile, after: view(after) }));
  }
  await conn.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
