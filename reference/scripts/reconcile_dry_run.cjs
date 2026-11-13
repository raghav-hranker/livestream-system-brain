// READ-ONLY dry run of docs/plans/prd-sections-topics-reconciliation.md.
// Writes <OUT>.json (plan + summaries) and <OUT>_changes.csv (one row per field that would change).
require('dotenv').config({ path: process.env.DOTENV_CONFIG_PATH || '.env.development' });
const mongoose = require('mongoose');
const fs = require('fs');

const { ObjectId } = mongoose.Types;
const KEEP_ACTIVE_SECTION_NAMES = new Set(['new pdfs (unfiled)']);
const KEPT_SPELLING = { advance: 'Advance', arithmetic: 'Arithmetic', 'e-book': 'E-Book' };
const AI_TEST_TOPIC_IDS = new Set([
  '6a885c143aed5ba9f3a2176e', '6a9ada036a0334598a77b808', '6a885c143aed5ba9f3a2176d', '6a885c113aed5ba9f3a21761',
  '6a885ba53aed5ba9f3a211e8', '6a885c143aed5ba9f3a2176f', '6a9ada146a0334598a77b809', '6a885ba53aed5ba9f3a211e9',
  '6a885ba53aed5ba9f3a211ea', '6a885ba53aed5ba9f3a211eb', '6a9ada276a0334598a77b80a', '6a885ba53aed5ba9f3a211ec',
  '6a885c143aed5ba9f3a2176a', '6a885ba53aed5ba9f3a211ed', '6a9ada366a0334598a77b80b',
  '6a885ba53aed5ba9f3a211f0', '6a885ba53aed5ba9f3a211f5', '6a885ba53aed5ba9f3a211f1', '6a885ba53aed5ba9f3a211f2',
  '6a885bee3aed5ba9f3a21599', '6a9ada486a0334598a77b80c', '6a885c143aed5ba9f3a2176b', '6a885ba53aed5ba9f3a211f3',
  '6a885c083aed5ba9f3a216ba', '6a885c083aed5ba9f3a216bb', '6a885c083aed5ba9f3a216bc',
  '6a885c113aed5ba9f3a21763', '6a885c113aed5ba9f3a21760', '6a885ba53aed5ba9f3a2120a', '6a885c113aed5ba9f3a2174f',
  '6a885ba53aed5ba9f3a2120c', '6a885ba53aed5ba9f3a21208', '6a885c113aed5ba9f3a21750', '6a885ba53aed5ba9f3a21219',
  '6a885c143aed5ba9f3a21768', '6a885ba53aed5ba9f3a21205', '6a885ba53aed5ba9f3a21217', '6a885c113aed5ba9f3a21764',
  '6a885ba53aed5ba9f3a21210', '6a885ba53aed5ba9f3a2121a',
]);

// [collection, field, key, isArray]. "content" refs decide which copy is kept; every ref counts for "empty".
const SECTION_CONTENT = [
  ['classes', 'section', 'class'], ['courseclasses', 'section', 'placement'],
  ['courseclasses', 'apxDisplayPlacements.section', 'apxPlacement', true], ['pdfs', 'section', 'pdf'],
  ['shorts', 'section', 'short'], ['questions', 'sectionId', 'question'], ['series', 'sectionId', 'series'],
  ['series', 'section_details.section_id', 'seriesSection', true], ['seriesquestionmaps', 'section_id', 'seriesQMap'],
  ['apxseriessectionmaps', 'localSectionId', 'apxSeriesMap'], ['aitestpatterns', 'sections.section_id', 'aiTestPattern', true],
];
const SECTION_OTHER = [
  ['assignques', 'section_id', 'assignQues'], ['savedquestions', 'sectionId', 'savedQuestion'],
  ['reportquestions', 'sectionId', 'reportQuestion'], ['learnlibrarytags', 'sourceSectionId', 'libraryTag'],
  ['series', 'section_cutoff_details.section_id', 'seriesCutoff', true], ['scores', 'sectional_data.section_id', 'score', true],
  ['userquestionanswers', 'sec_id', 'answer'],
];
const TOPIC_CONTENT = [
  ['classes', 'topic', 'class'], ['courseclasses', 'topic', 'placement'],
  ['courseclasses', 'apxDisplayPlacements.topic', 'apxPlacement', true], ['pdfs', 'topic', 'pdf'], ['shorts', 'topic', 'short'],
  ['questions', 'topicId', 'question'], ['series', 'chapterIds', 'seriesChapter', true],
  ['seriesquestionmaps', 'topic_ids', 'seriesQMap', true],
];
const TOPIC_OTHER = [
  ['usertopicquestionlogs', 'topic_id', 'studentLog'], ['coursetopics', 'topic', 'courseOrder'],
  ['savedquestions', 'topicId', 'savedQuestion'], ['reportquestions', 'topicId', 'reportQuestion'], ['subtopics', 'topic', 'subtopic'],
];
const SUB_CONTENT = [
  ['classes', 'subTopic', 'class'], ['courseclasses', 'subTopic', 'placement'],
  ['courseclasses', 'apxDisplayPlacements.subTopic', 'apxPlacement', true], ['pdfs', 'subTopic', 'pdf'],
  ['shorts', 'subTopic', 'short'], ['questions', 'subTopicId', 'question'], ['seriesquestionmaps', 'sub_topic_ids', 'seriesQMap', true],
];
// Fields the plan repoints (rule 3). Everything else on a merged-away id is left alone (rule 2).
const REPOINT = {
  section: [['classes', 'section'], ['courseclasses', 'section'], ['pdfs', 'section'], ['shorts', 'section'], ['questions', 'sectionId']],
  topic: [['classes', 'topic'], ['courseclasses', 'topic'], ['pdfs', 'topic'], ['shorts', 'topic'], ['questions', 'topicId']],
  subTopic: [['classes', 'subTopic'], ['courseclasses', 'subTopic'], ['pdfs', 'subTopic'], ['shorts', 'subTopic'], ['questions', 'subTopicId']],
};
const APX_FIELD = { section: 'section', topic: 'topic', subTopic: 'subTopic' };
const UNTOUCHED = {
  section: [...SECTION_CONTENT, ...SECTION_OTHER].filter(([c, f]) => !REPOINT.section.some(([rc, rf]) => rc === c && rf === f) && !f.startsWith('apxDisplayPlacements')),
  topic: [...TOPIC_CONTENT, ...TOPIC_OTHER].filter(([c, f]) => !REPOINT.topic.some(([rc, rf]) => rc === c && rf === f) && !f.startsWith('apxDisplayPlacements') && c !== 'coursetopics' && c !== 'subtopics'),
};

const S = (x) => (x == null ? '' : String(x));
const norm = (s) => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();
const both = (ids) => ids.flatMap((id) => (ObjectId.isValid(id) ? [new ObjectId(id), id] : [id]));
const sum = (o) => Object.values(o || {}).reduce((a, b) => a + b, 0);

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const existing = new Set((await db.listCollections().toArray()).map((c) => c.name));
  const missing = new Set();
  const col = (n) => { if (!existing.has(n)) missing.add(n); return db.collection(n); };

  const usage = async (specs) => {
    const m = new Map();
    for (const [c, f, key, arr] of specs) {
      if (!existing.has(c)) { missing.add(c); continue; }
      const rows = await col(c).aggregate([
        ...(arr ? [{ $unwind: '$' + f.split('.')[0] }] : []),
        { $match: { [f]: { $nin: [null, ''] } } },
        { $group: { _id: '$' + f, n: { $sum: 1 } } },
      ], { allowDiskUse: true }).toArray();
      for (const r of rows) { const o = m.get(S(r._id)) || {}; o[key] = (o[key] || 0) + r.n; m.set(S(r._id), o); }
    }
    return m;
  };

  const sections = await col('sections').find({}, { projection: { sectionName: 1, status: 1, customer_id: 1, createdAt: 1, legacy_id: 1 } }).toArray();
  const topics = await col('topics').find({}, { projection: { topicName: 1, section: 1, status: 1, customer_id: 1, createdAt: 1 } }).toArray();
  const subs = await col('subtopics').find({}, { projection: { subTopicName: 1, topic: 1, status: 1, createdAt: 1 } }).toArray();
  const secById = new Map(sections.map((s) => [S(s._id), s]));
  const topById = new Map(topics.map((t) => [S(t._id), t]));

  const secContent = await usage(SECTION_CONTENT);
  const secOther = await usage(SECTION_OTHER);
  const topContent = await usage(TOPIC_CONTENT);
  const topOther = await usage(TOPIC_OTHER);
  const subContent = await usage(SUB_CONTENT);
  const subOther = await usage([['savedquestions', 'subTopicId', 'savedQuestion']]);

  const secWeight = (id) => sum(secContent.get(id));
  const topWeight = (id) => sum(topContent.get(id)) + ((topOther.get(id) || {}).studentLog || 0);
  const subWeight = (id) => sum(subContent.get(id));
  const oldestFirst = (a, b) => S(a._id).localeCompare(S(b._id));

  const changes = [];
  const change = (phase, group, collection, docId, field, from, to, note = '') => changes.push({ phase, group, collection, docId: S(docId), field, from: S(from), to: S(to), note });
  const hardStops = [];
  const warnings = [];

  // Phase 2: empty sections and topics.
  const emptySections = sections.filter((s) => s.status === 1 && !KEEP_ACTIVE_SECTION_NAMES.has(norm(s.sectionName))
    && !secWeight(S(s._id)) && !sum(secOther.get(S(s._id))));
  const emptySectionIds = new Set(emptySections.map((s) => S(s._id)));
  for (const s of emptySections) change('2 empty sections', '', 'sections', s._id, 'status', 1, 0, s.sectionName);

  const activeSubsByTopic = new Map();
  for (const s of subs) if (s.status === 1) { const k = S(s.topic); if (!activeSubsByTopic.has(k)) activeSubsByTopic.set(k, []); activeSubsByTopic.get(k).push(s); }
  const isEmptyTopic = (t) => !topWeight(S(t._id)) && !sum(topOther.get(S(t._id))) && !AI_TEST_TOPIC_IDS.has(S(t._id));
  const emptyTopics = topics.filter((t) => t.status === 1 && isEmptyTopic(t));
  for (const t of emptyTopics) {
    const sec = secById.get(S(t.section));
    change('2 empty topics (decision pending)', '', 'topics', t._id, 'status', 1, 0, `${sec ? sec.sectionName : '?'} > ${t.topicName}`);
  }

  // Phase 3-5: section merge groups.
  const groupable = sections.filter((s) => s.status === 1 && !emptySectionIds.has(S(s._id)));
  const byName = new Map();
  for (const s of groupable) { const k = norm(s.sectionName); if (!byName.has(k)) byName.set(k, []); byName.get(k).push(s); }
  const groups = [...byName.entries()].filter(([, v]) => v.length > 1).map(([name, v]) => {
    v.sort((a, b) => secWeight(S(b._id)) - secWeight(S(a._id)) || oldestFirst(a, b));
    const kept = v[0];
    return { name, kept, losers: v.slice(1), keptName: KEPT_SPELLING[name] || kept.sectionName, ids: new Set(v.map((s) => S(s._id))) };
  }).sort((a, b) => [...a.ids].reduce((x, id) => x + secWeight(id), 0) - [...b.ids].reduce((x, id) => x + secWeight(id), 0));
  groups.forEach((g, i) => { g.label = `${String(i + 1).padStart(2, '0')} ${g.name}`; });

  const sectionRows = [];
  const topicRows = [];
  const subRows = [];
  const topicMap = new Map(); // merged-away topic id -> kept topic id
  const subMap = new Map();
  const loserSectionTo = new Map();
  const topicNameAfter = new Map(); // kept topic id -> spelling, for snapshot renames
  const subNameAfter = new Map();

  const nameTaken = (sectionId, name, exceptIds) => topics.some((t) => S(t.section) === sectionId && t.topicName === name && !exceptIds.has(S(t._id)));
  const subNameTaken = (topicId, name, exceptIds) => subs.some((s) => S(s.topic) === topicId && s.subTopicName === name && !exceptIds.has(S(s._id)));

  const planSubtopics = (phase, group, fromTopicId, toTopicId) => {
    const incoming = activeSubsByTopic.get(fromTopicId) || [];
    const existingSubs = activeSubsByTopic.get(toTopicId) || [];
    for (const s of incoming) {
      const match = existingSubs.find((e) => norm(e.subTopicName) === norm(s.subTopicName));
      const sid = S(s._id);
      if (match) {
        // The unique {topic, subTopicName} index ignores status, so the subtopic already under the kept topic must be the one kept.
        subMap.set(sid, S(match._id));
        subNameAfter.set(S(match._id), match.subTopicName);
        change(phase, group, 'subtopics', s._id, 'status', 1, 0, `merged into ${match.subTopicName} ${S(match._id)}`);
        subRows.push({ phase, group, action: 'merge away', id: sid, name: s.subTopicName, intoId: S(match._id), intoName: match.subTopicName, content: subWeight(sid), savedQuestions: (subOther.get(sid) || {}).savedQuestion || 0 });
      } else {
        if (subNameTaken(toTopicId, s.subTopicName, new Set([sid]))) hardStops.push({ phase, group, what: `subtopic "${s.subTopicName}" ${sid} cannot move: an inactive subtopic with the same name exists under the target topic` });
        change(phase, group, 'subtopics', s._id, 'topic', fromTopicId, toTopicId, 'moves with its topic');
        subRows.push({ phase, group, action: 'move with topic', id: sid, name: s.subTopicName, intoId: toTopicId, intoName: '', content: subWeight(sid), savedQuestions: 0 });
      }
    }
  };

  const planTopics = (phase, group, sectionIds, keptSectionId) => {
    const inGroup = topics.filter((t) => t.status === 1 && sectionIds.has(S(t.section)));
    const byTopicName = new Map();
    for (const t of inGroup) { const k = norm(t.topicName); if (!byTopicName.has(k)) byTopicName.set(k, []); byTopicName.get(k).push(t); }
    for (const [tname, list] of byTopicName) {
      const ai = list.filter((t) => AI_TEST_TOPIC_IDS.has(S(t._id)));
      if (ai.length > 1) hardStops.push({ phase, group, what: `two AI-test topics named "${tname}" would merge: ${ai.map((t) => S(t._id)).join(', ')}` });
      // The unique {section, topicName} index ignores status, so a topic already under the kept section must be the one kept.
      list.sort((a, b) => ((S(b.section) === keptSectionId) - (S(a.section) === keptSectionId))
        || (AI_TEST_TOPIC_IDS.has(S(b._id)) - AI_TEST_TOPIC_IDS.has(S(a._id))) || (topWeight(S(b._id)) - topWeight(S(a._id))) || oldestFirst(a, b));
      const kept = list[0];
      for (const t of list.slice(1)) {
        if (AI_TEST_TOPIC_IDS.has(S(t._id))) hardStops.push({ phase, group, what: `AI-test topic "${t.topicName}" ${S(t._id)} would merge away into ${S(kept._id)}` });
        if (((topOther.get(S(t._id)) || {}).studentLog || 0) > ((topOther.get(S(kept._id)) || {}).studentLog || 0)) warnings.push({ phase, group, what: `merged-away topic "${t.topicName}" ${S(t._id)} holds more student practice records than the kept one` });
      }
      const keptId = S(kept._id);
      const row = (t, action, extra = {}) => topicRows.push({
        phase, group, action, id: S(t._id), name: t.topicName, fromSection: S(t.section), fromSectionName: (secById.get(S(t.section)) || {}).sectionName,
        toSection: keptSectionId, intoId: action === 'merge away' ? keptId : '', intoName: action === 'merge away' ? kept.topicName : '',
        aiTestTopic: AI_TEST_TOPIC_IDS.has(S(t._id)), content: sum(topContent.get(S(t._id))), studentLogs: (topOther.get(S(t._id)) || {}).studentLog || 0,
        courseOrderRows: (topOther.get(S(t._id)) || {}).courseOrder || 0, subtopics: (activeSubsByTopic.get(S(t._id)) || []).length, ...extra,
      });
      if (S(kept.section) !== keptSectionId) {
        if (nameTaken(keptSectionId, kept.topicName, new Set(list.map((t) => S(t._id))))) hardStops.push({ phase, group, what: `topic "${kept.topicName}" ${keptId} cannot move: an inactive topic with the same name exists under the kept section` });
        change(phase, group, 'topics', kept._id, 'section', kept.section, keptSectionId, kept.topicName);
        row(kept, list.length > 1 ? 'keep and move across' : 'move across');
        if (AI_TEST_TOPIC_IDS.has(keptId)) warnings.push({ phase, group, what: `AI-test topic ${kept.topicName} ${keptId} changes section` });
      } else if (list.length > 1) row(kept, 'keep');
      if (list.length > 1) topicNameAfter.set(keptId, kept.topicName);
      for (const t of list.slice(1)) {
        topicMap.set(S(t._id), keptId);
        change(phase, group, 'topics', t._id, 'status', 1, 0, `merged into ${kept.topicName} ${keptId}`);
        row(t, 'merge away');
        planSubtopics(phase, group, S(t._id), keptId);
      }
    }
  };

  for (const g of groups) {
    const phase = g.label.startsWith('01') ? '4 pilot merge' : '5 section merges';
    const keptId = S(g.kept._id);
    if (g.keptName !== g.kept.sectionName) change(phase, g.label, 'sections', keptId, 'sectionName', g.kept.sectionName, g.keptName, 'approved spelling');
    sectionRows.push({ group: g.label, action: g.keptName !== g.kept.sectionName ? 'keep and rename' : 'keep', id: keptId, name: g.kept.sectionName, nameAfter: g.keptName, customer_id: g.kept.customer_id, content: secWeight(keptId), detail: secContent.get(keptId) || {} });
    for (const l of g.losers) {
      loserSectionTo.set(S(l._id), keptId);
      change(phase, g.label, 'sections', l._id, 'status', 1, 0, `merged into ${g.keptName} ${keptId}`);
      sectionRows.push({ group: g.label, action: 'merge away (switch off)', id: S(l._id), name: l.sectionName, nameAfter: g.keptName, customer_id: l.customer_id, content: secWeight(S(l._id)), detail: secContent.get(S(l._id)) || {} });
    }
    planTopics(phase, g.label, g.ids, keptId);
  }

  // Phase 6: same-name topics inside one section that is not in a merge group.
  const grouped = new Set(groups.flatMap((g) => [...g.ids]));
  for (const s of groupable) {
    const sid = S(s._id);
    if (grouped.has(sid)) continue;
    const names = new Map();
    for (const t of topics) if (t.status === 1 && S(t.section) === sid) names.set(norm(t.topicName), (names.get(norm(t.topicName)) || 0) + 1);
    if ([...names.values()].some((n) => n > 1)) planTopics('6 topics within a section', `section ${s.sectionName}`, new Set([sid]), sid);
  }

  // Repoint references. Fetch only documents that point at a merged-away id.
  const phaseOf = (group) => (group.startsWith('01') ? '4 pilot merge' : group.startsWith('section ') ? '6 topics within a section' : '5 section merges');
  const groupOfSection = new Map(groups.flatMap((g) => [...g.ids].map((id) => [id, g.label])));
  const groupOfTopic = new Map(topicRows.map((r) => [r.id, r.group]));
  const subGroup = new Map(subRows.map((r) => [r.id, r.group]));
  const maps = { section: loserSectionTo, topic: topicMap, subTopic: subMap };
  const groupFor = { section: groupOfSection, topic: groupOfTopic, subTopic: subGroup };
  const repointed = { section: new Map(), topic: new Map(), subTopic: new Map() }; // "coll|docId" -> new id, for snapshot logic
  const bumpLater = [];

  for (const level of ['section', 'topic', 'subTopic']) {
    const m = maps[level];
    if (!m.size) continue;
    const from = both([...m.keys()]);
    for (const [c, f] of REPOINT[level]) {
      if (!existing.has(c)) { missing.add(c); continue; }
      const cur = col(c).find({ [f]: { $in: from } }, { projection: { [f]: 1, course: 1 } });
      for await (const d of cur) {
        const to = m.get(S(d[f]));
        const group = groupFor[level].get(S(d[f])) || '';
        change(phaseOf(group), group, c, d._id, f, d[f], to);
        if (c === 'courseclasses') bumpLater.push([d.course, `${level}Repointed`]);
        repointed[level].set(`${c}|${S(d._id)}`, to);
      }
    }
    const apx = col('courseclasses').find({ ['apxDisplayPlacements.' + APX_FIELD[level]]: { $in: from } }, { projection: { apxDisplayPlacements: 1, course: 1 } });
    for await (const d of apx) {
      (d.apxDisplayPlacements || []).forEach((p, i) => {
        const to = m.get(S(p[APX_FIELD[level]]));
        if (!to) return;
        const group = groupFor[level].get(S(p[APX_FIELD[level]])) || '';
        change(phaseOf(group), group, 'courseclasses', d._id, `apxDisplayPlacements.${i}.${APX_FIELD[level]}`, p[APX_FIELD[level]], to);
        bumpLater.push([d.course, `${level}Repointed`]);
      });
    }
  }

  // AI tests draw only from AI_TEST_TOPIC_IDS, which never merge away (hard stop above), so these questions are outside every AI test.
  let aiTestQuestionsChangingTopic = 0;
  if (topicMap.size) {
    const n = await col('questions').countDocuments({ topicId: { $in: both([...topicMap.keys()]) }, custom_type: 'ai-test' });
    aiTestQuestionsChangingTopic = n;
  }

  // Course topic order (rule 6).
  const courseOrderRows = [];
  if (topicMap.size) {
    const rows = await col('coursetopics').find({ topic: { $in: both([...topicMap.keys(), ...new Set(topicMap.values())]) } }, { projection: { course: 1, topic: 1, priority: 1 } }).toArray();
    const has = new Set(rows.map((r) => `${S(r.course)}|${S(r.topic)}`));
    for (const r of rows) {
      const to = topicMap.get(S(r.topic));
      if (!to) continue;
      const group = groupOfTopic.get(S(r.topic)) || '';
      if (has.has(`${S(r.course)}|${to}`)) {
        courseOrderRows.push({ group, course: S(r.course), topic: S(r.topic), keptTopic: to, effect: 'kept topic order wins; this row stays, pointing at a switched-off topic' });
      } else {
        change(phaseOf(group), group, 'coursetopics', r._id, 'topic', r.topic, to, 'order kept');
        has.add(`${S(r.course)}|${to}`);
        courseOrderRows.push({ group, course: S(r.course), topic: S(r.topic), keptTopic: to, effect: 'row repointed, order kept' });
      }
    }
  }

  // Snapshot renames (rule 4) and custom names left alone.
  const groupOfSecAfter = (id) => { const g = groups.find((x) => x.ids.has(id)); return g || null; };
  const keptTopicNames = new Map([...topicNameAfter]);
  const customNames = [];
  const affectedSecIds = both(groups.flatMap((g) => [...g.ids]));
  const mergedTopicIds = new Set([...topicMap.keys(), ...topicMap.values()]);
  const mergedSubIds = new Set([...subMap.keys(), ...subMap.values()]);
  const ccCur = col('courseclasses').find({ $or: [
    { section: { $in: affectedSecIds } }, { 'apxDisplayPlacements.section': { $in: affectedSecIds } },
    { topic: { $in: both([...mergedTopicIds]) } }, { subTopic: { $in: both([...mergedSubIds]) } },
  ] }, { projection: { course: 1, section: 1, topic: 1, subTopic: 1, sectionName: 1, topicName: 1, subTopicName: 1, apxDisplayPlacements: 1 } });
  const courseTabs = new Map(); // course|group -> Set(section ids)
  const courseTopicRows = new Map(); // course|keptTopic -> Set(topic ids)
  const optionalRenames = [];
  const perCourse = new Map();
  const bump = (course, key) => { const o = perCourse.get(S(course)) || {}; o[key] = (o[key] || 0) + 1; perCourse.set(S(course), o); };
  const approved = (group, kind) => kind === 'section' && groups.some((g) => g.label === group && g.keptName !== g.kept.sectionName);
  const snap = (group, docId, field, current, groupNorm, target, kind, course) => {
    if (!current) return;
    if (norm(current) === groupNorm) {
      if (current === target) return;
      if (approved(group, kind)) { change(phaseOf(group), group, 'courseclasses', docId, field, current, target, `${kind} snapshot spelling (approved)`); bump(course, 'spellingChanges'); }
      else optionalRenames.push({ group, collection: 'courseclasses', docId: S(docId), course: S(course), field, from: current, to: target });
    }
    else customNames.push({ group, collection: 'courseclasses', docId: S(docId), field, storedName: current, wouldBe: target });
  };
  for await (const d of ccCur) {
    const sec = S(d.section);
    const g = groupOfSecAfter(sec);
    if (g) {
      snap(g.label, d._id, 'sectionName', d.sectionName, g.name, g.keptName, 'section', d.course);
      const k = `${S(d.course)}|${g.label}`;
      if (!courseTabs.has(k)) courseTabs.set(k, new Set());
      courseTabs.get(k).add(sec);
    }
    const tid = S(d.topic);
    const keptT = topicMap.get(tid) || (topicNameAfter.has(tid) ? tid : null);
    if (keptT) {
      const kt = topById.get(keptT);
      snap(groupOfTopic.get(tid) || '', d._id, 'topicName', d.topicName, norm(kt.topicName), keptTopicNames.get(keptT) || kt.topicName, 'topic', d.course);
      const k = `${S(d.course)}|${keptT}`;
      if (!courseTopicRows.has(k)) courseTopicRows.set(k, new Set());
      courseTopicRows.get(k).add(tid);
    }
    const stid = S(d.subTopic);
    const keptS = subMap.get(stid) || (subNameAfter.has(stid) ? stid : null);
    if (keptS && d.subTopicName && norm(d.subTopicName) === norm(subNameAfter.get(keptS)) && d.subTopicName !== subNameAfter.get(keptS)) {
      optionalRenames.push({ group: subGroup.get(stid) || '', collection: 'courseclasses', docId: S(d._id), course: S(d.course), field: 'subTopicName', from: d.subTopicName, to: subNameAfter.get(keptS) });
    }
    (d.apxDisplayPlacements || []).forEach((p, i) => {
      const pg = groupOfSecAfter(S(p.section));
      if (pg) snap(pg.label, d._id, `apxDisplayPlacements.${i}.sectionName`, p.sectionName, pg.name, pg.keptName, 'section', d.course);
      const pt = S(p.topic);
      const pk = topicMap.get(pt) || (topicNameAfter.has(pt) ? pt : null);
      if (pk) snap(groupOfTopic.get(pt) || '', d._id, `apxDisplayPlacements.${i}.topicName`, p.topicName, norm(topById.get(pk).topicName), keptTopicNames.get(pk) || topById.get(pk).topicName, 'topic', d.course);
    });
  }
  const pdfs = await col('pdfs').find({ $or: [{ section: { $in: affectedSecIds } }, { topic: { $in: both([...mergedTopicIds]) } }] }, { projection: { section: 1, topic: 1 } }).toArray();
  const pdfById = new Map(pdfs.map((p) => [S(p._id), p]));
  const cpCur = col('coursepdfs').find({ pdf: { $in: pdfs.map((p) => p._id) } }, { projection: { course: 1, pdf: 1, sectionName: 1, topicName: 1, overrideSectionName: 1 } });
  for await (const d of cpCur) {
    const p = pdfById.get(S(d.pdf));
    const g = groupOfSecAfter(S(p.section));
    if (g && d.sectionName) {
      if (norm(d.sectionName) === g.name) {
        if (d.sectionName !== g.keptName && approved(g.label, 'section')) { change(phaseOf(g.label), g.label, 'coursepdfs', d._id, 'sectionName', d.sectionName, g.keptName, 'section snapshot spelling (approved)'); bump(d.course, 'spellingChanges'); }
        else if (d.sectionName !== g.keptName) optionalRenames.push({ group: g.label, collection: 'coursepdfs', docId: S(d._id), course: S(d.course), field: 'sectionName', from: d.sectionName, to: g.keptName });
      }
      else customNames.push({ group: g.label, collection: 'coursepdfs', docId: S(d._id), field: 'sectionName', storedName: d.sectionName, wouldBe: g.keptName });
    }
    if (g && d.overrideSectionName) customNames.push({ group: g.label, collection: 'coursepdfs', docId: S(d._id), field: 'overrideSectionName', storedName: d.overrideSectionName, wouldBe: '(admin override, left alone)' });
    const tid = S(p.topic);
    const kt = topicMap.get(tid) || (topicNameAfter.has(tid) ? tid : null);
    if (kt && d.topicName && norm(d.topicName) === norm(topById.get(kt).topicName) && d.topicName !== (keptTopicNames.get(kt) || topById.get(kt).topicName)) {
      optionalRenames.push({ group: groupOfTopic.get(tid) || '', collection: 'coursepdfs', docId: S(d._id), course: S(d.course), field: 'topicName', from: d.topicName, to: keptTopicNames.get(kt) });
    }
  }

  for (const [course, key] of bumpLater) bump(course, key);
  for (const r of courseOrderRows) bump(r.course, 'topicOrderRows');
  for (const r of optionalRenames) if (r.course) bump(r.course, 'optionalSpellingChanges');
  const coursesUsingGroups = new Map();
  for (const k of courseTabs.keys()) { const [course, group] = k.split('|'); if (!coursesUsingGroups.has(course)) coursesUsingGroups.set(course, new Set()); coursesUsingGroups.get(course).add(group); }
  // Course impact.
  const courseIds = new Set([...courseTabs.keys(), ...courseTopicRows.keys(), ...courseOrderRows.map((r) => `${r.course}|`), ...[...perCourse.keys()].map((c) => `${c}|`)].map((k) => k.split('|')[0]));
  const courses = await col('courses').find({ _id: { $in: both([...courseIds]) } }, { projection: { title: 1, status: 1 } }).toArray();
  const courseTitle = new Map(courses.map((c) => [S(c._id), c.title]));
  const courseImpact = [];
  for (const [k, set] of courseTabs) if (set.size > 1) {
    const [course, group] = k.split('|');
    courseImpact.push({ course, title: courseTitle.get(course) || '', group, effect: `${set.size} section tabs become 1`, names: [...set].map((id) => secById.get(id).sectionName).join(' / ') });
  }
  for (const [k, set] of courseTopicRows) if (set.size > 1) {
    const [course, keptT] = k.split('|');
    courseImpact.push({ course, title: courseTitle.get(course) || '', group: groupOfTopic.get(keptT) || '', effect: `${set.size} topic rows become 1`, names: [...set].map((id) => topById.get(id).topicName).join(' / ') });
  }
  for (const r of courseOrderRows) if (r.effect.startsWith('kept')) courseImpact.push({ course: r.course, title: courseTitle.get(r.course) || '', group: r.group, effect: 'topic order: kept topic position wins', names: `${topById.get(r.topic).topicName} -> ${topById.get(r.keptTopic).topicName}` });

  const courseRows = [...courseIds].filter(Boolean).map((id) => ({
    course: id, title: courseTitle.get(id) || '', groupsUsed: [...(coursesUsingGroups.get(id) || [])].join(', '),
    sectionRepointed: 0, topicRepointed: 0, subTopicRepointed: 0, spellingChanges: 0, optionalSpellingChanges: 0, topicOrderRows: 0, ...(perCourse.get(id) || {}),
    studentVisible: (perCourse.get(id) || {}).spellingChanges ? 'approved spelling change' : courseImpact.some((r) => r.course === id) ? 'tabs or topic rows combine' : 'none',
  })).sort((a, b) => a.title.localeCompare(b.title));
  const crossCheck = await col('courseclasses').aggregate([
    { $match: { section: { $in: affectedSecIds } } },
    { $group: { _id: { course: '$course', section: '$section' } } },
    { $group: { _id: '$_id.course', sections: { $push: '$_id.section' } } },
  ]).toArray();
  const coursesWithTwoCopiesCrossCheck = crossCheck.filter((r) => {
    const byGroup = new Map();
    for (const sec of r.sections) { const g = groupOfSecAfter(S(sec)); if (g) byGroup.set(g.label, (byGroup.get(g.label) || 0) + 1); }
    return [...byGroup.values()].some((n) => n > 1);
  }).length;

  // What stays on the old ids (rule 2), and test papers holding two copies of one name.
  const untouched = [];
  const awaySec = [...loserSectionTo.keys()];
  for (const [c, f, key, arr] of UNTOUCHED.section) {
    if (!existing.has(c) || !awaySec.length) continue;
    const n = await col(c).countDocuments({ [f]: { $in: both(awaySec) } });
    if (n) untouched.push({ level: 'section', collection: c, field: f, what: key, documents: n });
  }
  for (const [c, f, key] of UNTOUCHED.topic) {
    if (!existing.has(c) || !topicMap.size) continue;
    const n = await col(c).countDocuments({ [f]: { $in: both([...topicMap.keys()]) } });
    if (n) untouched.push({ level: 'topic', collection: c, field: f, what: key, documents: n });
  }
  const papersWithTwoCopies = [];
  if (existing.has('assignques')) {
    const rows = await col('assignques').aggregate([
      { $match: { section_id: { $in: [...groupOfSection.keys()] } } },
      { $group: { _id: { s: '$series_id', sec: '$section_id' }, n: { $sum: 1 } } },
    ], { allowDiskUse: true }).toArray();
    const bySeries = new Map();
    for (const r of rows) { const k = `${r._id.s}|${groupOfSection.get(S(r._id.sec))}`; if (!bySeries.has(k)) bySeries.set(k, []); bySeries.get(k).push(S(r._id.sec)); }
    for (const [k, secs] of bySeries) if (secs.length > 1) { const [series, group] = k.split('|'); papersWithTwoCopies.push({ series, group, sections: secs.map((id) => secById.get(id).sectionName).join(' / ') }); }
  }

  const count = (pred) => changes.filter(pred).length;
  const summary = {
    generatedAt: new Date().toISOString(),
    hardStops: hardStops.length,
    warnings: warnings.length,
    missingCollections: [...missing],
    sectionsActiveToday: sections.filter((s) => s.status === 1).length,
    emptySectionsSwitchedOff: emptySections.length,
    emptyTopicsSwitchedOffIfApproved: emptyTopics.length,
    mergeGroups: groups.length,
    sectionsMergedAway: loserSectionTo.size,
    sectionsRenamed: count((c) => c.collection === 'sections' && c.field === 'sectionName'),
    topicsMergedAway: topicMap.size,
    topicsMovedAcross: topicRows.filter((r) => r.action.includes('move across')).length,
    subtopicsMergedAway: subMap.size,
    subtopicsMovedWithTopic: subRows.filter((r) => r.action === 'move with topic').length,
    withinSectionTopicGroups: new Set(topicRows.filter((r) => r.phase.startsWith('6')).map((r) => r.group + r.name.toLowerCase())).size,
    fieldChangesTotal: changes.length,
    coursesWithCombinedTabsOrTopics: new Set(courseImpact.map((r) => r.course)).size,
    coursesWithTwoCopiesCrossCheck,
    coursesTouched: courseRows.length,
    optionalSpellingChangesNotMade: optionalRenames.length,
    aiTestQuestionsChangingTopic,
    customNamesLeftAlone: customNames.length,
    testPapersWithTwoCopiesOfOneName: papersWithTwoCopies.length,
  };
  const byPhase = {};
  for (const c of changes) { const k = `${c.phase} | ${c.collection}.${c.field.replace(/\.\d+\./, '[].')}`; byPhase[k] = (byPhase[k] || 0) + 1; }

  console.log(JSON.stringify(summary, null, 1));
  console.log(JSON.stringify(byPhase, null, 1));
  if (hardStops.length) console.log('HARD STOPS', JSON.stringify(hardStops, null, 1));

  const out = process.env.OUT || 'reconcile_dry_run';
  fs.writeFileSync(out + '.json', JSON.stringify({ summary, byPhase, hardStops, warnings, sectionRows, topicRows, subRows, courseImpact, courseRows, courseOrderRows, customNames, optionalRenames, untouched, papersWithTwoCopies,
    groups: groups.map((g) => ({ group: g.label, keptId: S(g.kept._id), keptName: g.keptName, losers: g.losers.map((l) => S(l._id)) })) }, null, 1));
  const csv = (v) => `"${S(v).replace(/"/g, '""')}"`;
  const head = ['phase', 'group', 'collection', 'docId', 'field', 'from', 'to', 'note'];
  fs.writeFileSync(out + '_changes.csv', [head.join(','), ...changes.map((c) => head.map((h) => csv(c[h])).join(','))].join('\n'));
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
