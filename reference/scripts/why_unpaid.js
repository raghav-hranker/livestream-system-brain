// Why does /api/courses/by-id-2 say is_buy=0 for this user+course?
// Run on the prod box from the backend checkout:
//   DOTENV_CONFIG_PATH=.env.development node -r dotenv/config ~/why_unpaid.js <userId> <courseId>
const mongoose = require('mongoose');
const { Types } = mongoose;
const [U, C] = process.argv.slice(2);
(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const now = new Date();
  const p = (l, o) => console.log(l, JSON.stringify(o, null, 1));
  p('NOW', now);
  p('user', await db.collection('users').findOne({ _id: new Types.ObjectId(U) }, { projection: { name: 1, phone: 1, mobile: 1, email: 1, user_id: 1 } }));
  p('course', await db.collection('courses').findOne({ _id: new Types.ObjectId(C) }, { projection: { title: 1, status: 1, isFree: 1 } }));
  const proj = { userId: 1, orderStatus: 1, status: 1, expireDate: 1, courseId: 1, latestCourseId: 1, planId: 1, grandTotal: 1, createdAt: 1, paymentId: 1, razorpayOrderId: 1, razorpayPaymentId: 1, trxId: 1, orderType: 1 };
  const orders = await db.collection('orders').find({ $or: [{ userId: U }, { userId: new Types.ObjectId(U) }] }, { projection: proj }).sort({ createdAt: -1 }).limit(20).toArray();
  p(`orders for user (${orders.length}, newest first)`, orders);
  const touching = await db.collection('orders').find({ $or: [{ courseId: new Types.ObjectId(C) }, { courseId: C }, { latestCourseId: C }] }, { projection: proj }).sort({ createdAt: -1 }).limit(5).toArray();
  p('last 5 orders (any user) on this course', touching);
  const plans = await db.collection('plans').find({ course: new Types.ObjectId(C) }, { projection: { title: 1, name: 1, status: 1, course: 1 } }).toArray();
  p('plans containing course', plans.map(x => ({ ...x, course: x.course.length + ' courses' })));
  // the exact entitlement filter addIsPaidToCourses uses
  const active = await db.collection('orders').find({ userId: U, orderStatus: 'success', status: { $ne: 0 },
    $or: [{ expireDate: { $exists: false } }, { expireDate: null }, { expireDate: { $gte: now } }] }, { projection: proj }).toArray();
  p('ACTIVE orders per addIsPaidToCourses filter', active);
  await mongoose.disconnect();
})().catch(e => { console.error(e); process.exit(1); });
