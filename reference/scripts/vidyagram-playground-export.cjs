// vidyagram-playground-export.cjs — READ-ONLY export of a few Vidyagram courses for the local Course Builder
// Playground end to end (vidyagram/plans/tasks/course-playground/07-local-e2e.md). Refuses any DB but vidyagramdb.
//
//   LIST=1   prints candidate courses with active class / PDF / test counts (JSON lines) and exits.
//   COURSES=<id,id,...>  prints one Extended JSON bundle to stdout: the courses, their placements (courseclasses,
//            coursetopics, coursepdfs, coursetests) and every record those point at (classes, pdfs, series, sections,
//            topics, subtopics, maincategories, categories, facultydetails, tags).
//
// Run on webserver2-2 from the Vidyagram checkout, streaming the bundle back to the Mac:
//   ssh ... 'cd /var/www/backend.vidyagramar.com/vidyagram-backend && URI=$(grep ^MONGO_URI= .env.development | cut -d= -f2-) COURSES=... node - ' < this > bundle.json
// mongodb is not a direct dependency of the backend; mongoose re-exports the driver.
const { MongoClient, ObjectId, BSON } = require('mongoose').mongo;

const uri = process.env.URI;
if (!uri) { console.error('URI is required'); process.exit(2); }

const isId = (v) => v instanceof ObjectId;
const TAXO = /^(section|sectionId|topic|topicId|subTopic|subtopic|subTopicId|subtopicId)$/;

// Shared taxonomy ids anywhere one level down (top-level fields and arrays of sub-documents).
function taxonomyIds(doc, out) {
  for (const [k, v] of Object.entries(doc || {})) {
    if (TAXO.test(k) && isId(v)) out.add(v.toHexString());
    else if (Array.isArray(v)) for (const x of v) {
      if (x && typeof x === 'object' && !isId(x)) for (const [k2, v2] of Object.entries(x)) if (TAXO.test(k2) && isId(v2)) out.add(v2.toHexString());
    }
  }
}
const ids = (set) => [...set].filter((s) => ObjectId.isValid(s)).map((s) => new ObjectId(s));

(async () => {
  const client = new MongoClient(uri, { readPreference: 'secondaryPreferred' });
  await client.connect();
  const db = client.db();
  if (db.databaseName !== 'vidyagramdb') { console.error(`refusing: db is ${db.databaseName}, not vidyagramdb`); process.exit(2); }
  const c = (n) => db.collection(n);

  if (process.env.LIST) {
    const courses = await c('courses').find({}, { projection: { title: 1, status: 1, isLive: 1, isRecorded: 1, builder: 1 } }).sort({ _id: -1 }).toArray();
    const count = async (coll, match) => Object.fromEntries((await c(coll).aggregate([{ $match: match }, { $group: { _id: '$course', n: { $sum: 1 } } }]).toArray()).map((r) => [String(r._id), r.n]));
    const [cls, pdfs, tests] = await Promise.all([
      count('courseclasses', { isActive: { $ne: false }, status: { $ne: 0 } }),
      count('coursepdfs', { isActive: { $ne: false } }),
      count('coursetests', {}),
    ]);
    for (const x of courses) {
      const id = String(x._id);
      console.log(JSON.stringify({ id, title: x.title, status: x.status, live: !!x.isLive, builder: !!x.builder?.enabled, classes: cls[id] || 0, pdfs: pdfs[id] || 0, tests: tests[id] || 0 }));
    }
    await client.close();
    return;
  }

  const courseIds = (process.env.COURSES || '').split(',').map((s) => s.trim()).filter(Boolean).map((s) => new ObjectId(s));
  if (!courseIds.length) { console.error('COURSES=<id,...> or LIST=1'); process.exit(2); }

  const bundle = { exportedAt: new Date(), courseIds };
  bundle.courses = await c('courses').find({ _id: { $in: courseIds } }).toArray();
  bundle.courseclasses = await c('courseclasses').find({ course: { $in: courseIds } }).toArray();
  bundle.coursetopics = await c('coursetopics').find({ course: { $in: courseIds } }).toArray();
  bundle.coursepdfs = await c('coursepdfs').find({ course: { $in: courseIds } }).toArray();
  bundle.coursetests = await c('coursetests').find({ course: { $in: courseIds } }).toArray();

  const pick = (rows, key) => new Set(rows.map((r) => r[key]).filter(isId).map((v) => v.toHexString()));
  bundle.classes = await c('classes').find({ _id: { $in: ids(pick(bundle.courseclasses, 'class')) } }).toArray();
  bundle.pdfs = await c('pdfs').find({ _id: { $in: ids(pick(bundle.coursepdfs, 'pdf')) } }).toArray();
  bundle.series = await c('series').find({ _id: { $in: ids(pick(bundle.coursetests, 'test')) } }).toArray();

  const taxo = new Set();
  for (const coll of ['courseclasses', 'coursetopics', 'coursetests', 'classes', 'pdfs', 'series']) for (const d of bundle[coll]) taxonomyIds(d, taxo);
  const taxoIds = ids(taxo);
  bundle.sections = await c('sections').find({ _id: { $in: taxoIds } }).toArray();
  bundle.topics = await c('topics').find({ _id: { $in: taxoIds } }).toArray();
  // Parents of the topics and subtopics found, so every resolved name has its record.
  bundle.subtopics = await c('subtopics').find({ _id: { $in: taxoIds } }).toArray();
  const parentTopics = ids(pick(bundle.subtopics, 'topic'));
  const extraTopics = await c('topics').find({ _id: { $in: parentTopics, $nin: bundle.topics.map((t) => t._id) } }).toArray();
  bundle.topics.push(...extraTopics);
  const parentSections = ids(pick(bundle.topics, 'section'));
  bundle.sections.push(...await c('sections').find({ _id: { $in: parentSections, $nin: bundle.sections.map((s) => s._id) } }).toArray());

  const cat = new Set(), main = new Set(), fac = new Set(), tag = new Set();
  for (const x of bundle.courses) {
    if (isId(x.category)) cat.add(x.category.toHexString());
    if (isId(x.mainCategory)) main.add(x.mainCategory.toHexString());
    for (const f of x.faculties || []) if (isId(f)) fac.add(f.toHexString());
    for (const t of x.tags || []) if (isId(t)) tag.add(t.toHexString());
  }
  bundle.categories = await c('categories').find({}).toArray();
  bundle.maincategories = await c('maincategories').find({}).toArray();
  bundle.facultydetails = await c('facultydetails').find({}).toArray();
  bundle.tags = await c('tags').find({ _id: { $in: ids(tag) } }).toArray();

  process.stdout.write(BSON.EJSON.stringify(bundle, { relaxed: false }));
  const counts = Object.fromEntries(Object.entries(bundle).filter(([, v]) => Array.isArray(v)).map(([k, v]) => [k, v.length]));
  console.error(JSON.stringify(counts));
  await client.close();
})().catch((e) => { console.error(e); process.exit(1); });
