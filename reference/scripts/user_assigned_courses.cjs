// Read-only: how many courses a user (by mobile) holds through active orders, in quicktricksdb and vidyagramdb.
// Access = union over active orders (addIsPaidToCourses filter) of courseId, latestCourseId and the plan's course bundle.
// Run on webserver2-2 from a backend checkout:
//   cd /var/www/backend.quicktricksbysahilsir.com/quicktricks-backend
//   MOBILE=9643713929 [USER_IDS=id1,id2] node -r dotenv/config - dotenv_config_path=.env.development < user_assigned_courses.cjs
'use strict';

const mongoose = require(require.resolve('mongoose', { paths: [process.cwd()] }));
const MOBILE = process.env.MOBILE;
const USER_IDS = (process.env.USER_IDS || '').split(',').filter(Boolean);
if (!MOBILE && !USER_IDS.length) throw new Error('set MOBILE or USER_IDS');

const ids = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]).map(String).filter((x) => /^[0-9a-f]{24}$/.test(x));

(async () => {
  const conn = await mongoose.createConnection(process.env.MONGO_URI).asPromise();
  for (const dbName of ['quicktricksdb', 'vidyagramdb']) {
    const db = conn.useDb(dbName).db;
    const users = await db.collection('users').find(
      { $or: [
        ...(MOBILE ? [{ mobile: MOBILE }, { phone: MOBILE }, { mobile: Number(MOBILE) }, { phone: Number(MOBILE) }] : []),
        { _id: { $in: USER_IDS.map((x) => new mongoose.Types.ObjectId(x)) } },
      ] },
      { projection: { name: 1, mobile: 1, isDeleted: 1, deletedAt: 1, status: 1 } }).toArray();
    for (const u of users) {
      const U = String(u._id);
      const now = new Date();
      const orders = await db.collection('orders').find({
        $or: [{ userId: U }, { userId: u._id }], orderStatus: 'success', status: { $ne: 0 },
        $and: [{ $or: [{ expireDate: { $exists: false } }, { expireDate: null }, { expireDate: { $gte: now } }] }],
      }, { projection: { courseId: 1, latestCourseId: 1, planId: 1, orderNumber: 1, expireDate: 1 } }).toArray();
      // every order of the user, to explain an empty active set
      const allOrders = await db.collection('orders').aggregate([
        { $match: { $or: [{ userId: U }, { userId: u._id }] } },
        { $group: { _id: { orderStatus: '$orderStatus', status: '$status', expired: { $lt: ['$expireDate', now] } },
          n: { $sum: 1 }, last: { $max: '$updatedAt' } } },
      ]).toArray();
      const planIds = [...new Set(orders.flatMap((o) => ids(o.planId)))];
      const plans = planIds.length ? await db.collection('plans').find(
        { _id: { $in: planIds.map((x) => new mongoose.Types.ObjectId(x)) } }, { projection: { course: 1 } }).toArray() : [];
      const planCourses = new Map(plans.map((p) => [String(p._id), ids(p.course)]));
      const all = new Set();
      const perOrder = orders.map((o) => {
        const c = new Set([...ids(o.courseId), ...ids(o.latestCourseId), ...ids(o.planId).flatMap((p) => planCourses.get(p) || [])]);
        c.forEach((x) => all.add(x));
        return { order: String(o._id), orderNumber: o.orderNumber, expires: o.expireDate, courses: c.size };
      });
      const existing = await db.collection('courses').find(
        { _id: { $in: [...all].map((x) => new mongoose.Types.ObjectId(x)) } }, { projection: { status: 1 } }).toArray();
      console.log(JSON.stringify({
        db: dbName, userId: U, name: u.name, mobile: u.mobile, userStatus: u.status, isDeleted: u.isDeleted,
        allOrders: allOrders.map((g) => ({ ...g._id, n: g.n, lastUpdated: g.last })), activeOrders: orders.length, perOrder,
        distinctCourses: all.size, existingCourses: existing.length,
        activeCourses: existing.filter((c) => c.status === 1 || c.status === '1').length,
      }, null, 1));
    }
    if (!users.length) console.log(JSON.stringify({ db: dbName, users: 0 }));
  }
  await conn.close();
})().catch((e) => { console.error(e); process.exit(1); });
