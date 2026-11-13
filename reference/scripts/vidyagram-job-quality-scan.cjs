// Read-only on the DB (vidyagramdb only) and on AppX: for each ingest job in JOBS (comma list) mints a fresh AppX token,
// then for every quality (the minted one with its quality folder swapped: 240p 360p 480p 720p 1080p) reads the playlist
// and the first 1 KB of EVERY segment. Prints per quality: playlist status, segments, missing segment numbers and where
// in the video they fall. No URL, token or cookie is printed. Same check as the 11-10 gap-quality scan, for named jobs.
// Run from the nightly checkout on test-uday: JOBS=a,b node - < script
require('dotenv').config({ path: '.env.development', quiet: true });
require('ts-node/register/transpile-only');
const mongoose = require('mongoose');
const axios = require('axios');
const { regenerateSessionLink } = require(process.cwd() + '/src/services/apx/apxVideoTokenService');
const H = { Referer: 'https://appx-play.akamai.net.in/', Origin: 'https://appx-play.akamai.net.in' };
const RUNGS = ['240p', '360p', '480p', '720p', '1080p'];
const clean = (s) => String(s ?? '').replace(/https?:\/\/\S+/g, '[url]').slice(0, 140);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const hms = (s) => `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
(async () => {
  const ids = String(process.env.JOBS || '').split(',').map((s) => s.trim()).filter(Boolean);
  await mongoose.connect(process.env.MONGO_URI, { dbName: 'vidyagramdb', readPreference: 'secondaryPreferred', autoIndex: false, autoCreate: false });
  const db = mongoose.connection.db; if (db.databaseName !== 'vidyagramdb') throw new Error('wrong db');
  for (const id of ids) {
    const j = await db.collection('apxingestjobs').findOne({ _id: new mongoose.Types.ObjectId(id) });
    if (!j) { console.log(JSON.stringify({ job: id, result: 'not found' })); continue; }
    const cls = await db.collection('classes').findOne({ _id: j.classId }, { projection: { title: 1 } });
    await sleep(1300);
    let url; try { url = await regenerateSessionLink({ course_id: j.course_id, video_id: j.video_id, video_url: j.video_url }, '781'); } catch (e) { console.log(JSON.stringify({ job: id, result: 'no token: ' + clean(e.message) })); continue; }
    const minted = RUNGS.find((r) => url.includes(`/${r}/`));
    if (!minted) { console.log(JSON.stringify({ job: id, title: cls?.title, result: 'minted link has no quality folder; cannot derive the others' })); continue; }
    const out = { job: id, title: cls?.title, jobStatus: j.status, mintedQuality: minted, qualities: {} };
    for (const rung of RUNGS) {
      const pl = url.replace(`/${minted}/`, `/${rung}/`);
      const p = await axios.get(pl, { timeout: 20000, validateStatus: () => true, responseType: 'text', headers: H }).catch((e) => ({ status: 0, data: '' }));
      const text = String(p.data); const q = { playlist: p.status };
      if (p.status === 200 && text.startsWith('#EXTM3U')) {
        const lines = text.split(/\r?\n/); const segs = []; let dur = 0; let at = 0;
        for (const l of lines) { if (l.startsWith('#EXTINF:')) dur = parseFloat(l.slice(8)) || 0; else if (l.trim() && !l.startsWith('#')) { segs.push({ u: l.trim(), at }); at += dur; } }
        q.segments = segs.length; q.length = hms(at); q.endList = text.includes('#EXT-X-ENDLIST'); q.encrypted = text.includes('#EXT-X-KEY'); const missing = []; let bytesHint = 0;
        for (let i = 0; i < segs.length; i += 1) {
          let s = await axios.get(new URL(segs[i].u, pl).href, { timeout: 20000, validateStatus: () => true, responseType: 'arraybuffer', headers: { ...H, Range: 'bytes=0-1023' } }).catch(() => ({ status: 0 }));
          if (s.status !== 200 && s.status !== 206) { await sleep(800); s = await axios.get(new URL(segs[i].u, pl).href, { timeout: 20000, validateStatus: () => true, responseType: 'arraybuffer', headers: { ...H, Range: 'bytes=0-1023' } }).catch(() => ({ status: 0 })); }
          if (s.status !== 200 && s.status !== 206) missing.push({ n: i, http: s.status, at: hms(segs[i].at) });
        }
        q.missing = missing; q.complete = segs.length > 0 && missing.length === 0;
      }
      out.qualities[rung] = q;
    }
    console.log(JSON.stringify(out));
  }
  await mongoose.disconnect();
})().catch((e) => { console.error(clean(e.message)); process.exitCode = 1; });
