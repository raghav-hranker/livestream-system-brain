// Grant one Vidyagram account access to every course, for QA: a single ₹0 admin order whose
// courseId lists all courses (Vidyagram's plans cover only 20 of them, so assign-plan can't).
// Same shape as the admin's "assign for free" order, without an invoice. Idempotent: re-running
// refreshes the course list and expiry of the same order instead of adding another.
// Revoke: set orderStatus to "aborted" on orderNumber TEST-ALL-COURSES-20261019.
//
// Run on webserver2-2 from the Vidyagram backend checkout:
//   cd /var/www/backend.vidyagramar.com/vidyagram-backend
//   node -r dotenv/config ~/vidyagram-test-access-all-courses.cjs dotenv_config_path=.env.development
'use strict';

// Loaded from the backend checkout this is run in, not from where the script file lives.
const mongoose = require(require.resolve('mongoose', { paths: [process.cwd()] }));

const USER_ID = '6acfcbb2194fc7878e622279'; // mobile 9643713929
const ORDER_NUMBER = 'TEST-ALL-COURSES-20261019';

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: 'vidyagramdb', readPreference: 'primary' });
  const db = mongoose.connection.db;
  const user = await db.collection('users').findOne({ _id: new mongoose.Types.ObjectId(USER_ID) }, { projection: { _id: 1 } });
  if (!user) throw new Error(`user ${USER_ID} not found in vidyagramdb`);

  const courseIds = (await db.collection('courses').find({}, { projection: { _id: 1 } }).toArray()).map((c) => String(c._id));
  const now = new Date();
  const expireDate = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

  const res = await db.collection('orders').updateOne(
    { orderNumber: ORDER_NUMBER, customer_id: 781 },
    {
      $set: {
        userId: USER_ID,
        courseId: courseIds,
        orderStatus: 'success',
        status: 1,
        daysLeft: 365,
        duration: 365,
        expireDate,
        updatedAt: now,
      },
      $setOnInsert: {
        planId: null,
        packageId: [],
        latestCourseId: [],
        ebookId: [],
        courseBatchId: [],
        practiceBatchId: [],
        grandTotal: 0,
        originalAmount: 0,
        discountAmount: 0,
        planFor: 'All Vidyagram courses (test access)',
        type: 'free_admin_assignment',
        orderVia: 'admin',
        gateway: 'free',
        remarks: 'Test access for Raghav (QA): every course. To revoke set orderStatus=aborted.',
        customer_id: 781,
        orderNumber: ORDER_NUMBER,
        orderId: 'test_all_courses_20261019',
        orderDate: now,
        givenForFree: true,
        assignedByAdmin: true,
        assignedPlanAt: now,
        buyAll: 0,
        coins: 0,
        walletAmountUsed: 0,
        mergedFromOrderNumbers: [],
        createdAt: now,
      },
    },
    { upsert: true },
  );
  const order = await db.collection('orders').findOne({ orderNumber: ORDER_NUMBER, customer_id: 781 }, { projection: { _id: 1, courseId: 1, expireDate: 1 } });
  console.log(`${res.upsertedCount ? 'created' : 'updated'} order ${order._id}: ${order.courseId.length} courses, expires ${order.expireDate.toISOString().slice(0, 10)}`);
  await mongoose.disconnect();
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
