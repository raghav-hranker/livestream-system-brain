// READ-ONLY audit: duplicate sections / topics / subtopics (same name path) + usage counts per node.
require('dotenv').config({ path: process.env.DOTENV_CONFIG_PATH || '.env.development' });
const mongoose = require('mongoose');
(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const col = (n) => db.collection(n);
  const norm = (s) => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();
  const S = (x) => String(x);

  const sections = await col('sections').find({}, { projection: { sectionName: 1, status: 1, createdAt: 1, legacy_id: 1, customer_id: 1 } }).toArray();
  const topics = await col('topics').find({}, { projection: { topicName: 1, status: 1, section: 1, createdAt: 1, legacy_id: 1 } }).toArray();
  const subs = await col('subtopics').find({}, { projection: { subTopicName: 1, status: 1, topic: 1, createdAt: 1, legacy_id: 1 } }).toArray();
  const secById = new Map(sections.map((s) => [S(s._id), s]));
  const topById = new Map(topics.map((t) => [S(t._id), t]));

  // usage counters: id -> {source: count}
  const use = { sec: new Map(), top: new Map(), sub: new Map() };
  const bump = (m, id, src, n = 1) => { if (!id) return; const k = S(id); const o = m.get(k) || {}; o[src] = (o[src] || 0) + n; m.set(k, o); };
  const countBy = async (name, field, map, src, filter = {}) => {
    const rows = await col(name).aggregate([{ $match: { [field]: { $ne: null }, ...filter } }, { $group: { _id: '$' + field, n: { $sum: 1 } } }]).toArray();
    for (const r of rows) bump(map, r._id, src, r.n);
  };
  const countArr = async (name, field, map, src) => {
    const rows = await col(name).aggregate([{ $unwind: '$' + field }, { $group: { _id: '$' + field, n: { $sum: 1 } } }]).toArray();
    for (const r of rows) bump(map, r._id, src, r.n);
  };
  const jobs = [
    ['classes', 'section', use.sec, 'class'], ['classes', 'topic', use.top, 'class'], ['classes', 'subTopic', use.sub, 'class'],
    ['courseclasses', 'section', use.sec, 'courseclass'], ['courseclasses', 'topic', use.top, 'courseclass'], ['courseclasses', 'subTopic', use.sub, 'courseclass'],
    ['pdfs', 'section', use.sec, 'pdf'], ['pdfs', 'topic', use.top, 'pdf'], ['pdfs', 'subTopic', use.sub, 'pdf'],
    ['questions', 'sectionId', use.sec, 'question'], ['questions', 'topicId', use.top, 'question'], ['questions', 'subTopicId', use.sub, 'question'],
    ['shorts', 'section', use.sec, 'short'], ['shorts', 'topic', use.top, 'short'], ['shorts', 'subTopic', use.sub, 'short'],
    ['series', 'sectionId', use.sec, 'series'], ['seriesquestionmaps', 'section_id', use.sec, 'seriesqmap'],
    ['usertopicquestionlogs', 'topic_id', use.top, 'userlog'],
    ['learnlibrarytags', 'sourceSectionId', use.sec, 'libtag'], ['apxseriessectionmaps', 'localSectionId', use.sec, 'apxmap'],
    ['ebooks', 'section', use.sec, 'ebook'], ['ebooks', 'topic', use.top, 'ebook'], ['ebooks', 'subTopic', use.sub, 'ebook'],
  ];
  for (const j of jobs) { try { await countBy(...j); } catch (e) { console.error('skip', j[0], j[1], e.message); } }
  const arrJobs = [
    ['courseclasses', 'apxDisplayPlacements.section', use.sec, 'apxplacement'], ['courseclasses', 'apxDisplayPlacements.topic', use.top, 'apxplacement'], ['courseclasses', 'apxDisplayPlacements.subTopic', use.sub, 'apxplacement'],
    ['series', 'section_details.section_id', use.sec, 'series'], ['series', 'chapterIds', use.top, 'series'],
    ['seriesquestionmaps', 'topic_ids', use.top, 'seriesqmap'], ['seriesquestionmaps', 'sub_topic_ids', use.sub, 'seriesqmap'],
    ['aitestpatterns', 'sections.section_id', use.sec, 'aitest'],
  ];
  for (const j of arrJobs) { try { await countArr(...j); } catch (e) { console.error('skip', j[0], j[1], e.message); } }
  const cc = await col('courseclasses').aggregate([{ $match: { section: { $ne: null } } }, { $group: { _id: '$section', courses: { $addToSet: '$course' } } }]).toArray();
  for (const r of cc) bump(use.sec, r._id, 'courses', r.courses.length);
  // children count as "use" too (a section with topics is not free to delete)
  for (const t of topics) bump(use.sec, t.section, 'childTopics');
  for (const s of subs) bump(use.top, s.topic, 'childSubTopics');

  const total = (o) => Object.entries(o || {}).filter(([k]) => k !== 'courses').map(([, v]) => v).reduce((a, b) => a + b, 0);
  const contentTotal = (o) => Object.entries(o || {}).filter(([k]) => !k.startsWith('child') && k !== 'courses').reduce((a, [, b]) => a + b, 0);

  const secPath = (id) => { const s = secById.get(S(id)); return s ? s.sectionName : '?missing-section'; };
  const topPath = (id) => { const t = topById.get(S(id)); return t ? secPath(t.section) + ' > ' + t.topicName : '?missing-topic'; };

  const groupDupes = (items, keyFn, labelFn, useMap) => {
    const g = new Map();
    for (const it of items) { const k = keyFn(it); if (!g.has(k)) g.set(k, []); g.get(k).push(it); }
    const out = [];
    for (const [k, arr] of g) if (arr.length > 1) out.push({ key: k, items: arr.map((it) => ({ id: S(it._id), label: labelFn(it), status: it.status, customer_id: it.customer_id, legacy_id: it.legacy_id, created: it.createdAt && it.createdAt.toISOString().slice(0, 16), use: useMap.get(S(it._id)) || {}, contentUse: contentTotal(useMap.get(S(it._id))), totalUse: total(useMap.get(S(it._id))) })) });
    return out.sort((a, b) => a.key.localeCompare(b.key));
  };
  const report = {
    counts: { sections: sections.length, activeSections: sections.filter((s) => s.status === 1).length, customers: [...new Set(sections.map((s) => String(s.customer_id)))], topics: topics.length, subtopics: subs.length },
    // A: same name at the same level, regardless of parent (what the admin dropdown sees)
    sectionsByName: groupDupes(sections, (s) => norm(s.sectionName), (s) => s.sectionName, use.sec),
    topicsByName: groupDupes(topics, (t) => norm(t.topicName), (t) => topPath(t._id), use.top),
    subtopicsByName: groupDupes(subs, (s) => norm(s.subTopicName), (s) => topPath(s.topic) + ' > ' + s.subTopicName, use.sub),
    // B: same full path (section name > topic name > subtopic name) — the true duplicates
    topicsByPath: groupDupes(topics, (t) => norm(secPath(t.section)) + ' > ' + norm(t.topicName), (t) => topPath(t._id), use.top),
    subtopicsByPath: groupDupes(subs, (s) => norm(topPath(s.topic)) + ' > ' + norm(s.subTopicName), (s) => topPath(s.topic) + ' > ' + s.subTopicName, use.sub),
    orphans: {
      topicsMissingSection: topics.filter((t) => !secById.has(S(t.section))).length,
      subtopicsMissingTopic: subs.filter((s) => !topById.has(S(s.topic))).length,
    },
  };
  const summ = (name, arr) => { const nodes = arr.reduce((a, g) => a + g.items.length, 0); const unused = arr.reduce((a, g) => a + g.items.filter((i) => i.totalUse === 0).length, 0); const contentFree = arr.reduce((a, g) => a + g.items.filter((i) => i.contentUse === 0).length, 0); console.log(`${name}: ${arr.length} groups, ${nodes} nodes, ${unused} fully unused, ${contentFree} with no content (only children)`); };
  console.log(JSON.stringify(report.counts), JSON.stringify(report.orphans));
  for (const k of ['sectionsByName', 'topicsByName', 'subtopicsByName', 'topicsByPath', 'subtopicsByPath']) summ(k, report[k]);
  require('fs').writeFileSync(process.env.OUT || 'taxonomy_dupes.json', JSON.stringify(report, null, 1));
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
