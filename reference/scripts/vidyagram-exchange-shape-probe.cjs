const mongoose = require('mongoose');
(async () => {
  await mongoose.connect(process.env.URI, { serverSelectionTimeoutMS: 8000, readPreference: 'secondaryPreferred' });
  const db = mongoose.connection.db;
  if (db.databaseName !== 'vidyagramdb') throw new Error('refusing: connected to ' + db.databaseName);
  const days = Number(process.env.DAYS || 30);
  const since = new Date(Date.now() - days * 864e5);

  const plansBySize = await db.collection('plans').aggregate([
    { $group: { _id: { status: '$status', courses: { $size: { $ifNull: ['$course', []] } } }, n: { $sum: 1 } } },
    { $sort: { '_id.status': -1, '_id.courses': 1 } },
  ]).toArray();
  console.log('plans by status x course count:', JSON.stringify(plansBySize));

  const coursesInPlans = await db.collection('plans').aggregate([
    { $match: { status: 1 } },
    { $unwind: '$course' },
    { $group: { _id: { $toString: '$course' }, plans: { $sum: 1 } } },
    { $group: { _id: '$plans', courses: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]).toArray();
  console.log('active courses by number of active plans listing them:', JSON.stringify(coursesInPlans));

  const recent = await db.collection('orders').aggregate([
    { $match: { orderStatus: 'success', status: { $ne: 0 }, createdAt: { $gte: since } } },
    { $set: { planOid: { $convert: { input: '$planId', to: 'objectId', onError: null, onNull: null } } } },
    { $lookup: { from: 'plans', localField: 'planOid', foreignField: '_id', pipeline: [{ $project: { n: { $size: { $ifNull: ['$course', []] } } } }], as: 'p' } },
    { $group: {
      _id: {
        gateway: { $ifNull: ['$gateway', '$paymentMode'] },
        paid: { $gt: [{ $toDouble: { $ifNull: ['$grandTotal', 0] } }, 0] },
        planCourses: { $ifNull: [{ $first: '$p.n' }, -1] },
        build: { $gt: [{ $ifNull: ['$build.courseId', null] }, null] },
      },
      n: { $sum: 1 },
    } },
    { $sort: { n: -1 } },
  ]).toArray();
  console.log(`success orders created in last ${days}d by gateway x paid x plan course count x build:`);
  recent.forEach(r => console.log(' ', JSON.stringify(r)));

  await mongoose.disconnect();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
