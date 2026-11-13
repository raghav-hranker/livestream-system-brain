#!/usr/bin/env node
// Vidyagram (781): read-only check of what the upload lane produced for classes: the intake object and its status.json,
// and in recordedvideos-vidyagram the HLS master, its rungs, segment counts, and the first 1 KB of the first and last
// segment of every rung. Credentials CF_VIDYAGRAM_OUTPUT_* (job key, read) from system-brain .env.development; never printed.
//   node vidyagram-intake-output-check.mjs <classId>[,<classId>...]
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const require = createRequire(resolve(process.env.HOME, 'Projects/worktrees/vidyagram-admin-ui/package.json'));
const { S3Client, ListObjectsV2Command, GetObjectCommand } = require('@aws-sdk/client-s3');
const env = Object.fromEntries(readFileSync(resolve(process.env.HOME, 'Projects/system-brain/.env.development'), 'utf8').split('\n')
  .map((l) => l.match(/^(CF_VIDYAGRAM_[A-Z_]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].replace(/^["']|["']$/g, '')]));
const s3 = new S3Client({ region: 'auto', endpoint: env.CF_VIDYAGRAM_OUTPUT_ENDPOINT, credentials: { accessKeyId: env.CF_VIDYAGRAM_OUTPUT_ACCESS_KEY_ID, secretAccessKey: env.CF_VIDYAGRAM_OUTPUT_SECRET_ACCESS_KEY } });
const OUT = env.CF_VIDYAGRAM_OUTPUT_BUCKET; const IN = env.CF_VIDYAGRAM_INTAKE_BUCKET || 'tempvideos-vidyagram';
const text = async (Bucket, Key, Range) => { const r = await s3.send(new GetObjectCommand({ Bucket, Key, Range })); return Buffer.from(await r.Body.transformToByteArray()); };
const list = async (Bucket, Prefix) => { const all = []; let token; do { const r = await s3.send(new ListObjectsV2Command({ Bucket, Prefix, ContinuationToken: token })); all.push(...(r.Contents || [])); token = r.IsTruncated ? r.NextContinuationToken : null; } while (token); return all; };
for (const id of process.argv[2].split(',')) {
  const out = { classId: id };
  const intake = await list(IN, `781/${id}/`);
  out.intake = intake.map((o) => `${o.Key.split('/').pop()} ${o.Size}`);
  const st = intake.find((o) => o.Key.endsWith('status.json'));
  if (st) { try { const s = JSON.parse((await text(IN, st.Key)).toString()); out.intakeStatus = { status: s.status, stage: s.stage || s.step, progress: s.progress, error: s.error ? String(s.error).slice(0, 120) : undefined }; } catch { out.intakeStatus = 'unreadable'; } }
  const objs = await list(OUT, `781/${id}/hls/`);
  out.outputFiles = objs.length;
  const master = objs.find((o) => o.Key.endsWith('/hls/master.m3u8'));
  if (master) {
    const m = (await text(OUT, master.Key)).toString(); const lines = m.split('\n');
    out.rungs = [];
    for (let i = 0; i < lines.length; i++) if (lines[i].startsWith('#EXT-X-STREAM-INF')) {
      const res = (lines[i].match(/RESOLUTION=(\d+x\d+)/) || [])[1]; const pl = lines[i + 1].trim();
      const plKey = master.Key.replace('master.m3u8', pl);
      const p = (await text(OUT, plKey)).toString(); const segs = p.split('\n').map((x) => x.trim()).filter((x) => x && !x.startsWith('#'));
      const dur = p.split('\n').filter((x) => x.startsWith('#EXTINF:')).reduce((a, x) => a + parseFloat(x.slice(8)), 0);
      const ok = [];
      for (const s of [segs[0], segs[segs.length - 1]]) { try { const b = await text(OUT, plKey.replace(/[^/]+$/, s), 'bytes=0-1023'); ok.push(b[0] === 0x47 ? 'ts' : 'not-ts'); } catch (e) { ok.push('missing'); } }
      out.rungs.push(`${res} ${segs.length} segs ${Math.round(dur)} s ${ok.join('/')} ${p.includes('#EXT-X-ENDLIST') ? 'complete' : 'NO ENDLIST'}`);
    }
  }
  console.log(JSON.stringify(out));
}
