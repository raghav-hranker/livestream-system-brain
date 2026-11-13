// **Writes** with COMMIT=1, dry run by default. Puts one failed standard (1A/1B) upload job back at the head of its queue, under its own
// job id. The Redis payload is gone once a job ends, so it is rebuilt from a queued job of the same client, bucket and storage: id, key and
// roomId change, credentials and config are that job's. Refuses unless Mongo says failed, the job is not queued or running, and the
// job is not secured. Prints no credentials. Run on the GPU box:
//   ssh ... 'cd /root/video-transcoder/gpu-server/job-manager && KEY=168/145902/Inflation_PART_01.mp4 NODE_PATH=$PWD/node_modules node -' < requeue_failed_job.cjs
require('dotenv').config();
const { execSync } = require('child_process');
const { createClient } = require('redis');
const { MongoClient } = require('mongodb');

const QUEUES = ['queue:critical', 'queue:high', 'queue:normal', 'queue:low'];
const KEY = process.env.KEY;
if (!KEY) { console.error('KEY is required'); process.exit(2); }
const stop = (why) => { console.log(`REFUSED: ${why}`); process.exit(3); };

(async () => {
  const m = new MongoClient(process.env.MONGO_URI);
  await m.connect();
  const videos = m.db(process.env.MONGO_DB || 'transcoder').collection('videos');
  const rec = await videos.findOne({ key: KEY }, { sort: { queuedAt: -1 } });
  if (!rec) stop('no job record for this key');
  if (rec.status !== 'failed') stop(`job record is ${rec.status}`);

  const url = process.env.REDIS_URL;
  const r = url ? createClient({ url }) : createClient({
    socket: { host: process.env.REDIS_HOST, port: Number(process.env.REDIS_PORT || 6379) },
    username: process.env.REDIS_USERNAME || undefined, password: process.env.REDIS_PASSWORD || undefined,
  });
  await r.connect();

  let template = null;
  for (const q of QUEUES) {
    for (const s of await r.lRange(q, 0, -1)) {
      if (s.includes(`"${KEY}"`)) stop(`already in ${q}`);
      const j = JSON.parse(s);
      if (!template && !j.jobType && j.key && j.credentials && j.config && !j.config.secured && String(j.clientId) === String(rec.clientId)
        && j.bucketName === rec.bucketName && (j.storageProvider || 'r2') === (rec.storageProvider || 'r2')) template = { q, j };
    }
  }
  if (!template) stop('no queued job of this client and bucket to rebuild from');
  const running = execSync(`docker ps --format '{{.ID}}' | xargs -r docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}'`, { encoding: 'utf8' });
  if (running.includes(`JOB_ID=${rec._id}\n`)) stop('a container is running this job');

  const hash = await r.hGetAll(`job:${rec._id}`);
  const dedupe = hash.dedupeKey ? await r.hGet('processing:dedupe', hash.dedupeKey) : null;
  console.log(`job ${String(rec._id).slice(0, 24)} client ${rec.clientId} status ${rec.status}; redis status ${hash.status || '-'}, dedupe holder ${dedupe ? String(dedupe).slice(0, 24) : 'none'}`);
  if (dedupe && dedupe !== rec._id) stop('another job holds the dedupe key');

  const job = { ...template.j, id: rec._id, key: KEY, roomId: rec.classId || KEY.split('/')[1], createdAt: Date.now() };
  console.log(`rebuilt from ${String(template.j.id).slice(0, 24)}: room ${job.roomId}, upload ${job.config.uploadBucket}, target head of ${template.q}`);
  if (process.env.COMMIT === '1') {
    await r.lPush(template.q, JSON.stringify(job));
    console.log(`pushed; ${template.q} length ${await r.lLen(template.q)}`);
  } else console.log('dry run: nothing pushed');
  await r.quit();
  await m.close();
})().catch((e) => { console.error('FAILED', e.message.replace(/(mongodb(\+srv)?|rediss?):\/\/\S+/g, '<uri>')); process.exit(1); });
