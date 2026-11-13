// READ-ONLY. "Recording will be available soon" complaints: for the classes of the last DAYS days, shows per IST day
// how many reached a playable recording, then lists the ones that did not (stuck in processing/reconnecting/live,
// ended with no hlsAsset, or a past-dated recorded class with no asset), plus transcoder.videos jobs per day and status.
// Tenant follows the checkout's env file. Run on webserver2-2 from the backend checkout, fed over ssh stdin:
//   DAYS=14 DOTENV_CONFIG_PATH=.env.development node -r dotenv/config - < recording_readiness.cjs
const path = require('path');
const m = require(path.join(process.cwd(), 'node_modules/mongoose'));

const DAYS = Number(process.env.DAYS) || 14;
const now = Date.now();
const since = new Date(now - DAYS * 864e5);
const ist = (d) => (d ? new Date(new Date(d).getTime() + 5.5 * 36e5).toISOString().slice(0, 16).replace('T', ' ') : '-');
const day = (d) => ist(d).slice(0, 10);
const ageH = (d) => (d ? ((now - new Date(d).getTime()) / 36e5).toFixed(1) : '-');

(async () => {
  await m.connect(process.env.MONGO_URI);
  const db = m.connection.db;
  console.log(`db ${db.databaseName}, classes from ${ist(since)} IST\n`);

  const classes = await db.collection('classes').find(
    { startDate: { $gte: since, $lte: new Date(now) } },
    { projection: { title: 1, startDate: 1, updatedAt: 1, isLive: 1, status: 1, streamStatus: 1, hlsAsset: 1, class_link: 1, mp4Recordings: 1 } },
  ).toArray();

  const rows = {};
  const problems = [];
  for (const c of classes) {
    const r = (rows[day(c.startDate)] ||= { total: 0, ended: 0, playable: 0, noStatus: 0, processing: 0, reconnecting: 0, live: 0, preparing: 0, noAsset: 0, noMp4: 0 });
    r.total++;
    const s = c.streamStatus;
    if (!s) r.noStatus++;
    else if (r[s] !== undefined) r[s]++;
    const blockedByStatus = s === 'processing' || s === 'preparing';
    if (c.hlsAsset && !blockedByStatus) r.playable++;
    if (!c.hlsAsset) r.noAsset++;
    if (!(c.mp4Recordings || []).length) r.noMp4++;

    const quietH = Number(ageH(c.updatedAt));
    let why = null;
    if (s === 'processing') why = 'processing';
    else if (s === 'reconnecting' && quietH > 0.5) why = 'reconnecting';
    else if (s === 'live' && quietH > 6) why = 'live, quiet 6h+';
    else if (s === 'ended' && !c.hlsAsset) why = 'ended, no hlsAsset';
    else if (s === 'preparing' && Number(ageH(c.startDate)) > 3) why = 'preparing, start 3h+ ago';
    else if (!s && !c.hlsAsset && !c.class_link && Number(ageH(c.startDate)) > 3) why = 'no status, no asset, no link';
    if (why) problems.push({ why, c });
  }

  console.log('day (IST)    total  playable  noStatus processing reconnecting  live preparing ended  noAsset noMp4');
  for (const d of Object.keys(rows).sort()) {
    const r = rows[d];
    console.log(d, String(r.total).padStart(6), String(r.playable).padStart(9), String(r.noStatus).padStart(9), String(r.processing).padStart(10),
      String(r.reconnecting).padStart(12), String(r.live).padStart(5), String(r.preparing).padStart(9), String(r.ended).padStart(5), String(r.noAsset).padStart(8), String(r.noMp4).padStart(5));
  }

  console.log(`\nnot playable: ${problems.length}`);
  problems.sort((a, b) => b.c.startDate - a.c.startDate);
  for (const { why, c } of problems.slice(0, 80)) {
    console.log(`${ist(c.startDate)}  ${c._id}  ${why.padEnd(28)} isLive=${c.isLive ? 1 : 0} status=${c.status ?? '-'} updated ${ageH(c.updatedAt)}h ago  ${String(c.title ?? '').slice(0, 50)}`);
  }

  const customer = process.env.CUSTOMER_ID;
  const videos = m.connection.useDb('transcoder').db.collection('videos');
  const jobs = await videos.find(
    { $or: [{ queuedAt: { $gte: since } }, { startedAt: { $gte: since } }], ...(customer ? { clientId: { $in: [customer, Number(customer)] } } : {}) },
    { projection: { clientId: 1, key: 1, status: 1, queuedAt: 1, startedAt: 1, completedAt: 1 } },
  ).toArray().catch((e) => { console.log(`\ntranscoder.videos unreadable: ${e.message}`); return []; });

  const byDay = {};
  for (const j of jobs) {
    const kind = /\.m3u8/.test(j.key || '') || !j.key ? '1C' : '1A/1B';
    const k = `${day(j.queuedAt || j.startedAt)} ${j.clientId} ${kind}`;
    const b = (byDay[k] ||= { n: 0 });
    b.n++;
    b[j.status || '?'] = (b[j.status || '?'] || 0) + 1;
  }
  console.log(`\ntranscoder.videos jobs${customer ? ` for client ${customer}` : ''}: ${jobs.length}`);
  for (const k of Object.keys(byDay).sort()) console.log(k, JSON.stringify(byDay[k]));
  for (const j of jobs.filter((x) => x.status !== 'completed').slice(-40)) {
    console.log(`  ${j.status}  client ${j.clientId}  queued ${ist(j.queuedAt)}  started ${ist(j.startedAt)}  ${String(j.key || '').slice(0, 70)}`);
  }

  await m.disconnect();
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
