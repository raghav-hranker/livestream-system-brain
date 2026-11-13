// READ-ONLY. When were live classes on air on the GPU box? Each live class queues a 1C job when it ends, so queuedAt - durationSec
// gives its span. Prints class-hours per IST hour, the first start / last end per IST day, per client counts over the look-back,
// and any job still `processing` with no container (left by a manager restart).
// Run on the GPU box:  ssh ... 'cd /root/video-transcoder/gpu-server/job-manager && node - 14' < live_hours_from_1c.cjs
require('dotenv').config();
const { execSync } = require('child_process');
const { MongoClient } = require('mongodb');

const IST = 5.5 * 36e5;
const days = Number(process.argv[2]) || 14;
const fmt = (t) => new Date(t + IST).toISOString().slice(5, 16).replace('T', ' ');

(async () => {
  const c = new MongoClient(process.env.MONGO_URI);
  await c.connect();
  const v = c.db(process.env.MONGO_DB || 'transcoder').collection('videos');
  const docs = await v.find({ _id: /^hls-/, durationSec: { $gt: 60 }, queuedAt: { $gte: new Date(Date.now() - days * 864e5) } }, { projection: { clientId: 1, queuedAt: 1, durationSec: 1 } }).toArray();
  const hours = new Array(24).fill(0);
  const byDay = {};
  const byClient = {};
  for (const d of docs) {
    const end = +d.queuedAt;
    const start = end - d.durationSec * 1000;
    byClient[d.clientId] = (byClient[d.clientId] || 0) + 1;
    for (let t = start; t < end; t += 6e5) hours[new Date(t + IST).getUTCHours()] += 1 / 6;
    const day = new Date(start + IST).toISOString().slice(0, 10);
    const b = (byDay[day] ||= { n: 0, first: start, last: end });
    b.n++; b.first = Math.min(b.first, start); b.last = Math.max(b.last, end);
  }
  console.log(`live classes ended in the last ${days} days: ${docs.length}`, JSON.stringify(byClient));
  console.log('class-hours per IST hour:');
  hours.forEach((h, i) => console.log(String(i).padStart(2, '0'), String(Math.round(h)).padStart(5), '#'.repeat(Math.round(h / 4))));
  for (const k of Object.keys(byDay).sort()) console.log(k, 'classes', String(byDay[k].n).padStart(3), 'first start', fmt(byDay[k].first), 'last end', fmt(byDay[k].last));

  const running = new Set(execSync("docker ps --format '{{.ID}}'", { encoding: 'utf8' }).trim().split('\n').filter(Boolean).map((id) => {
    const env = execSync(`docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' ${id}`, { encoding: 'utf8' });
    return (env.match(/^JOB_ID=(.*)$/m) || [])[1];
  }));
  const stuck = (await v.find({ status: 'processing', startedAt: { $gte: new Date(Date.now() - 7 * 864e5) } }, { projection: { clientId: 1, startedAt: 1 } }).toArray()).filter((d) => !running.has(d._id));
  console.log(`processing with no running container: ${stuck.length}`, stuck.slice(0, 12).map((d) => `${d._id.slice(0, 26)} client=${d.clientId} started ${fmt(+d.startedAt)} IST`).join('; '));
  await c.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
