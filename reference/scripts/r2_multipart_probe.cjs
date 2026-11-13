// READ-ONLY. After an InvalidPart upload failure: objects under PREFIX, each multipart upload left open, and which part numbers it is
// missing. BUCKET defaults to recordedvideos-hranker. Run on the GPU box from the checkout that serves the API:
//   ssh ... 'cd /root/livestream-futurekul/backend && PREFIX=168/145902/mp4/ node -' < r2_multipart_probe.cjs
const path = require('path');
const fs = require('fs');
const { S3Client, ListObjectsV2Command, ListMultipartUploadsCommand, ListPartsCommand } = require(path.join(process.cwd(), 'node_modules/@aws-sdk/client-s3'));

const env = Object.fromEntries(fs.readFileSync('/root/video-transcoder/.env', 'utf8').split('\n')
  .filter((l) => /^[A-Za-z0-9_]+=/.test(l))
  .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; }));
const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: env.CLOUDFLARE_ACCESS_KEY_ID, secretAccessKey: env.CLOUDFLARE_SECRET_ACCESS_KEY },
});
const Bucket = process.env.BUCKET || 'recordedvideos-hranker';
const Prefix = process.env.PREFIX;
if (!Prefix) { console.error('PREFIX is required'); process.exit(2); }

(async () => {
  const listed = await s3.send(new ListObjectsV2Command({ Bucket, Prefix }));
  console.log('objects:', (listed.Contents || []).map((o) => `${o.Key.split('/').pop()} ${(o.Size / 1048576).toFixed(1)}MB ${o.LastModified.toISOString()}`).join(' | ') || 'none');
  const open = await s3.send(new ListMultipartUploadsCommand({ Bucket, Prefix }));
  if (!(open.Uploads || []).length) console.log('open multipart uploads: none');
  for (const u of open.Uploads || []) {
    const { Parts = [] } = await s3.send(new ListPartsCommand({ Bucket, Key: u.Key, UploadId: u.UploadId }));
    const have = new Set(Parts.map((p) => p.PartNumber));
    const max = Math.max(0, ...have);
    const missing = Array.from({ length: max }, (_, i) => i + 1).filter((n) => !have.has(n));
    console.log(`${u.Key} started ${u.Initiated.toISOString()}: ${Parts.length} parts, highest ${max}, missing ${missing.join(',') || 'none'}`);
    for (const n of missing) console.log(`  around ${n}:`, Parts.filter((p) => Math.abs(p.PartNumber - n) === 1).map((p) => `#${p.PartNumber} ${p.LastModified.toISOString()}`).join(' | '));
  }
})().catch((e) => { console.error('FAILED', e.name, e.message); process.exit(1); });
