// READ-ONLY. One row per section, topic or subtopic with how many records point at it from every place that
// stores its id. Same-name copies are grouped (column `group`) so they can be compared side by side.
// Box run:  KIND=sections|topics|subtopics DOTENV_CONFIG_PATH=.env.development OUT=<file>.csv node taxonomy_usage.cjs
// Offline:  KIND=sections KINDS=reference/section_kinds.csv COPIES=reference/test_copy_usage_copies.csv OUT=... node taxonomy_usage.cjs
//           KIND=topics   AUDIT=reference/topic_audit.csv OUT=... node taxonomy_usage.cjs
//           (rebuilds the table from the older probes' CSVs; columns they never counted stay blank; subtopics need the box)
const fs = require('fs');

// places: [column, collection, field, isArray]. Column order is CSV order.
const KINDS = {
  sections: {
    coll: 'sections', nameField: 'sectionName', parents: [],
    places: [
      ['classes', 'classes', 'section'], ['coursePlacements', 'courseclasses', 'section'],
      ['apxPlacements', 'courseclasses', 'apxDisplayPlacements.section', true], ['pdfs', 'pdfs', 'section'],
      ['shorts', 'shorts', 'section'], ['ebooks', 'ebooks', 'section'], ['questions', 'questions', 'sectionId'],
      ['testPapers', 'series', 'sectionId'], ['paperParts', 'series', 'section_details.section_id', true],
      ['paperCutoffs', 'series', 'section_cutoff_details.section_id', true], ['questionMaps', 'seriesquestionmaps', 'section_id'],
      ['apxSeriesMaps', 'apxseriessectionmaps', 'localSectionId'], ['aiTestPatterns', 'aitestpatterns', 'sections.section_id', true],
      ['assignedQuestions', 'assignques', 'section_id'], ['savedQuestions', 'savedquestions', 'sectionId'],
      ['reportedQuestions', 'reportquestions', 'sectionId'], ['libraryTags', 'learnlibrarytags', 'sourceSectionId'],
      ['scores', 'scores', 'sectional_data.section_id', true], ['answers', 'userquestionanswers', 'sec_id'],
    ],
    derived: [['courses', 'courseclasses', 'section', 'course'], ['topics', 'topics', 'section']],
  },
  topics: {
    coll: 'topics', nameField: 'topicName', parents: [['section', 'sections', 'sectionName']],
    places: [
      ['classes', 'classes', 'topic'], ['coursePlacements', 'courseclasses', 'topic'],
      ['apxPlacements', 'courseclasses', 'apxDisplayPlacements.topic', true], ['pdfs', 'pdfs', 'topic'],
      ['shorts', 'shorts', 'topic'], ['ebooks', 'ebooks', 'topic'], ['questions', 'questions', 'topicId'],
      ['testPapers', 'series', 'chapterIds', true], ['questionMaps', 'seriesquestionmaps', 'topic_ids', true],
      ['courseOrders', 'coursetopics', 'topic'], ['studentLogs', 'usertopicquestionlogs', 'topic_id'],
      ['savedQuestions', 'savedquestions', 'topicId'], ['reportedQuestions', 'reportquestions', 'topicId'],
    ],
    derived: [['courses', 'courseclasses', 'topic', 'course'], ['subtopics', 'subtopics', 'topic']],
  },
  subtopics: {
    coll: 'subtopics', nameField: 'subTopicName', parents: [['topic', 'topics', 'topicName'], ['section', 'sections', 'sectionName']],
    places: [
      ['classes', 'classes', 'subTopic'], ['coursePlacements', 'courseclasses', 'subTopic'],
      ['apxPlacements', 'courseclasses', 'apxDisplayPlacements.subTopic', true], ['pdfs', 'pdfs', 'subTopic'],
      ['shorts', 'shorts', 'subTopic'], ['questions', 'questions', 'subTopicId'],
      ['questionMaps', 'seriesquestionmaps', 'sub_topic_ids', true],
    ],
    derived: [['courses', 'courseclasses', 'subTopic', 'course']],
  },
};

const S = (v) => (v == null ? '' : String(v));
const norm = (s) => S(s).trim().replace(/\s+/g, ' ').toLowerCase();
const csv = (v) => { const s = S(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const parseCsv = (text) => {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"') q = true; else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows;
  return body.filter((r) => r.length > 1).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
};
const columnsOf = (kind) => ['group', 'copies', 'id', 'name', 'status', 'customer',
  ...kind.parents.flatMap(([f]) => [`${f}Id`, `${f}Name`]), ...kind.places.map((p) => p[0]), ...kind.derived.map((d) => d[0]), 'total'];

async function fromMongo(kind, uri) {
  const mongoose = require('mongoose');
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const usage = new Map();
  const add = (id, col, n) => { if (!id) return; const o = usage.get(S(id)) || {}; o[col] = (o[col] || 0) + n; usage.set(S(id), o); };
  const group = (coll, field, isArray, extra) => db.collection(coll).aggregate([
    ...(isArray ? [{ $unwind: '$' + field.split('.')[0] }] : []),
    { $match: { [field]: { $ne: null } } },
    // ids are sometimes stored as strings (userquestionanswers.sec_id): count both forms together
    { $group: { _id: { $toString: '$' + field }, ...(extra ? { s: { $addToSet: '$' + extra } } : { n: { $sum: 1 } }) } },
  ], { allowDiskUse: true }).toArray();
  for (const [col, coll, field, isArray] of kind.places) for (const r of await group(coll, field, isArray)) add(r._id, col, r.n);
  for (const [col, coll, field, distinct] of kind.derived) for (const r of await group(coll, field, false, distinct)) add(r._id, col, distinct ? r.s.length : r.n);

  const nameOf = {};
  for (const [, coll, nameField] of kind.parents) nameOf[coll] = new Map((await db.collection(coll).find({}, { projection: { [nameField]: 1, section: 1 } }).toArray()).map((d) => [S(d._id), d]));
  const docs = await db.collection(kind.coll).find({}, { projection: { [kind.nameField]: 1, status: 1, customer_id: 1, section: 1, topic: 1 } }).toArray();
  await mongoose.disconnect();
  return docs.map((d) => {
    const row = { id: S(d._id), name: d[kind.nameField], status: d.status, customer: d.customer_id, ...(usage.get(S(d._id)) || {}) };
    let parentId = d[kind.parents[0]?.[0]];
    for (const [f, coll, nameField] of kind.parents) {
      const p = nameOf[coll].get(S(parentId));
      row[`${f}Id`] = S(parentId); row[`${f}Name`] = p ? p[nameField] : '';
      parentId = p && p.section; // subtopic -> topic -> section
    }
    return row;
  });
}

function fromCsvs(kindName) {
  if (kindName === 'sections') {
    const rename = { class: 'classes', placement: 'coursePlacements', apxPlacement: 'apxPlacements', pdf: 'pdfs', short: 'shorts', ebook: 'ebooks', question: 'questions', series: 'testPapers', seriesDetail: 'paperParts', seriesQMap: 'questionMaps', apxSeriesMap: 'apxSeriesMaps', aiTest: 'aiTestPatterns', courses: 'courses', topics: 'topics' };
    const copies = new Map(process.env.COPIES ? parseCsv(fs.readFileSync(process.env.COPIES, 'utf8')).map((c) => [c.copyId, c]) : []);
    return parseCsv(fs.readFileSync(process.env.KINDS, 'utf8')).map((r) => {
      const row = { id: r.id, name: r.name, status: r.status, customer: r.customer_id };
      for (const [k, n] of Object.entries(JSON.parse(r.detail || '{}'))) row[rename[k] || k] = n;
      const c = copies.get(r.id);
      if (c) Object.assign(row, { scores: +c.scoresOnCopy, answers: +c.answersOnCopy, savedQuestions: +c.savedOnCopy, reportedQuestions: +c.reportedOnCopy });
      return row;
    });
  }
  if (kindName === 'topics') {
    const rename = { class: 'classes', placement: 'coursePlacements', apxPlacement: 'apxPlacements', pdf: 'pdfs', short: 'shorts', ebook: 'ebooks', question: 'questions', seriesChapter: 'testPapers', seriesQMap: 'questionMaps', studentLog: 'studentLogs' };
    return parseCsv(fs.readFileSync(process.env.AUDIT, 'utf8')).map((r) => {
      const row = { id: r.id, name: r.name, status: r.status, customer: r.customer_id, sectionId: r.sectionId, sectionName: r.sectionName, subtopics: +r.subtopics || undefined };
      for (const [k, n] of Object.entries(JSON.parse(r.use || '{}'))) row[rename[k] || k] = n;
      return row;
    });
  }
  throw new Error(`${kindName} has no offline source; run on the box`);
}

function table(kind, rows) {
  const byName = new Map();
  for (const r of rows) { const k = norm(r.name); if (!byName.has(k)) byName.set(k, []); byName.get(k).push(r); }
  for (const r of rows) {
    r.total = kind.places.reduce((a, [col]) => a + (r[col] || 0), 0);
    r.copies = byName.get(norm(r.name)).length;
    r.group = r.copies > 1 ? norm(r.name) : '';
  }
  return rows.sort((a, b) => (b.copies > 1) - (a.copies > 1) || norm(a.name).localeCompare(norm(b.name)) || b.total - a.total || a.id.localeCompare(b.id));
}

// Readable view: every same-name group where at least two copies are referenced somewhere, then the busiest singles.
function markdown(kindName, kind, rows, csvPath) {
  const cols = [...kind.parents.map(([f]) => `${f}Name`), ...kind.places.map((p) => p[0]).filter((c) => rows.some((r) => r[c])), ...kind.derived.map((d) => d[0])];
  const head = `| id | name | cust | on | ${cols.join(' | ')} | total |\n|---|---|---|---|${cols.map(() => '---:').join('|')}|---:|\n`;
  const line = (r) => `| ${r.id} | ${S(r.name).trim()} | ${r.customer} | ${r.status == 1 ? 'yes' : 'no'} | ${cols.map((c) => (r[c] ? r[c] : '')).join(' | ')} | ${r.total} |\n`;
  const groups = [...new Set(rows.filter((r) => r.group).map((r) => r.group))].map((g) => rows.filter((r) => r.group === g));
  const live = groups.filter((m) => m.filter((r) => r.total).length >= 2);
  const singles = rows.filter((r) => !r.group);
  let md = `# ${kindName}: usage by place (${new Date().toISOString().slice(0, 10)})\n\nSource: \`${csvPath}\`, one row per ${kindName.slice(0, -1)} (${rows.length} in all), every place that stores its id as a column. Blank = 0. Same-name copies share a \`group\`.\n\n`;
  md += `## Same-name groups with two or more referenced copies (${live.length} of ${groups.length} groups)\n\nGroups where only one copy is referenced, or none, are in the CSV but skipped here.\n\n`;
  for (const m of live) md += `### ${S(m[0].name).trim()} (${m.length} copies)\n\n${head}${m.map(line).join('')}\n`;
  md += `## Single-name ${kindName} (${singles.length})\n\n${singles.filter((r) => r.total).length} are referenced somewhere, ${singles.filter((r) => !r.total).length} by nothing. The 30 busiest:\n\n${head}${singles.slice().sort((a, b) => b.total - a.total).slice(0, 30).map(line).join('')}`;
  return md;
}

async function main() {
  const kindName = process.env.KIND || 'sections';
  const kind = KINDS[kindName];
  if (!kind) throw new Error(`KIND must be one of ${Object.keys(KINDS).join(', ')}`);
  const offline = process.env.KINDS || process.env.AUDIT;
  const rows = table(kind, offline ? fromCsvs(kindName) : await fromMongo(kind, process.env.MONGO_URI));
  const columns = columnsOf(kind);
  const out = process.env.OUT || `${kindName}_usage.csv`;
  fs.writeFileSync(out, [columns.join(','), ...rows.map((r) => columns.map((c) => csv(r[c])).join(','))].join('\n') + '\n');
  const groups = new Set(rows.filter((r) => r.group).map((r) => r.group));
  if (process.env.MD) fs.writeFileSync(process.env.MD, markdown(kindName, kind, rows, out));
  console.log(`${kindName}=${rows.length} duplicateNames=${groups.size} copiesInGroups=${rows.filter((r) => r.group).length} unreferenced=${rows.filter((r) => r.total === 0).length} -> ${out}`);
  return rows;
}

module.exports = { KINDS, columnsOf, table, fromCsvs, main };
if (require.main === module) {
  if (!process.env.KINDS && !process.env.AUDIT) require('dotenv').config({ path: process.env.DOTENV_CONFIG_PATH || '.env.development' });
  main().catch((e) => { console.error(e); process.exit(1); });
}
