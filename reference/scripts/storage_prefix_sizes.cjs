// read-only: object count, bytes and oldest/newest LastModified per top-level prefix
// (and per second-level prefix under TOP2 prefixes, e.g. 561/) for each STORE:BUCKET arg.
// Lists in parallel by walking two delimiter levels, then full listings below.
// Stores r2-source | r2-backup | b2, credentials from the r2-to-r2-backup .env. Writes one
// JSON per bucket to OUT_DIR. Run from ~/workspace/r2-to-r2-backup:
//   OUT_DIR=/path NODE_PATH=$PWD/node_modules node -r dotenv/config <this> dotenv_config_path=.env b2:livestream-selectionway ...
const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const fs = require('fs'); const path = require('path');
const e = process.env; const OUT = e.OUT_DIR || '.'; const CONC = Number(e.CONC || 32);
const S = {
  'r2-source': [e.SOURCE_ENDPOINT, 'auto', e.SOURCE_ACCESS_KEY_ID, e.SOURCE_SECRET_ACCESS_KEY],
  'r2-backup': [e.BACKUP_ENDPOINT, 'auto', e.BACKUP_ACCESS_KEY_ID, e.BACKUP_SECRET_ACCESS_KEY],
  b2: [e.B2_ENDPOINT, e.B2_REGION, e.B2_ACCESS_KEY_ID, e.B2_SECRET_ACCESS_KEY],
};
const mk = (s) => new S3Client({ endpoint: S[s][0], region: S[s][1], maxAttempts: 8, credentials: { accessKeyId: S[s][2], secretAccessKey: S[s][3] } });
async function pool(items, n, fn) { let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const x = items[i++]; await fn(x); } })); }
async function listAll(c, Bucket, Prefix, Delimiter, onObj) {
  const prefixes = []; let ContinuationToken;
  do {
    let r;
    for (let a = 1; ; a++) {
      try { r = await c.send(new ListObjectsV2Command({ Bucket, Prefix, Delimiter, ContinuationToken, MaxKeys: 1000 })); break; }
      catch (err) { if (a >= 12) throw err; await new Promise((ok) => setTimeout(ok, Math.min(30000, 500 * 2 ** a))); }
    }
    (r.Contents || []).forEach(onObj); (r.CommonPrefixes || []).forEach((p) => prefixes.push(p.Prefix));
    ContinuationToken = r.IsTruncated ? r.NextContinuationToken : undefined;
  } while (ContinuationToken);
  return prefixes;
}
(async () => {
  for (const arg of process.argv.slice(2).filter((a) => !a.startsWith('dotenv_'))) {
    const [store, bucket] = arg.split(':'); const c = mk(store); const t0 = Date.now();
    const agg = {}; const sub = {}; let n = 0;
    const add = (top, second, o) => {
      const t = (agg[top] ||= { count: 0, bytes: 0, oldest: null, newest: null });
      t.count++; t.bytes += o.Size; const d = o.LastModified.toISOString();
      if (!t.oldest || d < t.oldest) t.oldest = d; if (!t.newest || d > t.newest) t.newest = d;
      if (second) { const s = ((sub[top] ||= {})[second] ||= { count: 0, bytes: 0, newest: null }); s.count++; s.bytes += o.Size; if (!s.newest || d > s.newest) s.newest = d; }
      if (++n % 200000 === 0) process.stderr.write(`${arg} ${n} objects ${Math.round((Date.now() - t0) / 1000)}s\n`);
    };
    const tops = await listAll(c, bucket, '', '/', (o) => add('(root)', null, o));
    const level2 = [];
    await pool(tops, CONC, async (top) => {
      const seconds = await listAll(c, bucket, top, '/', (o) => add(top, '(direct)', o));
      seconds.forEach((s) => level2.push([top, s]));
    });
    await pool(level2, CONC, async ([top, s]) => { await listAll(c, bucket, s, undefined, (o) => add(top, s.slice(top.length), o)); });
    // keep second-level detail only where it is small enough to read (client-id style tops)
    for (const top of Object.keys(sub)) if (Object.keys(sub[top]).length > 400) delete sub[top];
    const out = { store, bucket, listedAt: new Date().toISOString(), seconds: Math.round((Date.now() - t0) / 1000), objects: n, bytes: Object.values(agg).reduce((a, t) => a + t.bytes, 0), tops: agg, sub };
    fs.writeFileSync(path.join(OUT, `${store}__${bucket}.json`), JSON.stringify(out, null, 1));
    console.log(`${arg}\t${n}\t${(out.bytes / 1e12).toFixed(3)} TB\t${out.seconds}s`);
  }
})().catch((err) => { console.error(err); process.exit(1); });
