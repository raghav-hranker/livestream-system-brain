#!/usr/bin/env node
// Convert an authorized APX UHS3 player metadata export into a private recovery capture.
// Never commit the input or output: both contain short-lived signed media URLs and keys.
import { createHash, createDecipheriv } from 'node:crypto';
import { open, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const [sourcePath, tokenPath, quality, outputPath] = process.argv.slice(2);
if (!sourcePath || !tokenPath || !quality || !outputPath) {
  console.error('Usage: node apx-uhs-source-to-capture.mjs SOURCE.json TOKEN.json QUALITY OUTPUT.json');
  process.exit(2);
}

const source = JSON.parse(await readFile(sourcePath, 'utf8'));
const { token } = JSON.parse(await readFile(tokenPath, 'utf8'));
if (!/^[0-9a-f]{24}$/.test(source.classId || '') || !/^[0-9]+$/.test(String(source.apxVideoId || ''))) {
  throw new Error('invalid destination class or APX video ID');
}
if (typeof token !== 'string' || token.length < 20 || typeof source.datetime !== 'string' ||
    typeof source.ivb6 !== 'string') throw new Error('incomplete player metadata');
const rung = source.qualities?.find((entry) => entry.quality === quality);
if (!rung || !rung.kstr || !rung.jstr) throw new Error(`quality ${quality} missing from capture`);

// APX's combined-img-player uses sha256(datetime + token slice) as the AES key.
const tail = source.datetime.slice(-4);
const start = Number(tail[0]);
const end = Number(tail.slice(1, 3));
const bits = ({ '6': 128, '7': 192, '8': 256 })[tail[3]];
if (!Number.isInteger(start) || !Number.isInteger(end) || start >= end || end > token.length || !bits) {
  throw new Error('unsupported UHS3 key derivation');
}
const key = createHash('sha256').update(source.datetime + token.slice(start, end)).digest().subarray(0, bits / 8);
const iv = Buffer.from(source.ivb6, 'base64');
if (iv.length !== 16) throw new Error('invalid UHS3 manifest IV');
function decrypt(value) {
  const decipher = createDecipheriv(`aes-${bits}-cbc`, key, iv);
  return Buffer.concat([decipher.update(Buffer.from(value, 'base64')), decipher.final()]).toString('utf8');
}
const keyBase64 = decrypt(rung.kstr);
if (Buffer.from(keyBase64, 'base64').length !== 16) throw new Error('invalid UHS3 HLS key');
const manifest = decrypt(rung.jstr);
if (!manifest.startsWith('#EXTM3U\n') || !manifest.includes('#EXT-X-ENDLIST')) {
  throw new Error('UHS3 manifest is not complete VOD HLS');
}

const segments = [];
let duration = null;
let keyUrl = null;
let keyIv = null;
let method = null;
for (const raw of manifest.split(/\r?\n/)) {
  const line = raw.trim();
  if (!line) continue;
  if (line.startsWith('#EXT-X-KEY:')) {
    const match = /^#EXT-X-KEY:METHOD=([^,]+),URI="([^"]+)",IV=0x([0-9a-fA-F]{32})/.exec(line);
    if (!match) throw new Error('unsupported UHS3 HLS key declaration');
    method = match[1];
    keyUrl = new URL(match[2], rung.path).href;
    const bytes = Buffer.from(match[3], 'hex');
    keyIv = [0, 4, 8, 12].map((i) => bytes.readUInt32BE(i));
  } else if (line.startsWith('#EXTINF:')) {
    duration = Number(line.slice(8).split(',')[0]);
    if (!Number.isFinite(duration) || duration <= 0) throw new Error('invalid HLS duration');
  } else if (!line.startsWith('#')) {
    if (!duration || !keyUrl || !keyIv || method !== 'AES-128') throw new Error('segment lacks AES metadata');
    const url = new URL(line, rung.path).href;
    for (const candidate of [url, keyUrl]) {
      const parsed = new URL(candidate);
      if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith('.classx.co.in')) {
        throw new Error('unexpected APX media host');
      }
    }
    segments.push({ index: segments.length, url, keyUrl, iv: keyIv, duration, method });
    duration = null;
  }
}
if (!segments.length || duration !== null) throw new Error('empty or truncated UHS3 manifest');

const capture = {
  classId: source.classId,
  apxVideoId: String(source.apxVideoId),
  capturedAt: source.capturedAt,
  quality,
  keyBase64,
  duration: segments.reduce((sum, segment) => sum + segment.duration, 0),
  segments,
};
const dest = resolve(outputPath);
const file = await open(dest, 'wx', 0o600);
try { await file.writeFile(JSON.stringify(capture)); } finally { await file.close(); }
console.log(JSON.stringify({ classId: capture.classId, quality, segments: segments.length,
  duration: Math.round(capture.duration), output: dest }));
