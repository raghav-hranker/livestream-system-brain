// Read-only, vidyagramdb only: the stored `certificate` block of one course (COURSE=<id>), plus every course
// whose certificate.courseCompleteBy is an object without a valid ObjectId `id`. Such a block fails Mongoose
// validation on every course save ("certificate.courseCompleteBy.id: Path `id` is required"), so the admin
// course edit page cannot save anything on that course.
// Run on webserver2-2 from the Vidyagram checkout:
//   cd /var/www/backend.vidyagramar.com/vidyagram-backend && COURSE=<id> node -r dotenv/config - dotenv_config_path=.env.development < vidyagram-course-certificate-shape.cjs
// The backend checkout has mongoose but no top-level mongodb package; use the driver mongoose bundles.
const { MongoClient, ObjectId } = require('mongoose').mongo;

(async () => {
  const client = await MongoClient.connect(process.env.MONGO_URI, { readPreference: 'primary' });
  const db = client.db();
  if (db.databaseName !== 'vidyagramdb') throw new Error(`refusing: database is ${db.databaseName}, not vidyagramdb`);
  const courses = db.collection('courses');

  if (process.env.COURSE) {
    const doc = await courses.findOne({ _id: new ObjectId(process.env.COURSE) }, { projection: { title: 1, certificate: 1, updatedAt: 1 } });
    console.log('course', JSON.stringify(doc, null, 1));
  }

  const bad = await courses.find(
    {
      'certificate.courseCompleteBy': { $type: 'object' },
      'certificate.courseCompleteBy.id': { $not: { $type: 'objectId' } },
    },
    { projection: { title: 1, certificate: 1 } },
  ).toArray();
  console.log(`courses with a courseCompleteBy lacking an ObjectId id: ${bad.length}`);
  for (const c of bad) console.log(String(c._id), JSON.stringify(c.title), JSON.stringify(c.certificate));

  await client.close();
})().catch((e) => { console.error(e); process.exit(1); });
