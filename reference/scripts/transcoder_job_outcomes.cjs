// READ-ONLY. Did transcoder jobs reach `completed`, per client and op, per IST day? Then every job in the last DAYS days
// that has not: failed ones with their reason, and queued/processing ones older than STUCK_H hours.
// Runs on the GPU box (178.63.88.34) against the manager's own MONGO_URI:
//   ssh ... 'cd /root/video-transcoder/gpu-server/job-manager && DAYS=10 STUCK_H=6 node -' < transcoder_job_outcomes.cjs
// Optional CLIENT=168 limits the listing, never the per-day table.
const path = require('path');
require(path.join(process.cwd(), 'node_modules/dotenv')).config();
const { MongoClient } = require(path.join(process.cwd(), 'node_modules/mongodb'));

const DAYS = Number(process.env.DAYS) || 10;
const STUCK_H = Number(process.env.STUCK_H) || 6;
const CLIENT = process.env.CLIENT;
const now = Date.now();
const since = new Date(now - DAYS * 864e5);
const ist = (d) => (d ? new Date(new Date(d).getTime() + 5.5 * 36e5).toISOString().slice(0, 16).replace('T', ' ') : '-');
const p50 = (a) => (a.length ? Math.round([...a].sort((x, y) => x - y)[Math.floor(a.length / 2)]) : '-');
const kindOf = (d) => (/\.m3u8/.test(d.key || '') || !d.key ? '1C' : '1A/1B');

(async () => {
  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  const videos = client.db(process.env.MONGO_DB || 'transcoder').collection('videos');
  const docs = await videos.find(
    { $or: [{ queuedAt: { $gte: since } }, { startedAt: { $gte: since } }] },
    { projection: { logs: 0, stdout: 0, stderr: 0 } },
  ).toArray();
  console.log(`jobs since ${ist(since)} IST: ${docs.length}; fields seen: ${[...new Set(docs.flatMap((d) => Object.keys(d)))].join(' ')}\n`);

  const rows = {};
  for (const d of docs) {
    const k = `${ist(d.queuedAt || d.startedAt).slice(0, 10)} ${String(d.clientId).padEnd(5)} ${kindOf(d).padEnd(5)}`;
    const r = (rows[k] ||= { n: 0, statuses: {}, wait: [] });
    r.n++;
    r.statuses[d.status || '?'] = (r.statuses[d.status || '?'] || 0) + 1;
    if (d.queuedAt && d.startedAt) r.wait.push((d.startedAt - d.queuedAt) / 6e4);
  }
  console.log('day (IST)  client op     jobs  p50-wait-min  statuses');
  for (const k of Object.keys(rows).sort()) {
    const r = rows[k];
    console.log(k, String(r.n).padStart(5), String(p50(r.wait)).padStart(13), ' ', JSON.stringify(r.statuses));
  }

  const open = docs.filter((d) => {
    if (CLIENT && String(d.clientId) !== CLIENT) return false;
    if (d.status === 'failed') return true;
    if (d.status === 'completed') return false;
    return now - new Date(d.queuedAt || d.startedAt).getTime() > STUCK_H * 36e5;
  });
  console.log(`\nnot completed (failed, or open over ${STUCK_H} h): ${open.length}`);
  for (const d of open.sort((a, b) => (a.queuedAt || a.startedAt) - (b.queuedAt || b.startedAt)).slice(-80)) {
    const reason = String(d.error || d.failureReason || d.reason || '').replace(/\s+/g, ' ').slice(0, 90);
    console.log(`${ist(d.queuedAt)}  start ${ist(d.startedAt)}  ${String(d.status).padEnd(10)} ${String(d.clientId).padEnd(5)} ${kindOf(d).padEnd(5)} ${String(d.key || '').slice(0, 60)}  ${reason}`);
  }
  // RECENT=30 lists the newest uploaded-file jobs (1A/1B), to see intake and timing right now.
  if (process.env.RECENT) {
    const recent = docs.filter((d) => kindOf(d) === '1A/1B' && /^\d+$/.test(String(d.clientId)))
      .sort((a, b) => (b.queuedAt || b.startedAt) - (a.queuedAt || a.startedAt)).slice(0, Number(process.env.RECENT));
    console.log(`\nnewest ${recent.length} recorded jobs:`);
    for (const d of recent) {
      const pipe = d.pipeline ? `${d.pipeline.hls || '-'}+${d.pipeline.mp4 || '-'}` : 'legacy';
      console.log(`${ist(d.queuedAt)}  start ${ist(d.startedAt).slice(11)}  done ${ist(d.completedAt).slice(11)}  ${String(d.status).padEnd(10)} ${String(d.clientId).padEnd(4)} ${pipe.padEnd(11)} ${Math.round((d.durationSec || 0) / 60)}m  ${String(d.key || '').slice(0, 55)}`);
    }
  }
  await client.close();
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
