// READ-ONLY: tag every section as class / test / both / empty from what references it.
require('dotenv').config({ path: process.env.DOTENV_CONFIG_PATH || '.env.development' });
const mongoose = require('mongoose');
const fs = require('fs');

const CLASS_SIDE = [
  ['classes', 'section', 'class'],
  ['courseclasses', 'section', 'placement'],
  ['courseclasses', 'apxDisplayPlacements.section', 'apxPlacement', true],
  ['pdfs', 'section', 'pdf'],
  ['shorts', 'section', 'short'],
  ['ebooks', 'section', 'ebook'],
];
const TEST_SIDE = [
  ['questions', 'sectionId', 'question'],
  ['series', 'sectionId', 'series'],
  ['series', 'section_details.section_id', 'seriesDetail', true],
  ['seriesquestionmaps', 'section_id', 'seriesQMap'],
  ['apxseriessectionmaps', 'localSectionId', 'apxSeriesMap'],
  ['aitestpatterns', 'sections.section_id', 'aiTest', true],
];
const STRAY_RATIO = 0.02;

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const counts = new Map();
  const add = (id, key, n) => {
    if (!id) return;
    const k = String(id);
    const o = counts.get(k) || {};
    o[key] = (o[key] || 0) + n;
    counts.set(k, o);
  };
  const tally = async ([coll, field, key, isArray]) => {
    const unwind = isArray ? [{ $unwind: '$' + field.split('.')[0] }] : [];
    const rows = await db.collection(coll).aggregate([
      ...unwind,
      { $match: { [field]: { $ne: null } } },
      { $group: { _id: '$' + field, n: { $sum: 1 } } },
    ]).toArray();
    for (const r of rows) add(r._id, key, r.n);
  };
  for (const src of [...CLASS_SIDE, ...TEST_SIDE]) {
    try { await tally(src); } catch (e) { console.error('skip', src[0], src[1], e.message); }
  }
  const courses = await db.collection('courseclasses').aggregate([
    { $match: { section: { $ne: null } } },
    { $group: { _id: '$section', c: { $addToSet: '$course' } } },
  ]).toArray();
  for (const r of courses) add(r._id, 'courses', r.c.length);
  const topics = await db.collection('topics').aggregate([{ $group: { _id: '$section', n: { $sum: 1 } } }]).toArray();
  for (const r of topics) add(r._id, 'topics', r.n);

  const sum = (o, side) => side.reduce((a, [, , key]) => a + (o[key] || 0), 0);
  const kindOf = (c, t) => {
    if (!c && !t) return 'empty';
    if (!t) return 'class';
    if (!c) return 'test';
    if (t / c < STRAY_RATIO) return 'class (stray tests)';
    if (c / t < STRAY_RATIO) return 'test (stray classes)';
    return 'both';
  };
  const norm = (s) => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();
  const sections = await db.collection('sections').find({}, { projection: { sectionName: 1, status: 1, customer_id: 1, legacy_id: 1, createdAt: 1 } }).toArray();
  const nameCount = new Map();
  for (const s of sections) nameCount.set(norm(s.sectionName), (nameCount.get(norm(s.sectionName)) || 0) + 1);

  const rows = sections.map((s) => {
    const o = counts.get(String(s._id)) || {};
    const classSide = sum(o, CLASS_SIDE);
    const testSide = sum(o, TEST_SIDE);
    return {
      id: String(s._id), name: s.sectionName, status: s.status, customer_id: s.customer_id, legacy_id: s.legacy_id,
      created: s.createdAt ? s.createdAt.toISOString().slice(0, 10) : '', sameNameCount: nameCount.get(norm(s.sectionName)),
      kind: kindOf(classSide, testSide), classSide, testSide, courses: o.courses || 0, topics: o.topics || 0, detail: o,
    };
  }).sort((a, b) => a.kind.localeCompare(b.kind) || norm(a.name).localeCompare(norm(b.name)));

  const tally2 = {};
  for (const r of rows) {
    const k = `${r.kind}${r.status === 1 ? '' : ' (inactive)'}`;
    tally2[k] = (tally2[k] || 0) + 1;
  }
  console.log(JSON.stringify(tally2, null, 1));

  const out = process.env.OUT || 'section_kinds';
  fs.writeFileSync(out + '.json', JSON.stringify(rows, null, 1));
  const csv = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const head = ['kind', 'name', 'id', 'status', 'customer_id', 'legacy_id', 'created', 'sameNameCount', 'classSide', 'testSide', 'courses', 'topics', 'detail'];
  fs.writeFileSync(out + '.csv', [head.join(','), ...rows.map((r) => head.map((h) => csv(h === 'detail' ? JSON.stringify(r.detail) : r[h])).join(','))].join('\n'));
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
