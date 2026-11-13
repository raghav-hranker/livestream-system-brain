#!/usr/bin/env node
// Vidyagram copy of nodejs-server-quickstricks/scripts/apx-uhs-recover.mjs (quicktricks' 2026-09 UHS3 recovery).
// Recover an APX UHS3 VOD from a capture made by scripts/apx-uhs-capture-saved-session.py.
// Input contains short-lived signed URLs: keep the JSON private and never commit it.
//
// Change from the quicktricks copy (2026-11-12): the second in-TS layer (first 94 bytes of full media payloads
// inverted) is NOT present on every recording. Vidyagram's 2024 recordings carry only the scrambled timestamps;
// inverting their payloads corrupts every segment after the first. Each segment now votes: start-code / ADTS
// patterns in the first 94 bytes of full media packets, plain vs inverted, and is inverted only when the inverted
// patterns win. APX_UHS_INVERT=always|never overrides. The run summary reports how many segments were inverted.
// Segment timeout 120 s (APX_UHS_FETCH_TIMEOUT_MS): 1600x900 segments are 3-7 MB, and with several recoveries
// sharing the line the quicktricks 30 s limit dropped them (11-12: 6 of 11 classes failed).
import { createDecipheriv } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const decodeBase64 = (value) => {
  const compact = value.replace(/\s/g, '');
  // Linear check: the quicktricks regex (nested {4} group) overflows V8's stack on segments over ~7 MB (11-13).
  if (!compact || compact.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(compact)) {
    throw new Error('invalid UHS base64');
  }
  return Buffer.from(compact, 'base64');
};

// These are the transforms used by APX's UHS3 player for the observed
// .tsb/.tsc/.tsd/.tse segment and .cssb/.csse key variants.
export const unwrapTsb = (body) => {
  const source = body.toString('utf8');
  let encoded = '';
  for (let i = 0; i < source.length; i++) encoded += String.fromCharCode((source.charCodeAt(i) >> 3) ^ 42);
  const cipher = decodeBase64(encoded);
  if (cipher.length === 0 || cipher.length % 16 !== 0) throw new Error('invalid AES segment length');
  return cipher;
};

export const unwrapTsd = (body) => {
  const source = body.toString('utf8');
  let encoded = '';
  for (let i = 0; i < source.length; i++) encoded += String.fromCharCode(source.charCodeAt(i) >> 2);
  const cipher = decodeBase64(encoded);
  if (cipher.length === 0 || cipher.length % 16 !== 0) throw new Error('invalid AES segment length');
  return cipher;
};

export const unwrapTse = (body) => {
  const source = body.toString('utf8');
  let encoded = '';
  for (let i = 0; i < source.length; i++) encoded += String.fromCharCode((source.charCodeAt(i) >> 3) ^ 5);
  const cipher = decodeBase64(encoded);
  if (cipher.length === 0 || cipher.length % 16 !== 0) throw new Error('invalid AES segment length');
  return cipher;
};

export const unwrapTsc = (body) => {
  const source = body.toString('utf8');
  let encoded = '';
  for (let i = 0; i < source.length; i++) encoded += String.fromCharCode(source.charCodeAt(i) - 10);
  const cipher = decodeBase64(encoded);
  if (cipher.length === 0 || cipher.length % 16 !== 0) throw new Error('invalid AES segment length');
  return cipher;
};

export const unwrapTsa = (body) => {
  const source = body.toString('utf8');
  let encoded = '';
  for (let i = 0; i < source.length; i++) encoded += String.fromCharCode(source.charCodeAt(i) - 20);
  const cipher = decodeBase64(encoded);
  if (cipher.length === 0 || cipher.length % 16 !== 0) throw new Error('invalid AES segment length');
  return cipher;
};

export const unwrapCssc = (body) => {
  const source = body.toString('utf8');
  if (/token\s+expired/i.test(source)) throw new Error('APX key token expired; capture fresh playback');
  let encoded = '';
  for (let i = 0; i < source.length; i++) encoded += String.fromCharCode(source.charCodeAt(i) - 10);
  const key = decodeBase64(encoded);
  if (key.length !== 16) throw new Error('invalid AES-128 key length');
  return key;
};

export const unwrapCssb = (body) => {
  const source = body.toString('utf8');
  if (/token\s+expired/i.test(source)) throw new Error('APX key token expired; capture fresh playback');
  let encoded = '';
  for (let i = 0; i < source.length; i++) encoded += String.fromCharCode((source.charCodeAt(i) >> 3) ^ 42);
  const key = decodeBase64(encoded);
  if (key.length !== 16) throw new Error('invalid AES-128 key length');
  return key;
};

export const unwrapCsse = (body) => {
  const source = body.toString('utf8');
  if (/token\s+expired/i.test(source)) throw new Error('APX key token expired; capture fresh playback');
  let encoded = '';
  for (let i = 0; i < source.length; i++) encoded += String.fromCharCode((source.charCodeAt(i) ^ 42) >> 3);
  const key = decodeBase64(encoded);
  if (key.length !== 16) throw new Error('invalid AES-128 key length');
  return key;
};

export const ivBuffer = (words) => {
  if (!Array.isArray(words) || words.length !== 4 || words.some((x) => !Number.isInteger(x))) {
    throw new Error('invalid UHS IV');
  }
  const iv = Buffer.alloc(16);
  words.forEach((word, i) => iv.writeUInt32BE(word >>> 0, i * 4));
  return iv;
};

export const decryptSegment = (cipher, key, words) => {
  const decipher = createDecipheriv('aes-128-cbc', key, ivBuffer(words));
  const plain = Buffer.concat([decipher.update(cipher), decipher.final()]);
  if (plain.length < 188 || plain.length % 188 !== 0) throw new Error('decrypted segment is not MPEG-TS');
  for (let i = 0; i < plain.length; i += 188) {
    if (plain[i] !== 0x47) throw new Error(`MPEG-TS sync failed at packet ${i / 188}`);
  }
  return plain;
};

const packet = (data, offset) => {
  if (data[offset] !== 0x47) throw new Error('MPEG-TS sync lost');
  const pid = ((data[offset + 1] & 0x1f) << 8) | data[offset + 2];
  const control = (data[offset + 3] >> 4) & 3;
  const payload = control === 1 ? offset + 4 : control === 3 ? offset + 5 + data[offset + 4] : offset + 188;
  return { pid, start: !!(data[offset + 1] & 0x40), payload, length: offset + 188 - payload };
};

const pesStreamId = (data, payload, masked) => {
  const byte = (index) => data[payload + index] ^ (masked ? 0xff : 0);
  if (byte(0) !== 0 || byte(1) !== 0 || byte(2) !== 1) return null;
  return byte(3);
};

const readPts = (data, offset) =>
  (data[offset] & 0x0e) * 536870912 + data[offset + 1] * 4194304 +
  (data[offset + 2] & 0xfe) * 16384 + data[offset + 3] * 128 +
  ((data[offset + 4] & 0xfe) / 2);

const writePts = (data, offset, value) => {
  const prefix = data[offset] >> 4;
  data[offset] = (prefix << 4) | (((value >>> 30) & 7) << 1) | 1;
  data[offset + 1] = (value >>> 22) & 0xff;
  data[offset + 2] = (((value >>> 15) & 0x7f) << 1) | 1;
  data[offset + 3] = (value >>> 7) & 0xff;
  data[offset + 4] = ((value & 0x7f) << 1) | 1;
};

// Does this segment carry the 94-byte inversion? H.264 start codes (00 00 01) and AAC ADTS syncs (FF Fx) show up in
// the first 94 bytes of full media packets; inverted they read FF FF FE and 00 0x.
export const maskVote = (data, pids) => {
  let plain = 0;
  let inverted = 0;
  for (let offset = 0; offset < data.length; offset += 188) {
    const p = packet(data, offset);
    if (!pids.has(p.pid) || p.length !== 184) continue;
    for (let i = 0; i < 92; i++) {
      const a = data[p.payload + i]; const b = data[p.payload + i + 1]; const c = data[p.payload + i + 2];
      if (a === 0 && b === 0 && c === 1) plain++;
      else if (a === 0xff && b === 0xff && c === 0xfe) inverted++;
      if (a === 0xff && (b & 0xf6) === 0xf0) plain++;
      else if (a === 0 && (b & 0xf6) === 0x09) inverted++;
    }
  }
  return { plain, inverted };
};

const shouldInvert = (data, pids, state) => {
  const forced = process.env.APX_UHS_INVERT;
  let invert;
  if (forced === 'always') invert = true;
  else if (forced === 'never') invert = false;
  else { const v = maskVote(data, pids); invert = v.inverted > v.plain; }
  state.inverted = (state.inverted || 0) + (invert ? 1 : 0);
  state.segments = (state.segments || 0) + 1;
  return invert;
};

// APX's UHS3 HLS worker reverses a second layer inside MPEG-TS: full media
// payload packets have their first 94 bytes inverted, and large PES timestamps
// use XOR plus a left shift. Restore both before handing TS to ordinary players.
export const repairTransportStream = (source, state = { timeFlag: null }) => {
  if (source.length % 188) throw new Error('MPEG-TS packet alignment lost');
  const data = Buffer.from(source);
  const pids = new Set();
  for (let offset = 0; offset < data.length; offset += 188) {
    const p = packet(data, offset);
    if (!p.start || p.length < 4) continue;
    const id = pesStreamId(data, p.payload, p.length === 184);
    if (id === 0xbd || (id >= 0xc0 && id <= 0xef)) pids.add(p.pid);
  }
  if (!pids.size) throw new Error('UHS media PIDs not found');
  if (shouldInvert(data, pids, state)) {
    for (let offset = 0; offset < data.length; offset += 188) {
      const p = packet(data, offset);
      if (pids.has(p.pid) && p.length === 184) {
        for (let i = 0; i < 94; i++) data[p.payload + i] ^= 0xff;
      }
    }
  }
  for (let offset = 0; offset < data.length; offset += 188) {
    const p = packet(data, offset);
    if (!pids.has(p.pid) || !p.start || p.length < 19) continue;
    if (pesStreamId(data, p.payload, false) == null) continue;
    const flags = data[p.payload + 7] & 0xc0;
    if (!(flags & 0x80)) continue;
    const ptsOffset = p.payload + 9;
    const dtsOffset = p.payload + 14;
    let pts = readPts(data, ptsOffset);
    let dts = flags & 0x40 ? readPts(data, dtsOffset) : pts;
    if (pts - dts > 60 * 90000) pts = dts;
    if (state.timeFlag == null) state.timeFlag = pts > 100000000 || dts > 100000000 ? 1 : 2;
    if (state.timeFlag === 1) {
      const decode = (value) => ((value ^ 0xff674ff) << 2) >>> 0;
      writePts(data, ptsOffset, decode(pts));
      if (flags & 0x40) writePts(data, dtsOffset, decode(dts));
    }
  }
  return data;
};

const fetchBytes = async (url, label) => {
  let parsed;
  try { parsed = new URL(url); } catch { throw new Error(`${label}: invalid URL`); }
  if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith('.classx.co.in')) {
    throw new Error(`${label}: unexpected APX host`);
  }
  let problem = 'network failure';
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(Number(process.env.APX_UHS_FETCH_TIMEOUT_MS || 120_000)), headers: {
        Referer: 'https://appx-play.classx.co.in/',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
      } });
      if (response.ok) return Buffer.from(await response.arrayBuffer());
      problem = `HTTP ${response.status}`;
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        throw new Error(`${label}: ${problem}`);
      }
    } catch (error) {
      if (error.message === `${label}: ${problem}`) throw error;
      problem = 'network failure';
    }
    if (attempt < 4) await new Promise((done) => setTimeout(done, 500 * 2 ** attempt));
  }
  throw new Error(`${label}: ${problem} after 5 attempts`);
};

const probe = (path) => {
  const result = spawnSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', path], {
    encoding: 'utf8', maxBuffer: 2 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) throw new Error('ffprobe rejected recovered media');
  const data = JSON.parse(result.stdout);
  if (!data.streams?.some((stream) => stream.codec_type === 'video') ||
      !data.streams?.some((stream) => stream.codec_type === 'audio')) {
    throw new Error('recovered media lacks video or audio');
  }
  return data;
};

const frameRate = (value) => {
  const [numerator, denominator] = String(value || '').split('/').map(Number);
  return denominator > 0 ? numerator / denominator : NaN;
};

// Some APX recordings remux with a roughly 1,000 fps video clock. Their
// duration and samples look fine, but the production NVENC HLS ladder rejects
// that rate with "Invalid Level" and never creates Class.hlsAsset.
export const normalizeRecoveredMp4 = (mp4Path, info = probe(mp4Path)) => {
  const video = info.streams.find((stream) => stream.codec_type === 'video');
  const rates = [video.r_frame_rate, video.avg_frame_rate].map(frameRate).filter(Number.isFinite);
  if (rates.length === 0) throw new Error('recovered video has no valid frame rate');
  if (Math.max(...rates) <= 60) {
    return { mp4Path, info, normalized: false };
  }
  const normalizedPath = join(dirname(mp4Path), 'recording-normalized.mp4');
  const result = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y',
    '-i', mp4Path, '-map', '0:v:0', '-map', '0:a:0', '-vf', 'fps=30',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p',
    '-c:a', 'copy', '-movflags', '+faststart', normalizedPath], { encoding: 'utf8' });
  if (result.error || result.status !== 0) throw new Error('high-fps normalization failed');
  const normalizedInfo = probe(normalizedPath);
  const normalizedVideo = normalizedInfo.streams.find((stream) => stream.codec_type === 'video');
  const normalizedRates = [normalizedVideo.r_frame_rate, normalizedVideo.avg_frame_rate]
    .map(frameRate).filter(Number.isFinite);
  if (normalizedRates.length === 0 || Math.max(...normalizedRates) > 60) {
    throw new Error('high-fps normalization did not cap the frame rate');
  }
  return { mp4Path: normalizedPath, info: normalizedInfo, normalized: true };
};

export const recover = async (capture, outputDir, { sample = false, resume = false } = {}) => {
  if (!Array.isArray(capture.segments) || capture.segments.length === 0) throw new Error('empty capture');
  const segments = sample ? capture.segments.slice(0, 1) : capture.segments;
  // APX sometimes serves "Token Expired" from ck.csse while its authorized player
  // supplies the same 16-byte HLS key inline. A private capture may include it.
  const inlineKey = capture.keyBase64 ? decodeBase64(capture.keyBase64) : null;
  if (inlineKey && inlineKey.length !== 16) throw new Error('invalid inline AES-128 key length');
  await mkdir(outputDir, { recursive: true, mode: 0o700 });
  const alreadyRecovered = await Promise.all(segments.map(async (_, i) => {
    if (!resume) return false;
    try {
      const info = await stat(join(outputDir, `${String(i).padStart(5, '0')}.ts`));
      return info.isFile() && info.size >= 188 && info.size % 188 === 0;
    } catch (error) {
      if (error.code === 'ENOENT') return false;
      throw error;
    }
  }));
  const keys = new Map();
  const timestampState = { timeFlag: null };
  const playlist = ['#EXTM3U', '#EXT-X-VERSION:3', '#EXT-X-MEDIA-SEQUENCE:0',
    `#EXT-X-TARGETDURATION:${Math.ceil(Math.max(...segments.map((segment) => Number(segment.duration))))}`];
  const fetchAndDecrypt = async (segment, i) => {
    if (segment.method !== 'AES-128') throw new Error(`segment ${i}: unsupported key method`);
    if (!keys.has(segment.keyUrl)) {
      keys.set(segment.keyUrl, inlineKey ? Promise.resolve(inlineKey) : (async () => {
        const extension = new URL(segment.keyUrl).pathname.split('.').pop();
        const unwrap = extension === 'cssb' ? unwrapCssb : extension === 'cssc' ? unwrapCssc
          : extension === 'csse' ? unwrapCsse : null;
        if (!unwrap) throw new Error(`unsupported UHS key format: ${extension}`);
        return unwrap(await fetchBytes(segment.keyUrl, `key ${i}`));
      })());
    }
    const extension = new URL(segment.url).pathname.split('.').pop();
    const unwrap = extension === 'tsa' ? unwrapTsa : extension === 'tsb' ? unwrapTsb : extension === 'tsc' ? unwrapTsc
      : extension === 'tsd' ? unwrapTsd : extension === 'tse' ? unwrapTse : null;
    if (!unwrap) throw new Error(`unsupported UHS segment format: ${extension}`);
    const [key, body] = await Promise.all([keys.get(segment.keyUrl), fetchBytes(segment.url, `segment ${i}`)]);
    return decryptSegment(unwrap(body), key, segment.iv);
  };
  // Keep a small network window full while writing and repairing TS packets in
  // source order. The timestamp transform carries state between segments.
  const configuredWindow = Number(process.env.APX_UHS_FETCH_WINDOW || 8);
  if (!Number.isInteger(configuredWindow) || configuredWindow < 1 || configuredWindow > 8) {
    throw new Error('APX_UHS_FETCH_WINDOW must be an integer from 1 to 8');
  }
  const windowSize = sample ? 1 : configuredWindow;
  const pending = new Map();
  const queue = (index) => {
    if (index >= segments.length) return;
    pending.set(index, alreadyRecovered[index] ? Promise.resolve({ reused: true })
      : fetchAndDecrypt(segments[index], index).then((value) => ({ value }), (error) => ({ error })));
  };
  // The timestamp repair mode is chosen from the source's first PES packet.
  // Reconstruct it when resuming after segment zero was already written.
  if (alreadyRecovered[0] && alreadyRecovered.some((present) => !present)) {
    repairTransportStream(await fetchAndDecrypt(segments[0], 0), timestampState);
  }
  for (let i = 0; i < Math.min(windowSize, segments.length); i++) queue(i);
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const result = await pending.get(i);
    if (result.error) throw result.error;
    pending.delete(i);
    queue(i + windowSize);
    const name = `${String(i).padStart(5, '0')}.ts`;
    if (!result.reused) {
      const plain = repairTransportStream(result.value, timestampState);
      await writeFile(join(outputDir, name), plain, { mode: 0o600 });
    }
    playlist.push(`#EXTINF:${Number(segment.duration).toFixed(6)},`, name);
    if ((i + 1) % 25 === 0 || i + 1 === segments.length) {
      console.log(JSON.stringify({ recovered: i + 1, total: segments.length }));
    }
  }
  playlist.push('#EXT-X-ENDLIST');
  const playlistPath = join(outputDir, 'index.m3u8');
  await writeFile(playlistPath, `${playlist.join('\n')}\n`, { mode: 0o600 });
  if (sample) {
    const info = probe(join(outputDir, '00000.ts'));
    return { segments: 1, video: info.streams.find((s) => s.codec_type === 'video').codec_name,
      audio: info.streams.find((s) => s.codec_type === 'audio').codec_name, playlistPath };
  }
  const originalMp4Path = join(outputDir, 'recording.mp4');
  const remux = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', playlistPath,
    '-map', '0:v:0', '-map', '0:a:0', '-c', 'copy', '-movflags', '+faststart', originalMp4Path], { encoding: 'utf8' });
  if (remux.error || remux.status !== 0) throw new Error('ffmpeg remux failed');
  const { mp4Path, info, normalized } = normalizeRecoveredMp4(originalMp4Path);
  const actual = Number(info.format.duration);
  const expected = segments.reduce((sum, segment) => sum + Number(segment.duration), 0);
  if (!Number.isFinite(actual) || Math.abs(actual - expected) > Math.max(30, expected * .01)) {
    throw new Error('recovered duration does not match source');
  }
  return { segments: segments.length, reused: alreadyRecovered.filter(Boolean).length,
    invertedSegments: timestampState.inverted || 0, duration: actual, expected, playlistPath, mp4Path, normalized };
};

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [capturePath, outputPath, option] = process.argv.slice(2);
  if (!capturePath || !outputPath || (option && option !== '--sample' && option !== '--resume')) {
    console.error('Usage: node vidyagram-uhs-recover.mjs CAPTURE.json OUTPUT_DIR [--sample|--resume]');
    process.exitCode = 2;
  } else {
    try {
      const capture = JSON.parse(await readFile(capturePath, 'utf8'));
      console.log(JSON.stringify(await recover(capture, resolve(outputPath),
        { sample: option === '--sample', resume: option === '--resume' })));
    } catch (error) {
      // Signed URLs and keys must never enter logs.
      console.error(`Recovery failed: ${String(error.message).replace(/https?:\/\/\S+/g, '[url]')}`);
      process.exitCode = 1;
    }
  }
}
