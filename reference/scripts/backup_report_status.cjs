// Read-only: latest r2-to-r2-backup daily reports from the backup R2 account.
// Run from ~/workspace/r2-to-r2-backup:
//   NODE_PATH=$PWD/node_modules node <this> [.env|.env.others] [since YYYY-MM-DD]
const path = require('node:path');
const envFile = process.argv[2] || '.env';
require('dotenv').config({ path: path.resolve(envFile), quiet: true });
const { S3Client, ListObjectsV2Command, GetObjectCommand } = require('@aws-sdk/client-s3');

const since = process.argv[3] || new Date(Date.now() - 14 * 864e5).toISOString().slice(0, 10);
const mapping = JSON.parse(process.env.DOMAIN_TO_BUCKET_MAPPING);
const bucket = process.env.REPORTS_BUCKET_NAME || Object.values(mapping)[0];
const client = new S3Client({
  region: 'auto',
  endpoint: process.env.BACKUP_ENDPOINT || `https://${process.env.BACKUP_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: process.env.BACKUP_ACCESS_KEY_ID, secretAccessKey: process.env.BACKUP_SECRET_ACCESS_KEY }
});

(async () => {
  const keys = [];
  let token;
  do {
    const page = await client.send(new ListObjectsV2Command({
      Bucket: bucket, Prefix: 'reports/', StartAfter: token ? undefined : `reports/dual_backup_${since}`, ContinuationToken: token
    }));
    for (const o of page.Contents || []) keys.push({ key: o.Key, modified: o.LastModified });
    token = page.NextContinuationToken;
  } while (token);
  console.log(`${envFile} db=${process.env.MONGODB_DATABASE} bucket=${bucket} reports since ${since}: ${keys.length}`);
  for (const { key, modified } of keys) {
    const body = await (await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }))).Body.transformToString();
    let r;
    try { r = JSON.parse(body); } catch { console.log(key, 'unparseable'); continue; }
    const s = r.summary || {};
    console.log(JSON.stringify({
      key: key.replace('reports/', ''), written: modified?.toISOString(), window: s.windowId || s.dateRange,
      duration: r.duration, docs: s.documentsProcessed, found: s.r2ObjectsFound, copied: s.r2ObjectsCopied,
      skipped: s.r2ObjectsSkipped, GB: s.bytesCopied != null ? +(s.bytesCopied / 1e9).toFixed(1) : undefined,
      failed: s.failed, targets: r.configuration?.targets, firstErrors: (r.errors || []).slice(0, 2).map((e) => e.error || e.message || e)
    }));
  }
})().catch((e) => { console.error(e.name, e.message); process.exit(1); });
