// READ-ONLY. "Recordings will be available soon" on the PHP-panel apps: for one client's completed upload jobs, asks the public
// recording API what the app would get, per IST week of the job, and lists the classes it refuses although the job finished.
// Runs on the GPU box from the job-manager directory (needs its Mongo URI; the API call is an ordinary public GET):
//   ssh ... 'cd /root/video-transcoder/gpu-server/job-manager && CLIENT=514 DAYS=120 node -' < recording_api_check.cjs
const path = require('path');
require(path.join(process.cwd(), 'node_modules/dotenv')).config();
const { MongoClient } = require(path.join(process.cwd(), 'node_modules/mongodb'));

const CLIENT = process.env.CLIENT || '514';
const DAYS = Number(process.env.DAYS) || 120;
const API = process.env.API || 'https://www.multistreaming.site/api/v2/recording';
const ist = (d) => (d ? new Date(new Date(d).getTime() + 5.5 * 36e5).toISOString().slice(0, 10) : '-');
const weekOf = (d) => {
  const t = new Date(d);
  t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7));
  return ist(t);
};

(async () => {
  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  const jobs = await client.db(process.env.MONGO_DB || 'transcoder').collection('videos').find(
    { clientId: { $in: [CLIENT, Number(CLIENT)] }, status: 'completed', completedAt: { $gte: new Date(Date.now() - DAYS * 864e5) } },
    { projection: { classId: 1, key: 1, completedAt: 1 } },
  ).sort({ completedAt: 1 }).toArray();

  const latest = new Map();
  for (const j of jobs) if (j.classId) latest.set(String(j.classId), j);
  const list = [...latest.values()];
  const results = [];
  for (let i = 0; i < list.length; i += 5) {
    results.push(...await Promise.all(list.slice(i, i + 5).map(async (j) => {
      const r = await fetch(`${API}/${j.classId}`).catch(() => null);
      const body = r ? await r.text().catch(() => '') : '';
      return { j, status: r ? r.status : 0, soon: /available soon/i.test(body) };
    })));
  }

  const weeks = {};
  for (const { j, status } of results) {
    const w = (weeks[process.env.BY_DAY ? ist(j.completedAt) : weekOf(j.completedAt)] ||= { classes: 0, ok: 0, refused: 0, other: 0 });
    w.classes++;
    if (status === 200) w.ok++;
    else if (status === 404) w.refused++;
    else w.other++;
  }
  console.log(`client ${CLIENT}: ${jobs.length} completed jobs, ${list.length} classes, oldest job looked at ${DAYS} days back`);
  console.log('week of     classes  ok  refused  other');
  for (const k of Object.keys(weeks).sort()) {
    const w = weeks[k];
    console.log(k, String(w.classes).padStart(8), String(w.ok).padStart(3), String(w.refused).padStart(8), String(w.other).padStart(6));
  }
  const refused = results.filter((x) => x.status !== 200);
  console.log(`\nrefused: ${refused.length}; newest first:`);
  for (const { j, status, soon } of refused.reverse().slice(0, 25)) {
    console.log(`  ${ist(j.completedAt)} ${status}${soon ? " soon" : ""}  class ${j.classId}  ${String(j.key || "").slice(0, 60)}`);
  }
  await client.close();
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
