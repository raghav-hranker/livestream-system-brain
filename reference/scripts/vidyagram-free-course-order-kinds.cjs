// Read-only. For every free Vidyagram course (isFree: true), counts the granting orders that list it, split by how
// they arose (AppX transaction kind from trxId: pay_, free_course*, csv_admin, other; or our own checkout/admin) and by
// expiry (active, expired, no expireDate). Answers "who holds a free course through an order, and would expiry lock them".
// Refuses any database but vidyagramdb. Run on webserver2-2 from the Vidyagram checkout:
//   cd /var/www/backend.vidyagramar.com/vidyagram-backend && node ~/vidyagram-free-course-order-kinds.cjs
const { createRequire } = require('module');
const path = require('path');
const r = createRequire(`${process.cwd()}/package.json`);
r('dotenv').config({ path: path.resolve(process.cwd(), process.env.ENV_FILE || '.env.development') });
const { MongoClient } = r('mongoose').mongo;

const kindOf = (o) => {
  const trx = String(o.trxId || '');
  if (!String(o.orderNumber || '').startsWith('APX-')) return o.assignedByAdmin ? 'ours:admin' : 'ours:checkout';
  if (/^pay_/i.test(trx)) return 'apx:pay_';
  if (/^free_course/i.test(trx)) return 'apx:free_course*';
  if (/^csv_admin/i.test(trx)) return 'apx:csv_admin';
  return 'apx:other';
};

(async () => {
  const client = new MongoClient(process.env.MONGO_URI, { serverSelectionTimeoutMS: 15000 });
  await client.connect();
  const db = client.db();
  if (db.databaseName !== 'vidyagramdb') throw new Error(`refusing: database is ${db.databaseName}`);
  const now = new Date();
  const courses = await db.collection('courses').find({ isFree: true }).project({ title: 1, freeAccess: 1, validity: 1 }).toArray();
  const ids = courses.map((c) => c._id);
  const orders = await db.collection('orders')
    .find({ courseId: { $in: ids }, orderStatus: 'success', status: { $ne: 0 } })
    .project({ courseId: 1, trxId: 1, orderNumber: 1, assignedByAdmin: 1, expireDate: 1, grandTotal: 1, userId: 1 }).toArray();
  for (const c of courses) {
    const mine = orders.filter((o) => (o.courseId || []).some((id) => String(id) === String(c._id)));
    const table = {};
    for (const o of mine) {
      const k = kindOf(o);
      const t = (table[k] ??= { orders: 0, users: new Set(), active: 0, expired: 0, noExpiry: 0, paidTotal: 0 });
      t.orders += 1; t.users.add(String(o.userId)); t.paidTotal += Number(o.grandTotal) || 0;
      if (!o.expireDate) t.noExpiry += 1; else if (o.expireDate < now) t.expired += 1; else t.active += 1;
    }
    const rows = Object.entries(table).map(([k, t]) => `${k}: ${t.orders} orders / ${t.users.size} users, active ${t.active}, expired ${t.expired}, no expiry ${t.noExpiry}, ₹${t.paidTotal}`);
    console.log(`\n${c.title} [${c.freeAccess === 'enroll' ? 'ENROLL' : 'open'}] validity=${c.validity ?? '-'} (${c._id})`);
    console.log(rows.length ? `  ${rows.join('\n  ')}` : '  no granting orders');
  }
  await client.close();
})().catch((error) => { console.error(error.message); process.exit(1); });
