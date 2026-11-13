// Run from the Vidyagram backend checkout on webserver2-2:
//   ssh … 'cd /var/www/backend.vidyagramar.com/vidyagram-backend && node -' < vidyagram-create-test-faculty.cjs
// Re-running finds the faculty by name instead of adding another.
// Restore: db.facultydetails.deleteOne({ _id: <printed id> }) once no course lists it.
require('dotenv').config({ path: '.env.development' });
const mongoose = require('mongoose');

const NAME = process.env.TEST_FACULTY_NAME || 'Test Faculty (QA)';

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: 'vidyagramdb', readPreference: 'primary' });
  if (mongoose.connection.db.databaseName !== 'vidyagramdb') throw new Error(`wrong db ${mongoose.connection.db.databaseName}`);
  const FacultyDetails = require('./dist/src/models/facultyDetails').default;

  const existing = await FacultyDetails.findOne({ name: NAME }).lean();
  if (existing) {
    console.log('exists', String(existing._id), existing.name, 'status', existing.status);
    return;
  }

  const team = await FacultyDetails.findOne({ name: 'Vidyagram Team' }).lean();
  const created = await FacultyDetails.create({
    name: NAME,
    designation: 'Test',
    bio: 'Test faculty for admin and app QA. Not a real teacher.',
    experience: '1 Year',
    reach: 'QA only',
    description: 'Test faculty for checking multi-faculty ordering. Remove from courses before launch.',
    status: 1,
    priority: 0,
    ...(team?.customer_id != null ? { customer_id: team.customer_id } : {}),
  });
  console.log('created', String(created._id), created.name, 'customer_id', created.customer_id ?? null,
    'faculty total', await FacultyDetails.countDocuments());
})()
  .catch((err) => { console.error(err.message); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
