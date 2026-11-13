#!/usr/bin/env node
// Vidyagram (781): upload one recovered MP4 into the class upload lane, exactly where the admin's class video upload
// puts it: tempvideos-vidyagram/781/<classId>/<file>. The R2 object-create event queues a secured GPU job that writes
// the HLS ladder to recordedvideos-vidyagram and sets Class.hlsAsset through backend.vidyagramar.com.
// **Writes** one intake object (every object there becomes a job). Refuses if any object already sits under
// 781/<classId>/ unless --again. Multipart, resumable by rerunning (lib-storage re-sends the parts).
// Credentials: R2_VIDEO_UPLOAD_* from system-brain .env.development (never printed).
//   node vidyagram-intake-upload.mjs <classId> <file.mp4> [--name recording-uhs-<date>.mp4] [--again]
import { createRequire } from 'node:module';
import { readFileSync, createReadStream, statSync } from 'node:fs';
import { basename, resolve } from 'node:path';
const require = createRequire(resolve(process.env.HOME, 'Projects/worktrees/vidyagram-admin-ui/package.json'));
const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const [classId, file, ...rest] = process.argv.slice(2);
if (!/^[0-9a-f]{24}$/.test(classId || '') || !file) { console.error('usage: <classId> <file.mp4> [--name x.mp4] [--again]'); process.exit(2); }
const name = rest.includes('--name') ? rest[rest.indexOf('--name') + 1] : basename(file);
if (!/^[\w.-]+\.mp4$/.test(name)) throw new Error('bad object name');
const env = Object.fromEntries(readFileSync(resolve(process.env.HOME, 'Projects/system-brain/.env.development'), 'utf8').split('\n')
  .map((l) => l.match(/^(R2_VIDEO_UPLOAD_[A-Z_]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].replace(/^["']|["']$/g, '')]));
if (env.R2_VIDEO_UPLOAD_BUCKET !== 'tempvideos-vidyagram') throw new Error('intake bucket is not tempvideos-vidyagram; refusing');
const s3 = new S3Client({ region: 'auto', endpoint: env.R2_VIDEO_UPLOAD_ENDPOINT, credentials: { accessKeyId: env.R2_VIDEO_UPLOAD_KEY_ID, secretAccessKey: env.R2_VIDEO_UPLOAD_KEY_SECRET } });
const prefix = `781/${classId}/`;
const have = await s3.send(new ListObjectsV2Command({ Bucket: env.R2_VIDEO_UPLOAD_BUCKET, Prefix: prefix }));
const existing = (have.Contents || []).map((o) => `${o.Key.slice(prefix.length)} ${o.Size}`);
if (existing.length && !rest.includes('--again')) { console.log(JSON.stringify({ classId, refused: 'intake already has objects for this class', existing })); process.exit(1); }
const size = statSync(file).size;
const up = new Upload({ client: s3, params: { Bucket: env.R2_VIDEO_UPLOAD_BUCKET, Key: prefix + name, Body: createReadStream(file), ContentType: 'video/mp4' }, partSize: 64 * 1024 * 1024, queueSize: 4 });
let last = 0; up.on('httpUploadProgress', (p) => { const pct = Math.floor((p.loaded / size) * 100); if (pct >= last + 25) { last = pct; console.log(JSON.stringify({ classId, uploadedPct: pct })); } });
await up.done();
const after = await s3.send(new ListObjectsV2Command({ Bucket: env.R2_VIDEO_UPLOAD_BUCKET, Prefix: prefix }));
const obj = (after.Contents || []).find((o) => o.Key === prefix + name);
console.log(JSON.stringify({ classId, key: prefix + name, bytes: obj?.Size, matchesFile: obj?.Size === size, otherObjects: existing }));
