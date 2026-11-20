// Dry run by default, refuses any DB but vidyagramdb. Merges a playground-built Course Builder course's two-teacher
// chapters per an approved PLAN, records each placement's teacher, and saves the teacher config and new weights
// (task vidyagram/plans/tasks/builder-teacher-by-class, decided 2026-11-20).
//   PLAN      JSON from that task: { pairs: [{ keep, merge: [topicId…], new }], single: [{ keep, new }] }.
//             `keep` survives (Abhinay's topic for a pair); every placement of COURSE in a `merge` topic moves to it;
//             `new` is the chapter weight. Every builder chapter must be a keep or a merge, weights must total 100.
//   SOURCES   source course ids, FACULTIES their teachers (FacultyDetails ids) and LABELS the toggle labels, same
//             order; the first is the suggested teacher. A placement's teacher = the faculty of the one source course
//             that holds its class (any status). A class in none or several sources is unresolved.
// Writes nothing unless COMMIT=1 EXPECT_MOVES=<n> EXPECT_TEACHERS=<n>: refuses on any unresolved placement, plan
// mismatch or count mismatch; backs up every touched placement and course.builder to ~/vg-backups/; placement updates
// are guarded on the topic they had; the course update is guarded on builder.version.
// RESTORE=<backup> COMMIT=1 puts topics, teachers and builder back (guarded on the merged state).
// It does NOT touch the per-placement chapter-name stamp (CourseClass.topicName): run vidyagram-builder-teacher-merge-names.cjs
// after a merge, or moved placements show their old chapter name as a second group in the class lists.
// Run on webserver2-2 from the Vidyagram checkout:
//   COURSE=6aff1280d8f488b0916b2f98 SOURCES=6ad5fa4c308a95d039c360fe,6af50ea418e98c6518eebd67 \
//   FACULTIES=6ada06b0ab837d7b99531da3,6af82ced78ca0c03c5968bb8 LABELS='Aditya Sir,Abhinay Sir' PLAN=/tmp/plan.json \
//   node -r dotenv/config - dotenv_config_path=.env.development < script
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const os = require('os');

const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!uri || !/\/vidyagramdb(\?|$)/.test(uri)) { console.error('refusing: MONGO_URI does not name vidyagramdb'); process.exit(1); }
const oid = (s) => new mongoose.Types.ObjectId(String(s));
const str = (v) => (v == null ? null : String(v));
const refuse = (why) => { console.error(`refusing: ${why}`); process.exit(2); };

(async () => {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const placementsCol = db.collection('courseclasses');
  const coursesCol = db.collection('courses');

  if (process.env.RESTORE) {
    const backup = JSON.parse(fs.readFileSync(process.env.RESTORE, 'utf8'));
    const ops = backup.placements.map((b) => {
      const after = b.after;
      const set = { updatedAt: new Date() };
      const unset = {};
      if (b.before.topic) set.topic = oid(b.before.topic); else unset.topic = '';
      if (b.before.teacher) set.teacher = oid(b.before.teacher); else unset.teacher = '';
      const filter = { _id: oid(b._id), topic: oid(after.topic), ...(after.teacher ? { teacher: oid(after.teacher) } : {}) };
      return { updateOne: { filter, update: { $set: set, ...(Object.keys(unset).length ? { $unset: unset } : {}) } } };
    });
    if (process.env.COMMIT !== '1') {
      console.log(JSON.stringify({ restore: process.env.RESTORE, wouldRestorePlacements: ops.length, wouldRestoreBuilderVersion: backup.builderBefore?.version }));
    } else {
      const r = await placementsCol.bulkWrite(ops, { ordered: false });
      const c = await coursesCol.updateOne({ _id: oid(backup.course), 'builder.version': backup.builderAfterVersion }, { $set: { builder: backup.builderBefore } });
      console.log(JSON.stringify({ restoredPlacements: r.modifiedCount, of: ops.length, builderRestored: c.modifiedCount }));
    }
    await mongoose.disconnect();
    return;
  }

  const courseId = oid(process.env.COURSE);
  const sources = process.env.SOURCES.split(',').map(oid);
  const faculties = process.env.FACULTIES.split(',').map(oid);
  const labels = process.env.LABELS.split(',').map((s) => s.trim());
  if (faculties.length !== sources.length || labels.length !== sources.length) refuse('SOURCES, FACULTIES and LABELS differ in length');
  const plan = JSON.parse(fs.readFileSync(process.env.PLAN, 'utf8'));
  const rows = [...plan.pairs.map((p) => ({ keep: p.keep, merge: p.merge, weight: p.new, name: p.name })), ...plan.single.map((s) => ({ keep: s.keep, merge: [], weight: s.new, name: s.name }))];

  const course = await coursesCol.findOne({ _id: courseId }, { projection: { title: 1, builder: 1 } });
  if (!course?.builder) refuse('course has no builder');
  const facultyDocs = await db.collection('facultydetails').find({ _id: { $in: faculties } }, { projection: { name: 1 } }).toArray();
  if (facultyDocs.length !== faculties.length) refuse('a FACULTIES id is not in facultydetails');

  // Plan checks against the current builder.
  const problems = [];
  const chapterIds = new Set((course.builder.chapters || []).map((c) => str(c.topicId)));
  const planned = new Map(); // topicId -> keep
  for (const r of rows) for (const t of [r.keep, ...r.merge]) {
    if (planned.has(t)) problems.push(`topic ${t} planned twice`);
    planned.set(t, r.keep);
  }
  for (const t of chapterIds) if (!planned.has(t)) problems.push(`builder chapter ${t} not in plan`);
  for (const t of planned.keys()) if (!chapterIds.has(t)) problems.push(`plan topic ${t} is not a builder chapter`);
  const doubled = rows.reduce((a, r) => a + r.weight * 2, 0);
  if (doubled !== 200) problems.push(`plan weights total ${doubled / 2}`);
  if (rows.some((r) => !Number.isInteger(r.weight * 2))) problems.push('a plan weight is not a 0.5 step');

  // Every placement of the course (any status), and the source course(s) holding its class.
  const placements = await placementsCol.find({ course: courseId }, { projection: { class: 1, topic: 1, teacher: 1, status: 1, isActive: 1 } }).toArray();
  const srcRows = await placementsCol.find({ course: { $in: sources }, class: { $in: placements.map((p) => p.class) } }, { projection: { course: 1, class: 1 } }).toArray();
  const srcOf = new Map();
  for (const r of srcRows) {
    const i = sources.findIndex((s) => s.equals(r.course));
    const k = str(r.class);
    srcOf.set(k, new Set([...(srcOf.get(k) || []), i]));
  }

  const moves = [];
  const teacherSets = [];
  const unresolved = [];
  const untopicked = [];
  const perKeep = new Map(); // keep -> { [srcIdx]: count } after the merge (active placements only)
  for (const p of placements) {
    const topic = str(p.topic);
    if (!topic) { untopicked.push(str(p._id)); continue; }
    const keep = planned.get(topic);
    const srcs = [...(srcOf.get(str(p.class)) || [])];
    const teacher = srcs.length === 1 ? faculties[srcs[0]] : null;
    if (!teacher) unresolved.push({ placement: str(p._id), class: str(p.class), topic, sources: srcs });
    if (keep && keep !== topic) moves.push({ _id: str(p._id), from: topic, to: keep });
    if (teacher && str(p.teacher) !== str(teacher)) teacherSets.push({ _id: str(p._id), teacher: str(teacher), was: str(p.teacher) });
    if (keep && p.status === 1 && p.isActive !== false && teacher) {
      const tally = perKeep.get(keep) || {};
      tally[srcs[0]] = (tally[srcs[0]] || 0) + 1;
      perKeep.set(keep, tally);
    }
  }
  const twoTeacher = [...perKeep.entries()].filter(([, t]) => Object.keys(t).length > 1);
  // A pair's keep should hold only the second teacher's classes now and its merges only the first's.
  const directionIssues = [];
  for (const r of plan.pairs) {
    for (const p of placements) {
      const srcs = [...(srcOf.get(str(p.class)) || [])];
      if (srcs.length !== 1) continue;
      if (str(p.topic) === r.keep && srcs[0] !== 1) directionIssues.push({ chapter: r.name, placement: str(p._id), note: 'keep topic holds a first-teacher class' });
      if (r.merge.includes(str(p.topic)) && srcs[0] !== 0) directionIssues.push({ chapter: r.name, placement: str(p._id), note: 'merged topic holds a second-teacher class' });
    }
  }

  const builderAfter = {
    ...course.builder,
    chapters: rows.map((r) => {
      const old = (course.builder.chapters || []).find((c) => str(c.topicId) === r.keep);
      return { topicId: oid(r.keep), weight: r.weight, customPrice: old?.customPrice ?? null };
    }),
    teachers: {
      options: faculties.map((f, i) => ({ facultyId: f, label: labels[i] })),
      suggestedFacultyId: faculties[0],
    },
    version: (course.builder.version ?? 0) + 1,
  };

  let applied = null;
  if (process.env.COMMIT === '1') {
    if (problems.length) refuse(`plan problems: ${problems.join('; ')}`);
    if (unresolved.length) refuse(`${unresolved.length} unresolved placements`);
    if (untopicked.length) refuse(`${untopicked.length} placements with no topic`);
    if (directionIssues.length) refuse(`${directionIssues.length} placements in the wrong side of a pair`);
    if (moves.length !== Number(process.env.EXPECT_MOVES)) refuse(`plan has ${moves.length} moves, EXPECT_MOVES=${process.env.EXPECT_MOVES}`);
    if (teacherSets.length !== Number(process.env.EXPECT_TEACHERS)) refuse(`plan sets ${teacherSets.length} teachers, EXPECT_TEACHERS=${process.env.EXPECT_TEACHERS}`);
    const touched = new Set([...moves.map((m) => m._id), ...teacherSets.map((t) => t._id)]);
    const docs = await placementsCol.find({ _id: { $in: [...touched].map(oid) } }).toArray();
    const moveOf = new Map(moves.map((m) => [m._id, m]));
    const teacherOf = new Map(teacherSets.map((t) => [t._id, t]));
    const dir = path.join(os.homedir(), 'vg-backups');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `builder-teacher-merge-${str(courseId)}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    fs.writeFileSync(file, JSON.stringify({
      course: str(courseId), at: new Date().toISOString(),
      builderBefore: course.builder, builderAfterVersion: builderAfter.version,
      placements: docs.map((d) => ({
        _id: str(d._id),
        before: { topic: str(d.topic), teacher: str(d.teacher) },
        after: { topic: moveOf.get(str(d._id))?.to ?? str(d.topic), teacher: teacherOf.get(str(d._id))?.teacher ?? str(d.teacher) },
        doc: d,
      })),
    }));
    const now = new Date();
    const ops = docs.map((d) => {
      const id = str(d._id);
      const set = { updatedAt: now };
      if (moveOf.has(id)) set.topic = oid(moveOf.get(id).to);
      if (teacherOf.has(id)) set.teacher = oid(teacherOf.get(id).teacher);
      return { updateOne: { filter: { _id: d._id, course: courseId, topic: d.topic }, update: { $set: set } } };
    });
    const r = await placementsCol.bulkWrite(ops, { ordered: false });
    const c = await coursesCol.updateOne({ _id: courseId, 'builder.version': course.builder.version ?? 0 }, { $set: { builder: builderAfter } });
    applied = { backup: file, placementsMatched: r.matchedCount, placementsModified: r.modifiedCount, of: ops.length, builderModified: c.modifiedCount };
  }

  console.log(JSON.stringify({
    applied,
    course: { id: str(courseId), title: course.title, builderVersion: course.builder.version ?? 0 },
    teachers: facultyDocs.map((f) => ({ id: str(f._id), name: f.name })),
    summary: {
      placements: placements.length, chaptersNow: chapterIds.size, chaptersAfter: rows.length,
      moves: moves.length, teacherSets: teacherSets.length, unresolved: unresolved.length, untopicked: untopicked.length,
      twoTeacherChaptersAfter: twoTeacher.length, directionIssues: directionIssues.length, problems,
      weightTotalAfter: doubled / 2,
    },
    chaptersAfter: rows.map((r) => ({ name: r.name, keep: r.keep, weight: r.weight, merges: r.merge.length, activeBySource: perKeep.get(r.keep) || {} })),
    unresolved, directionIssues: directionIssues.slice(0, 20),
  }, null, 1));
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
