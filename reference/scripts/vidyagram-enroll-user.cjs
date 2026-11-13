// Enrolls one Vidyagram student, found by mobile, in enroll-mode free courses through the deployed backend's own
// service (dist/src/services/courseEnrollment.js `enrollInCourse`), so the write is exactly what the Enroll tap does.
// Use it for a staff or test account when no student token is at hand. Dry run by default: prints the user and each
// course's free mode and existing enrollment. Refuses any database but vidyagramdb. Run on webserver2-2:
//   cd /var/www/backend.vidyagramar.com/vidyagram-backend && node ~/vidyagram-enroll-user.cjs <mobile> <courseId>... [--commit]
// Undo: db.courseenrollments.deleteMany({ userId: ObjectId('<printed userId>'), courseId: { $in: [...] } })
const { createRequire } = require('module');
const fs = require('fs');
const path = require('path');
const r = createRequire(`${process.cwd()}/package.json`);
const mongoose = r('mongoose');

const env = fs.readFileSync(path.resolve(process.cwd(), process.env.ENV_FILE || '.env.development'), 'utf8');
const envVar = (k) => (env.match(new RegExp(`^${k}=(.*)$`, 'm')) || [])[1]?.trim().replace(/^['"]|['"]$/g, '');
const args = process.argv.slice(2).filter((a) => a !== '--commit');
const commit = process.argv.includes('--commit');
const [mobile, ...courseIds] = args;
if (!mobile || courseIds.length === 0) throw new Error('usage: <mobile> <courseId>... [--commit]');

(async () => {
  await mongoose.connect(envVar('MONGO_URI'), { readPreference: 'primary', autoIndex: false, serverSelectionTimeoutMS: 15000 });
  const db = mongoose.connection.db;
  if (db.databaseName !== 'vidyagramdb') throw new Error(`refusing: database is ${db.databaseName}`);
  const digits = mobile.replace(/\D/g, '').slice(-10);
  const users = await db.collection('users')
    .find({ mobile: { $in: [digits, `91${digits}`, `+91${digits}`, Number(digits)] } })
    .project({ _id: 1, name: 1, mobile: 1, customer_id: 1 }).toArray();
  console.log(`users for ${digits}:`, users.map((u) => ({ _id: String(u._id), name: u.name, mobile: u.mobile, customer_id: u.customer_id })));
  if (users.length !== 1) throw new Error(`need exactly one user, found ${users.length}`);
  const userId = String(users[0]._id);
  for (const courseId of courseIds) {
    const course = await db.collection('courses').findOne({ _id: new mongoose.Types.ObjectId(courseId) }, { projection: { title: 1, isFree: 1, freeAccess: 1, status: 1 } });
    const existing = await db.collection('courseenrollments').findOne({ userId: users[0]._id, courseId: new mongoose.Types.ObjectId(courseId) });
    console.log(courseId, course && { title: course.title, isFree: course.isFree, freeAccess: course.freeAccess, status: course.status }, 'enrolled:', existing ? existing.enrolledAt : false);
  }
  if (!commit) {
    console.log('dry run: pass --commit to enroll');
  } else {
    const { enrollInCourse } = require(path.resolve(process.cwd(), 'dist/src/services/courseEnrollment.js'));
    for (const courseId of courseIds) console.log(courseId, 'enrollInCourse →', await enrollInCourse(userId, courseId));
  }
  await mongoose.disconnect();
})().catch(async (error) => { console.error(error.message); await mongoose.disconnect().catch(() => {}); process.exit(1); });
