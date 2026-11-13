// SelectionWay exit (2026-11-09): sets expiry rules that delete every top-level folder of the listed buckets
// except the KEEP folders. The storage provider deletes in the background (R2 within ~1 day, B2 hide + delete
// within ~2 days). Dry run by default. **COMMIT=1 writes the rules: permanent deletion.**
//
// The rules are built from the storage_prefix_sizes.cjs JSON files in INV_DIR. A dry run prints, per bucket, what
// is deleted, what is kept and the rules. Existing rules are kept. Ours have ID / prefix tag `sw-exit-`.
// STORES: a comma list of r2-backup and/or b2. The main R2 key cannot write lifecycle rules.
// Run from ~/workspace/r2-to-r2-backup:
//   INV_DIR=<dir> STORES=r2-backup,b2 [COMMIT=1] NODE_PATH=$PWD/node_modules node -r dotenv/config <this> dotenv_config_path=.env
const { S3Client, GetBucketLifecycleConfigurationCommand, PutBucketLifecycleConfigurationCommand } = require('@aws-sdk/client-s3');
const fs = require('fs'); const path = require('path');
const e = process.env; const COMMIT = e.COMMIT === '1';
const STORES = (e.STORES || '').split(',').filter(Boolean);
const PLAN = { // bucket -> folders to keep; every other top-level folder is deleted. selectionway-server is never touched.
  'tempvideos-selectionway': ['695/'],
  'recordedvideos-selectionway': ['472/', '695/', '408/', '442/'],
  'livestream-selectionway': ['135/', '168/', '534/', '552/', '695/', 'reports/', 'errors/'],
  'livestream-recorded': [],
};
const gb = (b) => (b / 1e9).toFixed(1) + ' GB';

function planFor(store, bucket) {
  const inv = JSON.parse(fs.readFileSync(path.join(e.INV_DIR, `${store}__${bucket}.json`), 'utf8'));
  const keep = PLAN[bucket]; const tops = Object.entries(inv.tops);
  const kept = tops.filter(([k]) => keep.includes(k));
  const gone = tops.filter(([k]) => !keep.includes(k));
  // no keep folder in this copy -> one whole-bucket rule (also covers root files)
  const prefixes = kept.length === 0 ? [''] : gone.map(([k]) => k);
  if (prefixes.includes('(root)')) throw new Error(`${store}:${bucket} has root files next to kept folders; handle by hand`);
  for (const p of prefixes) for (const k of keep) if (p !== '' && k.startsWith(p)) throw new Error(`${p} would hit kept ${k}`);
  const sum = (rows) => rows.reduce((a, [, t]) => [a[0] + t.count, a[1] + t.bytes], [0, 0]);
  return { inv, prefixes, kept, gone, del: sum(gone), keepSum: sum(kept) };
}

async function r2(bucket, prefixes) {
  const c = new S3Client({ endpoint: e.BACKUP_ENDPOINT, region: 'auto', credentials: { accessKeyId: e.BACKUP_ACCESS_KEY_ID, secretAccessKey: e.BACKUP_SECRET_ACCESS_KEY } });
  const cur = (await c.send(new GetBucketLifecycleConfigurationCommand({ Bucket: bucket })).catch(() => ({ Rules: [] }))).Rules || [];
  const others = cur.filter((r) => !String(r.ID).startsWith('sw-exit-'));
  const ours = prefixes.map((p, i) => ({ ID: `sw-exit-${i}`, Status: 'Enabled', Filter: { Prefix: p }, Expiration: { Days: 1 } }));
  if (COMMIT) {
    await c.send(new PutBucketLifecycleConfigurationCommand({ Bucket: bucket, LifecycleConfiguration: { Rules: [...others, ...ours] } }));
    const back = (await c.send(new GetBucketLifecycleConfigurationCommand({ Bucket: bucket }))).Rules;
    console.log(`  WROTE r2-backup:${bucket}: ${back.length} rules now:`, back.map((r) => `${r.ID}[${r.Filter?.Prefix ?? ''}]`).join(' '));
  }
}

let b2auth;
async function b2(bucket, prefixes) {
  if (!b2auth) b2auth = await fetch('https://api.backblazeb2.com/b2api/v3/b2_authorize_account', { headers: { Authorization: 'Basic ' + Buffer.from(`${e.B2_ACCESS_KEY_ID}:${e.B2_SECRET_ACCESS_KEY}`).toString('base64') } }).then((r) => r.json());
  const api = b2auth.apiInfo.storageApi.apiUrl; const H = { Authorization: b2auth.authorizationToken };
  const { buckets } = await fetch(`${api}/b2api/v3/b2_list_buckets`, { method: 'POST', headers: H, body: JSON.stringify({ accountId: b2auth.accountId, bucketName: bucket }) }).then((r) => r.json());
  const b = buckets[0]; if (!b) throw new Error(`b2 bucket ${bucket} not found`);
  if (b.lifecycleRules.length) throw new Error(`b2:${bucket} already has rules; merge by hand: ${JSON.stringify(b.lifecycleRules)}`);
  const rules = prefixes.map((p) => ({ fileNamePrefix: p, daysFromUploadingToHiding: 1, daysFromHidingToDeleting: 1 }));
  if (COMMIT) {
    const r = await fetch(`${api}/b2api/v3/b2_update_bucket`, { method: 'POST', headers: H, body: JSON.stringify({ accountId: b2auth.accountId, bucketId: b.bucketId, lifecycleRules: rules }) }).then((x) => x.json());
    if (!r.lifecycleRules) throw new Error(`b2_update_bucket ${bucket}: ${r.code} ${r.message}`);
    console.log(`  WROTE b2:${bucket}: ${r.lifecycleRules.length} rules now:`, r.lifecycleRules.map((x) => `[${x.fileNamePrefix}]`).join(' '));
  }
}

(async () => {
  if (!STORES.length || STORES.some((s) => !['r2-backup', 'b2'].includes(s))) throw new Error('STORES must be r2-backup and/or b2');
  console.log(COMMIT ? '*** COMMIT: writing expiry rules ***' : 'dry run (COMMIT=1 to write)');
  let total = 0;
  for (const store of STORES) for (const bucket of Object.keys(PLAN)) {
    const p = planFor(store, bucket); total += p.del[1];
    console.log(`## ${store}:${bucket} (listed ${p.inv.listedAt.slice(0, 16)}) DELETE ${p.del[0]} objects ${gb(p.del[1])} | KEEP ${p.kept.map(([k, t]) => `${k} ${t.count}`).join(', ') || 'nothing'} (${gb(p.keepSum[1])})`);
    console.log(`  rules on prefixes: ${p.prefixes.map((x) => JSON.stringify(x)).join(' ')}`);
    if (store === 'r2-backup') await r2(bucket, p.prefixes); else await b2(bucket, p.prefixes);
  }
  console.log(`TOTAL to delete: ${(total / 1e12).toFixed(3)} TB`);
})().catch((err) => { console.error('STOPPED:', err.message); process.exit(1); });
