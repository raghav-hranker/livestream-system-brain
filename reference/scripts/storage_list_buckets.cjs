// read-only: ListBuckets on the source R2, backup R2 and B2 accounts that the
// r2-to-r2-backup .env holds. Prints names + creation dates, never keys.
// Run from ~/workspace/r2-to-r2-backup: NODE_PATH=$PWD/node_modules node -r dotenv/config <this> dotenv_config_path=.env
const { S3Client, ListBucketsCommand } = require('@aws-sdk/client-s3');
const e = process.env;
const stores = {
  'r2-source': { endpoint: e.SOURCE_ENDPOINT, region: 'auto', id: e.SOURCE_ACCESS_KEY_ID, key: e.SOURCE_SECRET_ACCESS_KEY },
  'r2-backup': { endpoint: e.BACKUP_ENDPOINT, region: 'auto', id: e.BACKUP_ACCESS_KEY_ID, key: e.BACKUP_SECRET_ACCESS_KEY },
  b2: { endpoint: e.B2_ENDPOINT, region: e.B2_REGION, id: e.B2_ACCESS_KEY_ID, key: e.B2_SECRET_ACCESS_KEY },
};
(async () => {
  for (const [name, s] of Object.entries(stores)) {
    const c = new S3Client({ endpoint: s.endpoint, region: s.region, credentials: { accessKeyId: s.id, secretAccessKey: s.key } });
    try {
      const r = await c.send(new ListBucketsCommand({}));
      console.log(`## ${name} (${new URL(s.endpoint).host}) — ${r.Buckets.length} buckets`);
      for (const b of r.Buckets) console.log(`${name}\t${b.Name}\t${b.CreationDate?.toISOString().slice(0, 10)}`);
    } catch (err) { console.log(`## ${name}: ${err.name} ${err.message}`); }
  }
})();
