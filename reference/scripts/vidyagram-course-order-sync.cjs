#!/usr/bin/env node
// Preview by default; **writes only with --apply** (+ EXPECT=<rows to change>). Refuses any DB but vidyagramdb.
// Puts courses' class order back in AppX order: each CourseClass row's priority (and each display listing's
// priority, apxDisplayPlacements[].priority) becomes the rank the nightly planner gives it today (loadMirrorCourses →
// planCatalogue → planCoursePlacements, the nightly's own code). Section / topic / subtopic are NOT touched. Topic
// accordions and section tabs order by their first row's priority (no course here has a hand-set coursetopics order),
// so this fixes topic order, and new nightly rows (filed at the same planner rank) land in place.
// Rows the plan doesn't know (hand-made, no ledger) keep their relative order after the last planned rank.
//
// Run on test-uday from the nightly checkout:
//   gcloud compute ssh --zone asia-south1-a test-uday --project genial-analogy-477417-r7 --command \
//     'export PATH=/home/raghav/.nvm/versions/node/v24.14.0/bin:$PATH; cd /home/raghav/vidyagram-nightly-20261019 && \
//      COURSES=101,104 NODE_ENV=development node - ' < reference/scripts/vidyagram-course-order-sync.cjs
// Apply: add EXPECT=<n> (the preview's "rows+listings to change" total) and pass `- --apply`. Backup (EJSON of every
// placement of the named courses) goes to ~/vg-course-order-sync-backup-<stamp>.json on test-uday first; each course
// is one transaction of updates guarded on the old priority. Undo = restore priority / apxDisplayPlacements by _id.
const path = require('path');
const fs = require('fs');
const APP = process.cwd();
require(path.join(APP, 'node_modules/dotenv')).config({ path: path.join(APP, '.env.development') });
require(path.join(APP, 'node_modules/ts-node')).register({ transpileOnly: true });
const mongoose = require(path.join(APP, 'node_modules/mongoose'));
const { loadMirrorCourses } = require(path.join(APP, 'src/services/apx/apxCatalogMirrorReader'));
const { planCatalogue } = require(path.join(APP, 'src/services/apx/apxCatalogPlanner'));
const { planCoursePlacements } = require(path.join(APP, 'src/services/apx/apxCatalogCourseImport'));

const DB_NAME = 'vidyagramdb';
const CUSTOMER = '781';
const OFF_SALE = ['66'];
const APPLY = process.argv.includes('--apply');
const COURSES = String(process.env.COURSES || '').split(',').map((s) => s.trim()).filter(Boolean);
if (!COURSES.length) {
  console.error('set COURSES=<apxCourseId,...>');
  process.exit(2);
}
const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
const outOfOrder = (seq) => {
  const tails = [];
  for (const x of seq) {
    let lo = 0;
    let hi = tails.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (tails[mid] < x) lo = mid + 1;
      else hi = mid;
    }
    tails[lo] = x;
  }
  return seq.length - tails.length;
};

// Effective listings of a row: its display placements when it has any, else the row itself.
const listings = (r, prio) =>
  (r.apxDisplayPlacements || []).length
    ? r.apxDisplayPlacements.map((d) => ({ section: d.sectionName, topic: d.topicName, priority: prio ? prio(d) : d.priority }))
    : [{ section: r.sectionName, topic: r.topicName, priority: prio ? prio(null) : r.priority }];

// Topic groups out of AppX order: groups (section › topic) sorted by their first listing, compared with AppX's rank
// of the same groups (min planned rank of the classes the plan files there). Also sections.
const groupDrift = (rowsWithPrio, appxRankOfGroup) => {
  const first = new Map();
  for (const l of rowsWithPrio) {
    const k = `${norm(l.section)}\u0000${norm(l.topic)}`;
    if (!first.has(k) || l.priority < first.get(k)) first.set(k, l.priority);
  }
  const common = [...first].filter(([k]) => appxRankOfGroup.has(k)).sort((a, b) => a[1] - b[1]).map(([k]) => appxRankOfGroup.get(k));
  return outOfOrder(common);
};

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: DB_NAME, readPreference: APPLY ? 'primary' : 'secondaryPreferred', autoIndex: false, autoCreate: false });
  const db = mongoose.connection.db;
  if (db.databaseName !== DB_NAME) throw new Error('wrong db');

  const { inputs } = await loadMirrorCourses(db, { customerId: CUSTOMER });
  const { plans } = planCatalogue(inputs, { offSale: OFF_SALE });
  const ledger = await db.collection('apxcatalogimports')
    .find({ customerId: CUSTOMER, replaces: { $exists: false }, 'placements.apxCourseId': { $in: COURSES } }, { projection: { _id: 0, assetKey: 1, classId: 1, placements: 1 } })
    .toArray();
  const placementPlan = planCoursePlacements(ledger, plans, new Set(COURSES));
  const plansById = new Map(plans.map((p) => [String(p.course.apxCourseId), p]));

  const work = [];
  let total = 0;
  for (const apxCourseId of COURSES) {
    const course = await db.collection('courses').findOne({ apxCourseId }, { projection: { title: 1, status: 1 } });
    const planned = placementPlan.byCourse.get(apxCourseId) || [];
    const plan = plansById.get(apxCourseId);
    if (!course || !plan || !planned.length) {
      console.log(`${apxCourseId}: SKIP (course ${!!course}, plan ${!!plan}, planned ${planned.length})`);
      continue;
    }
    const rankOfRow = new Map(plan.items.map((i) => [String(i.rowId), Number(i.priority)]));
    const rankOfClass = new Map(planned.map((p) => [p.classId, Number(p.priority)]));
    const maxRank = Math.max(...planned.map((p) => Number(p.priority)));
    const appxGroup = new Map();
    for (const p of planned) {
      if (p.gone) continue;
      const k = `${norm(p.section)}\u0000${norm(p.topic)}`;
      appxGroup.set(k, Math.min(appxGroup.get(k) ?? Infinity, Number(p.priority)));
    }

    const rows = await db.collection('courseclasses').find({ course: course._id }).toArray();
    const unplanned = rows.filter((r) => !rankOfClass.has(String(r.class))).sort((a, b) => a.priority - b.priority);
    const extraRank = new Map(unplanned.map((r, i) => [String(r._id), maxRank + i + 1]));
    const newPrio = (r) => rankOfClass.get(String(r.class)) ?? extraRank.get(String(r._id));
    const newListingPrio = (r, d) => rankOfRow.get(String(d.apxClassId)) ?? newPrio(r);

    const ops = [];
    let rowChanges = 0;
    let listingChanges = 0;
    for (const r of rows) {
      const np = Math.max(1, Math.trunc(newPrio(r)));
      const set = {};
      const filter = { _id: r._id, course: course._id, priority: r.priority };
      if (np !== r.priority) (set.priority = np, rowChanges++);
      const dps = r.apxDisplayPlacements || [];
      if (dps.length) {
        const next = dps.map((d) => ({ ...d, priority: Math.max(1, Math.trunc(newListingPrio(r, d))) }));
        const changed = next.filter((d, i) => d.priority !== dps[i].priority).length;
        if (changed) {
          set.apxDisplayPlacements = next;
          filter['apxDisplayPlacements.priority'] = { $all: dps.map((d) => d.priority) };
          listingChanges += changed;
        }
      }
      if (Object.keys(set).length) ops.push({ updateOne: { filter, update: { $set: { ...set, updatedAt: new Date() } } } });
    }

    const active = rows.filter((r) => r.isActive !== false);
    const before = groupDrift(active.flatMap((r) => listings(r)), appxGroup);
    const after = groupDrift(active.flatMap((r) => listings(r, (d) => (d ? newListingPrio(r, d) : newPrio(r)))), appxGroup);
    total += ops.length;
    console.log(`${apxCourseId}: ${rows.length} rows, ${rowChanges} priorities + ${listingChanges} listing priorities change (${ops.length} row updates); topic groups out of AppX order ${before} → ${after}; unplanned rows ${unplanned.length} | ${String(course.title).slice(0, 60)}`);
    work.push({ apxCourseId, course, rows, ops });
  }
  console.log(`TOTAL row updates ${total}`);

  if (APPLY) {
    if (String(total) !== process.env.EXPECT) throw new Error(`refusing: EXPECT=${process.env.EXPECT} but ${total} row updates planned`);
    const { BSON } = require(path.join(APP, 'node_modules/mongoose')).mongo;
    const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
    const backupPath = `${require('os').homedir()}/vg-course-order-sync-backup-${stamp}.json`;
    fs.writeFileSync(backupPath, BSON.EJSON.stringify({ courses: work.map((w) => ({ apxCourseId: w.apxCourseId, course: w.course._id, courseclasses: w.rows })) }, { relaxed: false }), { mode: 0o600 });
    console.log('backup', backupPath);
    for (const w of work) {
      if (!w.ops.length) continue;
      const session = await mongoose.connection.startSession();
      try {
        await session.withTransaction(async () => {
          const res = await db.collection('courseclasses').bulkWrite(w.ops, { ordered: true, session });
          if (res.matchedCount !== w.ops.length) throw new Error(`${w.apxCourseId}: guard matched ${res.matchedCount} of ${w.ops.length}; aborted`);
        });
        console.log(`APPLIED ${w.apxCourseId}: ${w.ops.length} rows`);
      } finally {
        await session.endSession();
      }
    }
  }
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
