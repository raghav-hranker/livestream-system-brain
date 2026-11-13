// READ-ONLY: audit topics (and subtopics) and predict topic collisions for the planned section merges.
// Merge groups: active, non-empty sections sharing a case/space-folded name; survivor = most content.
require('dotenv').config({ path: process.env.DOTENV_CONFIG_PATH || '.env.development' });
const mongoose = require('mongoose');
const fs = require('fs');

const TOPIC_REFS = [
  ['classes', 'topic', 'class'],
  ['courseclasses', 'topic', 'placement'],
  ['courseclasses', 'apxDisplayPlacements.topic', 'apxPlacement', true],
  ['pdfs', 'topic', 'pdf'],
  ['shorts', 'topic', 'short'],
  ['ebooks', 'topic', 'ebook'],
  ['questions', 'topicId', 'question'],
  ['series', 'chapterIds', 'seriesChapter', true],
  ['seriesquestionmaps', 'topic_ids', 'seriesQMap', true],
  ['usertopicquestionlogs', 'topic_id', 'studentLog'],
];
const SECTION_REFS = [
  ['classes', 'section'], ['courseclasses', 'section'], ['pdfs', 'section'], ['shorts', 'section'], ['ebooks', 'section'],
  ['questions', 'sectionId'], ['series', 'sectionId'], ['seriesquestionmaps', 'section_id'],
];
const CONTENT_KEYS = ['class', 'placement', 'apxPlacement', 'pdf', 'short', 'ebook', 'question', 'seriesChapter', 'seriesQMap'];

const norm = (s) => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();
const S = String;

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const group = async (coll, field, isArray) => db.collection(coll).aggregate([
    ...(isArray ? [{ $unwind: '$' + field.split('.')[0] }] : []),
    { $match: { [field]: { $ne: null } } },
    { $group: { _id: '$' + field, n: { $sum: 1 } } },
  ]).toArray();

  const tUse = new Map();
  for (const [coll, field, key, arr] of TOPIC_REFS) {
    try {
      for (const r of await group(coll, field, arr)) {
        const o = tUse.get(S(r._id)) || {};
        o[key] = (o[key] || 0) + r.n;
        tUse.set(S(r._id), o);
      }
    } catch (e) { console.error('skip', coll, field, e.message); }
  }
  const sContent = new Map();
  for (const [coll, field] of SECTION_REFS) {
    try { for (const r of await group(coll, field)) sContent.set(S(r._id), (sContent.get(S(r._id)) || 0) + r.n); } catch (e) { console.error('skip', coll, field, e.message); }
  }
  const subsByTopic = new Map();
  for (const r of await db.collection('subtopics').aggregate([{ $group: { _id: '$topic', n: { $sum: 1 } } }]).toArray()) subsByTopic.set(S(r._id), r.n);

  const sections = await db.collection('sections').find({}, { projection: { sectionName: 1, status: 1, customer_id: 1 } }).toArray();
  const topics = await db.collection('topics').find({}, { projection: { topicName: 1, section: 1, status: 1, customer_id: 1, createdAt: 1, legacy_id: 1 } }).toArray();
  const secById = new Map(sections.map((s) => [S(s._id), s]));

  const contentOf = (o) => CONTENT_KEYS.reduce((a, k) => a + ((o || {})[k] || 0), 0);
  const rows = topics.map((t) => {
    const o = tUse.get(S(t._id)) || {};
    const sec = secById.get(S(t.section));
    return {
      id: S(t._id), name: t.topicName, status: t.status, customer_id: t.customer_id, legacy_id: t.legacy_id,
      created: t.createdAt ? t.createdAt.toISOString().slice(0, 10) : '',
      sectionId: S(t.section), sectionName: sec ? sec.sectionName : '?missing', sectionStatus: sec ? sec.status : null,
      content: contentOf(o), studentLogs: o.studentLog || 0, subtopics: subsByTopic.get(S(t._id)) || 0, use: o,
    };
  });

  const dupGroups = (keyFn, items) => {
    const m = new Map();
    for (const x of items) { const k = keyFn(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); }
    return [...m.entries()].filter(([, v]) => v.length > 1).map(([key, v]) => ({ key, topics: v.sort((a, b) => b.content - a.content) }));
  };
  const active = rows.filter((r) => r.status === 1);

  const sameSection = dupGroups((r) => r.sectionId + '|' + norm(r.name), active);

  const mergeable = sections.filter((s) => s.status === 1 && (sContent.get(S(s._id)) || 0) > 0);
  const byName = new Map();
  for (const s of mergeable) { const k = norm(s.sectionName); if (!byName.has(k)) byName.set(k, []); byName.get(k).push(s); }
  const collisions = [];
  for (const [name, secs] of byName) {
    if (secs.length < 2) continue;
    secs.sort((a, b) => (sContent.get(S(b._id)) || 0) - (sContent.get(S(a._id)) || 0));
    const survivor = secs[0];
    const ids = new Set(secs.map((s) => S(s._id)));
    const inGroup = active.filter((r) => ids.has(r.sectionId));
    const survivorNames = new Map(inGroup.filter((r) => r.sectionId === S(survivor._id)).map((r) => [norm(r.name), r]));
    const moved = inGroup.filter((r) => r.sectionId !== S(survivor._id));
    const clash = dupGroups((r) => norm(r.name), inGroup).filter((g) => new Set(g.topics.map((t) => t.sectionId)).size > 1);
    collisions.push({
      section: name, survivor: S(survivor._id), sectionsInGroup: secs.length, topicsInGroup: inGroup.length,
      topicsMovingAcross: moved.filter((r) => !survivorNames.has(norm(r.name))).length,
      collidingNames: clash.length, collidingTopics: clash.reduce((a, g) => a + g.topics.length, 0),
      exactCaseClash: clash.filter((g) => new Set(g.topics.map((t) => t.name.trim())).size < g.topics.length).length,
      collisionContent: clash.reduce((a, g) => a + g.topics.slice(1).reduce((b, t) => b + t.content, 0), 0),
      collisionStudentLogs: clash.reduce((a, g) => a + g.topics.reduce((b, t) => b + t.studentLogs, 0), 0),
      clash: clash.map((g) => ({ name: g.key, topics: g.topics.map((t) => ({ id: t.id, name: t.name, sectionId: t.sectionId, content: t.content, studentLogs: t.studentLogs, subtopics: t.subtopics, use: t.use })) })),
    });
  }

  const summary = {
    topics: rows.length, activeTopics: active.length,
    emptyActiveTopics: active.filter((r) => r.content === 0 && r.studentLogs === 0 && r.subtopics === 0).length,
    topicsUnderInactiveSections: active.filter((r) => r.sectionStatus !== 1).length,
    sameNameSameSectionGroups: sameSection.length,
    sameNameAnySectionNames: dupGroups((r) => norm(r.name), active).length,
    mergeGroups: collisions.length,
    postMergeCollidingNames: collisions.reduce((a, c) => a + c.collidingNames, 0),
    postMergeCollidingTopics: collisions.reduce((a, c) => a + c.collidingTopics, 0),
    postMergeExactCaseClashes: collisions.reduce((a, c) => a + c.exactCaseClash, 0),
  };
  console.log(JSON.stringify(summary, null, 1));
  for (const c of collisions.sort((a, b) => b.collidingTopics - a.collidingTopics)) {
    console.log(`${c.section}: ${c.topicsInGroup} topics, ${c.topicsMovingAcross} move across, ${c.collidingNames} colliding names (${c.exactCaseClash} exact-case), clash content ${c.collisionContent}, student logs ${c.collisionStudentLogs}`);
  }

  const out = process.env.OUT || 'topic_audit';
  fs.writeFileSync(out + '.json', JSON.stringify({ summary, sameSection, collisions }, null, 1));
  const csv = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const head = ['name', 'id', 'status', 'sectionName', 'sectionId', 'sectionStatus', 'customer_id', 'created', 'content', 'studentLogs', 'subtopics', 'use'];
  fs.writeFileSync(out + '.csv', [head.join(','), ...rows.map((r) => head.map((h) => csv(h === 'use' ? JSON.stringify(r.use) : r[h])).join(','))].join('\n'));
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
