#!/usr/bin/env node
'use strict';
// Read-only, Vidyagram only. Cross-checks vidyagram-apx-menu-master.cjs with its own simple text
// test, over every class that has an hlsAsset (AppX import or not), and lists class folders in
// the bucket to find masters no class points at. Prints ids, titles and labels, no URLs.
//   node vidyagram-apx-menu-coverage.cjs [--out <file.json>]
const fs = require('fs');
const path = require('path');

const BACKEND = '/Users/raghav/Projects/worktrees/vg-backend';
const BRAIN = path.resolve(__dirname, '..', '..');
const BUCKET = 'recordedvideos-vidyagram';
const dotenv = require(`${BACKEND}/node_modules/dotenv`);
const r2 = dotenv.parse(fs.readFileSync(path.join(BRAIN, '.env.development')));
const dbEnv = dotenv.parse(fs.readFileSync(`${BACKEND}/.env.development`));
const { S3Client, GetObjectCommand, ListObjectsV2Command } = require(`${BACKEND}/node_modules/@aws-sdk/client-s3`);
const { MongoClient } = require(`${BACKEND}/node_modules/mongoose`).mongo;

// Which AppX aliases this master lacks, by plain text. Independent of planMaster on purpose.
function lacking(text) {
  const has = (name) => text.includes(`NAME="${name}"`);
  const out = [];
  if (/^480p\.m3u8$/m.test(text) && !has('720p')) out.push('720p');
  if (/^480p\.m3u8$/m.test(text) && !has('480p')) out.push('480p');
  if (/^240p\.m3u8$/m.test(text) && !has('240p')) out.push('240p');
  if (/^240p\.m3u8$/m.test(text) && !has('144p')) out.push('144p');
  return out;
}

async function main() {
  if (r2.VIDYAGRAM_R2_BUCKET !== BUCKET) throw new Error('VIDYAGRAM_R2_BUCKET is not the Vidyagram bucket');
  const s3 = new S3Client({
    endpoint: r2.VIDYAGRAM_R2_ENDPOINT, region: 'auto', maxAttempts: 3,
    credentials: { accessKeyId: r2.VIDYAGRAM_R2_ACCESS_KEY_ID, secretAccessKey: r2.VIDYAGRAM_R2_SECRET_ACCESS_KEY },
  });
  const client = new MongoClient(dbEnv.MONGO_URI, { serverSelectionTimeoutMS: 15000 });
  await client.connect();
  const classes = await client.db('vidyagramdb').collection('classes')
    .find({ 'hlsAsset.key': { $exists: true, $nin: [null, ''] } }, { projection: { title: 1, status: 1, apxAssetKey: 1, 'hlsAsset.key': 1 } }).toArray();
  const totalClasses = await client.db('vidyagramdb').collection('classes').countDocuments({});
  await client.close();

  const read = async (key) => (await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }))).Body.transformToString();
  const report = { at: new Date().toISOString(), totalClasses, classesWithHls: classes.length, read: 0, full: 0, failed: [], lackingAliases: [], otherShape: [] };
  let next = 0;
  await Promise.all(Array.from({ length: 12 }, async () => {
    while (next < classes.length) {
      const c = classes[next]; next += 1;
      const row = { classId: String(c._id), title: c.title, status: c.status, appxImport: Boolean(c.apxAssetKey), key: c.hlsAsset.key };
      let text;
      try { text = await read(c.hlsAsset.key); } catch (e) { report.failed.push({ ...row, error: e.name }); continue; }
      report.read += 1;
      const files = [...text.matchAll(/^(?!#)(\S+)$/gm)].map((m) => m[1]);
      const missing = lacking(text);
      if (missing.length) report.lackingAliases.push({ ...row, missing, files: [...new Set(files)] });
      else if (!files.includes('480p.m3u8') && !files.includes('240p.m3u8')) report.otherShape.push({ ...row, files: [...new Set(files)] });
      else report.full += 1;
    }
  }));

  // Class folders in the bucket that no class's hlsAsset points at.
  const referenced = new Set(classes.map((c) => c.hlsAsset.key.split('/').slice(0, 2).join('/')));
  const folders = [];
  let token;
  do {
    const page = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: '781/', Delimiter: '/', ContinuationToken: token }));
    for (const p of page.CommonPrefixes || []) folders.push(p.Prefix.replace(/\/$/, ''));
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  const unreferenced = folders.filter((f) => !referenced.has(f));
  report.bucketClassFolders = folders.length;
  report.unreferencedFolders = unreferenced.length;
  report.unreferencedMasters = [];
  for (const folder of unreferenced) {
    try {
      const text = await read(`${folder}/hls/master.m3u8`);
      report.unreferencedMasters.push({ folder, missing: lacking(text) });
    } catch { /* no hls master in this folder */ }
  }
  s3.destroy();

  const out = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : null;
  if (out) fs.writeFileSync(out, JSON.stringify(report, null, 1));
  console.log(JSON.stringify(report, null, 1));
}

main().catch((e) => { console.error(e.name, e.message.replace(/mongodb:\/\/\S+/g, '<uri>')); process.exit(1); });
