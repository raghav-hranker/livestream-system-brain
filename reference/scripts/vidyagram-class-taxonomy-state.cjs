#!/usr/bin/env node
// Read-only, aggregate, refuses any DB but vidyagramdb: taxonomy on Class (what the admin Class form shows) against
// taxonomy on CourseClass (what a course shows): holding-section share, empty levels, dead references, topics filed
// under another section, name snapshots that differ from the node, and classes with no placement.
//
// Run on webserver2-2 from the VG checkout:
//   ssh -i ~/.ssh/hranker-webserver2-2 hranker@148.113.49.18 'export PATH=/home/hranker/.nvm/versions/node/v22.22.2/bin:$PATH; \
//     cd /var/www/backend.vidyagramar.com/vidyagram-backend && DOTENV_CONFIG_PATH=.env.development \
//     NODE_PATH=$PWD/node_modules node -r dotenv/config -' < reference/scripts/vidyagram-class-taxonomy-state.cjs
const { mongo } = require('mongoose');

const DB_NAME = 'vidyagramdb';
const HOLDING = 'Vidyagram import (unplaced)';
const id = (value) => (value ? String(value) : null);
const bump = (map, key) => map.set(key, (map.get(key) || 0) + 1);
const top = (map, n = 15) => [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);

(async () => {
  const client = new mongo.MongoClient(process.env.MONGO_URI, { readPreference: 'secondaryPreferred' });
  await client.connect();
  const db = client.db(DB_NAME);

  const sections = await db.collection('sections').find({}, { projection: { sectionName: 1, status: 1 } }).toArray();
  const topics = await db.collection('topics').find({}, { projection: { topicName: 1, section: 1, status: 1 } }).toArray();
  const subTopics = await db.collection('subtopics').find({}, { projection: { subTopicName: 1, topic: 1, status: 1 } }).toArray();
  const sectionById = new Map(sections.map((s) => [id(s._id), s]));
  const topicById = new Map(topics.map((t) => [id(t._id), t]));
  const subById = new Map(subTopics.map((s) => [id(s._id), s]));
  console.log('nodes', { sections: sections.length, topics: topics.length, subTopics: subTopics.length });
  const holding = sections.find((s) => s.sectionName === HOLDING);

  const classes = await db
    .collection('classes')
    .find({}, { projection: { section: 1, topic: 1, subTopic: 1, status: 1, isYoutubeRedirect: 1, apxAssetKey: 1, createdAt: 1 } })
    .toArray();
  const placements = await db
    .collection('courseclasses')
    .find({}, { projection: { class: 1, course: 1, section: 1, topic: 1, subTopic: 1, sectionName: 1, topicName: 1, subTopicName: 1, isActive: 1, status: 1 } })
    .toArray();

  const classSections = new Map();
  const classReport = { total: classes.length, inHolding: 0, noTopic: 0, noSubTopic: 0, otherSectionWithTopic: 0, otherSectionNoTopic: 0, deadSection: 0, deadTopic: 0, deadSubTopic: 0, notImported: 0 };
  const holdingBy = { youtube: 0, imported: 0, native: 0 };
  for (const c of classes) {
    const inHolding = holding && id(c.section) === id(holding._id);
    if (!c.apxAssetKey) classReport.notImported++;
    if (!c.topic) classReport.noTopic++;
    if (!c.subTopic) classReport.noSubTopic++;
    if (c.section && !sectionById.has(id(c.section))) classReport.deadSection++;
    if (c.topic && !topicById.has(id(c.topic))) classReport.deadTopic++;
    if (c.subTopic && !subById.has(id(c.subTopic))) classReport.deadSubTopic++;
    bump(classSections, sectionById.get(id(c.section))?.sectionName ?? '<none or dead>');
    if (inHolding) {
      classReport.inHolding++;
      holdingBy[c.isYoutubeRedirect ? 'youtube' : c.apxAssetKey ? 'imported' : 'native']++;
    } else if (c.topic) classReport.otherSectionWithTopic++;
    else classReport.otherSectionNoTopic++;
  }
  console.log('\nClass level', classReport, '\nin holding by kind', holdingBy);
  console.log('Class.section, top:', top(classSections));

  const placed = new Set();
  const sectionsPerClass = new Map();
  const report = { total: placements.length, active: 0, noSection: 0, noTopic: 0, noSubTopic: 0, holdingSection: 0, deadSection: 0, deadTopic: 0, deadSubTopic: 0, topicNotUnderSection: 0, subTopicNotUnderTopic: 0, sectionNameDiffers: 0, topicNameDiffers: 0, subTopicNameDiffers: 0, inactiveNodeOnActiveRow: 0 };
  const placementSections = new Map();
  for (const p of placements) {
    placed.add(id(p.class));
    const active = p.isActive !== false && p.status !== 0;
    if (active) report.active++;
    const section = sectionById.get(id(p.section));
    const topic = topicById.get(id(p.topic));
    const sub = subById.get(id(p.subTopic));
    if (!p.section) report.noSection++;
    if (!p.topic) report.noTopic++;
    if (!p.subTopic) report.noSubTopic++;
    if (holding && id(p.section) === id(holding._id)) report.holdingSection++;
    if (p.section && !section) report.deadSection++;
    if (p.topic && !topic) report.deadTopic++;
    if (p.subTopic && !sub) report.deadSubTopic++;
    if (topic && id(topic.section) !== id(p.section)) report.topicNotUnderSection++;
    if (sub && id(sub.topic) !== id(p.topic)) report.subTopicNotUnderTopic++;
    if (section && p.sectionName && p.sectionName !== section.sectionName) report.sectionNameDiffers++;
    if (topic && p.topicName && p.topicName !== topic.topicName) report.topicNameDiffers++;
    if (sub && p.subTopicName && p.subTopicName !== sub.subTopicName) report.subTopicNameDiffers++;
    if (active && (section?.status === 0 || topic?.status === 0 || sub?.status === 0)) report.inactiveNodeOnActiveRow++;
    bump(placementSections, section?.sectionName ?? p.sectionName ?? '<none or dead>');
    if (!sectionsPerClass.has(id(p.class))) sectionsPerClass.set(id(p.class), new Set());
    if (section) sectionsPerClass.get(id(p.class)).add(section.sectionName.trim().toLowerCase());
  }
  console.log('\nCourseClass level', report);
  console.log('CourseClass.section, top:', top(placementSections, 25));

  const spread = new Map();
  for (const names of sectionsPerClass.values()) bump(spread, names.size);
  console.log('distinct sections per placed class:', [...spread.entries()].sort((a, b) => a[0] - b[0]));

  const unplaced = classes.filter((c) => !placed.has(id(c._id)));
  console.log('\nclasses with no placement', {
    total: unplaced.length,
    active: unplaced.filter((c) => c.status === 1).length,
    youtube: unplaced.filter((c) => c.isYoutubeRedirect).length,
    imported: unplaced.filter((c) => c.apxAssetKey).length,
  });

  const byLowerName = (rows, field) => {
    const seen = new Map();
    for (const row of rows) bump(seen, String(row[field] ?? '').trim().toLowerCase());
    return [...seen.values()].filter((n) => n > 1).length;
  };
  const sectionDupes = new Map();
  for (const s of sections) bump(sectionDupes, s.sectionName.trim().toLowerCase());
  console.log('\nsection names used by more than one node:', top(new Map([...sectionDupes].filter(([, n]) => n > 1)), 25));
  console.log('duplicate names', { sections: byLowerName(sections, 'sectionName'), topics: byLowerName(topics, 'topicName'), subTopics: byLowerName(subTopics, 'subTopicName') });

  // Spot checks: rows with no filing, classes outside the holding section, and the largest sections by course.
  const courseIds = [...new Set(placements.map((p) => id(p.course)))];
  const courses = await db.collection('courses').find({ _id: { $in: courseIds.map((c) => new mongo.ObjectId(c)) } }, { projection: { title: 1, apxCourseId: 1, status: 1 } }).toArray();
  const courseById = new Map(courses.map((c) => [id(c._id), c]));
  const noFiling = placements.filter((p) => !p.section || !p.topic);
  const noFilingClasses = await db.collection('classes').find({ _id: { $in: noFiling.map((p) => p.class) } }, { projection: { title: 1 } }).toArray();
  const titleById = new Map(noFilingClasses.map((c) => [id(c._id), c.title]));
  console.log('\nplacements with no section or topic', noFiling.map((p) => ({ class: titleById.get(id(p.class)) ?? id(p.class), course: courseById.get(id(p.course))?.title, active: p.isActive })));
  const outside = await db.collection('classes').find({ section: { $ne: holding._id } }, { projection: { title: 1, section: 1, topic: 1, apxAssetKey: 1, status: 1, createdAt: 1 } }).toArray();
  console.log('classes outside holding', outside.map((c) => ({ title: c.title, section: sectionById.get(id(c.section))?.sectionName, topic: topicById.get(id(c.topic))?.topicName ?? null, placed: placed.has(id(c._id)), imported: Boolean(c.apxAssetKey), status: c.status })));
  for (const name of ['MATHEMATICS', 'Maths', 'English']) {
    const perCourse = new Map();
    const nodeIds = new Set();
    for (const p of placements) {
      const section = sectionById.get(id(p.section));
      if (section?.sectionName !== name) continue;
      nodeIds.add(id(section._id));
      const course = courseById.get(id(p.course));
      bump(perCourse, `${course?.apxCourseId ?? '?'} ${course?.title ?? id(p.course)}`);
    }
    console.log(`\nsection "${name}": nodes ${nodeIds.size}, courses ${perCourse.size}, biggest:`, top(perCourse, 8));
  }
  const perCourseSections = new Map();
  for (const p of placements) {
    const key = id(p.course);
    if (!perCourseSections.has(key)) perCourseSections.set(key, new Set());
    if (p.section) perCourseSections.get(key).add(id(p.section));
  }
  const counts = [...perCourseSections.values()].map((set) => set.size);
  console.log('\nplaced courses', counts.length, 'with one section', counts.filter((n) => n === 1).length);
  await client.close();
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
