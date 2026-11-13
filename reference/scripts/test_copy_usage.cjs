// READ-ONLY. For every section copy in the 25 merge groups (ids from reconcile_dry_run.json), lists each
// test paper that points at it and how, plus the student history on that copy.
// Writes <OUT>_tests.csv (one row per test paper x copy x how it points) and <OUT>_copies.csv (one row per copy).
// Env: DRY=<path to reconcile_dry_run.json> OUT=<output basename>
require('dotenv').config({ path: process.env.DOTENV_CONFIG_PATH || '.env.development' });
const mongoose = require('mongoose');
const fs = require('fs');

const { ObjectId } = mongoose.Types;
const S = (v) => (v == null ? '' : String(v));
const csv = (v) => { const s = S(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');

(async () => {
  const dry = JSON.parse(fs.readFileSync(process.env.DRY || 'reconcile_dry_run.json', 'utf8'));
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;

  const copies = dry.groups.flatMap((g) => [g.keptId, ...g.losers].map((id) => ({ id, group: g.group, role: id === g.keptId ? 'keep (current plan)' : 'merge away' })));
  const copyById = new Map(copies.map((c) => [c.id, c]));
  const oids = copies.map((c) => new ObjectId(c.id));
  const asIdOrText = [...oids, ...copies.map((c) => c.id)];
  const secs = await db.collection('sections').find({ _id: { $in: oids } }, { projection: { sectionName: 1, customer_id: 1 } }).toArray();
  for (const s of secs) Object.assign(copyById.get(S(s._id)), { name: s.sectionName, customer_id: s.customer_id });

  // [seriesId, copyId, how]
  const links = [];
  const series = await db.collection('series').find(
    { $or: [{ sectionId: { $in: oids } }, { 'section_details.section_id': { $in: oids } }, { 'section_cutoff_details.section_id': { $in: oids } }] },
    { projection: { sectionId: 1, 'section_details.section_id': 1, 'section_cutoff_details.section_id': 1 } },
  ).toArray();
  for (const s of series) {
    if (copyById.has(S(s.sectionId))) links.push([S(s._id), S(s.sectionId), 'paper subject']);
    for (const d of s.section_details || []) if (copyById.has(S(d.section_id))) links.push([S(s._id), S(d.section_id), 'paper part']);
    for (const d of s.section_cutoff_details || []) if (copyById.has(S(d.section_id))) links.push([S(s._id), S(d.section_id), 'part cutoff']);
  }
  const qmaps = await db.collection('seriesquestionmaps').aggregate([
    { $match: { section_id: { $in: oids } } },
    { $group: { _id: { series: '$series_id', sec: '$section_id' }, n: { $sum: 1 } } },
  ]).toArray();
  for (const q of qmaps) links.push([S(q._id.series), S(q._id.sec), `question map x${q.n}`]);

  const seriesIds = [...new Set(links.map((l) => l[0]))].map((id) => new ObjectId(id));
  const info = new Map((await db.collection('series').find({ _id: { $in: seriesIds } }, { projection: { series_name: 1, main_tab: 1, status: 1, customer_id: 1, createdAt: 1, legacy_id: 1 } }).toArray()).map((s) => [S(s._id), s]));
  const attempts = new Map((await db.collection('scores').aggregate([
    { $match: { seriesId: { $in: seriesIds } } },
    { $group: { _id: '$seriesId', n: { $sum: 1 } } },
  ]).toArray()).map((r) => [S(r._id), r.n]));

  // Student history per copy.
  const perCopy = async (coll, field, unwind) => new Map((await db.collection(coll).aggregate([
    ...(unwind ? [{ $match: { [field]: { $in: asIdOrText } } }, { $unwind: `$${field.split('.')[0]}` }] : []),
    { $match: { [field]: { $in: asIdOrText } } },
    { $group: { _id: { $toString: `$${field}` }, n: { $sum: 1 } } },
  ], { allowDiskUse: true }).toArray()).map((r) => [r._id, r.n]));
  const history = {
    scores: await perCopy('scores', 'sectional_data.section_id', true),
    answers: await perCopy('userquestionanswers', 'sec_id', false),
    saved: await perCopy('savedquestions', 'sectionId', false),
    reported: await perCopy('reportquestions', 'sectionId', false),
  };
  const apx = await perCopy('apxseriessectionmaps', 'localSectionId', false);
  const ai = await perCopy('aitestpatterns', 'sections.section_id', true);

  const out = process.env.OUT || 'test_copy_usage';
  const head = ['group', 'copyId', 'copyName', 'customer_id', 'role', 'how', 'seriesId', 'seriesName', 'mainTab', 'seriesStatus', 'seriesCustomer', 'seriesCreated', 'apxLegacyId', 'studentAttempts'];
  const rows = links.map(([sid, cid, how]) => {
    const c = copyById.get(cid); const s = info.get(sid) || {};
    return [c.group, cid, c.name, c.customer_id, c.role, how, sid, s.series_name, s.main_tab, s.status, s.customer_id, day(s.createdAt), s.legacy_id, attempts.get(sid) || 0];
  }).sort((a, b) => S(a[0]).localeCompare(S(b[0])) || S(a[1]).localeCompare(S(b[1])) || S(a[7]).localeCompare(S(b[7])));
  fs.writeFileSync(`${out}_tests.csv`, [head.join(','), ...rows.map((r) => r.map(csv).join(','))].join('\n'));

  const chead = ['group', 'copyId', 'copyName', 'customer_id', 'role', 'testPapers', 'studentAttemptsOnThosePapers', 'scoresOnCopy', 'answersOnCopy', 'savedOnCopy', 'reportedOnCopy', 'apxSeriesMaps', 'aiTestPatterns'];
  const crows = copies.map((c) => {
    const papers = new Set(links.filter((l) => l[1] === c.id).map((l) => l[0]));
    const att = [...papers].reduce((n, sid) => n + (attempts.get(sid) || 0), 0);
    return [c.group, c.id, c.name, c.customer_id, c.role, papers.size, att, history.scores.get(c.id) || 0, history.answers.get(c.id) || 0, history.saved.get(c.id) || 0, history.reported.get(c.id) || 0, apx.get(c.id) || 0, ai.get(c.id) || 0];
  });
  fs.writeFileSync(`${out}_copies.csv`, [chead.join(','), ...crows.map((r) => r.map(csv).join(','))].join('\n'));

  console.log(`copies=${copies.length} testPapers=${seriesIds.length} rows=${rows.length}`);
  for (const r of crows) if (r[5] || r[8] || r[7]) console.log(`${S(r[0]).padEnd(32)} ${r[1]} ${S(r[2]).padEnd(24)} ${S(r[4]).padEnd(19)} papers=${r[5]} attempts=${r[6]} scores=${r[7]} answers=${r[8]} saved=${r[9]}`);
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
