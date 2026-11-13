// Read-only, refuses any DB but vidyagramdb: buyer impact of the classes the launch match found without a video.
// The caller prepends GAPS = [[apxCourseId, rowId, outcome, kind]] and TOT = {apxCourseId: [ourCourseId, classes, title, appxStatus]}
// built from the launch-match JSON. Prints JSON lines, aggregate only, no student ids.
require('dotenv').config({ path: '.env.development', quiet: true });
const mongoose = require('mongoose');
const noUrl = (s) => String(s ?? '').replace(/https?:\/\/\S+/g, '[url]').replace(/[0-9a-f]{16,}/gi, '[id]').slice(0, 90);
(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: 'vidyagramdb', readPreference: 'secondaryPreferred', autoIndex: false, autoCreate: false });
  const db = mongoose.connection.db; if (db.databaseName !== 'vidyagramdb') throw new Error('wrong db');
  const led = await db.collection('apxcatalogimports').find({ customerId: '781' }, { projection: { classId: 1, sourceCourseId: 1, sourceRowId: 1, 'placements.apxCourseId': 1, 'placements.rowId': 1 } }).toArray();
  const byRow = new Map(); for (const l of led) for (const p of [{ apxCourseId: l.sourceCourseId, rowId: l.sourceRowId }, ...(l.placements || [])]) if (p.apxCourseId && p.rowId) byRow.set(`${p.apxCourseId}|${p.rowId}`, l);
  const classIds = new Map();
  for (const [c, row, outcome, kind] of GAPS) { const l = byRow.get(`${c}|${row}`); const id = l?.classId ? String(l.classId) : `none:${c}:${row}`; if (!classIds.has(id)) classIds.set(id, { outcome, kind, courses: new Set() }); classIds.get(id).courses.add(c); }
  const oids = [...classIds.keys()].filter((k) => !k.startsWith('none')).map((k) => new mongoose.Types.ObjectId(k));
  const cls = new Map((await db.collection('classes').find({ _id: { $in: oids } }).toArray()).map((c) => [String(c._id), c]));
  const jobs = new Map((await db.collection('apxingestjobs').find({ classId: { $in: oids } }).toArray()).map((j) => [String(j.classId), j]));
  const out = { distinctClasses: classIds.size, byOutcome: {}, classStatus: {}, views: { withViews: 0, totalViews: 0 }, jobReasons: {}, mp4Fields: {} };
  let sampleJobKeys = null; let sampleClsKeys = null;
  for (const [id, v] of classIds) {
    out.byOutcome[v.outcome] = (out.byOutcome[v.outcome] || 0) + 1;
    const c = cls.get(id); if (!c) continue;
    out.classStatus[`status ${c.status}`] = (out.classStatus[`status ${c.status}`] || 0) + 1;
    if ((c.viewCount || 0) > 0) { out.views.withViews += 1; out.views.totalViews += c.viewCount; }
    const j = jobs.get(id);
    if (j) { sampleJobKeys = sampleJobKeys || Object.keys(j); const reason = noUrl(j.lastError || j.error || j.deadReason || j.failureReason || j.reason || (j.errors || []).slice(-1)[0]?.message || 'no reason field'); const k = `${j.status}: ${reason}`; out.jobReasons[k] = (out.jobReasons[k] || 0) + 1; }
    if (v.outcome.includes('MP4')) { sampleClsKeys = sampleClsKeys || Object.keys(c); for (const f of Object.keys(c)) if (/url|link|video|mp4|hls|stream|record/i.test(f) && c[f] && (!Array.isArray(c[f]) || c[f].length)) out.mp4Fields[f] = (out.mp4Fields[f] || 0) + 1; }
  }
  out.sampleJobKeys = sampleJobKeys; out.sampleMp4ClassKeys = sampleClsKeys;
  console.log(JSON.stringify(out));
  const hosts = {};
  const rowDocs = await db.collection('apxcatalogrows').find({ customerId: '781', rowId: { $in: [...new Set(GAPS.filter((g) => g[2].includes('MP4')).map((g) => String(g[1])))] } }, { projection: { rowId: 1, 'raw.link': 1, 'raw.live_link': 1, 'raw.type': 1, 'raw.status': 1, hiddenReason: 1 } }).toArray();
  for (const d of rowDocs) { let h = 'none'; try { h = new URL(String(d.raw?.link || d.raw?.live_link)).host; } catch {} const k = `${h} | type ${d.raw?.type} | status ${d.raw?.status} | hidden ${d.hiddenReason}`; hosts[k] = (hosts[k] || 0) + 1; }
  console.log(JSON.stringify({ mp4RowDocs: rowDocs.length, hosts }));
  const plans = await db.collection('plans').find({}, { projection: { course: 1 } }).toArray();
  const now = new Date(); const allUsers = new Set(); const validUsers = new Set();
  const s = await db.collection('orders').findOne({ orderStatus: 'success' }, { projection: { duration: 1, daysLeft: 1, orderDate: 1, status: 1, courseId: 1, planId: 1, createdAt: 1 } });
  console.log(JSON.stringify({ orderSampleTypes: Object.fromEntries(Object.entries(s).map(([k, v]) => [k, Array.isArray(v) ? `array(${v.length}) of ${typeof v[0] === 'object' ? 'oid' : typeof v[0]}` : v instanceof Date ? 'date' : v && typeof v === 'object' ? 'oid' : `${typeof v}:${String(v).slice(0, 12)}`])) }));
  for (const [apx, t] of Object.entries(TOT)) {
    const gap = GAPS.filter((g) => g[0] === apx).length; if (!gap) continue;
    const ids = [new mongoose.Types.ObjectId(t[0]), t[0]];
    const pids = plans.filter((p) => (p.course || []).some((x) => String(x) === t[0])).flatMap((p) => [p._id, String(p._id)]);
    let res;
    try {
      res = await db.collection('orders').aggregate([
        { $match: { orderStatus: 'success', $or: [{ courseId: { $in: ids } }, { latestCourseId: { $in: ids } }, { planId: { $in: pids } }] } },
        { $addFields: { exp: { $dateAdd: { startDate: { $convert: { input: { $ifNull: ['$orderDate', '$createdAt'] }, to: 'date', onError: '$createdAt', onNull: '$createdAt' } }, unit: 'day', amount: { $convert: { input: '$duration', to: 'int', onError: 0, onNull: 0 } } } } } },
        { $group: { _id: '$userId', exp: { $max: '$exp' } } },
      ], { maxTimeMS: 180000, allowDiskUse: true }).toArray();
    } catch (e) { console.log(JSON.stringify({ apx, error: e.message.slice(0, 80) })); continue; }
    let valid = 0; for (const u of res) { allUsers.add(String(u._id)); if (u.exp && u.exp > now) { valid += 1; validUsers.add(String(u._id)); } }
    console.log(JSON.stringify({ apx, title: t[2], appx: t[3], classes: t[1], noVideo: gap, buyers: res.length, buyersAccessValid: valid }));
  }
  console.log(JSON.stringify({ distinctBuyersAcrossAffected: allUsers.size, distinctWithValidAccess: validUsers.size }));
  await mongoose.disconnect();
})().catch((e) => { console.error(String(e.message).slice(0, 300)); process.exitCode = 1; });
