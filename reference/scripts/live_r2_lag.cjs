// read-only: per live class, each rung's R2 playlist.m3u8 → last segment, and HEAD of the last 3 listed segments
require('dotenv').config({ path: '.env' });
const { S3Client, GetObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const c = new S3Client({ endpoint: process.env.LIVE_STORAGE_ENDPOINT || process.env.STORAGE_ENDPOINT, region: 'auto',
  credentials: { accessKeyId: process.env.LIVE_STORAGE_ACCESS_KEY_ID || process.env.STORAGE_ACCESS_KEY_ID,
    secretAccessKey: process.env.LIVE_STORAGE_SECRET_ACCESS_KEY || process.env.STORAGE_SECRET_ACCESS_KEY } });
const B = process.env.LIVE_S3_BUCKET_NAME || 'livestream-hranker-v2';
(async () => {
  for (const cls of process.argv.slice(2)) {
    const row = [];
    for (const q of [0, 1, 2, 3]) {
      const key = `472/${cls}/${q}/playlist.m3u8`;
      try {
        const o = await c.send(new GetObjectCommand({ Bucket: B, Key: key }));
        const txt = await o.Body.transformToString();
        const segs = txt.split('\n').filter(l => l.endsWith('.ts'));
        const last = segs.slice(-3);
        const miss = [];
        for (const s of last) { try { await c.send(new HeadObjectCommand({ Bucket: B, Key: `472/${cls}/${q}/${s}` })); } catch { miss.push(s); } }
        const ageS = Math.round((Date.now() - o.LastModified.getTime()) / 1000);
        row.push(`r${q}: last=${segs.at(-1)?.match(/\d+/)[0]} age=${ageS}s missing=[${miss.join(',')}]`);
      } catch (e) { row.push(`r${q}: ${e.name}`); }
    }
    console.log(new Date().toISOString().slice(11, 19), cls.slice(-6), row.join(' | '));
  }
})();
