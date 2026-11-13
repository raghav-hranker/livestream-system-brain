// READ-ONLY. The second half of the rooms rebuild: 1C live-recording MP4s in the R2 bucket livestream-recorded-hranker
// (<classId>/output_<quality>.mp4), which rooms_rebuild_list.cjs never listed. Writes nothing to any database or bucket.
// Summary lines go to stderr; one JSON line per class with MP4s and no recordings in test.rooms goes to stdout, in the shape
// rooms_restore_apply.cjs and rooms_fill_empty.cjs take. clientId comes from transcoder.videos when a job knows the class, else null.
// Run on the GPU box from the checkout that serves the API:
//   ssh ... 'cd /root/livestream-futurekul/backend && node -' < rooms_rebuild_live_list.cjs > live-list.ndjson
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
const BUCKET = 'livestream-recorded-hranker';
const CDN = 'https://livestreamrecorded.hranker.com';
const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${tx.CF_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: tx.CLOUDFLARE_ACCESS_KEY_ID, secretAccessKey: tx.CLOUDFLARE_SECRET_ACCESS_KEY },
});
const log = (...a) => console.error(...a);

(async () => {
  const classes = new Map();
  const other = {};
  let token; let objects = 0;
  do {
    const page = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, ContinuationToken: token }));
    for (const o of page.Contents || []) {
      objects++;
      const m = /^([^/]+)\/output_(\d+p)\.mp4$/.exec(o.Key);
      if (!m) { const k = o.Key.split('/').length + ' parts, .' + o.Key.split('.').pop(); other[k] = (other[k] || 0) + 1; continue; }
      const c = classes.get(m[1]) || { recordings: [], modified: 0 };
      c.recordings.push({ quality: m[2], url: `${CDN}/${o.Key}`, size: Math.round(o.Size / 10485.76) / 100 });
      c.modified = Math.max(c.modified, +o.LastModified);
      classes.set(m[1], c);
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
    if (objects % 50000 < 1000) log(`listed ${objects}`);
  } while (token);
  log(`bucket ${BUCKET}: ${objects} objects, ${classes.size} classes; other keys ${JSON.stringify(other)}`);

  const atlas = new MongoClient(require(path.join(cwd, 'config/config')).dbUri, { serverSelectionTimeoutMS: 20000, socketTimeoutMS: 240000 });
  await atlas.connect();
  const rooms = atlas.db('test').collection('rooms');
  const job = new MongoClient(jm.MONGO_URI, { serverSelectionTimeoutMS: 20000, socketTimeoutMS: 240000 });
  await job.connect();
  const videos = job.db(jm.MONGO_DB || 'transcoder').collection('videos');

  const ids = [...classes.keys()];
  const roomOf = new Map();
  for (let i = 0; i < ids.length; i += 500) {
    for (const d of await rooms.find({ classId: { $in: ids.slice(i, i + 500) } }, { projection: { classId: 1, clientId: 1, mp4Recordings: 1 } }).toArray()) roomOf.set(d.classId, d);
  }
  const clientOf = new Map();
  for await (const d of videos.find({ _id: /^hls-/ }, { projection: { clientId: 1, classId: 1 } })) {
    const id = d.classId || d._id.split('-').slice(2).join('-');
    if (d.clientId) clientOf.set(id, String(d.clientId));
  }

  const count = { hasRecordings: 0, absent: 0, emptyRoom: 0 };
  const shape = {}; const byClient = {}; const byMonth = {};
  for (const [classId, c] of classes) {
    const r = roomOf.get(classId);
    if (r && (r.mp4Recordings || []).length) { count.hasRecordings++; continue; }
    count[r ? 'emptyRoom' : 'absent']++;
    const kind = /^\d+$/.test(classId) ? 'numeric' : /^[0-9a-f]{24}$/.test(classId) ? 'objectId' : 'other';
    const clientId = (r && r.clientId) || clientOf.get(classId) || null;
    shape[kind] = (shape[kind] || 0) + 1;
    byClient[clientId || 'unknown'] = (byClient[clientId || 'unknown'] || 0) + 1;
    const month = new Date(c.modified).toISOString().slice(0, 7);
    byMonth[month] = (byMonth[month] || 0) + 1;
    console.log(JSON.stringify({ clientId, classId, kind, roomState: r ? 'empty' : 'absent', modified: month, recordings: c.recordings }));
  }
  log('against test.rooms:', JSON.stringify(count));
  log('missing by id shape:', JSON.stringify(shape));
  log('missing by client (from room or job log):', JSON.stringify(byClient));
  log('missing by file month:', JSON.stringify(byMonth));
  await atlas.close(); await job.close();
})().catch((e) => { console.error('FAILED', e.message.replace(/mongodb(\+srv)?:\/\/\S+/g, '<uri>')); process.exit(1); });
