// Read-only: AppX saved questions for up to MAX (default 30) cached VG tokens; no OTP, no DB writes.
// Prints aggregates, field names and value types only; never tokens, ids of learners, or question text.
// LOCAL_ONLY=1 stops before reading any token and calls nothing on AppX; runs from webserver2-2. AppX reads need GCP (test-uday).
'use strict';
const {MongoClient} = require('mongoose').mongo;
const uri = process.env.MONGO_URI;
if (!/^mongodb(?:\+srv)?:\/\/[^/]+\/vidyagramdb(?:\?|$)/.test(uri || '')) throw Error('VG URI required');
const MAX = Math.min(Number(process.env.MAX || 30), 60);
const MAX_PAGES = 40;
const BASE = 'https://armathsapi.akamai.net.in';
const ROUTES = {test: '/Test_Series/getSavedQuestions', quiz: '/Quiz/getSavedQuestions'};
const client = new MongoClient(uri, {maxPoolSize: 2, minPoolSize: 0, serverSelectionTimeoutMS: 15000, readPreference: 'secondaryPreferred'});
const log = (event, o) => console.log(JSON.stringify({event, ...o}));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const shape = o => Object.fromEntries(Object.entries(o || {}).map(([k, v]) => [k, Array.isArray(v) ? `array(${v.length})` : v === null ? 'null' : typeof v]));
const normalize = s => String(s || '').replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();

async function count(db, name, filter = {}) {
  try { return await db.collection(name).countDocuments(filter, {maxTimeMS: 45000}); } catch (e) { return `error:${e.codeName || e.name}`; }
}

async function main() {
  await client.connect();
  const db = client.db('vidyagramdb');
  log('local-counts', {
    savedquestions: await count(db, 'savedquestions'),
    tokens: await count(db, 'apxtestusertokens', {orgId: '2177599'}),
    questions: await count(db, 'questions'),
    questionsWithApxId: await count(db, 'questions', {hranker_id: /^CM-/}),
    apxQuestionRaw: await db.collection('apx_question_raw').estimatedDocumentCount(),
  });
  const rawSample = await db.collection('apx_question_raw').findOne({}, {projection: {raw: 0}});
  log('apx-question-raw-shape', {shape: shape(rawSample)});
  const localQuestion = await db.collection('questions').findOne({hranker_id: /^CM-/}, {projection: {question: 0, options: 0, solution: 0}});
  log('question-shape', {shape: shape(localQuestion)});
  log('native-saved', {userQuestionAnswersSaved: await count(db, 'userquestionanswers', {is_saved: 1})});
  const attempt = await db.collection('usertestdatas').findOne({allsaveData: {$exists: true, $nin: ['', null, []]}}, {projection: {allsaveData: 1}, maxTimeMS: 45000}).catch(e => ({error: e.codeName || e.name}));
  log('attempt-saved-data', {found: !!attempt && !attempt.error, error: attempt?.error || null, type: Array.isArray(attempt?.allsaveData) ? `array(${attempt.allsaveData.length})` : typeof attempt?.allsaveData});
  if (process.env.LOCAL_ONLY === '1') return;

  const tokens = await db.collection('apxtestusertokens').find({orgId: '2177599'}, {projection: {apxUserId: 1, token: 1}}).sort({_id: -1}).limit(MAX).toArray();
  const totals = {learners: 0, http: {}, api: {}, test: {withRows: 0, rows: 0, pageSizes: {}, perLearner: []}, quiz: {withRows: 0, rows: 0, pageSizes: {}, perLearner: []}, pageCapHit: 0};
  const rows = {test: [], quiz: []};
  let denied = 0;
  const html = await fetch('https://vidyagram.online/saved-question?type=question', {signal: AbortSignal.timeout(20000), headers: {'User-Agent': 'Mozilla/5.0'}}).then(r => r.text()).catch(() => '');
  const buildId = (html.match(/"buildId":"([^"]+)"/) || [])[1];
  const sectionCheck = {buildIdFound: !!buildId, http: {}, pagePropKeys: null, learnersWithSections: 0, learnersCompared: 0, learnersWhereCountsAgree: 0, countedInSections: 0, walkedRows: 0};
  outer: for (const t of tokens) {
    totals.learners++;
    let walkedTest = 0;
    for (const [kind, path] of Object.entries(ROUTES)) {
      const seen = new Set();
      for (let page = 0; page < MAX_PAGES; page++) {
        const u = new URL(BASE + path); u.searchParams.set('start', String(seen.size));
        let r, b;
        try {
          r = await fetch(u, {redirect: 'manual', signal: AbortSignal.timeout(20000), headers: {Accept: '*/*', 'Auth-Key': 'appxapi', 'Client-Service': 'Appx', Authorization: t.token, 'User-ID': String(t.apxUserId), Origin: 'https://vidyagram.online', Referer: 'https://vidyagram.online/', 'User-Agent': 'Mozilla/5.0'}});
          b = await r.json().catch(() => null);
        } catch (e) { totals.http[e.name] = (totals.http[e.name] || 0) + 1; break; }
        totals.http[r.status] = (totals.http[r.status] || 0) + 1;
        totals.api[b?.status] = (totals.api[b?.status] || 0) + 1;
        if (r.status === 401 || r.status === 403) denied++;
        if (r.status === 429 || denied >= 3) { log('stopped', {http: r.status, denied}); break outer; }
        await sleep(1000);
        const list = Array.isArray(b?.data) ? b.data : [];
        totals[kind].pageSizes[list.length] = (totals[kind].pageSizes[list.length] || 0) + 1;
        const fresh = list.filter(x => !seen.has(x.id));
        if (!fresh.length) break;
        fresh.forEach(x => seen.add(x.id));
        rows[kind].push(...fresh);
        if (page === MAX_PAGES - 1) totals.pageCapHit++;
      }
      if (seen.size) { totals[kind].withRows++; totals[kind].rows += seen.size; }
      totals[kind].perLearner.push(seen.size);
      if (kind === 'test') walkedTest = seen.size;
    }
    if (buildId) {
      const r = await fetch(`https://vidyagram.online/_next/data/${buildId}/saved-question.json?type=question`, {redirect: 'manual', signal: AbortSignal.timeout(20000), headers: {Accept: '*/*', 'x-nextjs-data': '1', 'User-Agent': 'Mozilla/5.0', Cookie: `base_url=${encodeURIComponent(BASE + '/')}; Authorization=${t.token}; User-ID=${t.apxUserId}`}}).catch(e => ({status: e.name}));
      sectionCheck.http[r.status] = (sectionCheck.http[r.status] || 0) + 1;
      const pp = r.json ? (await r.json().catch(() => null))?.pageProps : null;
      if (pp) {
        sectionCheck.pagePropKeys = sectionCheck.pagePropKeys || Object.keys(pp);
        const sections = Object.values(pp).find(v => Array.isArray(v) && v.some(s => s && s.question_count !== undefined));
        if (sections) {
          const counted = sections.reduce((n, s) => n + Number(s.question_count || 0), 0);
          if (sections.length) sectionCheck.learnersWithSections++;
          sectionCheck.learnersCompared++;
          sectionCheck.countedInSections += counted;
          sectionCheck.walkedRows += walkedTest;
          if (counted === walkedTest) sectionCheck.learnersWhereCountsAgree++;
        }
      }
      await sleep(1000);
    }
  }
  for (const kind of ['test', 'quiz']) totals[kind].perLearner = totals[kind].perLearner.sort((a, b) => a - b).join(',');
  log('source-totals', totals);
  log('section-count-check', sectionCheck);
  for (const kind of Object.keys(rows)) if (rows[kind].length) log('row-shape', {kind, topLevel: shape(rows[kind][0])});

  const sample = rows.test.slice(0, 1000);
  const ids = [...new Set(sample.map(r => String(r.id)))];
  const nums = ids.map(Number).filter(Number.isFinite);
  const byApxId = await db.collection('questions').find({hranker_id: {$in: ids.map(id => `CM-${id}`)}}, {projection: {hranker_id: 1, question: 1}}).toArray();
  const rawById = await db.collection('apx_question_raw').find({$or: [{apxId: {$in: ids}}, {apxId: {$in: nums}}]}, {projection: {apxId: 1}}).toArray();
  let textAgree = 0, textCompared = 0;
  const textMismatchLengths = [];
  const local = new Map(byApxId.map(q => [String(q.hranker_id).slice(3), q]));
  for (const r of sample) {
    const q = local.get(String(r.id));
    if (!q) continue;
    textCompared++;
    const source = normalize(r.question || r.question_en);
    const ours = Object.values(q.question || {}).map(normalize);
    if (source && ours.includes(source)) textAgree++;
    else textMismatchLengths.push({source: source.length, ours: ours.map(x => x.length)});
  }
  log('question-mapping', {sampleRows: sample.length, distinctIds: ids.length, foundByHrankerId: local.size, foundInApxQuestionRaw: new Set(rawById.map(x => String(x.apxId))).size, textCompared, textAgree, textMismatchLengths});

  const missing = [...new Map(sample.filter(r => !local.has(String(r.id))).map(r => [String(r.id), r])).values()];
  const testIds = [...new Set(missing.map(r => String(r.test_id)))], packageIds = [...new Set(missing.map(r => String(r.test_series_id)))];
  const knownTests = await db.collection('apx_testseries_raw').find({apxId: {$in: testIds}}, {projection: {apxId: 1, questionsSyncedAt: 1, questionsFetchError: 1}}).toArray();
  const knownPackages = await db.collection('apx_package_raw').find({apxId: {$in: packageIds}}, {projection: {apxId: 1}}).toArray();
  const knownTestIds = new Set(knownTests.map(x => String(x.apxId))), knownPackageIds = new Set(knownPackages.map(x => String(x.apxId)));
  const sameText = await db.collection('apx_question_raw').find({question: {$in: missing.map(r => r.question).filter(Boolean)}}, {projection: {question: 1}, maxTimeMS: 60000}).toArray().catch(e => ({error: e.codeName || e.name}));
  const sameTextSet = new Set(Array.isArray(sameText) ? sameText.map(x => x.question) : []);
  log('unmatched-questions', {
    distinctQuestions: missing.length,
    distinctTests: testIds.length,
    testKnownInMirror: missing.filter(r => knownTestIds.has(String(r.test_id))).length,
    testKnownAndFullySynced: knownTests.filter(x => x.questionsSyncedAt && !x.questionsFetchError).length,
    packageKnownInMirror: missing.filter(r => knownPackageIds.has(String(r.test_series_id))).length,
    sameExactTextUnderOtherId: sameText.error ? `error:${sameText.error}` : missing.filter(r => sameTextSet.has(r.question)).length,
    withQuestionText: missing.filter(r => r.question).length,
    withOptions: missing.filter(r => r.option_1 || r.option_image_1).length,
    withAnswer: missing.filter(r => r.answer).length,
    questionTypes: missing.reduce((o, r) => (o[r.question_type] = (o[r.question_type] || 0) + 1, o), {}),
  });
  const withSeries = sample.filter(r => r.test_series_id || r.testSeriesId).length;
  const withTest = sample.filter(r => r.test_id || r.testId).length;
  log('placement-fields', {withSeries, withTest});
}
main().catch(e => { console.error(JSON.stringify({event: 'probe-failed', name: e.name, code: e.code || null})); process.exitCode = 1; }).finally(() => client.close());
