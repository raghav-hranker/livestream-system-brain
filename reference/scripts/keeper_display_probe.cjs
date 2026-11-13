// READ-ONLY. For each section merge group (ids from reconcile_dry_run.json), report what a course tab
// shows from the section document itself: image and facultyDetails (courseController.ts getCourseClasses
// reads sectionDetails.image + sectionDetails.facultyDetails, fields that are not in the Section schema).
// Also lists the courses whose placements sit on a merged-away copy, so decision A can see which
// courses' tab image/faculty would change if that copy is not kept.
// Env: DRY=<path to reconcile_dry_run.json> OUT=<output basename>
require('dotenv').config({ path: process.env.DOTENV_CONFIG_PATH || '.env.development' });
const mongoose = require('mongoose');
const fs = require('fs');

const { ObjectId } = mongoose.Types;
const S = (v) => (v == null ? '' : String(v));

(async () => {
  const dry = JSON.parse(fs.readFileSync(process.env.DRY || 'reconcile_dry_run.json', 'utf8'));
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;

  const allIds = dry.groups.flatMap((g) => [g.keptId, ...g.losers]);
  const secs = await db.collection('sections').find({ _id: { $in: allIds.map((id) => new ObjectId(id)) } }).toArray();
  const secById = new Map(secs.map((s) => [S(s._id), s]));
  const facIds = secs.flatMap((s) => [].concat(s.facultyDetails || [])).filter(Boolean);
  const facs = await db.collection('facultydetails').find({ _id: { $in: facIds.map((id) => new ObjectId(S(id))) } }, { projection: { name: 1 } }).toArray();
  const facName = new Map(facs.map((f) => [S(f._id), f.name]));

  const describe = (id) => {
    const s = secById.get(id) || {};
    const known = new Set(['_id', 'sectionName', 'status', 'customer_id', 'legacy_id', 'createdBy', 'createdAt', 'updatedAt', '__v']);
    return {
      id,
      name: s.sectionName,
      customer_id: s.customer_id,
      image: s.image || null,
      faculty: [].concat(s.facultyDetails || []).map((f) => facName.get(S(f)) || S(f)),
      otherFields: Object.keys(s).filter((k) => !known.has(k) && k !== 'image' && k !== 'facultyDetails'),
    };
  };

  const groups = [];
  for (const g of dry.groups) {
    const ids = [g.keptId, ...g.losers];
    const oids = ids.map((id) => new ObjectId(id));
    // Courses per copy, from both placement shapes.
    const rows = await db.collection('courseclasses').aggregate([
      { $match: { $or: [{ section: { $in: oids } }, { 'apxDisplayPlacements.section': { $in: oids } }] } },
      { $project: { course: 1, secs: { $setUnion: [[{ $ifNull: ['$section', null] }], { $ifNull: ['$apxDisplayPlacements.section', []] }] } } },
      { $unwind: '$secs' },
      { $match: { secs: { $in: oids } } },
      { $group: { _id: { course: '$course', sec: '$secs' }, n: { $sum: 1 } } },
    ]).toArray();
    const courseIds = [...new Set(rows.map((r) => S(r._id.course)))];
    const courses = await db.collection('courses').find({ _id: { $in: courseIds.map((id) => new ObjectId(id)) } }, { projection: { courseName: 1, title: 1, name: 1, status: 1 } }).toArray();
    const cName = new Map(courses.map((c) => [S(c._id), { name: c.courseName || c.title || c.name, status: c.status }]));
    const copies = ids.map((id) => ({
      ...describe(id),
      role: id === g.keptId ? 'keep' : 'merge away',
      courses: rows.filter((r) => S(r._id.sec) === id).map((r) => ({ course: S(r._id.course), ...cName.get(S(r._id.course)), placements: r.n })),
    }));
    const kept = copies[0];
    const sameDisplay = (c) => S(c.image) === S(kept.image) && c.faculty.join('|') === kept.faculty.join('|');
    const changes = copies.slice(1).filter((c) => c.courses.length && !sameDisplay(c));
    groups.push({ group: g.group, copies, tabDisplayChanges: changes.map((c) => ({ from: c.id, courses: c.courses.length, image: [c.image, kept.image], faculty: [c.faculty, kept.faculty] })) });
  }

  const out = process.env.OUT || 'keeper_display_probe';
  fs.writeFileSync(out + '.json', JSON.stringify({ generatedAt: new Date().toISOString(), groups }, null, 1));
  const flagged = groups.filter((g) => g.tabDisplayChanges.length);
  console.log(`groups=${groups.length} withTabDisplayChange=${flagged.length}`);
  for (const g of flagged) for (const c of g.tabDisplayChanges) console.log(`${g.group}: ${c.from} ${c.courses} courses image ${c.image[0] ? 'set' : 'none'}->${c.image[1] ? 'set' : 'none'} faculty [${c.faculty[0]}]->[${c.faculty[1]}]`);
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
