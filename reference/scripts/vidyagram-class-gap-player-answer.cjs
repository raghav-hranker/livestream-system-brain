// Read-only on the DB (vidyagramdb only) and on AppX: for class rows with no video here (dead import or "no usable
// link"), asks AppX's player endpoint what it would play and classifies the answer WITHOUT assuming urls[] is the only
// shape: 'urls' (normal HLS list), 'appxplayer' (key=appxplayer + UHS_url: AppX's own player, which the importer does not
// read), 'drm', or 'nothing'. Also range-reads the row's own link and live_link (first 1 KB) to see if a direct file
// answers. One distinct class is checked once (first row). Caller prepends GAPS = [[course,row,outcome,title]].
// Prints JSON lines; no URL, token or cookie. Run from the nightly checkout on test-uday: node - < script
require('dotenv').config({ path: '.env.development', quiet: true });
const mongoose = require('mongoose');
const axios = require('axios');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const host = (s) => { try { const u = new URL(String(s)); return u.host + (/\.(m3u8|mp4|mpd)/.exec(u.pathname)?.[0] || ''); } catch { return ''; } };
const H = { Referer: 'https://appx-play.akamai.net.in/', Origin: 'https://appx-play.akamai.net.in' };
const probe = async (u) => { if (!host(u)) return null; try { const r = await axios.get(u, { timeout: 15000, validateStatus: () => true, responseType: 'arraybuffer', headers: { ...H, Range: 'bytes=0-1023' } }); return `${host(u)} -> ${r.status}`; } catch (e) { return `${host(u)} -> error`; } };
(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: 'vidyagramdb', readPreference: 'secondaryPreferred', autoIndex: false, autoCreate: false });
  const db = mongoose.connection.db; if (db.databaseName !== 'vidyagramdb') throw new Error('wrong db');
  const sess = await db.collection('apxsessions').findOne({ customerId: '781', isActive: { $ne: false } }, { projection: { session_id: 1 } });
  const led = await db.collection('apxcatalogimports').find({ customerId: '781' }, { projection: { classId: 1, sourceCourseId: 1, sourceRowId: 1, 'placements.apxCourseId': 1, 'placements.rowId': 1 } }).toArray();
  const byRow = new Map(); for (const l of led) for (const p of [{ apxCourseId: l.sourceCourseId, rowId: l.sourceRowId }, ...(l.placements || [])]) if (p.apxCourseId && p.rowId) byRow.set(`${p.apxCourseId}|${p.rowId}`, String(l.classId));
  const seen = new Map();
  for (const [c, row, outcome, title] of GAPS) { const k = byRow.get(`${c}|${row}`) || `row:${title}:${c}:${row}`; if (!seen.has(k)) seen.set(k, { c, row, outcome, title, courses: [] }); seen.get(k).courses.push(c); }
  for (const [k, g] of seen) {
    const cat = await db.collection('apxcatalogrows').findOne({ customerId: '781', apxCourseId: g.c, rowId: String(g.row) }, { projection: { 'raw.link': 1, 'raw.live_link': 1, 'raw.date_and_time': 1, 'raw.duration': 1, 'raw.recording_type': 1 } });
    const raw = cat?.raw || {};
    await sleep(1300);
    const form = new URLSearchParams({ course_id: g.c, video_id: String(g.row), ytflag: '1', folder_wise_course: '1', recaptcha_token: '', video_url: String(raw.link || raw.live_link || ''), uhsVersion: '0.00' });
    const r = await axios.post('https://cms.appx.co.in/common/get_video_token', form.toString(), { timeout: 15000, validateStatus: () => true, maxRedirects: 0, headers: { Accept: 'application/json, */*; q=0.01', 'Cache-Control': 'no-cache', 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', Cookie: `apx-aside-collapse=1; ci_session=${sess.session_id}`, Referer: 'https://cms.appx.co.in/', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36', 'X-Requested-With': 'XMLHttpRequest' } });
    if (r.status >= 300) { console.log(JSON.stringify({ t: 'stop', http: r.status })); break; }
    const b = r.data && typeof r.data === 'object' ? r.data : {};
    const urls = Array.isArray(b.urls) ? b.urls.filter((u) => u && u.path) : [];
    const answer = urls.length ? 'urls' : String(b.key) === 'appxplayer' && b.value ? 'appxplayer' : (b.hls_clear_key_urls || b.drm_mp4_url || b.drm_license_url) ? 'drm' : 'nothing';
    console.log(JSON.stringify({ t: 'row', classKey: k.startsWith('row:') ? '' : k, title: g.title, course: g.c, row: g.row, courses: g.courses.join(','), was: g.outcome, answer, qualities: urls.map((u) => u.quality).join('/'), urlHost: urls[0] ? host(urls[0].path) : '', recorded: String(raw.date_and_time || ''), seconds: String(raw.duration || ''), link: await probe(raw.link), liveLink: await probe(raw.live_link) }));
  }
  await mongoose.disconnect();
})().catch((e) => { console.error(String(e.message).replace(/https?:\/\/\S+/g, '[url]').slice(0, 200)); process.exitCode = 1; });
