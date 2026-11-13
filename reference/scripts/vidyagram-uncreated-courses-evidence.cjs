// Read-only, refuses any DB but vidyagramdb: per AppX course with no Course here, the evidence for why. Live AppX row, detail and
// content counts next to the last capture, the planner's header, the import ledgers, same-named Plans and purchases. Also lists the
// courses AppX files under each one (detail.parent_id). Prints no student data. COURSES=id,id narrows it; default is every live AppX
// course with no Course. Needs a live session. Run from the nightly checkout on test-uday:
//   nice -n 10 node --max-old-space-size=3072 - < vidyagram-uncreated-courses-evidence.cjs
require('dotenv').config({ path: '.env.development', quiet: true });
require('ts-node/register/transpile-only');
const mongoose = require('mongoose');
const root = process.cwd() + '/src/services/apx/';
const { createHttpCatalogSource } = require(root + 'apxCatalogHttpSource');
const { loadMirrorCourses } = require(root + 'apxCatalogMirrorReader');
const { planCatalogue } = require(root + 'apxCatalogPlanner');

const CUSTOMER = '781';
const bump = (m, k, n = 1) => { m[k] = (m[k] || 0) + n; return m; };
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const SAFE = /key|token|secret|signature|cookie|password|_button|button_|html|description/i;
const brief = (o) => Object.fromEntries(Object.entries(o || {})
  .filter(([k, v]) => !SAFE.test(k) && v !== null && v !== '' && typeof v !== 'object')
  .map(([k, v]) => [k, String(v).replace(/https?:\/\/\S+/g, '[url]').slice(0, 60)]));
const typeTally = (rows) => rows.reduce((m, r) => bump(m, `${String(r.type ?? '?').toUpperCase()} en=${r.enable} del=${r.deleted ?? 0}`), {});

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: 'vidyagramdb', readPreference: 'secondaryPreferred', autoIndex: false, autoCreate: false });
  try {
    const db = mongoose.connection.db;
    if (db.databaseName !== 'vidyagramdb') throw new Error('wrong db');
    const source = createHttpCatalogSource({ db, customerId: CUSTOMER, orgId: '2177599', tenantApiBase: 'https://armathsapi.akamai.net.in', gapMs: 1000, studentGapMs: 1000 });

    const live = [];
    for (let s = 0; ; s += 100) { const p = await source.courseListPage(s, 100); live.push(...p.rows); if (p.rows.length < 100) break; }
    const liveById = new Map(live.map((r) => [String(r.id), r]));
    const linked = new Set((await db.collection('courses').find({ apxCourseId: { $exists: true, $nin: [null, ''] } }, { projection: { apxCourseId: 1 } }).toArray()).map((c) => String(c.apxCourseId)));
    const targets = process.env.COURSES ? process.env.COURSES.split(',') : [...liveById.keys()].filter((k) => !linked.has(k));
    console.log(JSON.stringify({ liveTotal: live.length, targets }));

    const mirrorAll = await db.collection('apxcatalogcourses').find({ customerId: CUSTOMER }, { projection: { apxCourseId: 1, 'detail.parent_id': 1, 'listRow.title': 1, 'capture.runId': 1, 'capture.status': 1 } }).toArray();
    const childrenOf = {};
    for (const c of mirrorAll) { const p = String(c.detail?.parent_id ?? ''); if (p) (childrenOf[p] ||= []).push(`${c.apxCourseId}${linked.has(String(c.apxCourseId)) ? '' : '*'}`); }
    console.log(JSON.stringify({ parentIdValues: Object.fromEntries(Object.entries(childrenOf).map(([k, v]) => [k, v.length])) }));

    const seriesMirror = await db.collection('apxcatalogcourses').find({ customerId: CUSTOMER, 'detail.test_series_id': { $nin: [null, '', '0', 0, '-1', -1] } }, { projection: { apxCourseId: 1, 'detail.test_series_id': 1 } }).toArray();
    console.log(JSON.stringify({ coursesCarryingTestSeries: seriesMirror.map((c) => [c.apxCourseId, linked.has(String(c.apxCourseId)), c.detail.test_series_id]) }));
    const names = (await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name).filter((n) => /series|package|apx.*test/i.test(n));
    console.log(JSON.stringify({ seriesCollections: names }));
    for (const n of names) { const one = await db.collection(n).findOne({}); console.log(JSON.stringify({ coll: n, est: await db.collection(n).estimatedDocumentCount(), fields: Object.keys(one || {}).slice(0, 40).join(',') })); }
    const siblings = await db.collection('apxcatalogcourses').find({ customerId: CUSTOMER, 'detail.parent_id': { $in: ['57', '143', 57, 143] } }, { projection: { apxCourseId: 1, 'detail.parent_id': 1, 'listRow.title': 1 } }).toArray();
    console.log(JSON.stringify({ foldersOf57and143: siblings.map((c) => [c.detail.parent_id, c.apxCourseId, String(c.listRow?.title).trim(), linked.has(String(c.apxCourseId))]) }));

    const { inputs } = await loadMirrorCourses(db, { customerId: CUSTOMER, runId: null, courseIds: targets });
    const { plans } = planCatalogue(inputs);
    const planById = new Map(plans.map((p) => [String(p.course.apxCourseId), p]));

    for (const id of targets) {
      const row = liveById.get(id);
      const title = String(row?.title ?? '').trim();
      const out = { id, title };
      out.liveRow = brief(row);
      const detail = await source.courseDetail(id).catch((e) => ({ error: e.message }));
      out.liveDetailKeys = Object.keys(detail || {}).join(',');
      out.liveDetail = brief(detail);
      // contentPage answers an array, folderPathsPage { results, more }. A failed call stays visible as `error`, never as zero.
      out.liveContent = await source.contentPage(id, 0, 100)
        .then((rows) => ({ firstPageRows: rows.length, byType: typeTally(rows) }))
        .catch((e) => ({ error: String(e.message).slice(0, 80) }));
      out.liveFolders = await source.folderPathsPage(id, 0, 100)
        .then((p) => ({ rows: p.results.length, more: p.more, sample: p.results.slice(0, 6).map((f) => String(f.title ?? f.text ?? '').slice(0, 40)) }))
        .catch((e) => ({ error: String(e.message).slice(0, 80) }));
      out.liveTree = await source.folderContents(id, '-1')
        .then((r) => { const rows = Array.isArray(r) ? r : r?.rows ?? r?.data ?? []; return { rows: rows.length, types: rows.reduce((m, x) => bump(m, String(x.material_type ?? x.type ?? '?')), {}), sample: rows.slice(0, 6).map((x) => String(x.Title ?? x.title ?? '').slice(0, 40)) }; })
        .catch((e) => ({ error: String(e.message).slice(0, 80) }));
      out.bundleFields = Object.fromEntries(['vod_courses', 'test_series_id', 'allotment_id', 'book_id', 'pricing_plan_id', 'enable_pricing_plan', 'subscription_plan_id', 'show_content_tab', 'show_test_tab', 'view_in_web', 'allow_payment', 'app_category'].map((k) => [k, detail?.[k] ?? null]));

      const doc = await db.collection('apxcatalogcourses').findOne({ customerId: CUSTOMER, apxCourseId: id }, { projection: { capture: 1 } });
      const cap = doc?.capture || {};
      out.capture = { runId: cap.runId, status: cap.status, doneAt: cap.finishedAt ?? cap.doneAt ?? null, counts: cap.counts ?? null };
      const rows = await db.collection('apxcatalogrows').find({ customerId: CUSTOMER, apxCourseId: id }, { projection: { hiddenReason: 1, 'raw.type': 1, 'raw.enable': 1, 'raw.deleted': 1 } }).toArray();
      out.mirrorRows = { total: rows.length, byType: typeTally(rows.map((r) => r.raw || {})), hidden: rows.reduce((m, r) => bump(m, String(r.hiddenReason ?? 'visible').slice(0, 30)), {}) };

      const plan = planById.get(id);
      out.planner = plan ? { status: plan.course.status, enabled: plan.course.enabled, price: plan.course.price, sentinel: plan.course.priceSentinel, flags: plan.course.flags, counts: plan.counts, kinds: plan.items.reduce((m, i) => bump(m, i.kind), {}), excluded: plan.excluded.reduce((m, e) => bump(m, `${e.reason}${e.reason === 'unsupported type' ? ` ${e.type}` : ''}`), {}), items: plan.items.slice(0, 15).map((i) => `${i.kind}:${i.rowId}:${String(i.apxTitle).slice(0, 40)}`) } : null;

      out.classLedgerPlacements = await db.collection('apxcatalogimports').countDocuments({ customerId: CUSTOMER, 'placements.apxCourseId': id });
      out.pdfLedgerSources = await db.collection('apxcatalogpdfimports').countDocuments({ customerId: CUSTOMER, 'sources.apxCourseId': id });
      out.courseById = await db.collection('courses').countDocuments({ apxCourseId: { $in: [id, Number(id)] } });
      out.courseSameTitle = (await db.collection('courses').find({ title: { $regex: `^\\s*${esc(title)}\\s*$`, $options: 'i' } }, { projection: { apxCourseId: 1, status: 1 } }).toArray()).map((c) => ({ apx: c.apxCourseId ?? null, status: c.status }));
      out.filedUnder = String(detail?.parent_id ?? '');
      out.coursesFiledUnderThis = childrenOf[id] || [];

      const samePlans = await db.collection('plans').find({ $or: [{ name: { $regex: `^\\s*${esc(title)}\\s*$`, $options: 'i' } }, { title: { $regex: `^\\s*${esc(title)}\\s*$`, $options: 'i' } }] }, { projection: { name: 1, status: 1, isActive: 1, course: 1, price: 1, createdAt: 1 } }).toArray();
      out.samePlans = [];
      for (const p of samePlans) {
        const n = await db.collection('orders').countDocuments({ planId: { $in: [p._id, String(p._id)] }, orderStatus: 'success' }, { maxTimeMS: 60000 }).catch(() => 'timeout');
        const bundled = await db.collection('courses').find({ _id: { $in: (p.course || []).map((c) => { try { return new mongoose.Types.ObjectId(String(c)); } catch { return null; } }).filter(Boolean) } }, { projection: { apxCourseId: 1, title: 1 } }).toArray();
        out.samePlans.push({ planId: String(p._id), status: p.status, active: p.isActive, courses: (p.course || []).length, price: p.price, created: String(p.createdAt).slice(0, 15), successOrders: n, bundle: bundled.map((c) => `${c.apxCourseId ?? 'no id'}:${String(c.title).slice(0, 32)}`) });
      }

      const bought = await db.collection('apx_orders_new').aggregate([
        { $match: { item_id: { $in: [id, Number(id)] } } },
        { $group: { _id: { type: '$item_type', processed: { $eq: ['$processed', true] }, skip: '$processedSkipReason' }, n: { $sum: 1 } } },
      ], { maxTimeMS: 90000 }).toArray().catch((e) => [{ _id: { error: e.codeName || e.message }, n: 0 }]);
      out.appxPurchases = bought.map((b) => [b._id.type, b._id.processed ? 'processed' : 'unprocessed', b._id.skip ?? '', b.n]);
      console.log(JSON.stringify(out));
    }
  } finally { await mongoose.disconnect(); }
})().catch((e) => { console.error(String(e.stack || e.message).replace(/https?:\/\/\S+/g, '[url]')); process.exitCode = 1; });
