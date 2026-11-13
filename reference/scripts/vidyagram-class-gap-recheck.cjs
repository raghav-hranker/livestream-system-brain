// Read-only on the DB (refuses any DB but vidyagramdb) and on AppX: re-checks the classes the launch match found with no
// video. The caller prepends GAPS = [[apxCourseId, rowId, outcome, title, path]] from the launch-match JSON.
//  - MP4 never copied: prints each distinct class with every course/row it sits in (for sampling in the AppX dashboard).
//  - dead ingest jobs: mints a fresh AppX video token per job (1.3 s apart, stops on the first non-2xx), then reads the
//    master playlist, one media playlist and its first and last segment (first 1 KB each). A known-good control class is
//    minted first and last; if a control fails the run's answers are not trusted.
//  - rows with no usable link: says whether today's captured student-tree row carries any link field.
// Prints JSON lines. No URL, token or cookie is printed or stored. Run from the nightly checkout on test-uday: node - < script
require('dotenv').config({ path: '.env.development', quiet: true });
require('ts-node/register/transpile-only');
const mongoose = require('mongoose');
const axios = require('axios');
const root = process.cwd() + '/src/services/apx/';
const { regenerateSessionLink } = require(root + 'apxVideoTokenService');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clean = (s) => String(s ?? '').replace(/https?:\/\/\S+/g, '[url]').slice(0, 110);
const H = { Referer: 'https://appx-play.akamai.net.in/', Origin: 'https://appx-play.akamai.net.in' };
const get = (u, extra = {}) => axios.get(u, { timeout: 20000, maxRedirects: 2, validateStatus: () => true, responseType: 'text', maxContentLength: 4194304, headers: { ...H, ...extra } });
async function media(url) {
  const out = {};
  let m = await get(url); out.master = m.status;
  if (m.status !== 200 || !String(m.data).startsWith('#EXTM3U')) { if (m.status === 200) out.kind = /\.mp4(\?|$)/i.test(url) ? 'mp4' : 'not a playlist'; return out; }
  let u = url; let text = String(m.data);
  if (text.includes('#EXT-X-STREAM-INF')) { const lines = text.split(/\r?\n/); const rel = lines.filter((x) => x.trim() && !x.startsWith('#'))[0]; out.variants = lines.filter((x) => x.startsWith('#EXT-X-STREAM-INF')).length; u = new URL(rel, url).href; m = await get(u); out.mediaPlaylist = m.status; if (m.status !== 200) return out; text = String(m.data); }
  const segs = text.split(/\r?\n/).map((x) => x.trim()).filter((x) => x && !x.startsWith('#'));
  out.segments = segs.length; out.endList = text.includes('#EXT-X-ENDLIST');
  out.sample = [];
  for (const i of [...new Set([0, segs.length - 1])].filter((i) => i >= 0)) { const s = await axios.get(new URL(segs[i], u).href, { timeout: 20000, validateStatus: () => true, responseType: 'arraybuffer', headers: { ...H, Range: 'bytes=0-1023' } }); out.sample.push(s.status); }
  out.playable = out.segments > 0 && out.sample.every((s) => s === 200 || s === 206);
  return out;
}
(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: 'vidyagramdb', readPreference: 'secondaryPreferred', autoIndex: false, autoCreate: false });
  const db = mongoose.connection.db; if (db.databaseName !== 'vidyagramdb') throw new Error('wrong db');
  const led = await db.collection('apxcatalogimports').find({ customerId: '781' }, { projection: { classId: 1, sourceCourseId: 1, sourceRowId: 1, 'placements.apxCourseId': 1, 'placements.rowId': 1 } }).toArray();
  const byRow = new Map(); for (const l of led) for (const p of [{ apxCourseId: l.sourceCourseId, rowId: l.sourceRowId }, ...(l.placements || [])]) if (p.apxCourseId && p.rowId) byRow.set(`${p.apxCourseId}|${p.rowId}`, l);
  const groups = new Map();
  for (const [c, row, outcome, title, path] of GAPS) { const l = byRow.get(`${c}|${row}`); const id = l?.classId ? String(l.classId) : `none:${c}:${row}`; if (!groups.has(id)) groups.set(id, { outcome, title, places: [] }); groups.get(id).places.push({ c, row, path }); }
  const oids = [...groups.keys()].filter((k) => !k.startsWith('none')).map((k) => new mongoose.Types.ObjectId(k));
  const cls = new Map((await db.collection('classes').find({ _id: { $in: oids } }, { projection: { title: 1, duration: 1 } }).toArray()).map((c) => [String(c._id), c]));
  const jobs = new Map((await db.collection('apxingestjobs').find({ classId: { $in: oids } }).toArray()).map((j) => [String(j.classId), j]));
  // 1. MP4 list
  const rowIds = [...new Set(GAPS.filter((g) => g[2].includes('MP4')).map((g) => String(g[1])))];
  const rawRows = new Map((await db.collection('apxcatalogrows').find({ customerId: '781', rowId: { $in: rowIds } }, { projection: { rowId: 1, apxCourseId: 1, 'raw.link': 1, 'raw.live_link': 1, 'raw.duration': 1, 'raw.created_at': 1, 'raw.date_and_time': 1 } }).toArray()).map((d) => [`${d.apxCourseId}|${d.rowId}`, d]));
  for (const [id, g] of groups) if (g.outcome.includes('MP4')) {
    const first = rawRows.get(`${g.places[0].c}|${g.places[0].row}`); let host = ''; let file = '';
    try { const u = new URL(String(first?.raw?.link || first?.raw?.live_link)); host = u.host; file = decodeURIComponent(u.pathname.split('/').pop()).slice(0, 80); } catch {}
    console.log(JSON.stringify({ t: 'mp4', classId: id, ourTitle: cls.get(id)?.title || '', appxTitle: g.title, host, file, places: g.places }));
  }
  // 3. linkless rows: what today's student tree carries
  const linkless = [...groups.values()].filter((g) => g.outcome.includes('no usable link'));
  for (const g of linkless) for (const p of g.places) {
    const page = await db.collection('apxcatalogtree').aggregate([{ $match: { customerId: '781', apxCourseId: p.c, lastSeenRunId: 'daily-2026-11-12' } }, { $unwind: '$rows' }, { $match: { 'rows.id': { $in: [p.row, Number(p.row), String(p.row)] } } }, { $limit: 1 }, { $project: { _id: 0, rows: 1 } }]).toArray();
    const row = page[0]?.rows; const has = {};
    if (row) for (const f of ['file_link', 'video_player_url', 'video_player_lower_url', 'download_link', 'download_url_higher_version', 'embed_url', 'recording_hls', 'video_id', 'encrypted_links', 'links', 'download_links', 'livestream_links', 'webdrm_links', 'media_id']) { const v = row[f]; if (v && String(v) !== '-1' && String(v) !== '0' && String(v) !== '[]' && (!Array.isArray(v) || v.length)) { let h = 'set'; try { h = new URL(String(Array.isArray(v) ? v[0]?.path || v[0] : v)).host; } catch {} has[f] = h; } }
    console.log(JSON.stringify({ t: 'linkless', title: g.title, c: p.c, row: p.row, path: p.path, inTodaysTree: Boolean(row), liveStatus: row?.live_status, ytFlag: row?.ytFlag, fields: has }));
  }
  // 2. dead jobs: fresh token + media check
  const control = await db.collection('apxingestjobs').find({ status: 'done' }).sort({ updatedAt: -1 }).limit(1).next();
  const mint = async (j) => { try { return { url: await regenerateSessionLink({ course_id: j.course_id, video_id: j.video_id, video_url: j.video_url }, '781') }; } catch (e) { return { error: clean(e.message) }; } };
  const c1 = await mint(control); console.log(JSON.stringify({ t: 'control-before', ok: Boolean(c1.url), error: c1.error }));
  if (!c1.url) throw new Error('control mint failed; stopping before any check');
  let n = 0;
  for (const [id, g] of groups) {
    if (!g.outcome.includes('ingest dead')) continue;
    const j = jobs.get(id); if (!j) { console.log(JSON.stringify({ t: 'dead', classId: id, title: g.title, result: 'no job' })); continue; }
    await sleep(1300); n += 1;
    const tk = await mint(j);
    if (tk.error && /HTTP (3|4|5)\d\d/.test(tk.error)) { console.log(JSON.stringify({ t: 'stop', after: n, error: tk.error })); break; }
    let m = null; if (tk.url) { try { m = await media(tk.url); } catch (e) { m = { error: clean(e.message) }; } }
    console.log(JSON.stringify({ t: 'dead', classId: id, job: String(j._id), title: g.title, courses: g.places.map((p) => p.c).join(','), oldError: clean(j.error), attempts: j.attempts, jobCourse: j.course_id, token: tk.url ? 'minted' : tk.error, media: m }));
  }
  await sleep(1300); const c2 = await mint(control); console.log(JSON.stringify({ t: 'control-after', ok: Boolean(c2.url), error: c2.error }));
  await mongoose.disconnect();
})().catch((e) => { console.error(clean(e.message)); process.exitCode = 1; });
