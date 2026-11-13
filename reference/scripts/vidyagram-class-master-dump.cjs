#!/usr/bin/env node
// Read-only, Vidyagram only: vidyagram-class-master-dump.cjs <classId>...
// Prints each class's title, status, ingest job state and stored master.m3u8. No credentials or URLs.
const fs = require('fs');
const path = require('path');

const BACKEND = '/Users/raghav/Projects/worktrees/vg-backend';
const BRAIN = path.resolve(__dirname, '..', '..');
const dotenv = require(`${BACKEND}/node_modules/dotenv`);
const r2 = dotenv.parse(fs.readFileSync(path.join(BRAIN, '.env.development')));
const dbEnv = dotenv.parse(fs.readFileSync(`${BACKEND}/.env.development`));
const { S3Client, GetObjectCommand } = require(`${BACKEND}/node_modules/@aws-sdk/client-s3`);
const { MongoClient, ObjectId } = require(`${BACKEND}/node_modules/mongoose`).mongo;

(async () => {
  const ids = process.argv.slice(2);
  if (!ids.length) throw new Error('usage: vidyagram-class-master-dump.cjs <classId>...');
  const s3 = new S3Client({
    endpoint: r2.VIDYAGRAM_R2_ENDPOINT, region: 'auto', maxAttempts: 2,
    credentials: { accessKeyId: r2.VIDYAGRAM_R2_ACCESS_KEY_ID, secretAccessKey: r2.VIDYAGRAM_R2_SECRET_ACCESS_KEY },
  });
  const client = new MongoClient(dbEnv.MONGO_URI, { serverSelectionTimeoutMS: 15000 });
  await client.connect();
  const db = client.db('vidyagramdb');
  for (const id of ids) {
    const c = await db.collection('classes').findOne({ _id: new ObjectId(id) }, { projection: { title: 1, status: 1, 'hlsAsset.key': 1 } });
    if (!c) { console.log(`\n=== ${id} | no such class`); continue; }
    const j = await db.collection('apxingestjobs').findOne({ classId: new ObjectId(id) }, { projection: { status: 1 } });
    const key = c.hlsAsset && c.hlsAsset.key;
    console.log(`\n=== ${id} | ${c.title} | status ${c.status} | job ${j ? j.status : 'none'} | key ${key || 'none'}`);
    if (!key) continue;
    try {
      const r = await s3.send(new GetObjectCommand({ Bucket: r2.VIDYAGRAM_R2_BUCKET, Key: key }));
      console.log((await r.Body.transformToString()).trim());
    } catch (e) { console.log('master read failed', e.name); }
  }
  await client.close();
  s3.destroy();
})().catch((e) => { console.error(e.name, e.message.replace(/mongodb:\/\/\S+/g, '<uri>')); process.exit(1); });
