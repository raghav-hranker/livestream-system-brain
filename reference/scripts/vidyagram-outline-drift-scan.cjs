#!/usr/bin/env node
// Read-only, refuses any DB but vidyagramdb: how far every Vidyagram course's outline has drifted from AppX.
// Uses the nightly's own code (test-uday checkout): loadMirrorCourses (latest done capture of every course) →
// planCatalogue → planCoursePlacements over the class-import ledger = exactly the Section › Topic › Subtopic and
// priority the placement step would give each (course, class) if it were filing it today. Compares that with the
// CourseClass rows, which the nightly never updates once they exist.
//
// Per course: taxonomy drift (rows under another section/topic/subtopic name), order drift (rows out of AppX order
// inside their topic = rows outside the longest in-order run; topics whose order differs), topic-order drift (topic
// groups in another order than AppX), rows AppX has that we lack, our active rows AppX doesn't plan (hand-made or
// stale), and how many drifted rows were updated >10 min after creation (proxy for an admin edit to respect).
//
// Run on test-uday from the nightly checkout (no writes; secondaryPreferred):
//   gcloud compute ssh --zone asia-south1-a test-uday --project genial-analogy-477417-r7 --command \
//     'export PATH=/home/raghav/.nvm/versions/node/v24.14.0/bin:$PATH; cd /home/raghav/vidyagram-nightly-20261019 && \
//      NODE_ENV=development node - ' < reference/scripts/vidyagram-outline-drift-scan.cjs > drift.jsonl
// Output: JSON lines, one per course ({type:"course"}), then {type:"totals"}. Progress goes to stderr.
const path = require('path');
const APP = process.cwd();
require(path.join(APP, 'node_modules/dotenv')).config({ path: path.join(APP, '.env.development') });
require(path.join(APP, 'node_modules/ts-node')).register({ transpileOnly: true });
const mongoose = require(path.join(APP, 'node_modules/mongoose'));
const { loadMirrorCourses } = require(path.join(APP, 'src/services/apx/apxCatalogMirrorReader'));
const { planCatalogue } = require(path.join(APP, 'src/services/apx/apxCatalogPlanner'));
const { planCoursePlacements } = require(path.join(APP, 'src/services/apx/apxCatalogCourseImport'));

const DB_NAME = 'vidyagramdb';
const CUSTOMER = '781';
const OFF_SALE = ['66']; // = vidyagramNightlySteps PLACEMENT_OFF_SALE
const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
const log = (m) => process.stderr.write(`${m}\n`);

// rows out of order = n − longest increasing subsequence of planned priority when sorted by our priority
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

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: DB_NAME, readPreference: 'secondaryPreferred', autoIndex: false, autoCreate: false });
  const db = mongoose.connection.db;
  if (db.databaseName !== DB_NAME) throw new Error('wrong db');

  log('loading mirror…');
  const { inputs } = await loadMirrorCourses(db, { customerId: CUSTOMER });
  log(`mirror courses ${inputs.length}; planning…`);
  const { plans } = planCatalogue(inputs, { offSale: OFF_SALE });
  const ledger = await db.collection('apxcatalogimports')
    .find({ customerId: CUSTOMER, replaces: { $exists: false } }, { projection: { _id: 0, assetKey: 1, classId: 1, placements: 1 } })
    .toArray();
  log(`ledger rows ${ledger.length}; placement plan…`);
  const placementPlan = planCoursePlacements(ledger, plans, null);

  const courses = await db.collection('courses')
    .find({ apxCourseId: { $exists: true, $ne: null } }, { projection: { title: 1, apxCourseId: 1, status: 1 } })
    .toArray();
  const byApx = new Map(courses.map((c) => [String(c.apxCourseId), c]));
  const totals = { courses: 0, coursesWithDrift: 0, taxonomyRows: 0, orderRows: 0, topicsReordered: 0, topicOrderCourses: 0, missingRows: 0, extraActiveRows: 0, editedDriftRows: 0, plannedRows: 0 };

  for (const [apxCourseId, planned] of placementPlan.byCourse) {
    const course = byApx.get(apxCourseId);
    if (!course) continue;
    totals.courses++;
    const rows = await db.collection('courseclasses')
      .find({ course: course._id }, { projection: { class: 1, priority: 1, sectionName: 1, topicName: 1, subTopicName: 1, isActive: 1, status: 1, createdAt: 1, updatedAt: 1, apxDisplayPlacements: 1 } })
      .toArray();
    const ours = new Map(rows.map((r) => [String(r.class), r]));
    const plannedIds = new Set(planned.map((p) => p.classId));
    const live = planned.filter((p) => !p.gone);
    totals.plannedRows += live.length;

    let taxonomy = 0;
    let edited = 0;
    let missing = 0;
    const taxSamples = new Map();
    const groups = new Map(); // planned group -> [{ours, plan}]
    for (const p of live) {
      const r = ours.get(p.classId);
      if (!r) { missing++; continue; }
      const crossListed = (r.apxDisplayPlacements || []).length > 0;
      const drift = !crossListed && (norm(r.sectionName) !== norm(p.section) || norm(r.topicName) !== norm(p.topic) || norm(r.subTopicName) !== norm(p.subTopic));
      const wasEdited = r.updatedAt && r.createdAt && r.updatedAt - r.createdAt > 10 * 60 * 1000;
      if (drift) {
        taxonomy++;
        if (wasEdited) edited++;
        const k = `${r.sectionName ?? '-'} › ${r.topicName ?? '-'}${r.subTopicName ? ' › ' + r.subTopicName : ''} → ${p.section} › ${p.topic}${p.subTopic ? ' › ' + p.subTopic : ''}`;
        taxSamples.set(k, (taxSamples.get(k) || 0) + 1);
      }
      const g = `${p.section}\u0000${p.topic}\u0000${p.subTopic ?? ''}`;
      (groups.get(g) ?? groups.set(g, []).get(g)).push({ ours: r.priority, plan: p.priority, edited: wasEdited });
    }

    let order = 0;
    let topicsReordered = 0;
    let orderEdited = 0;
    for (const list of groups.values()) {
      const seq = [...list].sort((a, b) => a.ours - b.ours).map((x) => x.plan);
      const n = outOfOrder(seq);
      if (n) {
        order += n;
        topicsReordered++;
        orderEdited += list.filter((x) => x.edited).length ? 1 : 0;
      }
    }
    // topic groups in AppX order vs ours (by each group's first row)
    const gList = [...groups.values()].filter((l) => l.length);
    const byPlan = gList.map((l, i) => ({ i, plan: Math.min(...l.map((x) => x.plan)), ours: Math.min(...l.map((x) => x.ours)) }));
    const topicOrderOff = outOfOrder([...byPlan].sort((a, b) => a.ours - b.ours).map((x) => x.plan));

    const extraActive = rows.filter((r) => r.isActive !== false && r.status !== 0 && !plannedIds.has(String(r.class))).length;

    const drifted = taxonomy || order || topicOrderOff || missing || extraActive;
    if (drifted) totals.coursesWithDrift++;
    totals.taxonomyRows += taxonomy;
    totals.orderRows += order;
    totals.topicsReordered += topicsReordered;
    totals.topicOrderCourses += topicOrderOff ? 1 : 0;
    totals.missingRows += missing;
    totals.extraActiveRows += extraActive;
    totals.editedDriftRows += edited;

    process.stdout.write(JSON.stringify({
      type: 'course', apxCourseId, courseId: String(course._id), title: course.title, status: course.status,
      planned: live.length, ours: rows.length, taxonomyRows: taxonomy, taxonomyEdited: edited, orderRows: order,
      topicsReordered, topicsReorderedWithEdits: orderEdited, topicGroupsOutOfOrder: topicOrderOff, missingRows: missing, extraActiveRows: extraActive,
      taxonomyMoves: [...taxSamples].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, n]) => `${n}× ${k}`),
    }) + '\n');
  }
  process.stdout.write(JSON.stringify({ type: 'totals', ...totals, unfiledPlacements: placementPlan.unfiled.length, duplicates: placementPlan.duplicates.length }) + '\n');
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
