// Vidyagram: import AppX video rows the class import skipped as "no usable link" although AppX's player endpoint
// returns a normal stream list for them. **Writes only with COMMIT=1** (dry run default); refuses any DB but vidyagramdb.
// The caller prepends ROWS = [[apxCourseId, rowId]]. For each row it mints a token, takes the stream's stable address
// (query string dropped) as the link, and derives the usual asset key from it. Then, per asset, exactly as the class
// import does: an asset that already has a Class only gains the new course placements in the ledger; a new asset gets
// a Class (holding taxonomy, AppX thumbnail), one ingest job and a ledger row. Course placement itself is left to the
// course import (nightly, or apxCatalogImportCourses for the courses). Prints one JSON line per asset; no URL printed.
// Run from the nightly checkout on test-uday: [COMMIT=1] node - < script
require('dotenv').config({ path: '.env.development', quiet: true });
require('ts-node/register/transpile-only');
const mongoose = require('mongoose');
const axios = require('axios');
const root = process.cwd() + '/src/services/apx/';
const { loadMirrorCourses } = require(root + 'apxCatalogMirrorReader');
const { planCatalogue } = require(root + 'apxCatalogPlanner');
const { planClassImport } = require(root + 'apxCatalogClassImport');
const { ensureImportTaxonomy, loadForeignClassTitles, IMPORT_LEDGER } = require(root + 'apxCatalogClassCommit');
const { deriveApxAssetKey } = require(root + 'apxAssetKey');
const { findOrCreateClassByAssetKey } = require(root + 'apxPortingService');
const { enqueueIngestJobForClass } = require(root + 'apxIngestService');
const Class = require(process.cwd() + '/src/models/Class').default;
const ApxIngestJob = require(process.cwd() + '/src/models/ApxIngestJob').default;
const CUSTOMER = '781'; const RUN = 'manual-linkless-2026-11-12'; const COMMIT = process.env.COMMIT === '1';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clean = (s) => String(s ?? '').replace(/https?:\/\/\S+/g, '[url]').slice(0, 160);
(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: 'vidyagramdb', readPreference: 'primary', autoIndex: false, autoCreate: false });
  const db = mongoose.connection.db; if (db.databaseName !== 'vidyagramdb') throw new Error('wrong db');
  const sess = await db.collection('apxsessions').findOne({ customerId: CUSTOMER, isActive: { $ne: false } }, { projection: { session_id: 1 } });
  const mint = async (course, row, video_url) => {
    await sleep(1300);
    const form = new URLSearchParams({ course_id: course, video_id: row, ytflag: '1', folder_wise_course: '1', recaptcha_token: '', video_url, uhsVersion: '0.00' });
    const r = await axios.post('https://cms.appx.co.in/common/get_video_token', form.toString(), { timeout: 15000, validateStatus: () => true, maxRedirects: 0, headers: { Accept: 'application/json, */*; q=0.01', 'Cache-Control': 'no-cache', 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', Cookie: `apx-aside-collapse=1; ci_session=${sess.session_id}`, Referer: 'https://cms.appx.co.in/', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36', 'X-Requested-With': 'XMLHttpRequest' } });
    if (r.status >= 300) throw new Error(`get_video_token HTTP ${r.status}`);
    return Array.isArray(r.data?.urls) ? r.data.urls.filter((u) => u && u.path) : [];
  };
  // 1. link + asset key per row
  const want = new Map(); // "course|row" -> { link, key }
  for (const [course, row] of ROWS) {
    const urls = await mint(course, row, '');
    const best = urls.find((u) => String(u.quality).toLowerCase() === '720p') || urls[0];
    if (!best) { console.log(JSON.stringify({ t: 'skip', course, row, why: 'no stream list today' })); continue; }
    const link = String(best.path).split('?')[0];
    const key = deriveApxAssetKey(link);
    // the job mints with this link at claim time: prove AppX answers the same way when it is sent
    const again = await mint(course, row, link);
    if (!again.length) { console.log(JSON.stringify({ t: 'skip', course, row, why: 'no stream list when the link is sent back' })); continue; }
    want.set(`${course}|${row}`, { link, key, qualities: urls.map((u) => u.quality).join('/') });
  }
  // 2. the planner's own items for these rows (title, folder filing, order), re-keyed by the real asset
  const courseIds = [...new Set(ROWS.map((r) => r[0]))];
  const { inputs } = await loadMirrorCourses(db, { customerId: CUSTOMER, runId: null, courseIds });
  const { plans } = planCatalogue(inputs);
  const picked = plans.map((p) => ({ ...p, items: p.items.filter((i) => want.has(`${p.course.apxCourseId}|${i.rowId}`)).map((i) => ({ ...i, assetKey: want.get(`${p.course.apxCourseId}|${i.rowId}`).key, noUsableLink: false })) }));
  const found = picked.reduce((n, p) => n + p.items.length, 0);
  const plan = planClassImport(picked, await loadForeignClassTitles(picked.flatMap((p) => p.items.map((i) => i.assetKey))));
  console.log(JSON.stringify({ t: 'plan', rows: ROWS.length, withStream: want.size, plannerItems: found, assets: plan.units.length, counts: plan.counts, commit: COMMIT }));
  const ledger = db.collection(IMPORT_LEDGER);
  const taxonomyIds = COMMIT ? await ensureImportTaxonomy() : null;
  const sum = { placedOnExistingClass: 0, existingClassHasVideo: 0, classesCreated: 0, jobsQueued: 0, ledgerRowsWritten: 0, placementsAdded: 0, failed: 0 };
  for (const unit of plan.units) {
    const out = { t: 'asset', title: unit.title, action: unit.action, active: unit.active, keyKind: unit.assetKey.split(':')[0], placements: unit.placements.map((p) => `${p.apxCourseId}:${p.rowId}`).join(' ') };
    try {
      if (unit.action !== 'ingest') { out.result = `not handled: planner action ${unit.action}`; console.log(JSON.stringify(out)); continue; }
      const existing = await Class.findOne({ apxAssetKey: unit.assetKey }).select('_id title hlsAsset status').lean();
      const led = await ledger.findOne({ customerId: CUSTOMER, assetKey: unit.assetKey }, { projection: { placements: 1, classId: 1 } });
      out.existingClass = existing ? `${existing.title} | video ${Boolean(existing.hlsAsset)} | status ${existing.status}` : null;
      out.ledgerHas = led ? (led.placements || []).length : 0;
      const src = unit.source; const w = want.get(`${src.apxCourseId}|${src.rowId}`);
      const courseDoc = await db.collection('apxcatalogcourses').findOne({ customerId: CUSTOMER, apxCourseId: src.apxCourseId }, { projection: { _id: 1 } });
      const pairOwner = await ApxIngestJob.findOne({ apxCourseId: courseDoc._id, apxClassId: src.rowId }).select('classId').lean();
      if (pairOwner && String(pairOwner.classId) !== String(existing?._id ?? '')) throw new Error('another job already owns this course/row pair');
      let classId = existing?._id; let ingestJobId = null;
      const existingJob = existing ? await ApxIngestJob.findOne({ classId: existing._id }).select('_id status').lean() : null;
      out.plan = existing ? (existingJob || existing.hlsAsset ? 'add placements to the existing class' : 'existing class without job: queue a job + add placements') : 'create class + job + ledger row';
      if (COMMIT) {
        if (!existing) {
          const raw = (await db.collection('apxcatalogrows').findOne({ customerId: CUSTOMER, apxCourseId: src.apxCourseId, rowId: src.rowId }, { projection: { 'raw.image': 1, 'raw.suggested_thumbnail': 1 } }))?.raw || {};
          ({ classId } = await findOrCreateClassByAssetKey({ id: src.rowId, title: unit.title, image: raw.image, suggested_thumbnail: raw.suggested_thumbnail }, unit.assetKey, { ...taxonomyIds, topic: null, teacherName: unit.teacherName }, { isYoutube: false, link: '' }, { status: unit.active ? 1 : 0, log: () => {}, portThumbnail: true }));
          sum.classesCreated += 1;
        } else { sum.placedOnExistingClass += 1; if (existing.hlsAsset) sum.existingClassHasVideo += 1; }
        if (existingJob) ingestJobId = existingJob._id;
        else if (!existing || !existing.hlsAsset) { const q = await enqueueIngestJobForClass(classId, { apxCourseId: courseDoc._id, apxClassId: src.rowId, course_id: src.apxCourseId, video_id: src.rowId, video_url: w.link }); ingestJobId = q?._id ?? null; sum.jobsQueued += 1; }
        const placements = unit.placements.map((p) => ({ ...p }));
        const res = await ledger.updateOne({ customerId: CUSTOMER, assetKey: unit.assetKey }, { $setOnInsert: { classId, kind: 'ingest', ingestJobId, runId: RUN, sourceCourseId: src.apxCourseId, sourceRowId: src.rowId, titleRule: unit.titleRule, placements, createdAt: new Date() } }, { upsert: true });
        if (res.upsertedCount) sum.ledgerRowsWritten += 1;
        else { const have = new Set((led?.placements ?? []).map((p) => `${p.apxCourseId}/${p.rowId}`)); const fresh = placements.filter((p) => !have.has(`${p.apxCourseId}/${p.rowId}`)); if (fresh.length) { await ledger.updateOne({ customerId: CUSTOMER, assetKey: unit.assetKey }, { $push: { placements: { $each: fresh } } }); sum.placementsAdded += fresh.length; } }
        out.classId = String(classId); out.job = ingestJobId ? String(ingestJobId) : null; out.result = 'written';
      }
    } catch (e) { out.result = 'FAILED: ' + clean(e.message); sum.failed += 1; }
    console.log(JSON.stringify(out));
  }
  console.log(JSON.stringify({ t: 'summary', commit: COMMIT, ...sum }));
  await mongoose.disconnect();
})().catch((e) => { console.error(clean(e.message)); process.exitCode = 1; });
