// read-only: for each STORE:BUCKET arg, the top-level prefixes (delimiter '/'), the first
// root-level keys and whether the account can read it. Stores: r2-source | r2-backup | b2,
// credentials from the r2-to-r2-backup .env. Never prints keys.
// Run from ~/workspace/r2-to-r2-backup: NODE_PATH=$PWD/node_modules node -r dotenv/config <this> dotenv_config_path=.env b2:livestream-selectionway ...
const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const e = process.env;
const S = {
  'r2-source': [e.SOURCE_ENDPOINT, 'auto', e.SOURCE_ACCESS_KEY_ID, e.SOURCE_SECRET_ACCESS_KEY],
  'r2-backup': [e.BACKUP_ENDPOINT, 'auto', e.BACKUP_ACCESS_KEY_ID, e.BACKUP_SECRET_ACCESS_KEY],
  b2: [e.B2_ENDPOINT, e.B2_REGION, e.B2_ACCESS_KEY_ID, e.B2_SECRET_ACCESS_KEY],
};
const client = (s) => new S3Client({ endpoint: S[s][0], region: S[s][1], credentials: { accessKeyId: S[s][2], secretAccessKey: S[s][3] } });
(async () => {
  for (const arg of process.argv.slice(2).filter((a) => !a.startsWith('dotenv_'))) {
    const [store, bucket, prefix = ''] = arg.split(':');
    const c = client(store);
    try {
      const prefixes = []; const roots = []; let token;
      do {
        const r = await c.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, Delimiter: '/', ContinuationToken: token, MaxKeys: 1000 }));
        (r.CommonPrefixes || []).forEach((p) => prefixes.push(p.Prefix));
        (r.Contents || []).forEach((o) => roots.push(o));
        token = r.IsTruncated ? r.NextContinuationToken : undefined;
      } while (token && prefixes.length < 20000);
      console.log(`## ${arg}: ${prefixes.length} prefixes, ${roots.length} root objects`);
      console.log('  prefixes:', prefixes.slice(0, 25).join(' '), prefixes.length > 25 ? '…' : '');
      if (roots.length) console.log('  roots:', roots.slice(0, 5).map((o) => `${o.Key} ${o.Size} ${o.LastModified.toISOString().slice(0, 10)}`).join(' | '));
    } catch (err) { console.log(`## ${arg}: ${err.name} ${err.message}`); }
  }
})();
