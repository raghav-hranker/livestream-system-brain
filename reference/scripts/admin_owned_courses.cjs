// Read-only. Lists admins whose name or email matches the text, their role, and the
// courses + class count each one created (Course.createdBy / Class.createdBy).
// Usage: node reference/scripts/admin_owned_courses.cjs pankaj
const { createRequire } = require('module');
const fs = require('fs');
const BACKEND = '/Users/raghav/Projects/quicktricks-backend';
const r = createRequire(`${BACKEND}/package.json`);
const { MongoClient } = r('mongodb');

const uri = fs.readFileSync(`${BACKEND}/.env.development`, 'utf8').match(/^MONGO_URI=(.*)$/m)[1].trim();
const needle = new RegExp(process.argv[2] || 'pankaj', 'i');

(async () => {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 15000 });
  await client.connect();
  const db = client.db();
  const admins = await db.collection('admins')
    .find({ $or: [{ email: needle }, { name: needle }] }, { projection: { name: 1, email: 1, role: 1, status: 1 } })
    .toArray();
  if (!admins.length) console.log('No admin matches', needle);
  for (const a of admins) {
    const courses = await db.collection('courses')
      .find({ createdBy: a._id }, { projection: { title: 1, status: 1, createdAt: 1 } })
      .sort({ createdAt: -1 })
      .toArray();
    const classes = await db.collection('classes').countDocuments({ createdBy: a._id });
    console.log(`\n${a.name} <${a.email}> role=${a.role} status=${a.status} id=${a._id}`);
    console.log(`created ${courses.length} courses, ${classes} classes`);
    for (const c of courses) {
      console.log(`  ${c._id}  status=${c.status}  ${c.createdAt?.toISOString?.().slice(0, 10) ?? '-'}  ${c.title}`);
    }
  }
  await client.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
