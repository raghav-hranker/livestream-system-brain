// Read-only, vidyagramdb only: how many videos are without a playable copy here BEYOND the launch-match gap list.
// Caller prepends KNOWN (class ids already listed) and KNOWN_ROWS ("course|row" of the linkless rows already listed).
// 1. every Class with no video, by ledger kind, job state, whether students can reach it, and whether it is already known
// 2. ingest jobs by status and error family
// 3. AppX VIDEO rows in the mirror that never became a Class, by why (link shape, hidden reason, course state)
// Aggregate counts plus short title samples; no URLs. Run from the nightly checkout on test-uday: node - < script
require('dotenv').config({ path: '.env.development', quiet: true });
const mongoose = require('mongoose');
const bump = (m, k, n = 1) => { m[k] = (m[k] || 0) + n; return m; };
const fam = (e) => { const s = String(e || ''); return !s ? 'none' : /no playable URL/i.test(s) ? 'AppX answered with its own player (read as no playable URL)' : /404/.test(s) ? 'source 404' : /Retry held/i.test(s) ? 'segment gap' : s.replace(/https?:\/\/\S+/g, '[url]').slice(0, 50); };
const shape = (raw) => { const l = String(raw?.link || ''); const v = String(raw?.live_link || ''); const one = (s) => !s ? 'empty' : /youtu/i.test(s) ? 'youtube' : /\.m3u8/i.test(s) ? (/(^|[/-])pull-/i.test(s) ? 'live-pull m3u8' : 'm3u8') : /\.mp4/i.test(s) ? 'mp4' : 'other'; return `link ${one(l)} / live_link ${one(v)}`; };
(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: 'vidyagramdb', readPreference: 'secondaryPreferred', autoIndex: false, autoCreate: false });
  const db = mongoose.connection.db; if (db.databaseName !== 'vidyagramdb') throw new Error('wrong db');
  const known = new Set(KNOWN); const knownRows = new Set(KNOWN_ROWS);
  const courses = new Map((await db.collection('courses').find({}, { projection: { apxCourseId: 1, status: 1, title: 1 } }).toArray()).map((c) => [String(c._id), c]));
  const courseByApx = new Map([...courses.values()].filter((c) => c.apxCourseId).map((c) => [String(c.apxCourseId), c]));
  const placed = new Map(); // class -> {active placements, in active course}
  for (const p of await db.collection('courseclasses').find({}, { projection: { course: 1, class: 1, isActive: 1, status: 1 } }).toArray()) { const k = String(p.class); const v = placed.get(k) || { n: 0, live: 0, apx: [] }; if (p.isActive !== false) { v.n += 1; const c = courses.get(String(p.course)); if (c?.status === 1) v.live += 1; if (c?.apxCourseId) v.apx.push(String(c.apxCourseId)); } placed.set(k, v); }
  const ledger = await db.collection('apxcatalogimports').find({ customerId: '781' }, { projection: { classId: 1, kind: 1, sourceCourseId: 1, sourceRowId: 1, 'placements.apxCourseId': 1, 'placements.rowId': 1, 'placements.active': 1 } }).toArray();
  const ledByClass = new Map(ledger.map((l) => [String(l.classId), l]));
  const ledRows = new Set(); for (const l of ledger) for (const p of [{ apxCourseId: l.sourceCourseId, rowId: l.sourceRowId }, ...(l.placements || [])]) ledRows.add(`${p.apxCourseId}|${p.rowId}`);
  const jobs = await db.collection('apxingestjobs').find({}, { projection: { classId: 1, status: 1, error: 1, attempts: 1, updatedAt: 1 } }).toArray();
  const jobByClass = new Map(jobs.map((j) => [String(j.classId), j]));
  const classes = await db.collection('classes').find({}, { projection: { title: 1, status: 1, hlsAsset: 1, isYoutubeRedirect: 1, isLive: 1, streamStatus: 1, apxAssetKey: 1, createdAt: 1, mp4Recordings: 1 } }).toArray();
  // 1
  const A = { total: classes.length, withVideo: 0, noVideo: 0, groups: {}, unknownSamples: {} };
  for (const c of classes) {
    if (c.hlsAsset || c.isYoutubeRedirect) { A.withVideo += 1; continue; }
    A.noVideo += 1;
    const id = String(c._id); const l = ledByClass.get(id); const j = jobByClass.get(id); const pl = placed.get(id) || { n: 0, live: 0, apx: [] };
    const reach = c.status !== 1 ? 'class switched off' : pl.live ? 'in a course on sale' : pl.n ? 'in off-sale courses only (buyers still see it)' : 'in no course';
    const kind = !c.apxAssetKey ? `made here (${c.isLive ? 'live class' : 'not live'}, stream ${c.streamStatus || 'none'})` : !l ? 'AppX class, no ledger row' : l.kind === 'mp4-pending' ? 'AppX MP4 never copied' : l.kind === 'ingest' ? `AppX import: job ${j ? j.status : 'none'} (${fam(j?.error)})` : `AppX ${l.kind}`;
    const k = `${known.has(id) ? 'KNOWN' : 'NEW'} | ${kind} | ${reach}`;
    bump(A.groups, k);
    if (!known.has(id)) { (A.unknownSamples[k] = A.unknownSamples[k] || []); if (A.unknownSamples[k].length < 6) A.unknownSamples[k].push(`${String(c.title).slice(0, 40)} [${[...new Set(pl.apx)].slice(0, 5).join(',')}]`); }
  }
  console.log(JSON.stringify({ t: 'classes', ...A }));
  // 2
  const J = {}; for (const j of jobs) bump(J, `${j.status} | ${j.status === 'done' ? '' : fam(j.error)} | ${known.has(String(j.classId)) ? 'known' : 'NEW'}`);
  console.log(JSON.stringify({ t: 'jobs', total: jobs.length, J }));
  // 3
  const R = { videoRows: 0, inLedger: 0, never: {}, neverSamples: {}, neverByCourse: {} };
  const cur = db.collection('apxcatalogrows').find({ customerId: '781' }, { projection: { rowId: 1, apxCourseId: 1, hiddenReason: 1, lastSeenRunId: 1, 'raw.type': 1, 'raw.status': 1, 'raw.link': 1, 'raw.live_link': 1, 'raw.title': 1, 'raw.live_status': 1 } });
  for await (const d of cur) {
    if (String(d.raw?.type).toUpperCase() !== 'VIDEO') continue;
    R.videoRows += 1;
    const key = `${d.apxCourseId}|${d.rowId}`;
    if (ledRows.has(key)) { R.inLedger += 1; continue; }
    const c = courseByApx.get(String(d.apxCourseId));
    const stale = d.lastSeenRunId !== 'daily-2026-11-12' ? 'not in today\'s AppX list' : 'in today\'s AppX list';
    const k = `${knownRows.has(key) ? 'KNOWN' : 'NEW'} | ${stale} | hidden: ${d.hiddenReason || 'no'} | ${shape(d.raw)} | course ${!c ? 'has no course here' : c.status === 1 ? 'on sale' : 'off sale'}`;
    bump(R.never, k); bump(R.neverByCourse, `${d.apxCourseId}`);
    (R.neverSamples[k] = R.neverSamples[k] || []); if (R.neverSamples[k].length < 5) R.neverSamples[k].push(`${String(d.raw?.title).slice(0, 36)} [${d.apxCourseId}:${d.rowId}]`);
  }
  R.neverByCourse = Object.fromEntries(Object.entries(R.neverByCourse).sort((a, b) => b[1] - a[1]).slice(0, 25));
  console.log(JSON.stringify({ t: 'rows', ...R }));
  const one = await db.collection('apxcatalogrows').find({ customerId: '781', rowId: { $in: ['176079', '176077', '177702', '178574'] } }, { projection: { rowId: 1, apxCourseId: 1, hiddenReason: 1, lastSeenRunId: 1 } }).toArray();
  console.log(JSON.stringify({ t: 'userRows', rows: one.map((d) => `${d.apxCourseId}:${d.rowId} hidden ${d.hiddenReason} seen ${d.lastSeenRunId} ledger ${ledRows.has(`${d.apxCourseId}|${d.rowId}`)}`) }));
  await mongoose.disconnect();
})().catch((e) => { console.error(String(e.message).slice(0, 300)); process.exitCode = 1; });
