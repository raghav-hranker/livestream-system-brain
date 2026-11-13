// READ-ONLY. Is a recorded job's HLS really playable? For the newest completed 1A/1B jobs of a client, walks
// <CDN>/<client>/<class>/hls/ master -> every rung -> first and last segment, and compares playlist length with the job's
// durationSec. Splits the totals by legacy vs the 10-30 pipeline. Prints every bad job and the totals.
// Runs on the GPU box from the job-manager directory:
//   ssh ... 'cd /root/video-transcoder/gpu-server/job-manager && CLIENT=168 N=40 node -' < transcoder_hls_check.cjs
const path = require('path');
require(path.join(process.cwd(), 'node_modules/dotenv')).config();
const { MongoClient } = require(path.join(process.cwd(), 'node_modules/mongodb'));

const CLIENT = process.env.CLIENT || '168';
const N = Number(process.env.N) || 40;
const HOST = process.env.CDN_HOST || 'https://recordedvideos.hranker.com';
const MASTERS = ['master.m3u8', 'playlist.m3u8', 'index.m3u8'];
const ist = (d) => (d ? new Date(new Date(d).getTime() + 5.5 * 36e5).toISOString().slice(0, 16).replace('T', ' ') : '-');

const text = async (url) => {
  const r = await fetch(url);
  return { status: r.status, body: r.ok ? await r.text() : '' };
};
const head = async (url) => (await fetch(url, { method: 'HEAD' })).status;
const lines = (body) => body.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));

const walk = async (d) => {
  const base = `${HOST}/${d.clientId}/${d.classId}/hls/`;
  let master = null;
  let name = null;
  for (const m of MASTERS) {
    const got = await text(base + m);
    if (got.status === 200) { master = got.body; name = m; break; }
  }
  if (!master) return { problem: 'no master' };
  const rungs = lines(master);
  if (!rungs.length) return { problem: `${name} lists no rungs` };
  const seconds = [];
  for (const rung of rungs) {
    const url = new URL(rung, base + name).toString();
    const pl = await text(url);
    if (pl.status !== 200) return { problem: `rung ${rung} ${pl.status}` };
    if (!pl.body.includes('#EXT-X-ENDLIST')) return { problem: `rung ${rung} has no ENDLIST` };
    const segs = lines(pl.body);
    if (!segs.length) return { problem: `rung ${rung} empty` };
    for (const s of [segs[0], segs[segs.length - 1]]) {
      const st = await head(new URL(s, url).toString());
      if (st !== 200) return { problem: `rung ${rung} segment ${s.split('?')[0]} ${st}` };
    }
    seconds.push([...pl.body.matchAll(/#EXTINF:([\d.]+)/g)].reduce((a, x) => a + Number(x[1]), 0));
  }
  const short = d.durationSec ? Math.min(...seconds) / d.durationSec : 1;
  if (short < 0.98) return { problem: `shortest rung ${Math.round(Math.min(...seconds))}s of ${d.durationSec}s` };
  return { rungs: rungs.length };
};

(async () => {
  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  const videos = client.db(process.env.MONGO_DB || 'transcoder').collection('videos');
  const query = { clientId: { $in: [CLIENT, Number(CLIENT)] }, status: 'completed', key: /\.(mp4|mkv|mov|webm)$/i };
  const fields = { clientId: 1, classId: 1, key: 1, durationSec: 1, pipeline: 1, completedAt: 1 };
  const fresh = await videos.find({ ...query, pipeline: { $exists: true } }).project(fields).sort({ completedAt: -1 }).limit(N).toArray();
  const old = await videos.find({ ...query, pipeline: { $exists: false } }).project(fields).sort({ completedAt: -1 }).limit(N).toArray();
  for (const [label, jobs] of [['10-30 pipeline', fresh], ['legacy', old]]) {
    let ok = 0;
    for (const d of jobs) {
      const res = await walk(d).catch((e) => ({ problem: e.message }));
      if (res.problem) console.log(`BAD ${label}: ${ist(d.completedAt)} ${d.key}  ${res.problem}`);
      else ok++;
    }
    console.log(`${label}: ${ok} of ${jobs.length} playable end to end`);
  }
  await client.close();
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
