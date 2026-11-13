// Read-only, refuses any DB but vidyagramdb. Launch match: AppX vs Vidyagram, one row per thing, for six deliverables:
//   courses (active / inactive, price, validity), classes, PDFs on classes, tests on classes, ebooks, tests.
// AppX side = the live CMS course list + each course's last done capture (the planner's view) + the apx_*_raw mirrors.
// Writes OUT (default ~/vidyagram-appx-launch-match-<date>.json, mode 600); build the CSVs on the Mac with
// vidyagram-appx-launch-match-csv.py. No AppX writes, no DB writes, no links or secrets in the output.
// Run from the nightly checkout on test-uday:
//   cd <nightly checkout> && nice -n 10 node --max-old-space-size=3072 - < vidyagram-appx-launch-match.cjs
require('dotenv').config({ path: '.env.development', quiet: true });
require('ts-node/register/transpile-only');
const fs = require('fs');
const mongoose = require('mongoose');
const root = process.cwd() + '/src/services/apx/';
const { createHttpCatalogSource } = require(root + 'apxCatalogHttpSource');
const { loadMirrorCourses } = require(root + 'apxCatalogMirrorReader');
const { planCatalogue } = require(root + 'apxCatalogPlanner');
const { runView } = require(root + 'apxCatalogCapture');

const CUSTOMER = '781';
const TODAY = new Date().toISOString().slice(0, 10);
const OUT = process.env.OUT || `${process.env.HOME}/vidyagram-appx-launch-match-${TODAY}.json`;
const LIVE = process.env.LIVE !== '0';
// AppX course folders as the public site names them (vidyagram.online/new-courses, read 2026-11-12).
const FOLDERS = { 58: 'Paid Courses', 62: 'Free Courses', 57: 'Exam Pattern and Syllabus', 143: 'Live Test', ...JSON.parse(process.env.FOLDER_NAMES || '{}') };
const UNIT_LABEL = { DAYS: 'Days', MONTHS: 'Months', YEARS: 'Years' };

const key = (s) => String(s ?? '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ').trim();
const str = (v) => (v === null || v === undefined ? '' : String(v).trim());
const num = (v) => { const n = Number(v); return v === '' || v === null || v === undefined || !Number.isFinite(n) ? null : n; };
const idList = (v) => (Array.isArray(v) ? v.map(str) : str(v).split(',').map((s) => s.trim())).filter((s) => s && s !== '-1' && s !== '0');
const realId = (v) => { const s = str(v); return s && s !== '-1' && s !== '0' ? s : ''; };
const bump = (m, k, n = 1) => { m[k] = (m[k] || 0) + n; return m; };
const priceWord = (p) => (p === null ? 'no price' : p === -1 ? 'not for sale (-1)' : p === -3 ? 'free / special (-3)' : p === -10 ? 'free (-10)' : p === 0 ? 'free (0)' : `₹${p}`);

const report = { generatedAt: new Date().toISOString(), live: LIVE, sheets: {}, totals: {} };

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: 'vidyagramdb', readPreference: 'secondaryPreferred', autoIndex: false, autoCreate: false });
  try {
    const db = mongoose.connection.db;
    if (db.databaseName !== 'vidyagramdb') throw new Error('wrong db');
    const all = (name, filter = {}, projection = {}) => db.collection(name).find(filter, { projection }).toArray();

    // ---------- AppX courses ----------
    const mirrorDocs = await all('apxcatalogcourses', { customerId: CUSTOMER }, { apxCourseId: 1, listRow: 1, detail: 1, 'capture.runId': 1, 'capture.status': 1 });
    const mirrorById = new Map(mirrorDocs.map((d) => [String(d.apxCourseId), d]));
    let live = [];
    if (LIVE) {
      const source = createHttpCatalogSource({ db, customerId: CUSTOMER, orgId: '2177599', tenantApiBase: 'https://armathsapi.akamai.net.in', gapMs: 1000, studentGapMs: 1000 });
      for (let s = 0; ; s += 100) { const p = await source.courseListPage(s, 100); live.push(...p.rows); if (p.rows.length < 100) break; }
    } else {
      live = mirrorDocs.filter((d) => d.listRow && str(d.detail?.deleted) !== '1').map((d) => ({ ...d.listRow, id: d.apxCourseId }));
    }
    const liveById = new Map(live.map((r) => [String(r.id), r]));
    const { inputs } = await loadMirrorCourses(db, { customerId: CUSTOMER, runId: null, courseIds: [...liveById.keys()] });
    const { plans } = planCatalogue(inputs);
    const planById = new Map(plans.map((p) => [String(p.course.apxCourseId), p]));
    console.log('AppX courses listed', live.length, LIVE ? '(live CMS list)' : '(mirror)', '| with a done capture', plans.length);

    // ---------- our side ----------
    const courses = await all('courses', {}, { apxCourseId: 1, title: 1, status: 1, price: 1, discountPrice: 1, apxPrice: 1, isFree: 1, validity: 1, isCombo: 1, selling: 1, showInBatchFilter: 1, createdAt: 1 });
    const courseByApx = new Map(courses.filter((c) => c.apxCourseId).map((c) => [String(c.apxCourseId), c]));
    const classes = new Map((await all('classes', {}, { status: 1, isYoutubeRedirect: 1, hlsAsset: 1, 'pdfAssignments.pdfId': 1, pdfIds: 1, 'seriesAssignments.seriesId': 1, seriesIds: 1 })).map((c) => [String(c._id), c]));
    const jobs = new Map((await all('apxingestjobs', {}, { classId: 1, status: 1 })).map((j) => [String(j.classId), j]));
    const ledgerRows = await all('apxcatalogimports', { customerId: CUSTOMER }, { assetKey: 1, classId: 1, sourceCourseId: 1, sourceRowId: 1, 'placements.apxCourseId': 1, 'placements.rowId': 1 });
    const ledgerByKey = new Map(ledgerRows.map((l) => [l.assetKey, l]));
    const ledgerByRow = new Map();
    for (const l of ledgerRows) for (const p of [{ apxCourseId: l.sourceCourseId, rowId: l.sourceRowId }, ...(l.placements || [])]) if (p.apxCourseId && p.rowId) ledgerByRow.set(`${p.apxCourseId}|${p.rowId}`, l);
    const ledgerOf = (id, item) => ledgerByKey.get(item.assetKey) || ledgerByRow.get(`${id}|${item.rowId}`);
    const pdfBySource = new Map();
    for (const l of await all('apxcatalogpdfimports', { customerId: CUSTOMER }, { status: 1, pdfId: 1, sources: 1 })) for (const s of l.sources || []) pdfBySource.set(`${s.apxCourseId}|${s.rowId}|${s.field}`, { l, s });
    const placements = new Map(); const placedPerCourse = {}; const activePlacedPerCourse = {};
    for (const p of await all('courseclasses', {}, { course: 1, class: 1, isActive: 1, status: 1 })) { placements.set(`${p.course}:${p.class}`, p); bump(placedPerCourse, String(p.course)); if (p.isActive !== false) bump(activePlacedPerCourse, String(p.course)); }
    const coursePdfs = new Map(); const pdfsPerCourse = {};
    for (const p of await all('coursepdfs', {}, { course: 1, pdf: 1, isActive: 1 })) { coursePdfs.set(`${p.course}:${p.pdf}`, p); if (p.isActive !== false) bump(pdfsPerCourse, String(p.course)); }
    const courseTests = new Map(); const testsPerCourse = {};
    for (const t of await all('coursetests', {}, { course: 1, test: 1, isActive: 1 })) { courseTests.set(`${t.course}:${t.test}`, t); if (t.isActive !== false) bump(testsPerCourse, String(t.course)); }
    const planDocs = await all('plans', {}, { name: 1, title: 1, status: 1, course: 1, amount: 1, duration: 1, courseSale: 1 });
    const planById2 = new Map(planDocs.map((p) => [String(p._id), p]));
    const planBySaleKey = new Map(planDocs.filter((p) => p.courseSale?.key).map((p) => [`${p.courseSale.courseId}|${p.courseSale.key}`, p]));
    // A course sells through Course.selling.options; each option is backed by a plan (id "p<planId>", else courseSale.key "main:<id>").
    const MONTHS = { DAY: 1 / 30, DAYS: 1 / 30, MONTH: 1, MONTHS: 1, YEAR: 12, YEARS: 12 };
    const months = (n, unit) => { const m = MONTHS[str(unit).toUpperCase()]; return num(n) !== null && m ? Math.round(num(n) * m * 10) / 10 : null; };
    const lengthWord = (m) => (m === null ? '?' : m >= 1200 ? 'Lifetime' : m % 12 === 0 ? `${m / 12} Year${m === 12 ? '' : 's'}` : `${m} Months`);
    const offer = (price, m) => `${price > 0 ? '₹' + price : 'Free'} / ${lengthWord(m)}`;
    const ourOffers = (course) => (course?.selling?.options || []).map((o) => {
      const plan = str(o.id).startsWith('p') && planById2.get(str(o.id).slice(1)) || planBySaleKey.get(`${course._id}|main:${o.id}`) || null;
      return { price: num(o.price) || 0, months: months(o.validity?.n, o.validity?.unit), plan };
    });
    const seriesDocs = await all('series', {}, { legacy_id: 1, series_name: 1, main_tab: 1, status: 1, apx_test_status: 1, is_free: 1 });
    const seriesByLegacy = new Map(); for (const s of seriesDocs) if (realId(s.legacy_id)) { const k = str(s.legacy_id); if (!seriesByLegacy.has(k)) seriesByLegacy.set(k, []); seriesByLegacy.get(k).push(s); }
    const attach = new Map(); for (const a of await all('apx_class_tests_attach', {}, { classId: 1, seriesId: 1, from: 1, testId: 1 })) attach.set(`${a.from}|${a.testId}`, a);

    // ---------- AppX tests (mirrors) ----------
    const apxTests = await all('apx_testseries_raw', {}, { apxId: 1, id: 1, title: 1, test_title: 1, packageApxIds: 1, packageApxId: 1, free_flag: 1, flag: 1, status: 1, deleted: 1, is_live_test: 1, questions: 1, questions_added: 1 });
    const testsByPackage = new Map();
    for (const t of apxTests) for (const p of new Set([...idList(t.packageApxIds), ...idList(t.packageApxId)])) { if (!testsByPackage.has(p)) testsByPackage.set(p, []); testsByPackage.get(p).push(t); }
    const apxTestById = new Map(apxTests.map((t) => [str(t.apxId || t.id), t]));

    const ref = (id, course) => ({ apxCourseId: id, appxCourse: str(liveById.get(id)?.title || mirrorById.get(id)?.detail?.title), ourCourse: course ? str(course.title) : '', ourCourseId: course ? String(course._id) : '' });
    const singlePlans = (course) => planDocs.filter((p) => Array.isArray(p.course) && p.course.length === 1 && String(p.course[0]) === String(course._id));
    const anyPlans = (course) => planDocs.filter((p) => p.status === 1 && Array.isArray(p.course) && p.course.some((c) => String(c) === String(course._id)));

    // ---------- 1. Courses: active / inactive, price, validity; plus per-course content counts ----------
    const S1 = (report.sheets.courses = []);
    const gapClasses = (report.sheets.classGaps = []);
    const gapPdfs = (report.sheets.pdfGaps = []);
    const classPdfRows = (report.sheets.classPdfGaps = []);
    const classTestRows = (report.sheets.classTestGaps = []);
    const courseTestRows = (report.sheets.courseTestGaps = []);
    const T = (report.totals = { courses: {}, classes: {}, pdfs: {}, classPdfs: {}, classTests: {}, courseTests: {} });

    for (const [id, row] of liveById) {
      const d = mirrorById.get(id)?.detail || {};
      const course = courseByApx.get(id);
      const plan = planById.get(id);
      const runId = mirrorById.get(id)?.capture?.runId;
      const enable = str(row.enable ?? d.enable);
      const price = num(row.price ?? d.price);
      const mrp = num(d.mrp);
      const folderId = str(d.parent_id);
      const appxActive = enable === '1' && price !== -1 && price !== null;
      // What the public AppX site lists: an enabled course filed in the Paid or Free folder that is on sale.
      const appxPublic = appxActive && (folderId === '58' || folderId === '62') && str(d.view_in_web) !== '0';
      let options = [];
      try { options = typeof d.price_planningData === 'string' ? JSON.parse(d.price_planningData) : d.price_planningData || []; } catch { options = []; }
      const liveOptions = Array.isArray(options) && str(d.enable_pricing_plan) === '1' ? options.filter((o) => str(o.status) !== '0') : [];
      const h = plan?.course;
      const appxValidity = h?.validity ? `${h.validity.value} ${UNIT_LABEL[h.validity.unit]}` : `${str(d.validity)} ${str(d.validity_type)}`.trim();
      const sells = course ? singlePlans(course) : [];
      const onSale = sells.filter((p) => p.status === 1);
      const ourActive = course ? course.status === 1 : null;

      const r = {
        ...ref(id, course),
        appxFolder: folderId === '-1' || !folderId ? '(top level, not in a public folder)' : FOLDERS[folderId] || `folder ${folderId}`,
        appxEnabled: enable === '1' ? 'yes' : 'no', appxPrice: price ?? '', appxPriceMeans: priceWord(price), appxMrp: mrp ?? '',
        appxValidity, appxLengthOptions: liveOptions.map((o) => `${str(o.validity)} ${str(o.validity_type)} ₹${str(o.price)}`).join(' | '),
        appxActive: appxActive ? 'ACTIVE' : 'INACTIVE', appxOnPublicSite: appxPublic ? 'yes' : 'no',
        ourStatus: course ? (ourActive ? 'ACTIVE' : 'INACTIVE') : 'NO COURSE', ourPrice: course?.price ?? '', ourDiscountPrice: course?.discountPrice ?? '', ourIsFree: course ? Boolean(course.isFree) : '',
        ourValidity: course ? str(course.validity) : '', ourPlansOnSale: onSale.map((p) => `₹${p.amount}/${p.duration}d`).join(' | '), ourPlansOffSale: sells.filter((p) => p.status !== 1).length,
        ourBundlePlansOnSale: course ? anyPlans(course).length - onSale.length : '',
        isCombo: idList(d.allotment_id).filter((x) => x !== id).length ? 'combo' : '',
      };
      // status verdict
      r.statusMatch = !course ? (appxActive ? 'MISSING HERE: AppX sells it, no course' : 'ok: AppX inactive, no course here') : appxActive === ourActive ? 'ok' : appxActive ? 'AppX ACTIVE, ours INACTIVE' : 'AppX INACTIVE, ours ACTIVE';
      // price + validity verdict: what AppX sells (each length) against Course.selling.options and the plan behind each
      const sellPrice = price !== null && price > 0 ? price : 0;
      const appxOffers = liveOptions.length ? liveOptions.map((o) => ({ price: num(o.price) || 0, months: months(o.validity, o.validity_type) })) : [{ price: sellPrice, months: months(d.validity, d.validity_type) }];
      const ours = course ? ourOffers(course) : [];
      r.appxSells = appxActive ? appxOffers.map((o) => offer(o.price, o.months)).join(' | ') : '';
      r.ourSells = ours.map((o) => offer(o.price, o.months)).join(' | ');
      r.ourPlanBehindEachOption = ours.map((o) => (o.price <= 0 ? 'free' : !o.plan ? 'NO PLAN' : o.plan.status !== 1 ? 'plan off sale' : num(o.plan.amount) !== o.price ? `plan charges ₹${o.plan.amount}` : 'ok')).join(' | ');
      if (!course) { r.priceMatch = ''; r.validityMatch = ''; } else if (!appxActive) { r.priceMatch = 'n/a (AppX not selling)'; r.validityMatch = 'n/a (AppX not selling)'; } else {
        const pa = appxOffers.map((o) => o.price).sort((x, y) => x - y).join(','); const po = ours.map((o) => o.price).sort((x, y) => x - y).join(',');
        const va = appxOffers.map((o) => o.months).sort((x, y) => x - y).join(','); const vo = ours.map((o) => o.months).sort((x, y) => x - y).join(',');
        const pd = [];
        if (!ours.length) pd.push('course has no selling option');
        else if (pa !== po) pd.push(`AppX ${appxOffers.map((o) => (o.price > 0 ? '₹' + o.price : 'Free')).join(' / ')}, ours ${ours.map((o) => (o.price > 0 ? '₹' + o.price : 'Free')).join(' / ')}`);
        if (sellPrice > 0 && num(course.discountPrice) !== sellPrice && num(course.price) !== sellPrice) pd.push(`card shows ₹${course.discountPrice ?? course.price}`);
        if (sellPrice === 0 && !course.isFree) pd.push('AppX free, ours not marked free');
        const bad = ours.filter((o) => o.price > 0 && (!o.plan || o.plan.status !== 1 || num(o.plan.amount) !== o.price));
        if (bad.length) pd.push(`checkout plan wrong for ${bad.map((o) => offer(o.price, o.months)).join(', ')}`);
        r.priceMatch = pd.length ? pd.join('; ') : 'ok';
        r.validityMatch = !ours.length ? 'course has no selling option' : va === vo ? 'ok' : `AppX ${appxOffers.map((o) => lengthWord(o.months)).join(' / ')}, ours ${ours.map((o) => lengthWord(o.months)).join(' / ')}`;
      }

      // ---- content counts ----
      const c = { appxVideos: 0, classPlaced: 0, classPlayable: 0, appxPdfs: 0, pdfPlaced: 0, appxClassPdfs: 0, classPdfOk: 0, appxClassTests: 0, classTestOk: 0 };
      const videoItems = new Map();
      for (const item of (plan?.items || []).filter((i) => i.active)) {
        const base = { ...ref(id, course), rowId: item.rowId, title: item.apxTitle, path: (item.path || []).join(' > ') };
        if (item.kind === 'PDF') {
          c.appxPdfs += 1;
          const l = pdfBySource.get(`${id}|${item.rowId}|link`)?.l;
          const cp = course && l?.pdfId ? coursePdfs.get(`${course._id}:${l.pdfId}`) : null;
          const outcome = !course ? 'no course here' : !l ? 'not imported' : l.status !== 'done' || !l.pdfId ? `import ${l.status}` : cp ? 'ok' : 'PDF exists, not in this course';
          if (outcome === 'ok') c.pdfPlaced += 1; else gapPdfs.push({ outcome, ...base });
          bump(T.pdfs, outcome);
          continue;
        }
        c.appxVideos += 1; videoItems.set(String(item.rowId), item);
        const l = ledgerOf(id, item);
        const cid = l?.classId ? String(l.classId) : null;
        const cls = cid && classes.get(cid);
        const cc = course && cid ? placements.get(`${course._id}:${cid}`) : null;
        let outcome;
        if (!course) outcome = 'no course here';
        else if (!l || !cid) outcome = item.noUsableLink ? 'AppX row has no usable link' : 'not imported';
        else if (!cls) outcome = 'import points at a missing class';
        else if (!cc) outcome = 'class exists, not in this course';
        else if (cls.isYoutubeRedirect || cls.hlsAsset) outcome = 'ok';
        else if (item.kind === 'VIDEO_MP4') outcome = 'in course, MP4 not copied (no video)';
        else outcome = `in course, no video (ingest ${jobs.get(cid)?.status || 'none'})`;
        if (cc) c.classPlaced += 1;
        if (outcome === 'ok') c.classPlayable += 1; else gapClasses.push({ outcome, ...base, kind: item.kind });
        bump(T.classes, outcome);
      }
      // PDFs and tests attached to class rows, from the course's current tree view
      if (plan && runId) {
        const pages = await db.collection('apxcatalogtree').aggregate([
          { $match: { customerId: CUSTOMER, apxCourseId: id, ...runView(runId) } },
          { $project: { _id: 0, rows: { $map: { input: { $ifNull: ['$rows', []] }, as: 'r', in: {
            id: '$$r.id', mt: '$$r.material_type', title: '$$r.Title', t: '$$r.test_title_id', q: '$$r.quiz_title_id',
            n1: { $gt: [{ $strLenCP: { $toString: { $ifNull: ['$$r.pdf_link', ''] } } }, 0] },
            n2: { $gt: [{ $strLenCP: { $toString: { $ifNull: ['$$r.pdf_link2', ''] } } }, 0] },
          } } } } },
        ]).toArray();
        const seen = new Set(); const courseTestIds = new Map();
        for (const p of pages) for (const row of p.rows) {
          const rid = String(row.id);
          if (row.mt === 'TEST' || row.mt === 'QUIZ') { if (!seen.has('ct' + rid)) { seen.add('ct' + rid); courseTestIds.set(`${row.mt}:${realId(row.mt === 'TEST' ? (realId(row.t) ? row.t : row.q) : row.q)}`, { kind: `content ${row.mt} row`, title: str(row.title), id: realId(row.t) || realId(row.q) }); } continue; }
          const item = videoItems.get(rid);
          if (!item) continue;
          const cid = ledgerOf(id, item)?.classId; const cls = cid && classes.get(String(cid));
          for (const [field, has] of [['pdf_link', row.n1], ['pdf_link2', row.n2]]) {
            if (!has || seen.has(`${rid}|${field}`)) continue;
            seen.add(`${rid}|${field}`); c.appxClassPdfs += 1;
            const hit = pdfBySource.get(`${id}|${item.rowId}|${field}`);
            let outcome;
            if (!course) outcome = 'no course here';
            else if (!hit) outcome = 'PDF not imported';
            else if (!hit.l.pdfId) outcome = `PDF import ${hit.l.status}`;
            else if (!cls) outcome = 'class not imported';
            else if ((cls.pdfAssignments || []).some((a) => String(a.pdfId) === String(hit.l.pdfId)) || (cls.pdfIds || []).some((x) => String(x) === String(hit.l.pdfId))) outcome = 'ok';
            else outcome = 'PDF exists, not on the class';
            if (outcome === 'ok') c.classPdfOk += 1; else classPdfRows.push({ outcome, ...ref(id, course), rowId: item.rowId, slot: field === 'pdf_link' ? 'PDF 1' : 'PDF 2', classTitle: item.apxTitle });
            bump(T.classPdfs, outcome);
          }
          const tid = realId(row.t);
          if (tid && !seen.has(`${rid}|test`)) {
            seen.add(`${rid}|test`); c.appxClassTests += 1;
            const ours = seriesByLegacy.get(tid) || [];
            const onClass = cls && ours.some((s) => (cls.seriesAssignments || []).some((a) => String(a.seriesId) === String(s._id)) || (cls.seriesIds || []).some((x) => String(x) === String(s._id)));
            let outcome;
            if (!course) outcome = 'no course here';
            else if (!cls) outcome = 'class not imported';
            else if (!ours.length) outcome = 'test not in our tests';
            else if (onClass) outcome = 'ok';
            else outcome = 'test exists, not on the class';
            if (outcome === 'ok') c.classTestOk += 1; else classTestRows.push({ outcome, ...ref(id, course), rowId: item.rowId, classTitle: item.apxTitle, appxTestId: tid, appxTest: str(apxTestById.get(tid)?.title) });
            bump(T.classTests, outcome);
          }
        }
        // course-level tests: test packages attached to the course + TEST/QUIZ rows in its content
        for (const pk of idList(d.test_series_id)) for (const t of testsByPackage.get(pk) || []) courseTestIds.set(`TEST:${str(t.apxId || t.id)}`, { kind: `package ${pk}`, title: str(t.title), id: str(t.apxId || t.id) });
        c.appxCourseTests = courseTestIds.size; c.courseTestOk = 0;
        for (const [k, v] of courseTestIds) {
          const ours = k.startsWith('TEST:') ? seriesByLegacy.get(v.id) || [] : [];
          const inCourse = course && ours.some((s) => courseTests.get(`${course._id}:${s._id}`)?.isActive !== false && courseTests.has(`${course._id}:${s._id}`));
          const outcome = !course ? 'no course here' : k.startsWith('QUIZ:') ? 'AppX quiz row (matched by hand)' : !ours.length ? 'test not in our tests' : inCourse ? 'ok' : 'test exists, not in this course';
          if (outcome === 'ok') c.courseTestOk += 1; else courseTestRows.push({ outcome, ...ref(id, course), appxTestId: v.id, appxTest: v.title, from: v.kind });
          bump(T.courseTests, outcome);
        }
      }
      let stats = {}; try { stats = typeof d.content_stats === 'string' ? JSON.parse(d.content_stats) : d.content_stats || {}; } catch { stats = {}; }
      Object.assign(r, {
        appxClasses: c.appxVideos, ourClassesMatched: c.classPlaced, ourClassesPlayable: c.classPlayable, classesMissing: c.appxVideos - c.classPlayable,
        ourClassesInCourseTotal: course ? activePlacedPerCourse[String(course._id)] || 0 : '',
        appxPdfs: c.appxPdfs, ourPdfsMatched: c.pdfPlaced, pdfsMissing: c.appxPdfs - c.pdfPlaced, ourPdfsInCourseTotal: course ? pdfsPerCourse[String(course._id)] || 0 : '',
        appxClassPdfs: c.appxClassPdfs, ourClassPdfs: c.classPdfOk, classPdfsMissing: c.appxClassPdfs - c.classPdfOk,
        appxClassTests: c.appxClassTests, ourClassTests: c.classTestOk, classTestsMissing: c.appxClassTests - c.classTestOk,
        appxCourseTests: c.appxCourseTests ?? '', ourCourseTestsMatched: c.courseTestOk ?? '', ourCourseTestsTotal: course ? testsPerCourse[String(course._id)] || 0 : '',
        appxTestPackages: idList(d.test_series_id).join(','), appxOwnCountVideos: stats.videos_count ?? '', appxOwnCountFiles: stats.files_count ?? '', appxOwnCountTests: stats.tests_count ?? '',
        captured: plan ? runId : 'no done capture',
      });
      S1.push(r);
      bump(T.courses, r.statusMatch);
    }
    // ours only
    for (const c of courses.filter((c) => !c.apxCourseId || !liveById.has(String(c.apxCourseId)))) {
      const sells = singlePlans(c).filter((p) => p.status === 1);
      S1.push({ apxCourseId: str(c.apxCourseId), appxCourse: '', ourCourse: str(c.title), ourCourseId: String(c._id), appxActive: c.apxCourseId ? 'NOT LISTED IN APPX ANY MORE' : 'NOT AN APPX COURSE', appxOnPublicSite: 'no',
        ourStatus: c.status === 1 ? 'ACTIVE' : 'INACTIVE', ourPrice: c.price ?? '', ourDiscountPrice: c.discountPrice ?? '', ourIsFree: Boolean(c.isFree), ourValidity: str(c.validity), ourSells: ourOffers(c).map((o) => offer(o.price, o.months)).join(' | '),
        statusMatch: c.status === 1 ? 'OURS ONLY, ACTIVE (not in AppX)' : 'ours only, inactive', ourClassesInCourseTotal: activePlacedPerCourse[String(c._id)] || 0, ourPdfsInCourseTotal: pdfsPerCourse[String(c._id)] || 0, ourCourseTestsTotal: testsPerCourse[String(c._id)] || 0,
        ourCreated: c.createdAt?.toISOString?.().slice(0, 10) || '' });
      bump(T.courses, c.status === 1 ? 'OURS ONLY, ACTIVE (not in AppX)' : 'ours only, inactive');
    }

    // ---------- 5. Ebooks and books (AppX mirrors vs the library) ----------
    const lib = await all('learnlibraryitems', {}, { type: 1, title: 1, isActive: 1, isFree: 1, price: 1, discountPrice: 1, originalPrice: 1, samplePdfUrl: 1, sourcePdfId: 1, createdAt: 1 });
    const oldEbooks = await all('ebooks', {}, { title: 1, status: 1, isFree: 1, newPrice: 1 });
    const S5 = (report.sheets.ebooks = []); T.ebooks = {};
    const used = new Set();
    const findLib = (title, type) => { const k = key(title); const pool = lib.filter((l) => !used.has(String(l._id))); return pool.find((l) => l.type === type && key(l.title) === k) || pool.find((l) => key(l.title) === k) || pool.find((l) => l.type === type && k.length > 12 && (key(l.title).startsWith(k) || k.startsWith(key(l.title)))); };
    for (const [coll, kind, type] of [['apx_ebooks_raw', 'Paid E-book', 'ebook'], ['apx_free_ebooks_raw', 'Free E-book', 'ebook'], ['apx_books_raw', 'Book (printed)', 'book']]) {
      for (const e of await all(coll, {}, { apxId: 1, row: 1 })) {
        const row = e.row || {};
        const appxOn = coll === 'apx_free_ebooks_raw' ? str(row.status) === '1' : str(row.enable) === '1';
        const deleted = str(row.deleted) === '1';
        const hit = findLib(row.title, type); if (hit) used.add(String(hit._id));
        const outcome = !hit ? (deleted ? 'ok: deleted in AppX, not here' : appxOn ? 'MISSING HERE (AppX shows it)' : 'missing here (AppX has it switched off)') : appxOn === Boolean(hit.isActive) ? 'ok' : appxOn ? 'AppX shows it, ours hidden' : 'AppX switched off, ours shown';
        S5.push({ outcome, kind, appxId: str(e.apxId), appxTitle: str(row.title), appxCategory: str(row.category), appxShown: appxOn ? 'yes' : 'no', appxDeleted: deleted ? 'yes' : '', appxPrice: str(row.price), appxMrp: str(row.mrp), appxValidity: row.validity ? `${str(row.validity)} ${str(row.validity_type)}` : '', appxHasPdf: str(row.pdf_link) ? 'yes' : 'no',
          ourTitle: hit ? str(hit.title) : '', ourType: hit ? hit.type : '', ourShown: hit ? (hit.isActive ? 'yes' : 'no') : '', ourFree: hit ? Boolean(hit.isFree) : '', ourPrice: hit ? hit.discountPrice ?? hit.price ?? '' : '', ourHasPdf: hit ? (hit.sourcePdfId || str(hit.samplePdfUrl) ? 'yes' : 'no') : '' });
        bump(T.ebooks, `${kind}: ${outcome}`);
      }
    }
    for (const l of lib.filter((l) => !used.has(String(l._id)))) { S5.push({ outcome: 'ours only', kind: l.type === 'book' ? 'Book (printed)' : 'E-book', ourTitle: str(l.title), ourType: l.type, ourShown: l.isActive ? 'yes' : 'no', ourFree: Boolean(l.isFree), ourPrice: l.discountPrice ?? l.price ?? '', ourCreated: l.createdAt?.toISOString?.().slice(0, 10) || '' }); bump(T.ebooks, `${l.type}: ours only`); }
    for (const e of oldEbooks) { S5.push({ outcome: 'ours only (old ebooks collection)', kind: 'E-book', ourTitle: str(e.title), ourType: 'ebooks collection', ourShown: e.status === 1 ? 'yes' : 'no', ourFree: Boolean(e.isFree), ourPrice: e.newPrice ?? '' }); bump(T.ebooks, 'old ebooks collection: ours only'); }
    T.ebookCounts = { appxPaidEbooks: S5.filter((r) => r.kind === 'Paid E-book').length, appxFreeEbooks: S5.filter((r) => r.kind === 'Free E-book').length, appxBooks: S5.filter((r) => r.kind === 'Book (printed)' && r.appxId).length, ourEbooks: lib.filter((l) => l.type === 'ebook').length, ourBooks: lib.filter((l) => l.type === 'book').length, ourOldEbooks: oldEbooks.length };

    // ---------- 6. Tests ----------
    const S6 = (report.sheets.tests = []); T.tests = {}; const tabCount = {};
    const usedSeries = new Set();
    for (const t of apxTests) {
      const tid = str(t.apxId || t.id);
      const ours = seriesByLegacy.get(tid) || [];
      ours.forEach((s) => usedSeries.add(String(s._id)));
      const appxPublished = str(t.flag) === '1';
      const o = ours[0];
      const outcome = !ours.length ? (appxPublished ? 'MISSING HERE (published in AppX)' : 'missing here (unpublished in AppX)') : appxPublished === (o.status === 1) ? 'ok' : appxPublished ? 'AppX published, ours off' : 'AppX unpublished, ours on';
      S6.push({ outcome, appxTestId: tid, appxTest: str(t.title || t.test_title), appxPackages: [...new Set([...idList(t.packageApxIds), ...idList(t.packageApxId)])].join(','), appxFree: str(t.free_flag) === '1' ? 'free' : 'paid', appxPublished: appxPublished ? 'yes' : 'no', appxLive: str(t.is_live_test) === '1' ? 'live' : '', appxQuestions: str(t.questions_added || t.questions),
        ourTest: o ? str(o.series_name) : '', ourTab: o ? str(o.main_tab) : '', ourStatus: o ? (o.status === 1 ? 'on' : 'off') : '', ourCopies: ours.length > 1 ? ours.length : '' });
      bump(T.tests, outcome);
    }
    for (const s of seriesDocs) { bump(tabCount, `${s.main_tab}: ${s.status === 1 ? 'on' : 'off'}`); if (!usedSeries.has(String(s._id)) && !['daily-quiz', 'current-affair-daily-quiz'].includes(s.main_tab)) { S6.push({ outcome: realId(s.legacy_id) ? 'ours only (AppX id not in the AppX list)' : 'ours only (made here)', appxTestId: str(s.legacy_id), ourTest: str(s.series_name), ourTab: str(s.main_tab), ourStatus: s.status === 1 ? 'on' : 'off' }); bump(T.tests, realId(s.legacy_id) ? 'ours only (AppX id not in the AppX list)' : 'ours only (made here)'); } }
    T.testTabs = tabCount;
    // quizzes: no AppX id on ours, match by title
    const S6q = (report.sheets.quizzes = []); T.quizzes = {};
    const quizPool = seriesDocs.filter((s) => ['daily-quiz', 'current-affair-daily-quiz'].includes(s.main_tab)); const usedQ = new Set();
    for (const q of await all('apx_quiz_raw', {}, { apxId: 1, title: 1, status: 1, deleted: 1, total_ques: 1, exam: 1, datetimestart: 1 })) {
      const hit = quizPool.find((s) => !usedQ.has(String(s._id)) && key(s.series_name) === key(q.title)); if (hit) usedQ.add(String(hit._id));
      const on = str(q.status) === '1';
      const outcome = !hit ? (on ? 'MISSING HERE (on in AppX)' : 'missing here (off in AppX)') : on === (hit.status === 1) ? 'ok' : on ? 'AppX on, ours off' : 'AppX off, ours on';
      S6q.push({ outcome, appxQuizId: str(q.apxId), appxQuiz: str(q.title), appxSubject: str(q.exam), appxOn: on ? 'yes' : 'no', appxQuestions: str(q.total_ques), appxDate: str(q.datetimestart).slice(0, 10), ourQuiz: hit ? str(hit.series_name) : '', ourTab: hit ? hit.main_tab : '', ourStatus: hit ? (hit.status === 1 ? 'on' : 'off') : '' });
      bump(T.quizzes, outcome);
    }
    for (const s of quizPool.filter((s) => !usedQ.has(String(s._id)))) { S6q.push({ outcome: 'ours only', ourQuiz: str(s.series_name), ourTab: s.main_tab, ourStatus: s.status === 1 ? 'on' : 'off' }); bump(T.quizzes, 'ours only'); }
    // packages
    const S6p = (report.sheets.testPackages = []); T.testPackages = {};
    const pkgs = await all('packages', {}, { packageName: 1, apx_legacy_id: 1, status: 1, price: 1, discountPrice: 1, isFree: 1, assignedSeries: 1, main_slug: 1 });
    const psCount = {}; for (const ps of await all('packageseries', {}, { packageId: 1 })) bump(psCount, String(ps.packageId));
    const coursesUsing = {}; for (const d of mirrorDocs) for (const pk of idList(d.detail?.test_series_id)) (coursesUsing[pk] = coursesUsing[pk] || []).push(String(d.apxCourseId));
    const usedP = new Set();
    for (const p of await all('apx_package_raw', {}, { apxId: 1, title: 1, enable: 1, price: 1, offer_price: 1, validity: 1, validity_type: 1, test_maker: 1 })) {
      const pid = str(p.apxId); const hit = pkgs.find((x) => str(x.apx_legacy_id) === pid); if (hit) usedP.add(String(hit._id));
      const pr = num(p.price); const on = str(p.enable) === '1' && pr !== -1;
      const appxN = (testsByPackage.get(pid) || []).length; const oursN = hit ? Math.max(psCount[String(hit._id)] || 0, (hit.assignedSeries || []).length) : 0;
      const diffs = [];
      if (!hit) diffs.push(on ? 'MISSING HERE (AppX sells it)' : 'missing here (AppX not selling)');
      else { if (on !== (hit.status === 1)) diffs.push(on ? 'AppX on sale, ours off' : 'AppX not selling, ours on'); if (appxN !== oursN) diffs.push(`tests: AppX ${appxN}, ours ${oursN}`); if (on && pr > 0 && num(hit.discountPrice) !== pr && num(hit.price) !== pr) diffs.push(`price: AppX ₹${pr}, ours ₹${hit.discountPrice ?? hit.price}`); }
      const outcome = diffs.length ? diffs.join('; ') : 'ok';
      S6p.push({ outcome, appxPackageId: pid, appxPackage: str(p.title), appxEnabled: str(p.enable) === '1' ? 'yes' : 'no', appxPrice: pr ?? '', appxPriceMeans: priceWord(pr), appxValidity: `${str(p.validity)} ${str(p.validity_type)}`.trim(), appxTests: appxN, appxAttachedToCourses: (coursesUsing[pid] || []).join(','), appxTestMaker: str(p.test_maker) === '1' ? 'test maker' : '',
        ourPackage: hit ? str(hit.packageName) : '', ourStatus: hit ? (hit.status === 1 ? 'on' : 'off') : '', ourPrice: hit ? hit.discountPrice ?? hit.price ?? '' : '', ourFree: hit ? Boolean(hit.isFree) : '', ourTests: hit ? oursN : '', ourTab: hit ? str(hit.main_slug) : '' });
      bump(T.testPackages, outcome === 'ok' ? 'ok' : diffs[0].replace(/\d+/g, 'N'));
    }
    for (const x of pkgs.filter((x) => !usedP.has(String(x._id)))) { S6p.push({ outcome: 'ours only', ourPackage: str(x.packageName), ourStatus: x.status === 1 ? 'on' : 'off', ourPrice: x.discountPrice ?? x.price ?? '', ourFree: Boolean(x.isFree), ourTests: Math.max(psCount[String(x._id)] || 0, (x.assignedSeries || []).length), ourTab: str(x.main_slug) }); bump(T.testPackages, 'ours only'); }

    // ---------- headline numbers ----------
    const sum = (f) => S1.reduce((a, r) => a + (Number(r[f]) || 0), 0);
    const cnt = (f) => S1.filter(f).length;
    report.headline = {
      appxCoursesListed: liveById.size, appxActive: cnt((r) => r.appxActive === 'ACTIVE'), appxInactive: cnt((r) => r.appxActive === 'INACTIVE'),
      appxOnPublicSite: cnt((r) => r.appxOnPublicSite === 'yes'), appxPublicPaid: cnt((r) => r.appxOnPublicSite === 'yes' && r.appxFolder === 'Paid Courses'), appxPublicFree: cnt((r) => r.appxOnPublicSite === 'yes' && r.appxFolder === 'Free Courses'),
      ourCourses: courses.length, ourActive: courses.filter((c) => c.status === 1).length, ourInactive: courses.filter((c) => c.status !== 1).length, ourWithAppxId: courses.filter((c) => c.apxCourseId).length,
      appxClasses: sum('appxClasses'), ourClassesPlayable: sum('ourClassesPlayable'), ourClassesMatched: sum('ourClassesMatched'), ourClassDocs: classes.size, ourPlacementsActive: Object.values(activePlacedPerCourse).reduce((a, b) => a + b, 0),
      appxPdfs: sum('appxPdfs'), ourPdfsMatched: sum('ourPdfsMatched'), appxClassPdfs: sum('appxClassPdfs'), ourClassPdfs: sum('ourClassPdfs'),
      appxClassTests: sum('appxClassTests'), ourClassTests: sum('ourClassTests'), appxCourseTests: sum('appxCourseTests'), ourCourseTestsMatched: sum('ourCourseTestsMatched'),
      appxTests: apxTests.length, ourTests: seriesDocs.length, appxTestPackages: S6p.filter((r) => r.appxPackageId).length, ourTestPackages: pkgs.length, appxQuizzes: S6q.filter((r) => r.appxQuizId).length, ourQuizzes: quizPool.length,
      ourClassesWithTests: [...classes.values()].filter((c) => (c.seriesAssignments || []).length || (c.seriesIds || []).length).length, attachLedger: attach.size,
    };
    console.log(JSON.stringify(report.headline, null, 1));
    console.log(JSON.stringify(report.totals, null, 1));
    // public-list rule check: how the 49 on vidyagram.online splits
    const rule = {}; for (const r of S1.filter((r) => r.appxFolder === 'Paid Courses' || r.appxFolder === 'Free Courses')) bump(rule, `${r.appxFolder} | enabled ${r.appxEnabled} | ${r.appxPriceMeans.replace(/₹\d+/, 'priced')}`);
    console.log('public folders:', JSON.stringify(rule, null, 1));
    fs.writeFileSync(OUT, JSON.stringify(report));
    fs.chmodSync(OUT, 0o600);
    console.log('Report written:', OUT, `(${(fs.statSync(OUT).size / 1e6).toFixed(1)} MB)`);
  } finally { await mongoose.disconnect(); }
})().catch((e) => { console.error(String(e.stack || e.message).replace(/https?:\/\/\S+/g, '[url]')); process.exitCode = 1; });
