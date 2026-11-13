// Read-only, refuses any DB but vidyagramdb. Students whose only route to a course is a switched-off plan.
// For every course-made plan (courseSale) at status 0: the students holding an unexpired granting order on it
// (orderStatus success, status != 0, expireDate null or in the future), minus those who own the plan's course some
// other way, by the rule in services/courseScope.ts (loadScopeOrders): an order whose `courseId` or `latestCourseId`
// ARRAY lists the course, or whose plan is status 1 and lists it in `Plans.course`. What is left cannot open the course.
// One JSON line per plan, then totals and up to SAMPLE (5) locked user ids per plan for a manual check.
//   cd ~/Projects/worktrees/vg-backend && node - < ~/Projects/system-brain/reference/scripts/vidyagram-off-plan-access-probe.cjs
require('dotenv').config({ path: '.env.development', quiet: true });
const mongoose = require('mongoose');

const SAMPLE = Number(process.env.SAMPLE) || 5;
const out = (o) => console.log(JSON.stringify(o));
const both = (id) => [String(id), new mongoose.Types.ObjectId(String(id))];

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { readPreference: 'secondaryPreferred' });
  try {
    const db = mongoose.connection.db;
    if (db.databaseName !== 'vidyagramdb') throw new Error(`refusing: ${db.databaseName}`);
    const orders = db.collection('orders');
    const now = new Date();
    const granting = { orderStatus: 'success', status: { $ne: 0 }, $or: [{ expireDate: null }, { expireDate: { $gt: now } }] };
    const offPlans = await db.collection('plans').find({ 'courseSale.courseId': { $exists: true }, status: { $ne: 1 } },
      { projection: { name: 1, status: 1, course: 1, courseSale: 1, updatedAt: 1 } }).toArray();
    const totals = { offPlans: offPlans.length, holders: 0, locked: 0 };
    for (const plan of offPlans) {
      const courseId = String(plan.courseSale.courseId);
      const holders = await orders.distinct('userId', { ...granting, planId: { $in: both(plan._id) } });
      // Plans that are on and list the course: an order on any of them grants it.
      const onPlans = await db.collection('plans').find({ status: 1, course: { $in: both(courseId) } }, { projection: { _id: 1 } }).toArray();
      const onPlanIds = onPlans.flatMap((p) => both(p._id));
      const owners = await orders.distinct('userId', {
        ...granting,
        $and: [{ $or: [
          { courseId: { $type: 'array', $in: both(courseId) } },
          { latestCourseId: { $type: 'array', $in: both(courseId) } },
          ...(onPlanIds.length ? [{ planId: { $in: onPlanIds } }] : []),
        ] }],
      });
      const own = new Set(owners.map(String));
      const locked = holders.map(String).filter((u) => !own.has(u));
      // How the holders' orders on this plan carry the course: array, a bare string / ObjectId, or nothing.
      const shapes = await orders.aggregate([
        { $match: { ...granting, planId: { $in: both(plan._id) } } },
        { $group: { _id: { courseId: { $type: '$courseId' }, latest: { $type: '$latestCourseId' }, empty: { $cond: [{ $isArray: '$courseId' }, { $eq: [{ $size: '$courseId' }, 0] }, null] } }, n: { $sum: 1 } } },
        { $sort: { n: -1 } }, { $limit: 6 },
      ]).toArray();
      totals.holders += holders.length;
      totals.locked += locked.length;
      out({ plan: String(plan._id), name: String(plan.name || '').slice(0, 45), course: courseId, planStatus: plan.status, offSince: plan.updatedAt,
        otherOnPlans: onPlans.length, holders: holders.length, locked: locked.length, sample: locked.slice(0, SAMPLE),
        orderShapes: shapes.map((s) => ({ ...s._id, n: s.n })) });
    }
    out({ totals });
  } finally {
    await mongoose.disconnect();
  }
})().catch((e) => { console.error(e.message); process.exit(1); });
