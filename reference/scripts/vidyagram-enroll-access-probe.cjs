// Shows the enroll-to-unlock rule on one real Vidyagram student through the deployed access checks
// (dist/src/services/classAccessAuthz.js). For each enroll-mode course it picks a class the student can only reach
// through that course, then asks authorizeClassAccess and authorizeCourseAccess twice: with the student's orders
// (real access) and with orders hidden (what a student without a purchase gets). Orders are only hidden inside the
// check; nothing writes to orders.
// Dry run: prints the checks as things stand. --commit: deletes the student's enrollment rows for these courses,
// checks (locked), enrolls through enrollInCourse, checks again (unlocked). Refuses any database but vidyagramdb.
//   cd /var/www/backend.vidyagramar.com/vidyagram-backend && node ~/vidyagram-enroll-access-probe.cjs <mobile> <courseId>... [--commit]
const { createRequire } = require('module');
const path = require('path');
const r = createRequire(`${process.cwd()}/package.json`);
r('dotenv').config({ path: path.resolve(process.cwd(), process.env.ENV_FILE || '.env.development') });
const mongoose = r('mongoose');

const commit = process.argv.includes('--commit');
const [mobile, ...courseIds] = process.argv.slice(2).filter((a) => a !== '--commit');
if (!mobile || courseIds.length === 0) throw new Error('usage: <mobile> <courseId>... [--commit]');
const dist = (p) => require(path.resolve(process.cwd(), 'dist/src', p));

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { readPreference: 'primary', autoIndex: false, serverSelectionTimeoutMS: 15000 });
  const db = mongoose.connection.db;
  if (db.databaseName !== 'vidyagramdb') throw new Error(`refusing: database is ${db.databaseName}`);
  const authz = dist('services/classAccessAuthz.js');
  const { enrollInCourse } = dist('services/courseEnrollment.js');
  const oid = (id) => new mongoose.Types.ObjectId(id);

  const digits = mobile.replace(/\D/g, '').slice(-10);
  const users = await db.collection('users').find({ mobile: { $in: [digits, `91${digits}`, `+91${digits}`, Number(digits)] } }).project({ _id: 1 }).toArray();
  if (users.length !== 1) throw new Error(`need exactly one user, found ${users.length}`);
  const userId = String(users[0]._id);
  console.log(`user ${userId}`);

  const noOrders = { findActiveOrdersForUser: async () => [] };
  const classDeps = { real: authz.mongoAuthorizationDeps, noOrders: { ...authz.mongoAuthorizationDeps, ...noOrders } };
  const courseDeps = { real: authz.mongoCourseAuthorizationDeps, noOrders: { ...authz.mongoCourseAuthorizationDeps, ...noOrders } };
  const verdict = (res) => (res.allowed ? 'ALLOWED' : `403 ${res.code}`);

  const probeClass = {};
  for (const courseId of courseIds) {
    const rows = await db.collection('courseclasses').find({ course: oid(courseId), isActive: true, status: 1 }).project({ class: 1 }).limit(200).toArray();
    for (const row of rows) {
      const placements = await authz.mongoAuthorizationDeps.findCoursesForClass(String(row.class));
      const cls = await authz.mongoAuthorizationDeps.findClassById(String(row.class));
      const onlyThroughEnroll = cls && !cls.isFree && placements.every((p) => !p.placementIsFree && p.courseMode !== 'open');
      if (onlyThroughEnroll) { probeClass[courseId] = String(row.class); break; }
    }
    console.log(`${courseId}: probe class ${probeClass[courseId] ?? 'none found'} (of ${rows.length} placements read)`);
  }

  const check = async (label) => {
    console.log(`\n--- ${label}`);
    for (const courseId of courseIds) {
      const enrolled = await db.collection('courseenrollments').findOne({ userId: oid(userId), courseId: oid(courseId) });
      const out = { enrollment: enrolled ? enrolled.enrolledAt.toISOString() : 'none' };
      for (const mode of ['real', 'noOrders']) {
        out[`course(${mode})`] = verdict(await authz.authorizeCourseAccess({ userId, isAdmin: false, courseId }, courseDeps[mode]));
        if (probeClass[courseId]) {
          out[`class(${mode})`] = verdict(await authz.authorizeClassAccess({ userId, isAdmin: false, classId: probeClass[courseId], accessKind: 'play' }, classDeps[mode]));
        }
      }
      console.log(courseId, JSON.stringify(out));
    }
  };

  await check('as things stand');
  if (commit) {
    const removed = await db.collection('courseenrollments').deleteMany({ userId: oid(userId), courseId: { $in: courseIds.map(oid) } });
    console.log(`\nremoved ${removed.deletedCount} enrollment row(s)`);
    await check('LOCKED: no enrollment');
    for (const courseId of courseIds) console.log(courseId, 'enrollInCourse →', JSON.stringify(await enrollInCourse(userId, courseId)));
    await check('UNLOCKED: after Enroll');
  } else {
    console.log('\ndry run: pass --commit to reset, enroll and re-check');
  }
  await mongoose.disconnect();
})().catch(async (error) => { console.error(error.stack || error.message); await mongoose.disconnect().catch(() => {}); process.exit(1); });
