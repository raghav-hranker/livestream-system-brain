// READ-ONLY. Futurekul (client 135) classes of one course, from Atlas `test`. COURSE is a case-insensitive regex on the course title.
// Prints the course, the shape of each collection a class can sit in, every doc in them that mentions the course id, and any that
// match NAME in a string field. Run on the GPU box from the checkout that serves the API:
//   ssh ... 'cd /root/livestream-futurekul/backend && COURSE=arjun NAME="class[ -]*15" node -' < futurekul_course_classes.cjs
const path = require('path');
const { MongoClient } = require(path.join(process.cwd(), 'node_modules/mongoose')).mongo;

const COURSE = new RegExp(process.env.COURSE || 'arjun', 'i');
const NAME = new RegExp(process.env.NAME || 'class[ -]*15', 'i');
const COLLECTIONS = ['classesClass', 'syncedassignclasstocourses', 'futurekul cladss notificatioons', 'futurekul notifications', 'oldliverooms', 'rooms'];
const brief = (v) => (typeof v === 'string' ? v.split('?')[0].slice(0, 90) : v instanceof Date ? v.toISOString().slice(0, 16) : v && typeof v === 'object' ? String(v).slice(0, 40) : v);
const line = (d) => Object.entries(d).filter(([k, v]) => v != null && v !== '' && !/password|token|phone|mobile|email/i.test(k)).slice(0, 14).map(([k, v]) => `${k}=${brief(v)}`).join(' | ');
const mentions = (v, ids) => {
  if (v == null) return false;
  if (Array.isArray(v)) return v.some((x) => mentions(x, ids));
  if (v.constructor === Object) return Object.values(v).some((x) => mentions(x, ids));
  return ids.has(String(v));
};
const matches = (v, re) => {
  if (typeof v === 'string') return re.test(v);
  if (Array.isArray(v)) return v.some((x) => matches(x, re));
  if (v && v.constructor === Object) return Object.values(v).some((x) => matches(x, re));
  return false;
};

(async () => {
  const client = new MongoClient(require(path.join(process.cwd(), 'config/config')).dbUri, { serverSelectionTimeoutMS: 20000, socketTimeoutMS: 240000 });
  await client.connect();
  const db = client.db('test');
  const all = await db.collection('futurekul courses').find({}).toArray();
  const courses = all.filter((c) => matches(c, COURSE));
  console.log(`futurekul courses: ${all.length}; matching ${COURSE}: ${courses.length}`);
  for (const c of courses) console.log('  ', line(c));
  const ids = new Set();
  for (const c of courses) { ids.add(String(c._id)); for (const k of ['id', 'courseId', 'course_id', 'courseID']) if (c[k] != null) ids.add(String(c[k])); }
  console.log('course ids searched:', [...ids].join(', '));

  for (const name of COLLECTIONS) {
    const coll = db.collection(name);
    const total = await coll.estimatedDocumentCount();
    const sample = await coll.findOne({}, { sort: { _id: -1 } });
    console.log(`\n== ${name}: ${total} docs; fields: ${sample ? Object.keys(sample).join(',') : '-'}`);
    if (!sample) continue;
    const linked = []; const named = [];
    for await (const d of coll.find({})) {
      if (mentions(d, ids)) linked.push(d);
      if (matches(d, NAME)) named.push(d);
    }
    console.log(`linked to the course: ${linked.length}; matching ${NAME}: ${named.length}`);
    for (const d of linked.slice(-60)) console.log('  L', line(d));
    for (const d of named.slice(-25)) console.log('  N', line(d));
  }
  await client.close();
})().catch((e) => { console.error('FAILED', e.message.replace(/mongodb(\+srv)?:\/\/\S+/g, '<uri>')); process.exit(1); });
