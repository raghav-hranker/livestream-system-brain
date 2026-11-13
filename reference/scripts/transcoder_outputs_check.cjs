// READ-ONLY. Does a job's video really exist on the CDN? HEADs every recorded `outputs` URL of completed 1A/1B jobs, and for
// jobs left `queued` with no startedAt (the old drain worker wrote no log) HEADs the 720p MP4 the key implies.
// Splits by the job's image generation: `pipeline` set means the 10-30 GPU/remux image. Prints only misses and totals.
// Runs on the GPU box from the job-manager directory:
//   ssh ... 'cd /root/video-transcoder/gpu-server/job-manager && DAYS=10 CLIENT=168 node -' < transcoder_outputs_check.cjs
const path = require('path');
require(path.join(process.cwd(), 'node_modules/dotenv')).config();
const { MongoClient } = require(path.join(process.cwd(), 'node_modules/mongodb'));

const DAYS = Number(process.env.DAYS) || 10;
const CLIENT = process.env.CLIENT || '168';
const HOST = process.env.CDN_HOST || 'https://recordedvideos.hranker.com';
const since = new Date(Date.now() - DAYS * 864e5);
const ist = (d) => (d ? new Date(new Date(d).getTime() + 5.5 * 36e5).toISOString().slice(0, 16).replace('T', ' ') : '-');

const head = async (url) => {
  for (let i = 0; i < 2; i++) {
    try {
      const r = await fetch(url, { method: 'HEAD' });
      return { status: r.status, bytes: Number(r.headers.get('content-length')) || 0 };
    } catch (e) { if (i) return { status: 0, bytes: 0 }; }
  }
};
const inBatches = async (items, n, fn) => {
  const out = [];
  for (let i = 0; i < items.length; i += n) out.push(...await Promise.all(items.slice(i, i + n).map(fn)));
  return out;
};

(async () => {
  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  const videos = client.db(process.env.MONGO_DB || 'transcoder').collection('videos');
  const clientId = { $in: [CLIENT, Number(CLIENT)] };
  const key = /\.(mp4|mkv|mov|webm)$/i;

  const done = await videos.find({ clientId, status: 'completed', completedAt: { $gte: since }, key }).project({ key: 1, outputs: 1, pipeline: 1, completedAt: 1 }).toArray();
  const groups = { legacy: { jobs: 0, urls: 0, missing: 0, empty: 0 }, 'gpu/remux': { jobs: 0, urls: 0, missing: 0, empty: 0 } };
  await inBatches(done, 6, async (d) => {
    const g = groups[d.pipeline ? 'gpu/remux' : 'legacy'];
    g.jobs++;
    if (!(d.outputs || []).length) { g.empty++; console.log(`no outputs recorded: ${ist(d.completedAt)} ${d.key}`); return; }
    for (const o of d.outputs) {
      g.urls++;
      const h = await head(o.url);
      if (h.status !== 200 || !h.bytes) { g.missing++; console.log(`MISSING ${h.status} ${ist(d.completedAt)} ${o.quality} ${d.key}`); }
    }
  });
  console.log(`completed jobs, client ${CLIENT}, since ${ist(since)}:`, JSON.stringify(groups));

  const never = await videos.find({ clientId, status: 'queued', startedAt: null, queuedAt: { $gte: since }, key }).project({ key: 1, queuedAt: 1 }).toArray();
  const rows = await inBatches(never, 8, async (d) => {
    const dir = d.key.slice(0, d.key.lastIndexOf('/'));
    const base = d.key.slice(d.key.lastIndexOf('/') + 1).replace(/\.[^.]+$/, '');
    return { d, h: await head(`${HOST}/${dir}/mp4/${encodeURIComponent(base)}_720p.mp4`) };
  });
  const absent = rows.filter((r) => r.h.status !== 200);
  console.log(`\nqueued, never started: ${never.length}; 720p MP4 exists on CDN: ${never.length - absent.length}; absent: ${absent.length}`);
  for (const { d, h } of absent) console.log(`  ${h.status} queued ${ist(d.queuedAt)} ${d.key}`);
  await client.close();
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
