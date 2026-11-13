// Vidyagram: create the real teachers' FacultyDetails profiles (report
// vidyagram/reports/vidyagram-appx-teacher-source-2026-10-22.md, appendix). Names and subjects come from AppX
// class titles, folders and course descriptions. Experience and reach are not known yet: "—" until the client
// sends them. Dry run by default; COMMIT=1 writes. Run from the Vidyagram backend checkout on webserver2-2:
//   ssh … 'cd /var/www/backend.vidyagramar.com/vidyagram-backend && node -' < vidyagram-create-faculties.cjs
//   ssh … 'cd /var/www/backend.vidyagramar.com/vidyagram-backend && COMMIT=1 node -' < vidyagram-create-faculties.cjs
// Re-running skips a name that already exists (case-insensitive), so it never adds a second profile.
// Restore: db.facultydetails.deleteMany({ _id: { $in: [<printed ids>] } }) once no class or course points at them.
require('dotenv').config({ path: '.env.development' });
const mongoose = require('mongoose');

const COMMIT = process.env.COMMIT === '1';

// [name, subject chip, description]
const TEACHERS = [
  ['Aditya Ranjan Sir', 'Maths', 'Maths Expert'],
  ['Jai Sir', 'English', 'English Expert'],
  ["Shubham Grover Ma'am", 'Static GK & Computer', 'Static GK & Computer Expert'],
  ['Deepak Sir', 'GK/GS', 'GS Expert'],
  ["Arti Ma'am", 'Science', 'Science Expert'],
  ['Akash Chaturvedi Sir', 'Reasoning', 'Reasoning Expert'],
  ['Anurag Sir', 'Maths', 'Maths Expert'],
  ['Himanshu Sir', 'GK/GS', 'GS Expert'],
  ['Pushpendra Sir', 'Science', 'Science Expert'],
  ['Shivant Sir', 'Polity', 'Polity Expert'],
  ['Mohit Sir', 'Hindi', 'Hindi Expert'],
  ['Ajeet Sir', 'Polity', 'Polity Expert'],
  ['Ankit Sir', 'GK/GS', 'GS Expert'],
  ['Pulkit Sir', 'Reasoning', 'Reasoning Expert'],
  ['D.S Sir', 'Geography', 'Geography Expert'],
  ['Amit Sir', 'Static GK', 'Static GK Expert'],
  ['VK Sir', 'UP GK', 'UP GK Expert'],
  ["Riya Ma'am", 'Computer', 'Computer Expert'],
  ['Vishal Sir', 'Geography', 'Geography Expert'],
  ['Manoj Sir', 'Maths', 'Maths Expert'],
  ["Anshi Ma'am", 'Bihar GK', 'Bihar GK Expert'],
  ['Vikramjeet Sir', null, 'UPSI Faculty'],
];

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: 'vidyagramdb', readPreference: 'primary' });
  if (mongoose.connection.db.databaseName !== 'vidyagramdb') throw new Error(`wrong db ${mongoose.connection.db.databaseName}`);
  const FacultyDetails = require('./dist/src/models/facultyDetails').default;

  const team = await FacultyDetails.findOne({ name: 'Vidyagram Team' }).lean();
  if (!team) throw new Error('Vidyagram Team profile not found');
  console.log(COMMIT ? 'COMMIT' : 'DRY RUN', '| faculty before', await FacultyDetails.countDocuments(),
    '| Vidyagram Team customer_id', team.customer_id, 'createdBy', String(team.createdBy ?? ''));

  const created = [];
  for (const [name, subject, description] of TEACHERS) {
    const existing = await FacultyDetails.findOne({ name: new RegExp(`^\\s*${escape(name)}\\s*$`, 'i') }).lean();
    if (existing) { console.log('exists ', String(existing._id), existing.name); continue; }
    const doc = {
      name,
      ...(subject ? { subject } : {}),
      description,
      experience: '—',
      reach: '—',
      status: 1,
      priority: 0,
      customer_id: team.customer_id,
      ...(team.createdBy ? { createdBy: team.createdBy } : {}),
    };
    if (!COMMIT) { console.log('create ', name, '|', subject ?? '(no subject)', '|', description); continue; }
    const c = await FacultyDetails.create(doc);
    created.push(String(c._id));
    console.log('created', String(c._id), name);
  }
  console.log('faculty after', await FacultyDetails.countDocuments(), '| new ids', JSON.stringify(created));
})()
  .catch((err) => { console.error(err.message); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
