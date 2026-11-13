#!/usr/bin/env node
// Read-only, Vidyagram only: vidyagram-r2-master-sample.cjs [count]
// Prints the first [count] (default 3) stored 781/ master.m3u8 files in listing order, so no Mongo needed.
// Listing order is by key, so these are the oldest class ids, not a random sample.
const fs = require('fs');
const path = require('path');

const BACKEND = '/Users/raghav/Projects/worktrees/vg-backend';
const BRAIN = path.resolve(__dirname, '..', '..');
const dotenv = require(`${BACKEND}/node_modules/dotenv`);
const r2 = dotenv.parse(fs.readFileSync(path.join(BRAIN, '.env.development')));
const { S3Client, ListObjectsV2Command, GetObjectCommand } = require(`${BACKEND}/node_modules/@aws-sdk/client-s3`);

(async () => {
  const count = Number(process.argv[2]) || 3;
  const s3 = new S3Client({
    endpoint: r2.VIDYAGRAM_R2_ENDPOINT, region: 'auto', maxAttempts: 2,
    credentials: { accessKeyId: r2.VIDYAGRAM_R2_ACCESS_KEY_ID, secretAccessKey: r2.VIDYAGRAM_R2_SECRET_ACCESS_KEY },
  });
  const found = [];
  let token;
  for (let page = 0; page < 8 && found.length < count; page += 1) {
    const list = await s3.send(new ListObjectsV2Command({
      Bucket: r2.VIDYAGRAM_R2_BUCKET, Prefix: '781/', MaxKeys: 1000, ContinuationToken: token,
    }));
    for (const o of list.Contents || []) if (o.Key.endsWith('/master.m3u8')) found.push(o);
    token = list.NextContinuationToken;
    if (!token) break;
  }
  console.log(`masters found ${found.length}`);
  for (const o of found.slice(0, count)) {
    const r = await s3.send(new GetObjectCommand({ Bucket: r2.VIDYAGRAM_R2_BUCKET, Key: o.Key }));
    console.log(`\n== ${o.Key} ${o.LastModified.toISOString()}`);
    console.log((await r.Body.transformToString()).trim());
  }
  s3.destroy();
})().catch((e) => { console.error(e.name, e.message.slice(0, 200)); process.exit(1); });
