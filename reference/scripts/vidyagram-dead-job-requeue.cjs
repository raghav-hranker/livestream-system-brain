// Vidyagram: put named dead video-import jobs back in the queue after proving AppX serves the whole video now.
// **Writes apxingestjobs only with COMMIT=1** (dry run default): for each id in JOBS (comma list) it mints a fresh AppX
// token, reads the playlist and the first 1 KB of EVERY segment, and only if all answer 200/206 sets the job
// dead -> pending, attempts 0, error null (compare-and-set on status dead). Prints the before-image; rollback = set
// status back to 'dead' with the printed attempts and error. Refuses any DB but vidyagramdb. No URL or cookie printed.
// Run from the nightly checkout on test-uday: JOBS=a,b [COMMIT=1] node - < script
require('dotenv').config({ path: '.env.development', quiet: true });
require('ts-node/register/transpile-only');
const mongoose = require('mongoose');
const axios = require('axios');
const { regenerateSessionLink } = require(process.cwd() + '/src/services/apx/apxVideoTokenService');
const H = { Referer: 'https://appx-play.akamai.net.in/', Origin: 'https://appx-play.akamai.net.in' };
const clean = (s) => String(s ?? '').replace(/https?:\/\/\S+/g, '[url]').slice(0, 140);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const ids = String(process.env.JOBS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!ids.length) throw new Error('JOBS is empty');
  await mongoose.connect(process.env.MONGO_URI, { dbName: 'vidyagramdb', readPreference: 'primary', autoIndex: false, autoCreate: false });
  const db = mongoose.connection.db; if (db.databaseName !== 'vidyagramdb') throw new Error('wrong db');
  const jobs = db.collection('apxingestjobs');
  const by = await jobs.aggregate([{ $group: { _id: '$status', n: { $sum: 1 }, last: { $max: '$updatedAt' } } }]).toArray();
  console.log(JSON.stringify({ queue: by.map((x) => `${x._id}:${x.n} last ${x.last?.toISOString?.().slice(0, 16)}`) }));
  for (const id of ids) {
    const j = await jobs.findOne({ _id: new mongoose.Types.ObjectId(id) });
    if (!j || j.status !== 'dead') { console.log(JSON.stringify({ job: id, skipped: j ? `status ${j.status}` : 'not found' })); continue; }
    const before = { job: id, classId: String(j.classId), status: j.status, attempts: j.attempts, error: clean(j.error) };
    await sleep(1300);
    let url; try { url = await regenerateSessionLink({ course_id: j.course_id, video_id: j.video_id, video_url: j.video_url }, '781'); } catch (e) { console.log(JSON.stringify({ ...before, result: 'no token: ' + clean(e.message) })); continue; }
    const get = (u) => axios.get(u, { timeout: 20000, validateStatus: () => true, responseType: 'text', headers: H });
    let m = await get(url); let u = url; let text = String(m.data); const rungs = [];
    const lists = text.includes('#EXT-X-STREAM-INF') ? text.split(/\r?\n/).filter((x) => x.trim() && !x.startsWith('#')).map((x) => new URL(x, url).href) : [url];
    let allOk = m.status === 200;
    for (const pl of lists) {
      const p = pl === url ? m : await get(pl); const segs = String(p.data).split(/\r?\n/).map((x) => x.trim()).filter((x) => x && !x.startsWith('#'));
      let bad = 0; let firstBad = null;
      for (let i = 0; i < segs.length; i += 1) { const s = await axios.get(new URL(segs[i], pl).href, { timeout: 20000, validateStatus: () => true, responseType: 'arraybuffer', headers: { ...H, Range: 'bytes=0-1023' } }).catch(() => ({ status: 0 })); if (s.status !== 200 && s.status !== 206) { bad += 1; firstBad = firstBad ?? i; } }
      rungs.push({ playlist: p.status, segments: segs.length, bad, firstBad }); if (p.status !== 200 || !segs.length || bad) allOk = false;
    }
    let wrote = false;
    if (allOk && process.env.COMMIT === '1') { const r = await jobs.updateOne({ _id: j._id, status: 'dead' }, { $set: { status: 'pending', attempts: 0, error: null, updatedAt: new Date() } }); wrote = r.modifiedCount === 1; }
    console.log(JSON.stringify({ ...before, rungs, wholeVideoReadable: allOk, requeued: wrote }));
  }
  await mongoose.disconnect();
})().catch((e) => { console.error(clean(e.message)); process.exitCode = 1; });
