// READ-ONLY, refuses any DB but vidyagramdb. Dumps a Course Builder course and its source courses as EJSON lines
// ({ c: collection, d: doc }) for a local preview DB: the courses, every placement of them, their classes, topics,
// sections, subtopics, the courses' faculties, course topic order (coursetopics) and outline names. Load it with
// vidyagram-builder-course-load.cjs into a LOCAL mongod (db vidyagramdb). Run on webserver2-2 from the Vidyagram checkout:
//   COURSES=6aff1280d8f488b0916b2f98,6ad5fa4c308a95d039c360fe,6af50ea418e98c6518eebd67 \
//   node -r dotenv/config - dotenv_config_path=.env.development < script > dump.ejsonl
const mongoose = require('mongoose');
const { EJSON } = require('bson');

const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!uri || !/\/vidyagramdb(\?|$)/.test(uri)) { console.error('refusing: MONGO_URI does not name vidyagramdb'); process.exit(1); }
const oid = (s) => new mongoose.Types.ObjectId(String(s));
const ids = (docs, field) => [...new Set(docs.flatMap((d) => [].concat(d[field] ?? []).map(String)))].filter((s) => /^[0-9a-f]{24}$/.test(s)).map(oid);

(async () => {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const out = (c, docs) => { for (const d of docs) process.stdout.write(EJSON.stringify({ c, d }, { relaxed: false }) + '\n'); };
  const courseIds = process.env.COURSES.split(',').map(oid);
  const courses = await db.collection('courses').find({ _id: { $in: courseIds } }).toArray();
  const placements = await db.collection('courseclasses').find({ course: { $in: courseIds } }).toArray();
  const classes = await db.collection('classes').find({ _id: { $in: ids(placements, 'class') } }).toArray();
  const topicIds = [...ids(placements, 'topic'), ...ids(classes, 'topic')];
  const sectionIds = [...ids(placements, 'section'), ...ids(classes, 'section')];
  const subIds = [...ids(placements, 'subTopic'), ...ids(classes, 'subTopic')];
  out('courses', courses);
  out('courseclasses', placements);
  out('classes', classes);
  out('topics', await db.collection('topics').find({ _id: { $in: topicIds } }).toArray());
  out('sections', await db.collection('sections').find({ _id: { $in: sectionIds } }).toArray());
  out('subtopics', await db.collection('subtopics').find({ _id: { $in: subIds } }).toArray());
  out('facultydetails', await db.collection('facultydetails').find({ _id: { $in: ids(courses, 'faculties') } }).toArray());
  out('coursetopics', await db.collection('coursetopics').find({ course: { $in: courseIds } }).toArray());
  out('courseoutlinenames', await db.collection('courseoutlinenames').find({ course: { $in: courseIds } }).toArray());
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
