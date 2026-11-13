// READ-ONLY. Builds the list of Atlas test.rooms records missing since the 2026-10-30 loss, from the R2 recorded bucket
// (<client>/<class>/mp4/<name>_<quality>p.mp4) cross-checked with transcoder.videos outputs. Writes nothing to any database or bucket.
// MODE=probe prints the bucket layout, a healthy room's shape and the output hosts. MODE=build prints summary lines to stderr
// and one JSON line per missing class to stdout. CLIENTS=135,514 limits the build.
// Run on the GPU box from the checkout that serves the API:
//   ssh ... 'cd /root/livestream-futurekul/backend && MODE=probe node -' < rooms_rebuild_list.cjs
//   ssh ... 'cd /root/livestream-futurekul/backend && MODE=build CLIENTS=135,514 node -' < rooms_rebuild_list.cjs > list.ndjson
const path = require('path');
const fs = require('fs');
const cwd = process.cwd();
const { S3Client, ListObjectsV2Command } = require(path.join(cwd, 'node_modules/@aws-sdk/client-s3'));
const { MongoClient } = require(path.join(cwd, 'node_modules/mongoose')).mongo;

const envOf = (file) => Object.fromEntries(fs.readFileSync(file, 'utf8').split('\n')
  .filter((l) => /^[A-Za-z0-9_]+=/.test(l))
  .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; }));
const tx = envOf('/root/video-transcoder/.env');
const jm = envOf('/root/video-transcoder/gpu-server/job-manager/.env');
const BUCKET = process.env.BUCKET || 'recordedvideos-hranker';
const CDN = process.env.CDN_HOST || 'https://recordedvideos.hranker.com';
const log = (...a) => console.error(...a);
const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${tx.CF_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: tx.CLOUDFLARE_ACCESS_KEY_ID, secretAccessKey: tx.CLOUDFLARE_SECRET_ACCESS_KEY },
});

const listAll = async (Prefix, Delimiter) => {
  const prefixes = [];
  const objects = [];
  let ContinuationToken;
  do {
    let page;
    for (let attempt = 1; ; attempt++) {
      try {
        page = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix, Delimiter, ContinuationToken }));
        break;
      } catch (e) {
        if (attempt >= 4) throw e;
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }
    for (const p of page.CommonPrefixes || []) prefixes.push(p.Prefix);
    for (const o of page.Contents || []) objects.push(o);
    ContinuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (ContinuationToken);
  return { prefixes, objects };
};
const pool = async (items, n, fn) => {
  let next = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (next < items.length) { const i = next++; await fn(items[i], i); }
  }));
};

(async () => {
  const atlas = new MongoClient(require(path.join(cwd, 'config/config')).dbUri, { serverSelectionTimeoutMS: 20000, socketTimeoutMS: 240000 });
  await atlas.connect();
  const rooms = atlas.db('test').collection('rooms');
  const job = new MongoClient(jm.MONGO_URI, { serverSelectionTimeoutMS: 20000, socketTimeoutMS: 240000 });
  await job.connect();
  const videos = job.db('transcoder').collection('videos');

  if ((process.env.MODE || 'probe') === 'probe') {
    const sample = await rooms.findOne({ status: 'recorded', 'mp4Recordings.0': { $exists: true } }, { sort: { _id: -1 } });
    const redacted = { ...sample, mp4Recordings: sample?.mp4Recordings?.slice(0, 1) };
    console.log('healthy room shape:', JSON.stringify(redacted).slice(0, 700));
    console.log('room field sets:', JSON.stringify(Object.keys(sample || {})));
    const top = await listAll('', '/');
    console.log(`bucket ${BUCKET}: ${top.prefixes.length} top folders:`, top.prefixes.slice(0, 50).join(' '));
    const classes = await listAll('514/', '/');
    console.log(`514: ${classes.prefixes.length} class folders, e.g. ${classes.prefixes.slice(0, 3).join(' ')}`);
    const one = await listAll('514/139750/', '/');
    console.log('514/139750 folders:', one.prefixes.join(' '), 'files:', one.objects.map((o) => o.Key).slice(0, 4).join(' '));
    const mp4 = await listAll('514/139750/mp4/');
    console.log('its mp4s:', mp4.objects.map((o) => `${o.Key} ${(o.Size / 1048576).toFixed(1)}MB`).join(' | '));
    const hosts = {};
    for await (const d of videos.find({ status: 'completed', 'outputs.0': { $exists: true } }, { projection: { 'outputs.url': 1, clientId: 1 } })) {
      let h = '?';
      try { h = new URL(d.outputs[0].url).host; } catch (e) { /* keep ? */ }
      const k = `${h} client ${/^\d+$/.test(String(d.clientId)) ? d.clientId : 'other'}`;
      hosts[k] = (hosts[k] || 0) + 1;
    }
    console.log('output hosts:', JSON.stringify(hosts));
  } else {
    const present = new Set((await rooms.find({ 'mp4Recordings.0': { $exists: true } }, { projection: { classId: 1 } }).toArray()).map((r) => String(r.classId)));
    const wanted = (process.env.CLIENTS || '').split(',').filter(Boolean);
    const top = await listAll('', '/');
    const clients = top.prefixes.map((p) => p.replace('/', '')).filter((c) => /^\d+$/.test(c) && (!wanted.length || wanted.includes(c)));
    const summary = {};
    for (const client of clients) {
      const s = (summary[client] = { folders: 0, present: 0, build: 0, noMp4: 0, manyNames: 0, jobAgrees: 0, jobDiffers: 0, noJob: 0 });
      const jobs = {};
      for await (const d of videos.find({ clientId: { $in: [client, Number(client)] }, status: 'completed', 'outputs.0': { $exists: true } }, { projection: { classId: 1, outputs: 1, completedAt: 1 } }).sort({ completedAt: 1 })) {
        if (d.classId) jobs[String(d.classId)] = d;
      }
      const folders = (await listAll(`${client}/`, '/')).prefixes;
      s.folders = folders.length;
      const built = new Set();
      await pool(folders, 16, async (prefix) => {
        const classId = prefix.split('/')[1];
        if (present.has(classId)) { s.present++; return; }
        const { objects } = await listAll(`${prefix}mp4/`);
        const files = objects.map((o) => ({ key: o.Key, size: o.Size, at: o.LastModified, m: /\/([^/]+)_(\d+p)\.mp4$/.exec(o.Key) })).filter((f) => f.m && f.size > 0);
        if (!files.length) { s.noMp4++; return; }
        const names = new Set(files.map((f) => f.m[1]));
        if (names.size > 1) s.manyNames++;
        // A re-uploaded class has several names: keep only the newest upload, so qualities never mix two versions.
        const latestName = files.reduce((a, f) => (f.at > a.at ? f : a)).m[1];
        const newest = {};
        for (const f of files) if (f.m[1] === latestName) newest[f.m[2]] = f;
        built.add(classId);
        const recordings = Object.entries(newest)
          .sort((a, b) => parseInt(b[0], 10) - parseInt(a[0], 10))
          .map(([quality, f]) => ({ quality, url: `${CDN}/${f.key.split('/').map(encodeURIComponent).join('/')}`, size: Number((f.size / 1048576).toFixed(2)) }));
        const j = jobs[classId];
        let check = 'noJob';
        if (j) {
          const fromJob = new Set(j.outputs.map((o) => o.url));
          check = recordings.every((r) => fromJob.has(r.url)) && recordings.length === fromJob.size ? 'jobAgrees' : 'jobDiffers';
        }
        s[check]++;
        s.build++;
        console.log(JSON.stringify({ clientId: client, classId, check, names: names.size, recordings }));
      });
      // Live-class MP4s sit on another bucket, so a finished job with no folder here is still a class to restore.
      s.jobOnly = 0;
      for (const [classId, j] of Object.entries(jobs)) {
        if (present.has(classId) || built.has(classId)) continue;
        s.jobOnly++;
        s.build++;
        const recordings = j.outputs.map((o) => ({ quality: o.quality, url: o.url, size: Number(o.size) || undefined }));
        console.log(JSON.stringify({ clientId: client, classId, check: 'jobOnly', names: 1, recordings }));
      }
      log(`client ${client}: ${JSON.stringify(s)}`);
    }
    log('TOTAL', JSON.stringify(Object.values(summary).reduce((a, s) => { for (const k of Object.keys(s)) a[k] = (a[k] || 0) + s[k]; return a; }, {})));
  }
  await atlas.close();
  await job.close();
})().catch((e) => { console.error('FAILED', e.name, e.message); process.exit(1); });
