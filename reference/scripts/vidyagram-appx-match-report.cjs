// Read-only, refuses any DB but vidyagramdb. The AppX → Vidyagram match report: for each checklist item (courses,
// classes, ebooks, class notes, sub courses, prices, daily sync, validity, faculty, main category, category, section,
// topic, sub topic, tags) it compares AppX, as the planner reads each course's last done capture, with what we hold, and
// gives every row an outcome. Prints the outcome totals per item; the full rows go to OUT (default
// ~/vidyagram-appx-match-<date>.json on the box, mode 600). Build the spreadsheet on the Mac with
// vidyagram-appx-match-xlsx.py. No AppX writes, no DB writes, no links or secrets in the output.
//
// The live AppX course list needs a maintained CMS session; LIVE=0 uses the mirror's course list instead.
// Run from the nightly checkout on test-uday (nvm PATH as in vidyagram-nightly-gcp-run.sh):
//   cd <nightly checkout> && nice -n 10 node --max-old-space-size=3072 - < vidyagram-appx-match-report.cjs
require('dotenv').config({ path: '.env.development', quiet: true });
require('ts-node/register/transpile-only');
const fs = require('fs');
const mongoose = require('mongoose');
const root = process.cwd() + '/src/services/apx/';
const { createHttpCatalogSource } = require(root + 'apxCatalogHttpSource');
const { loadMirrorCourses } = require(root + 'apxCatalogMirrorReader');
const planner = require(root + 'apxCatalogPlanner');
const { planCatalogue } = planner;
// The planner's "… By X Sir" reader; a copy for a checkout older than task 03c.
const BY_TEACHER = /(?:^|[\s(\[])by\s+((?:[\p{L}\p{M}.]+\s+){0,3}?[\p{L}\p{M}.]+)\s+(sir|ma['\u2019]?am|mam|madam)(?![\p{L}\p{M}\p{N}])/iu;
const teacherFromFolder = planner.teacherFromFolder || ((s) => { const m = String(s).normalize('NFKC').replace(/\s+/g, ' ').trim().match(BY_TEACHER); return m ? `${m[1]} ${/^sir$/i.test(m[2]) ? 'Sir' : "Ma'am"}` : null; });
const { runView } = require(root + 'apxCatalogCapture');

const CUSTOMER = '781';
const TODAY = new Date().toISOString().slice(0, 10);
const OUT = process.env.OUT || `${process.env.HOME}/vidyagram-appx-match-${TODAY}.json`;
const LIVE = process.env.LIVE !== '0';
const PLACEHOLDER_TEACHERS = new Set(['vidyagram team']);
const UNIT_LABEL = { DAYS: 'Days', MONTHS: 'Months', YEARS: 'Years' };
const UNIT_DAYS = { DAYS: 1, MONTHS: 30, YEARS: 365, DAY: 1, MONTH: 30, YEAR: 365 };

const bump = (m, k, n = 1) => { m[k] = (m[k] || 0) + n; return m; };
const key = (s) => String(s ?? '').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
const str = (v) => (v === null || v === undefined ? '' : String(v).trim());
const num = (v) => { const n = Number(v); return v === '' || v === null || v === undefined || !Number.isFinite(n) ? null : n; };
const idList = (v) => str(v).split(',').map((s) => s.trim()).filter((s) => s && s !== '-1');
const noUrls = (s) => String(s ?? '').replace(/https?:\/\/\S+/g, '[url]').replace(/rtmps?:\/\/\S+/g, '[url]');
const ok = (o) => o.startsWith('ok');
// "Ratio 07 | Aditya Sir" / "… - Jai Sir": a teacher at the end of a title, which teacherFromFolder ("By X Sir") misses.
const TAIL_TEACHER = /[|\/–-]\s*((?:[\p{L}\p{M}.]+\s+){0,2}[\p{L}\p{M}.]+)\s+(sir|ma['\u2019]?am|mam|madam)\s*\)?\s*$/iu;
const teacherOf = (title) => {
  const by = teacherFromFolder(str(title));
  if (by) return by;
  const m = str(title).normalize('NFKC').match(TAIL_TEACHER);
  return m ? `${m[1]} ${/^sir$/i.test(m[2]) ? 'Sir' : "Ma'am"}` : null;
};
const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));

// "Add In a Home Page (Add In a Home Page),<br>SSC CPO (SSC CPO)" → ['Add In a Home Page', 'SSC CPO']
const examNames = (v) => str(v).split(/,\s*(?:<br\s*\/?>)?/i).map((s) => s.replace(/<[^>]+>/g, '').replace(/\s*\([^()]*\)\s*$/, '').trim()).filter(Boolean);
const HOME_PAGE = 'add in a home page';

const validityDays = (label) => {
  const m = str(label).match(/^(\d+)\s*(day|month|year)s?/i);
  return m ? Number(m[1]) * UNIT_DAYS[m[2].toUpperCase()] : null;
};

const report = { generatedAt: new Date().toISOString(), live: LIVE, items: {} };
const section = (id, title, note) => (report.items[id] = { title, note, totals: {}, rows: [] });
const add = (sec, outcome, row) => { bump(sec.totals, outcome); sec.rows.push({ outcome, ...row }); };

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: 'vidyagramdb', readPreference: 'secondaryPreferred', autoIndex: false, autoCreate: false });
  try {
    const db = mongoose.connection.db;
    if (db.databaseName !== 'vidyagramdb') throw new Error('wrong db');
    const all = (name, filter = {}, projection = {}) => db.collection(name).find(filter, { projection }).toArray();

    // --- AppX side ---
    const mirrorDocs = await all('apxcatalogcourses', { customerId: CUSTOMER }, { apxCourseId: 1, listRow: 1, detail: 1, 'capture.runId': 1, 'capture.status': 1, 'capture.finishedAt': 1 });
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
    const inputById = new Map(inputs.map((i) => [String(i.apxCourseId), i]));
    const appxTitle = (id) => str(liveById.get(id)?.title || mirrorById.get(id)?.detail?.title || mirrorById.get(id)?.listRow?.title);
    console.log('AppX listed', live.length, LIVE ? '(live CMS list)' : '(mirror list, LIVE=0)', '| planned from a done capture', plans.length);

    // --- our side ---
    const courses = await all('courses', {}, { apxCourseId: 1, title: 1, status: 1, price: 1, discountPrice: 1, apxPrice: 1, isFree: 1, validity: 1, faculties: 1, facultyDetails: 1, mainCategory: 1, category: 1, tags: 1, isCombo: 1, 'selling.combo': 1 });
    const courseByApx = new Map(courses.filter((c) => c.apxCourseId).map((c) => [String(c.apxCourseId), c]));
    const courseById = new Map(courses.map((c) => [String(c._id), c]));
    const nameMap = async (coll, field) => new Map((await all(coll, {}, { [field]: 1 })).map((d) => [String(d._id), str(d[field])]));
    const mainCategoryName = await nameMap('maincategories', 'mainCategoryName');
    const categoryName = await nameMap('categories', 'categoryName');
    const subTopicName = await nameMap('subtopics', 'subTopicName');
    const facultyName = await nameMap('facultydetails', 'name');
    const classes = new Map((await all('classes', {}, { isYoutubeRedirect: 1, hlsAsset: 1, teacherName: 1, facultyId: 1, 'pdfAssignments.pdfId': 1, pdfIds: 1 })).map((c) => [String(c._id), c]));
    const jobs = new Map((await all('apxingestjobs', {}, { classId: 1, status: 1 })).map((j) => [String(j.classId), j]));
    const ledgerRows = await all('apxcatalogimports', { customerId: CUSTOMER }, { assetKey: 1, classId: 1, sourceCourseId: 1, sourceRowId: 1, 'placements.apxCourseId': 1, 'placements.rowId': 1 });
    const ledgerByKey = new Map(ledgerRows.map((l) => [l.assetKey, l]));
    const ledgerByRow = new Map(); // `${course}|${row}` → ledger, for rows whose asset key the planner cannot derive or that changed
    for (const l of ledgerRows) for (const p of [{ apxCourseId: l.sourceCourseId, rowId: l.sourceRowId }, ...(l.placements || [])]) if (p.apxCourseId && p.rowId) ledgerByRow.set(`${p.apxCourseId}|${p.rowId}`, l);
    const ledgerOf = (id, item) => ledgerByKey.get(item.assetKey) || ledgerByRow.get(`${id}|${item.rowId}`);
    const pdfBySource = new Map(); // `${course}|${row}|${field}` → { ledger, source }
    for (const l of await all('apxcatalogpdfimports', { customerId: CUSTOMER }, { status: 1, pdfId: 1, sources: 1 })) {
      for (const s of l.sources || []) pdfBySource.set(`${s.apxCourseId}|${s.rowId}|${s.field}`, { l, s });
    }
    const placements = new Map(); // `${course}:${class}` → CourseClass
    for (const p of await all('courseclasses', {}, { course: 1, class: 1, sectionName: 1, topicName: 1, subTopic: 1 })) placements.set(`${p.course}:${p.class}`, p);
    const coursePdfs = new Map();
    for (const p of await all('coursepdfs', {}, { course: 1, pdf: 1, sectionName: 1, topicName: 1, overrideSectionName: 1 })) coursePdfs.set(`${p.course}:${p.pdf}`, p);
    const planDocs = await all('plans', {}, { name: 1, title: 1, status: 1, course: 1, amount: 1, duration: 1 });

    const ref = (id, course) => ({ apxCourseId: id, appxCourse: appxTitle(id), ourCourse: course ? str(course.title) : '', ourCourseId: course ? String(course._id) : '' });

    // 1. Courses
    const S1 = section('courses', 'Courses', 'Every course AppX lists has a Course here; status follows AppX enable and price -1.');
    for (const [id, row] of liveById) {
      const course = courseByApx.get(id);
      const plan = planById.get(id);
      const want = plan ? plan.course.status : null;
      let outcome;
      if (!course) outcome = plan && plan.counts.active ? 'missing: AppX course with content has no Course' : 'missing: no Course, AppX course is empty';
      else if (want !== null && course.status !== want) outcome = `status differs (AppX wants ${want})`;
      else if (key(course.title) !== key(plan ? plan.course.title : row.title)) outcome = 'ok: present, title differs';
      else outcome = 'ok: present';
      add(S1, outcome, { ...ref(id, course), appxEnabled: str(row.enable), appxPrice: str(row.price), ourStatus: course ? course.status : '', appxItems: plan ? plan.counts.active : '' });
    }
    for (const c of courses.filter((c) => c.apxCourseId && !liveById.has(String(c.apxCourseId)))) add(S1, 'info: AppX no longer lists it', { ...ref(String(c.apxCourseId), c), ourStatus: c.status });
    for (const c of courses.filter((c) => !c.apxCourseId)) add(S1, 'info: made here, no AppX id', { apxCourseId: '', ourCourse: str(c.title), ourCourseId: String(c._id), ourStatus: c.status });

    // 2-3. Classes and Ebooks, item by item (the parity audit's outcomes); 12-14 taxonomy rides on the same walk.
    const S2 = section('classes', 'Classes', 'Every active AppX video in a live course is a Class with a video, placed in its course.');
    const S3 = section('ebooks', 'Ebooks (PDF)', 'Every active AppX PDF row is a Pdf placed in its course (CoursePdf).');
    const S12 = section('section', 'Section', 'Each placed item sits under the Section the AppX folder tree gives it. Admin edits since import show as differs.');
    const S13 = section('topic', 'Topic', 'Each placed item sits under the Topic the AppX folder tree gives it.');
    const S14 = section('subTopic', 'Sub Topics', 'Each placed class sits under the Sub Topic the AppX folder tree gives it (PDFs carry no sub topic).');
    const S9c = section('facultyClass', 'Faculty (classes)', 'A class whose AppX folder or title names a teacher carries that teacher here.');
    const taxonomy = (sec, appx, ours, r) => {
      const a = key(appx); const o = key(ours);
      add(sec, !a && !o ? 'ok: none on either side' : a === o ? 'ok: same' : !o ? 'ours blank' : !a ? 'ours set, AppX none' : 'differs', { ...r, appx: str(appx), ours: str(ours) });
    };
    const perCourseTax = new Map();
    for (const [id] of liveById) {
      const plan = planById.get(id);
      const course = courseByApx.get(id);
      if (!plan) continue;
      const tax = { appx: { s: new Set(), t: new Set(), st: new Set() }, ours: { s: new Set(), t: new Set(), st: new Set() } };
      perCourseTax.set(id, tax);
      for (const item of plan.items.filter((i) => i.active)) {
        const r = { ...ref(id, course), rowId: item.rowId, kind: item.kind, title: item.apxTitle, path: (item.path || []).join(' > ') };
        const pl = item.placement;
        if (pl) { tax.appx.s.add(key(pl.section)); tax.appx.t.add(key(`${pl.section}>${pl.topic}`)); if (pl.subTopic) tax.appx.st.add(key(`${pl.section}>${pl.topic}>${pl.subTopic}`)); }
        if (item.kind === 'PDF') {
          const hit = pdfBySource.get(`${id}|${item.rowId}|link`);
          const l = hit?.l;
          const cp = course && l?.pdfId ? coursePdfs.get(`${course._id}:${l.pdfId}`) : null;
          const outcome = !l ? 'missing: not in PDF import ledger' : l.status !== 'done' || !l.pdfId ? `missing: ledger ${l.status}` : cp ? 'ok: pdf placed' : 'pdf exists, not placed in this course';
          add(S3, outcome, r);
          if (cp && pl) {
            const sName = cp.overrideSectionName || cp.sectionName;
            taxonomy(S12, pl.section, sName, r); taxonomy(S13, pl.topic, cp.topicName, r);
            tax.ours.s.add(key(sName)); tax.ours.t.add(key(`${sName}>${cp.topicName}`));
          }
          continue;
        }
        const l = ledgerOf(id, item);
        const cid = l?.classId ? String(l.classId) : null;
        const cls = cid && classes.get(cid);
        const cc = course && cid ? placements.get(`${course._id}:${cid}`) : null;
        let outcome;
        if (!l || !cid) outcome = item.noUsableLink ? 'missing: AppX row has no usable link' : 'missing: not in import ledger';
        else if (!cls) outcome = 'missing: ledger points at a missing Class';
        else if (!cc) outcome = 'class exists, not placed in this course';
        else if (cls.isYoutubeRedirect) outcome = 'ok: placed, YouTube';
        else if (cls.hlsAsset) outcome = 'ok: placed, video in our storage';
        else if (item.kind === 'VIDEO_MP4') outcome = 'placed, MP4 not copied';
        else outcome = `placed, no video: job ${jobs.get(cid)?.status || 'none'}`;
        add(S2, outcome, r);
        if (cc && pl) {
          const st = cc.subTopic ? subTopicName.get(String(cc.subTopic)) : '';
          taxonomy(S12, pl.section, cc.sectionName, r); taxonomy(S13, pl.topic, cc.topicName, r); taxonomy(S14, pl.subTopic, st, r);
          tax.ours.s.add(key(cc.sectionName)); tax.ours.t.add(key(`${cc.sectionName}>${cc.topicName}`)); if (st) tax.ours.st.add(key(`${cc.sectionName}>${cc.topicName}>${st}`));
        }
        if (cls) {
          const hint = item.facultyHint || teacherOf(item.apxTitle);
          const ours = str(cls.teacherName) || facultyName.get(String(cls.facultyId)) || '';
          const o = !hint ? 'info: AppX names no teacher' : key(ours) === key(hint) ? 'ok: same teacher' : PLACEHOLDER_TEACHERS.has(key(ours)) || !ours ? 'ours placeholder' : 'differs';
          add(S9c, o, { ...r, appx: hint || '', ours });
        }
      }
    }
    S2.rows = S2.rows.filter((r) => !ok(r.outcome)); // keep the file small: gaps only
    S9c.rows = S9c.rows.filter((r) => !ok(r.outcome) && !r.outcome.startsWith('info'));
    for (const sec of [S12, S13, S14]) sec.rows = sec.rows.filter((r) => !ok(r.outcome));
    report.items.taxonomyCounts = { title: 'Section / Topic / Sub Topic counts per course', note: 'Distinct nodes the AppX tree gives vs distinct nodes our placements use, active items only.', totals: {}, rows: [] };
    for (const [id, t] of perCourseTax) {
      const r = { ...ref(id, courseByApx.get(id)), appxSections: t.appx.s.size, ourSections: t.ours.s.size, appxTopics: t.appx.t.size, ourTopics: t.ours.t.size, appxSubTopics: t.appx.st.size, ourSubTopics: t.ours.st.size };
      const outcome = r.appxSections === r.ourSections && r.appxTopics === r.ourTopics && r.appxSubTopics === r.ourSubTopics ? 'ok: same counts' : 'counts differ';
      add(report.items.taxonomyCounts, outcome, r);
    }

    // 4. Class notes: pdf_link / pdf_link2 on AppX video rows → Pdf on the Class (pdfAssignments).
    const S4 = section('classNotes', 'Assigned PDFs to Classes', 'A note PDF on an active AppX video row is attached to that video\'s Class here.');
    for (const [id] of liveById) {
      const input = inputById.get(id); const plan = planById.get(id); const course = courseByApx.get(id);
      const runId = mirrorById.get(id)?.capture?.runId;
      if (!input || !plan || !runId) continue;
      const videos = new Map(plan.items.filter((i) => i.active && i.kind !== 'PDF').map((i) => [i.rowId, i]));
      const pages = await db.collection('apxcatalogtree').aggregate([
        { $match: { customerId: CUSTOMER, apxCourseId: id, ...runView(runId) } },
        { $project: { _id: 0, rows: { $map: { input: { $ifNull: ['$rows', []] }, as: 'r', in: {
          id: '$$r.id',
          n1: { $gt: [{ $strLenCP: { $toString: { $ifNull: ['$$r.pdf_link', ''] } } }, 0] },
          n2: { $gt: [{ $strLenCP: { $toString: { $ifNull: ['$$r.pdf_link2', ''] } } }, 0] },
        } } } } },
      ]).toArray();
      const seen = new Set();
      for (const p of pages) for (const row of p.rows) {
        const item = videos.get(String(row.id));
        if (!item) continue;
        for (const [field, has] of [['pdf_link', row.n1], ['pdf_link2', row.n2]]) {
          if (!has || seen.has(`${row.id}|${field}`)) continue;
          seen.add(`${row.id}|${field}`);
          const hit = pdfBySource.get(`${id}|${item.rowId}|${field}`);
          const cid = ledgerOf(id, item)?.classId;
          const cls = cid && classes.get(String(cid));
          let outcome;
          if (!hit) outcome = 'missing: note not in PDF import ledger';
          else if (!hit.l.pdfId) outcome = `missing: ledger ${hit.l.status}, source ${hit.s.state}`;
          else if (!cls) outcome = 'missing: video has no Class';
          else if ((cls.pdfAssignments || []).some((a) => String(a.pdfId) === String(hit.l.pdfId)) || (cls.pdfIds || []).some((p) => String(p) === String(hit.l.pdfId))) outcome = 'ok: note on class';
          else outcome = 'pdf exists, not on class';
          add(S4, outcome, { ...ref(id, course), rowId: item.rowId, slot: field, title: item.apxTitle });
        }
      }
    }
    S4.rows = S4.rows.filter((r) => !ok(r.outcome));

    // 5. Sub courses: AppX allotment_id (what a combo grants) vs our combo sub courses and the same-named Plan.
    const S5 = section('subCourses', 'Sub Courses', 'An AppX combo (allotment_id) grants the same courses here: Course.selling.combo, else the same-named Plan. upgrade_courses / vod_courses shown for reference.');
    const toApx = (ids) => ids.map((x) => courseById.get(String(x))).filter(Boolean).map((c) => str(c.apxCourseId) || `ours:${c._id}`).sort();
    for (const d of mirrorDocs) {
      const id = String(d.apxCourseId);
      const want = idList(d.detail?.allotment_id).filter((x) => x !== id).sort(); // AppX lists the combo itself too
      const up = idList(d.detail?.upgrade_courses); const vod = idList(d.detail?.vod_courses);
      if (!want.length && !up.length && !vod.length) continue;
      const course = courseByApx.get(id);
      const combo = course?.selling?.combo;
      const ourCombo = combo?.on ? toApx(combo.subCourses || []) : [];
      const t = key(appxTitle(id));
      const samePlan = planDocs.filter((p) => [p.name, p.title].some((x) => key(x) === t)); // off-sale plans count: AppX buyers' orders sit on them
      const planSet = samePlan.length ? toApx([].concat(...samePlan.map((p) => p.course || []))).filter((x) => x !== id) : [];
      const ours = ourCombo.length ? ourCombo : planSet;
      let outcome;
      if (!want.length) outcome = 'info: not a combo (upgrade / VOD links only)';
      else if (!ours.length) outcome = course ? 'missing: no combo or same-named Plan grants these' : 'missing: combo has no Course and no same-named Plan';
      else if (sameSet(want, ours)) outcome = ourCombo.length ? 'ok: combo sub courses match' : 'ok: same-named Plan grants the same';
      else outcome = 'differs';
      add(S5, outcome, { ...ref(id, course), liveInAppX: liveById.has(id), appxGrants: want.join(','), oursGrants: ours.join(','), oursFrom: ourCombo.length ? 'combo' : samePlan.length ? `plan x${samePlan.length} (status ${samePlan.map((p) => p.status).join(',')})` : '', missingHere: want.filter((x) => !ours.includes(x)).join(','), extraHere: ours.filter((x) => !want.includes(x)).join(','), isCombo: Boolean(course?.isCombo), appxUpgradeCourses: up.join(','), appxVodCourses: vod.join(',') });
    }

    // 6. Prices and 8. Validity, per live AppX course with a Course.
    const S6 = section('prices', 'Prices Sync', 'Course price fields follow AppX price/mrp the way the importer maps them (price = mrp when higher, discountPrice = AppX price; -10 free, -1 stopped selling, -3 special). Single-course plan amount shown.');
    const S8 = section('validity', 'Validity Sync', 'Course validity label equals AppX validity + validity_type; plan days near it; AppX length options vs our single-course plans.');
    const singlePlans = (course) => planDocs.filter((p) => p.status === 1 && Array.isArray(p.course) && p.course.length === 1 && String(p.course[0]) === String(course._id));
    for (const [id] of liveById) {
      const course = courseByApx.get(id); const d = mirrorById.get(id)?.detail || {};
      if (!course) continue;
      const plan = planById.get(id); const h = plan?.course;
      // The live list first: AppX's course detail keeps the old price after the list says -1 (stopped selling).
      const apxPrice = num(liveById.get(id)?.price ?? d.price); const mrp = num(d.price) === apxPrice ? num(d.mrp) : null;
      const sells = singlePlans(course);
      const r = { ...ref(id, course), appxPrice: apxPrice ?? '', appxMrp: mrp ?? '', ourApxPrice: course.apxPrice ?? '', ourPrice: course.price ?? '', ourDiscountPrice: course.discountPrice ?? '', ourIsFree: Boolean(course.isFree), planAmounts: sells.map((p) => p.amount).join(',') };
      const diffs = [];
      if (apxPrice === null) diffs.push('AppX has no price');
      else {
        if (num(course.apxPrice) !== apxPrice) diffs.push('apxPrice');
        if (apxPrice > 0) {
          const wantPrice = mrp !== null && mrp > apxPrice ? mrp : apxPrice;
          if (num(course.price) !== wantPrice) diffs.push('price (MRP)');
          if (num(course.discountPrice) !== apxPrice) diffs.push('discountPrice');
          if (sells.length && !sells.some((p) => num(p.amount) === apxPrice)) diffs.push('plan amount');
        } else if (apxPrice === -10 && !course.isFree) diffs.push('isFree');
      }
      const sentinel = apxPrice === -1 ? ' (AppX stopped selling)' : apxPrice === -3 ? ' (AppX special price)' : apxPrice === -10 ? ' (AppX free)' : '';
      add(S6, diffs.length ? `differs: ${diffs.join(', ')}` : `ok: same${sentinel}`, r);

      const want = h?.validity ? `${h.validity.value} ${UNIT_LABEL[h.validity.unit]}` : '';
      let options = [];
      try { options = typeof d.price_planningData === 'string' ? JSON.parse(d.price_planningData) : d.price_planningData || []; } catch { options = []; }
      const liveOptions = Array.isArray(options) && str(d.enable_pricing_plan) === '1' ? options.filter((o) => str(o.status) !== '0') : [];
      const days = validityDays(course.validity);
      const vr = { ...ref(id, course), appxValidity: want || `${str(d.validity)} ${str(d.validity_type)}`.trim(), ourValidity: str(course.validity), planDays: sells.map((p) => p.duration).join(','), appxLengthOptions: liveOptions.map((o) => `${str(o.validity)} ${str(o.validity_type)} ₹${str(o.price)}`).join(' | '), ourSingleCoursePlans: sells.length, appxExtendedValidity: `${str(d.extended_validity)} ${str(d.extended_validity_type)}`.trim(), appxExpiryMode: str(d.expiry_mode) };
      const vd = [];
      if (!want) vd.push('AppX validity unreadable');
      else if (key(want) !== key(course.validity)) vd.push('label');
      if (days && sells.length && !sells.some((p) => Math.abs(num(p.duration) - days) <= days * 0.05)) vd.push('plan days');
      if (liveOptions.length > 1 && sells.length < liveOptions.length) vd.push(`AppX sells ${liveOptions.length} lengths, ours ${sells.length}`);
      add(S8, vd.length ? `differs: ${vd.join(', ')}` : 'ok: same', vr);
    }

    // 9. Faculty, course level. AppX has teacher ids only (no registry captured) and teachers named in titles.
    const S9 = section('faculty', 'Faculty Sync', 'Course level: the teacher an AppX course names (title "By X Sir"; teacher_id is an id with no name captured) is on the Course here. Class level is the Faculty (classes) sheet.');
    for (const [id] of liveById) {
      const course = courseByApx.get(id); if (!course) continue;
      const d = mirrorById.get(id)?.detail || {};
      const fromTitle = teacherOf(appxTitle(id));
      const ours = [...new Set([...(course.faculties || []), course.facultyDetails].filter(Boolean).map((f) => facultyName.get(String(f)) || '?'))];
      const real = ours.filter((n) => !PLACEHOLDER_TEACHERS.has(key(n)));
      let outcome;
      if (!fromTitle && !idList(d.teacher_id).length) outcome = real.length ? 'ok: AppX names none, ours set' : 'info: AppX names no teacher';
      else if (fromTitle && real.some((n) => key(n) === key(fromTitle))) outcome = 'ok: same teacher';
      else if (!real.length) outcome = 'ours placeholder';
      else outcome = fromTitle ? 'differs' : 'check: AppX teacher id only';
      add(S9, outcome, { ...ref(id, course), appxTeacherFromTitle: fromTitle || '', appxTeacherIds: idList(d.teacher_id).join(','), ours: ours.join(', ') });
    }

    // 10-11. Main category (AppX course folder parent_id) and category (AppX exam_name).
    const S10 = section('mainCategory', 'Main Category', 'AppX files each course in a course folder (parent_id); ours is Course.mainCategory. The mirror has no folder names, so most show as folder <id>.');
    const S11 = section('category', 'Category', 'AppX tags each course with exams (exam_name; "Add In a Home Page" is a home-page switch, left out); ours is one Course.category.');
    // Course folder ids are not course ids (none is in the mirror) and the mirror holds no folder names. 62 is "Free Courses"
    // (vidyagram-free-course-preview.cjs); FOLDER_NAMES='{"58":"…"}' adds more once read off the CMS.
    const FOLDERS = { 62: 'Free Courses', ...JSON.parse(process.env.FOLDER_NAMES || '{}') };
    const folderName = (pid) => (pid === '-1' || !pid ? '(top level)' : FOLDERS[pid] || `folder ${pid}`);
    for (const [id] of liveById) {
      const course = courseByApx.get(id); if (!course) continue;
      const d = mirrorById.get(id)?.detail || {};
      const pid = str(d.parent_id);
      const ourMain = mainCategoryName.get(String(course.mainCategory)) || '';
      add(S10, key(folderName(pid)) === key(ourMain) ? 'ok: same' : ourMain === 'Vidyagram' ? 'ours import default' : 'differs', { ...ref(id, course), appxFolderId: pid, appx: folderName(pid), ours: ourMain });
      const exams = examNames(d.exam_name || liveById.get(id)?.exam_name).filter((e) => key(e) !== HOME_PAGE);
      const ourCat = categoryName.get(String(course.category)) || '';
      add(S11, !exams.length ? (ourCat ? 'info: AppX names no exam' : 'ok: none on either side') : exams.some((e) => key(e) === key(ourCat)) ? (exams.length > 1 ? 'ok: one of several AppX exams' : 'ok: same') : key(ourCat) === 'all courses' ? 'ours import default' : 'differs', { ...ref(id, course), appx: exams.join(' | '), homePage: examNames(d.exam_name).some((e) => key(e) === HOME_PAGE), ours: ourCat });
    }

    // 15. Tags: any tag-, badge- or label-like AppX course field vs Course.tags.
    const S15 = section('tags', 'Tags', 'AppX course fields that look like tags or badges, and Course.tags. AppX content rows carry no tag field in the mirror.');
    const TAGLIKE = /tag|badge|label|featured/i; // featured_discounts (coupon ids) and price_kicker are not tags
    const tagFields = {};
    for (const d of mirrorDocs) for (const [k, v] of Object.entries(d.detail || {})) if (TAGLIKE.test(k) && !/token|jsonld|discount/i.test(k) && str(v) && num(v) !== 0 && str(v) !== '-1') bump(tagFields, k);
    report.items.tags.note += ` Filled AppX fields: ${JSON.stringify(tagFields)}.`;
    for (const [id] of liveById) {
      const course = courseByApx.get(id); if (!course) continue;
      const d = mirrorById.get(id)?.detail || {};
      const appx = Object.keys(tagFields).map((k) => (str(d[k]) && num(d[k]) !== 0 && str(d[k]) !== '-1' ? `${k}=${noUrls(str(d[k])).slice(0, 40)}` : '')).filter(Boolean);
      const ours = (course.tags || []).map(str).filter(Boolean);
      add(S15, !appx.length && !ours.length ? 'ok: none on either side' : !ours.length ? 'ours blank' : !appx.length ? 'ours only' : 'check by hand', { ...ref(id, course), appx: appx.join(' | '), ours: ours.join(', ') });
    }

    // 7. Daily sync: the last 14 nightly runs and how fresh each course's capture is.
    const S7 = section('dailySync', 'Daily Sync', 'Last 14 nightly runs (apxnightlysyncruns) with each step\'s state, then courses whose last done capture is older than the newest done run.');
    const runs = await db.collection('apxnightlysyncruns').find({ customerId: CUSTOMER }).sort({ startedAt: -1 }).limit(14).toArray();
    for (const r of runs) {
      const steps = Object.entries(r.steps || {}).map(([k, v]) => `${k}:${v?.state || '?'}`).join(' ');
      add(S7, r.state === 'done' ? 'ok: done' : String(r.state), { run: String(r._id), startedAt: r.startedAt?.toISOString?.() || '', finishedAt: r.finishedAt?.toISOString?.() || '', steps, failures: (r.failures || []).length, firstFailure: noUrls((r.failures || [])[0]?.message || '').slice(0, 200) });
    }
    const newestCapture = runs.find((r) => r.steps?.capture?.state === 'done' || r.state === 'done' || r.state === 'done-with-failures');
    for (const [id] of liveById) {
      const run = str(mirrorById.get(id)?.capture?.runId);
      if (newestCapture && run && run !== String(newestCapture._id) && mirrorById.get(id)?.capture?.status === 'done') add(S7, 'stale capture: course not captured in the newest run', { ...ref(id, courseByApx.get(id)), run });
      if (!planById.has(id)) add(S7, 'no done capture', { ...ref(id, courseByApx.get(id)), run });
    }

    const order = ['courses', 'classes', 'ebooks', 'classNotes', 'subCourses', 'prices', 'dailySync', 'validity', 'faculty', 'facultyClass', 'mainCategory', 'category', 'section', 'topic', 'subTopic', 'taxonomyCounts', 'tags'];
    report.items = Object.fromEntries(order.map((k) => [k, report.items[k]]));
    for (const [k, sec] of Object.entries(report.items)) {
      console.log(`\n== ${sec.title} (${k})`);
      for (const [o, n] of Object.entries(sec.totals).sort((a, b) => b[1] - a[1])) console.log(' ', n, o);
    }
    fs.writeFileSync(OUT, JSON.stringify(report));
    fs.chmodSync(OUT, 0o600);
    console.log('\nReport written:', OUT, `(${(fs.statSync(OUT).size / 1e6).toFixed(1)} MB)`);
  } finally { await mongoose.disconnect(); }
})().catch((e) => { console.error(noUrls(e.stack || e.message)); process.exitCode = 1; });
