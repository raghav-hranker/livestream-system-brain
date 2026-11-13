// READ-ONLY. Explains the job manager's "Failed: N" counter: failed jobs since SINCE (ISO, default last manager restart you pass in),
// split into real uploads and forged ones (client id not numeric, or key not under <client>/<class>/).
// Runs on the GPU box from the job-manager directory:
//   ssh ... 'cd /root/video-transcoder/gpu-server/job-manager && SINCE=2026-10-30T10:30:00Z node -' < transcoder_failed_since.cjs
const path = require('path');
require(path.join(process.cwd(), 'node_modules/dotenv')).config();
const { MongoClient } = require(path.join(process.cwd(), 'node_modules/mongodb'));
const since = new Date(process.env.SINCE);
const ist = (d) => (d ? new Date(new Date(d).getTime() + 5.5 * 36e5).toISOString().slice(0, 16).replace('T', ' ') : '-');
(async () => {
  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  const docs = await client.db(process.env.MONGO_DB || 'transcoder').collection('videos')
    .find({ startedAt: { $gte: since } }, { projection: { clientId: 1, key: 1, status: 1, startedAt: 1, error: 1, jobId: 1 } }).toArray();
  const real = (d) => /^\d+$/.test(String(d.clientId)) && (!d.key || new RegExp(`^${d.clientId}/[^/]+/[^/]+$`).test(d.key)) && !/\$\(|`|;|\|/.test(d.key || '');
  const count = (l) => l.reduce((a, d) => { a[d.status] = (a[d.status] || 0) + 1; return a; }, {});
  console.log(`started since ${ist(since)} IST: ${docs.length}`);
  console.log('real   ', JSON.stringify(count(docs.filter(real))));
  console.log('forged ', JSON.stringify(count(docs.filter((d) => !real(d)))));
  for (const d of docs.filter((x) => x.status === 'failed' && real(x))) console.log(`  REAL failed ${ist(d.startedAt)} ${d.clientId} ${d.key || d.jobId}  ${String(d.error || '').slice(0, 70)}`);
  for (const d of docs.filter((x) => x.status === 'completed' && !real(x))) console.log(`  FORGED completed ${ist(d.startedAt)} client=${String(d.clientId).slice(0, 20)} ${String(d.key || '').slice(0, 70)}`);
  await client.close();
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
