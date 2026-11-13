// Read-only: the dependency chain behind the toppers editorial journals' linked tests, before copying them to Vidyagram.
// journals -> seriesIds -> series -> seriesquestionmaps / testsectionquestionmaps -> questions -> taxonomy ids.
// For every id kind: how many, found in adminPanelDB, already present in vidyagramdb (same _id), and for taxonomy
// how many names match a Vidyagram row. Counts and names only. Run on webserver2-2 from the Vidyagram checkout:
//   URI=$(grep -E '^MONGO_URI=' .env.development | cut -d= -f2- | tr -d '"') nice -n 10 node - < script
const mongoose = require('mongoose');
const { ObjectId } = mongoose.Types;

const uniq = (arr) => [...new Set(arr.filter(Boolean).map(String))].filter((x) => ObjectId.isValid(x)).map((x) => new ObjectId(x));
const count = (db, col, ids) => (ids.length ? db.collection(col).countDocuments({ _id: { $in: ids } }) : 0);

(async () => {
  const conn = await mongoose.createConnection(process.env.URI, { readPreference: 'secondaryPreferred' }).asPromise();
  const tw = conn.useDb('adminPanelDB', { useCache: true }).db;
  const vg = conn.useDb('vidyagramdb', { useCache: true }).db;

  const journals = await tw.collection('editorialjournals').find({}, { projection: { seriesIds: 1, 'seriesAssignments.seriesId': 1, isActive: 1 } }).toArray();
  const seriesIds = uniq(journals.flatMap((j) => [...(j.seriesIds || []), ...((j.seriesAssignments || []).map((a) => a.seriesId))]));
  const series = await tw.collection('series').find({ _id: { $in: seriesIds } }).toArray();
  const out = { journals: journals.length, journalsWithTests: journals.filter((j) => (j.seriesIds || []).length).length, seriesLinked: seriesIds.length, seriesFound: series.length };
  out.seriesAlreadyInVg = await count(vg, 'series', seriesIds);
  const bucket = (f) => series.reduce((m, s) => { const k = String(f(s)); m[k] = (m[k] || 0) + 1; return m; }, {});
  out.seriesBy = { customer_id: bucket((s) => s.customer_id), status: bucket((s) => s.status), is_free: bucket((s) => s.is_free), main_tab: bucket((s) => s.main_tab), type: bucket((s) => s.type) };
  out.seriesTotalQuestionsField = series.reduce((n, s) => n + (Number(s.totalquestion) || 0), 0);

  const sqm = await tw.collection('seriesquestionmaps').find({ series_id: { $in: seriesIds } }).toArray();
  const tsqm = await tw.collection('testsectionquestionmaps').find({ seriesId: { $in: seriesIds } }, { projection: { seriesId: 1 } }).toArray();
  const questionIds = uniq(sqm.flatMap((m) => m.question_ids || []));
  out.maps = { seriesquestionmaps: sqm.length, seriesWithMap: uniq(sqm.map((m) => m.series_id)).length, testsectionquestionmaps: tsqm.length };
  out.maps.sqmAlreadyInVg = await count(vg, 'seriesquestionmaps', uniq(sqm.map((m) => m._id)));
  out.maps.tsqmAlreadyInVg = await count(vg, 'testsectionquestionmaps', uniq(tsqm.map((m) => m._id)));
  const questions = await tw.collection('questions').find({ _id: { $in: questionIds } }, { projection: { sectionId: 1, mainCategory: 1, category: 1, topicId: 1, subTopicId: 1, customer_id: 1, questionImage: 1 } }).toArray();
  out.questions = { linked: questionIds.length, found: questions.length, alreadyInVg: await count(vg, 'questions', questionIds), byCustomer: questions.reduce((m, q) => { m[q.customer_id] = (m[q.customer_id] || 0) + 1; return m; }, {}) };

  const tax = {
    sections: { col: 'sections', ids: uniq([...series.flatMap((s) => [s.sectionId, ...(s.section_details || []).map((d) => d.section_id), ...(s.section_cutoff_details || []).map((d) => d.section_id)]), ...sqm.map((m) => m.section_id), ...questions.map((q) => q.sectionId)]) },
    maincategories: { col: 'maincategories', ids: uniq([...series.map((s) => s.mainCategory), ...sqm.map((m) => m.main_category_id), ...questions.map((q) => q.mainCategory)]) },
    categories: { col: 'categories', ids: uniq([...series.map((s) => s.category), ...sqm.map((m) => m.category_id), ...questions.map((q) => q.category)]) },
    topics: { col: 'topics', ids: uniq([...series.flatMap((s) => [...(s.chapterIds || []), s.chapterId]), ...sqm.flatMap((m) => m.topic_ids || []), ...questions.map((q) => q.topicId)]) },
    subtopics: { col: 'subtopics', ids: uniq([...sqm.flatMap((m) => m.sub_topic_ids || []), ...questions.map((q) => q.subTopicId)]) },
  };
  out.taxonomy = {};
  for (const [k, { col, ids }] of Object.entries(tax)) {
    const rows = ids.length ? await tw.collection(col).find({ _id: { $in: ids } }, { projection: { name: 1, title: 1, section_name: 1, main_category_name: 1, category_name: 1, topic_name: 1 } }).toArray() : [];
    const names = rows.map((r) => r.name || r.title || r.section_name || r.main_category_name || r.category_name || r.topic_name).filter(Boolean);
    const vgByName = names.length ? await vg.collection(col).countDocuments({ $or: [{ name: { $in: names } }, { title: { $in: names } }, { section_name: { $in: names } }] }) : 0;
    out.taxonomy[k] = { ids: ids.length, foundInToppers: rows.length, sameIdInVg: await count(vg, col, ids), namesMatchInVg: vgByName, sample: names.slice(0, 10) };
  }
  // Which other collections point at these series (purchase/package links)?
  for (const [col, field] of [['packageseries', 'series_id'], ['packageseries', 'seriesId'], ['packages', 'series'], ['practicebatchtests', 'seriesId']]) {
    const n = await tw.collection(col).countDocuments({ [field]: { $in: seriesIds } }).catch(() => -1);
    if (n > 0) out[`${col}.${field}`] = n;
  }
  console.log(JSON.stringify(out, null, 1));
  await conn.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
