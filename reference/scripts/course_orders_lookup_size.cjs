// Read-only: why a course page hits "Total size of documents in orders ... exceeds 104857600 bytes".
// For COURSE (optional) and for the top courses by order count, in vidyagramdb and quicktricksdb: the orders the
// course pipeline's $lookup pulls (courseId, plus build.courseId), their total BSON bytes against the 100 MB cap,
// and the largest top-level fields of the biggest order. Prints sizes and field names only, never field values.
// Run on webserver2-2 from a backend checkout:
//   cd /var/www/backend.quicktricksbysahilsir.com/quicktricks-backend
//   COURSE=<courseId> [TOP=15] node -r dotenv/config - dotenv_config_path=.env.development < course_orders_lookup_size.cjs
'use strict';

const mongoose = require(require.resolve('mongoose', { paths: [process.cwd()] }));
const COURSE = process.env.COURSE;
const TOP = Number(process.env.TOP || 15);
const CAP = 104857600;
const mb = (n) => (n / 1048576).toFixed(1) + ' MB';

const sizeOf = async (orders, field, id) => {
  const [row] = await orders.aggregate([
    { $match: { [field]: id } },
    { $group: { _id: null, n: { $sum: 1 }, bytes: { $sum: { $bsonSize: '$$ROOT' } }, max: { $max: { $bsonSize: '$$ROOT' } } } },
  ], { allowDiskUse: true, maxTimeMS: 120000 }).toArray();
  return row || { n: 0, bytes: 0, max: 0 };
};

(async () => {
  const conn = await mongoose.createConnection(process.env.MONGO_URI).asPromise();
  for (const dbName of ['vidyagramdb', 'quicktricksdb']) {
    const db = conn.useDb(dbName).db;
    const orders = db.collection('orders');
    const courses = db.collection('courses');
    console.log(`\n=== ${dbName}: orders ${await orders.estimatedDocumentCount()}`);

    if (COURSE) {
      const id = new mongoose.Types.ObjectId(COURSE);
      const course = await courses.findOne({ _id: id }, { projection: { title: 1, status: 1 } });
      console.log(`course ${COURSE}: ${course ? JSON.stringify({ title: course.title, status: course.status }) : 'NOT in this db'}`);
      if (course) {
        const direct = await sizeOf(orders, 'courseId', id);
        const build = await sizeOf(orders, 'build.courseId', id);
        console.log(`  courseId:       ${direct.n} orders, ${mb(direct.bytes)}, biggest ${mb(direct.max)}`);
        console.log(`  build.courseId: ${build.n} orders, ${mb(build.bytes)}, biggest ${mb(build.max)}`);
        const [biggest] = await orders.aggregate([
          { $match: { courseId: id } },
          { $sort: { _id: -1 } },
          { $limit: 2000 },
          { $project: { size: { $bsonSize: '$$ROOT' }, fields: { $objectToArray: '$$ROOT' } } },
          { $sort: { size: -1 } },
          { $limit: 1 },
          { $project: { size: 1, fields: { $map: { input: '$fields', as: 'f', in: {
            k: '$$f.k', bytes: { $bsonSize: { $arrayToObject: [[{ k: 'v', v: '$$f.v' }]] } } } } } } },
        ], { allowDiskUse: true, maxTimeMS: 120000 }).toArray();
        if (biggest) {
          const top = biggest.fields.sort((a, b) => b.bytes - a.bytes).slice(0, 6).map((f) => `${f.k}=${f.bytes}`).join(' ');
          console.log(`  biggest of newest 2000: ${biggest.size} bytes; fields ${top}`);
        }
        const byStatus = await orders.aggregate([
          { $match: { courseId: id } },
          { $group: { _id: '$orderStatus', n: { $sum: 1 }, users: { $addToSet: '$userId' } } },
          { $project: { n: 1, users: { $size: '$users' } } },
          { $sort: { n: -1 } },
        ], { allowDiskUse: true, maxTimeMS: 120000 }).toArray();
        console.log('  by orderStatus:', JSON.stringify(byStatus));
      }
    }

    const top = await orders.aggregate([
      { $match: { courseId: { $ne: null } } },
      { $group: { _id: '$courseId', n: { $sum: 1 }, bytes: { $sum: { $bsonSize: '$$ROOT' } } } },
      { $sort: { bytes: -1 } },
      { $limit: TOP },
    ], { allowDiskUse: true, maxTimeMS: 120000 }).toArray();
    const titles = new Map((await courses.find({ _id: { $in: top.map((r) => r._id).filter((x) => x instanceof mongoose.Types.ObjectId) } },
      { projection: { title: 1 } }).toArray()).map((c) => [String(c._id), c.title]));
    console.log(`top ${TOP} courses by order bytes (cap ${mb(CAP)}):`);
    for (const r of top) {
      const flag = r.bytes > CAP ? 'OVER ' : r.bytes > CAP * 0.5 ? 'near ' : '     ';
      console.log(`  ${flag}${String(r._id)} ${String(r.n).padStart(7)} orders ${mb(r.bytes).padStart(10)}  ${titles.get(String(r._id)) ?? ''}`);
    }
    const indexes = await orders.indexes();
    console.log('courseId indexes:', indexes.filter((i) => Object.keys(i.key).some((k) => /courseId/.test(k))).map((i) => i.name).join(', ') || 'NONE');
  }
  await conn.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
