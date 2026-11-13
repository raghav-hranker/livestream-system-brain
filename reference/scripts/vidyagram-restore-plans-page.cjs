// Puts course-made plans back on the app's Plans page (adds 'plans' to Plans.displayOn). The course form used to reset an
// on-sale main plan's screens to ['course'] on every save, so the courses switched to course selling on 2026-11-07..09
// dropped off the Plans page while still selling on their course pages. Fixed in the backend (the sync now leaves
// screens alone, and a new length copies the course's); this repairs the plans it already changed.
//
// Only on-sale, active main plans (courseSale.key main:*) of the courses passed with --course; only ever adds 'plans'.
// Refuses any database but vidyagramdb. Writes the touched plans' _id + displayOn to ~/vg-backups before writing.
// Dry run by default. Deploy the backend fix first, or the next save of the course takes the tick off again.
//   MONGO_URI='mongodb://...@127.0.0.1:27018/vidyagramdb?...&directConnection=true&readPreference=primary'
//   NODE_PATH=<backend>/node_modules/mongoose/node_modules:<backend>/node_modules \
//     node vidyagram-restore-plans-page.cjs --course <id> [--course <id> ...] [--commit]
// Restore: for each backed-up row, Plans.updateOne({_id}, {$set: {displayOn: <saved>}}).
const fs = require('fs');
const os = require('os');
const path = require('path');
const { MongoClient, ObjectId } = require('mongodb');

const argv = process.argv.slice(2);
const commit = argv.includes('--commit');
const courseIds = argv.flatMap((arg, i) => (arg === '--course' ? [argv[i + 1]] : []));

(async () => {
  if (courseIds.length === 0) throw new Error('pass --course <id> at least once');
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI is not set');
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 15000, readPreference: 'primary' });
  const db = client.db();
  if (db.databaseName !== 'vidyagramdb') throw new Error(`refusing: database is ${db.databaseName}`);
  await client.connect();

  const filter = {
    'courseSale.courseId': { $in: courseIds.map((id) => new ObjectId(id)) },
    'courseSale.key': /^main:/,
    'courseSale.onSale': true,
    status: 1,
    displayOn: { $type: 'array', $ne: 'plans' },
  };
  const plans = await db.collection('plans').find(filter, { projection: { title: 1, amount: 1, duration: 1, displayOn: 1, 'courseSale.courseId': 1 } }).toArray();
  const seen = new Set(plans.map((plan) => String(plan.courseSale.courseId)));
  for (const plan of plans) console.log(`${plan._id}  ${plan.title}  ₹${plan.amount}/${plan.duration}d  ${JSON.stringify(plan.displayOn)} -> +plans`);
  for (const id of courseIds.filter((id) => !seen.has(id))) console.log(`course ${id}: no on-sale main plan missing the Plans page`);
  console.log(`${plans.length} plans of ${seen.size}/${courseIds.length} courses would get 'plans'`);

  if (commit && plans.length > 0) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const file = path.join(os.homedir(), 'vg-backups', `restore-plans-page-${stamp}.json`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(plans.map((plan) => ({ _id: String(plan._id), displayOn: plan.displayOn })), null, 2));
    console.log(`backup ${file}`);
    const result = await db.collection('plans').updateMany({ ...filter, _id: { $in: plans.map((plan) => plan._id) } }, { $addToSet: { displayOn: 'plans' } });
    console.log(`matched ${result.matchedCount}, modified ${result.modifiedCount}`);
  } else if (!commit) {
    console.log('dry run: pass --commit to write');
  }
  await client.close();
})().catch((error) => { console.error(error.message); process.exit(1); });
