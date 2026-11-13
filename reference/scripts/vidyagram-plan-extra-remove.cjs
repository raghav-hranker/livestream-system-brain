// WRITES only with COMMIT=1. Refuses any DB but vidyagramdb. Takes one extra course (EXTRA_ID) off one plan's course
// list (PLAN_ID): the "Also on this course's plan" item the admin cannot remove. Refuses unless the extra course is
// inactive (status 0) and is not the plan's own course or one of its combo sub courses. Orders are not touched.
// Dry run prints the list before and what it would become. Restore = put the printed "before" list back.
// Run on webserver2-2 from the Vidyagram checkout:
// PLAN_ID=<id> EXTRA_ID=<id> [COMMIT=1] node -r dotenv/config - dotenv_config_path=.env.development < script
const mongoose = require('mongoose');
const { ObjectId } = mongoose.Types;
(async () => {
  const planId = String(process.env.PLAN_ID || ''), extraId = String(process.env.EXTRA_ID || '');
  const commit = process.env.COMMIT === '1';
  if (![planId, extraId].every(id => /^[0-9a-f]{24}$/.test(id))) throw new Error('set PLAN_ID and EXTRA_ID');
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 8000, readPreference: 'primary' });
  const db = mongoose.connection.db;
  if (db.databaseName !== 'vidyagramdb') throw new Error('refusing: connected to ' + db.databaseName);
  const plans = db.collection('plans');
  const plan = await plans.findOne({ _id: new ObjectId(planId) }, { projection: { name: 1, status: 1, course: 1, courseSale: 1 } });
  if (!plan) throw new Error('no such plan');
  const extra = await db.collection('courses').findOne({ _id: new ObjectId(extraId) }, { projection: { title: 1, status: 1 } });
  const before = (plan.course || []).map(String);
  console.log('PLAN  ', plan.name, '| status', plan.status);
  console.log('EXTRA ', extra ? `${extra.title} | status ${extra.status}` : '(course record not found)');
  console.log('before', JSON.stringify(before));
  if (!before.includes(extraId)) { console.log('Nothing to do: the plan does not list it.'); return mongoose.disconnect(); }
  const own = [plan.courseSale && plan.courseSale.courseId, ...((plan.courseSale && plan.courseSale.comboCourses) || [])].filter(Boolean).map(String);
  if (own.includes(extraId)) throw new Error('refusing: that is the plan\'s own course or a sub course');
  if (extra && Number(extra.status) !== 0) throw new Error('refusing: the extra course is active (status ' + extra.status + ')');
  console.log('after ', JSON.stringify(before.filter(id => id !== extraId)));
  if (!commit) { console.log('DRY RUN: nothing written. Add COMMIT=1 to write.'); return mongoose.disconnect(); }
  const res = await plans.updateOne({ _id: plan._id }, { $pull: { course: { $in: [extraId, new ObjectId(extraId)] } } });
  const now = await plans.findOne({ _id: plan._id }, { projection: { course: 1 } });
  console.log('WRITTEN modified', res.modifiedCount, '| now', JSON.stringify((now.course || []).map(String)));
  await mongoose.disconnect();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
