// READ-ONLY. Transcoder throughput from the job-manager's `transcoder.videos` log:
// per client, how many jobs, minutes of video, processing time, realtime factor
// (video seconds per wall second) and queue wait; then busy-slot count per IST hour.
// 1A/1B rows split by the job's `pipeline` (hls path + mp4 path, written by images
// from the gpu-decode-mp4-remux change); jobs from older images show as `legacy`.
//
// Runs on the GPU box (178.63.88.34) against the manager's own MONGO_URI:
//   ssh ... 'cd /root/video-transcoder/gpu-server/job-manager && node - 7' < transcoder_job_speed.cjs
// Arg: days to look back (default 7).
require('dotenv').config();
const { MongoClient } = require('mongodb');

const days = Number(process.argv[2]) || 7;
const since = new Date(Date.now() - days * 864e5);

const pct = (arr, p) => {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
};
const r1 = (n) => (n == null ? '-' : Math.round(n * 10) / 10);

(async () => {
  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  const videos = client.db(process.env.MONGO_DB || 'transcoder').collection('videos');
  const docs = await videos
    .find({ startedAt: { $gte: since } }, { projection: { clientId: 1, key: 1, status: 1, queuedAt: 1, startedAt: 1, completedAt: 1, durationSec: 1, pipeline: 1 } })
    .toArray();

  const byClient = {};
  for (const d of docs) {
    const kind = /\.m3u8/.test(d.key || '') || !d.key ? '1C' : '1A/1B';
    const pipe = kind === '1C' ? '' : d.pipeline ? `${d.pipeline.hls || '-'}+${d.pipeline.mp4 || '-'}` : 'legacy';
    const k = `${d.clientId || '?'} ${kind} ${pipe}`.trim();
    const c = (byClient[k] ||= { n: 0, failed: 0, videoMin: 0, procMin: 0, rtf: [], procMinEach: [], waitMin: [] });
    c.n++;
    if (d.status === 'failed') c.failed++;
    if (d.queuedAt && d.startedAt) c.waitMin.push((d.startedAt - d.queuedAt) / 6e4);
    if (d.status === 'completed' && d.completedAt && d.startedAt) {
      const proc = (d.completedAt - d.startedAt) / 1e3;
      c.procMin += proc / 60;
      c.procMinEach.push(proc / 60);
      if (d.durationSec) {
        c.videoMin += d.durationSec / 60;
        c.rtf.push(d.durationSec / proc);
      }
    }
  }

  console.log(`jobs started in the last ${days} days: ${docs.length}\n`);
  console.log('client kind pipeline'.padEnd(34) + '  jobs fail  video-h  slot-h  p50-proc-min  p90-proc-min  p50-rtf  p50-wait-min  p90-wait-min');
  for (const [k, c] of Object.entries(byClient).sort((a, b) => b[1].procMin - a[1].procMin)) {
    console.log(
      k.padEnd(34),
      String(c.n).padStart(5), String(c.failed).padStart(4),
      String(r1(c.videoMin / 60)).padStart(8), String(r1(c.procMin / 60)).padStart(7),
      String(r1(pct(c.procMinEach, 0.5))).padStart(13), String(r1(pct(c.procMinEach, 0.9))).padStart(13),
      String(r1(pct(c.rtf, 0.5))).padStart(8),
      String(r1(pct(c.waitMin, 0.5))).padStart(13), String(r1(pct(c.waitMin, 0.9))).padStart(13),
    );
  }

  // Average busy slots per IST hour of day (slot-minutes / 60 / days). A doc left
  // `processing` by a dead container never completes; count an open doc only while
  // it could still be running (started in the last 6 h).
  const busy = new Array(24).fill(0);
  for (const d of docs) {
    if (!d.startedAt) continue;
    if (!d.completedAt && Date.now() - d.startedAt > 6 * 36e5) continue;
    const end = d.completedAt ? +d.completedAt : Date.now();
    for (let t = +d.startedAt; t < end; t += 6e4) {
      const h = new Date(t + 5.5 * 36e5).getUTCHours();
      busy[h] += Math.min(6e4, end - t) / 6e4;
    }
  }
  console.log('\nIST hour  avg busy slots');
  busy.forEach((m, h) => console.log(String(h).padStart(2, '0'), ' ', r1(m / 60 / days), '#'.repeat(Math.round(m / 60 / days * 4))));
  await client.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
