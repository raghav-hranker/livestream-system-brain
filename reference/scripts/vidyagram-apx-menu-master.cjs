#!/usr/bin/env node
'use strict';
// Vidyagram only. Survey (default, read-only) or rewrite migrated classes' master.m3u8 so they
// carry AppX's quality menu over the same physical files: 720p plays 480p.m3u8, 240p and 144p
// play 240p.m3u8 (whose pixels are 256x144). Segments and rung playlists are never touched.
//
//   node vidyagram-apx-menu-master.cjs [--snapshot <dir>] [--targets-only] [--limit N] [--probe N]
//   node vidyagram-apx-menu-master.cjs --commit (--limit N | --all)
//   node vidyagram-apx-menu-master.cjs --rollback <ledger.jsonl> [--commit]
//
// Targets: classes with an apxAssetKey and hlsAsset.key = 781/<classId>/hls/master.m3u8.
// Admin uploads have no apxAssetKey. A master with any tag or file this script does not know
// is reported as `unknown` and left alone. Prints no credentials or signed URLs.
// Cloudflare keeps a served master far longer than 1 h (status TTL 1 year), so a change reaches
// viewers only after that master's URL is purged.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const BUCKET = 'recordedvideos-vidyagram';
const DB_NAME = 'vidyagramdb';
const BACKEND = '/Users/raghav/Projects/worktrees/vg-backend';
const BRAIN = path.resolve(__dirname, '..', '..');
const MASTER_KEY = /^781\/[0-9a-f]{24}\/hls\/master\.m3u8$/;

// Order is the menu order. Only the labels change; each uri keeps its own bandwidth.
const LADDER = [
  { uri: '240p.m3u8', labels: [['144p', '256x144'], ['240p', '426x240']], realHeight: 144 },
  { uri: '360p.m3u8', labels: [['360p', '638x360']], realHeight: 360 },
  { uri: '480p.m3u8', labels: [['480p', '854x480'], ['720p', '1280x720']], realHeight: 480 },
  { uri: '1080p.m3u8', labels: [['1080p', '1920x1080']], realHeight: null },
];
const KNOWN_ATTRS = new Set(['BANDWIDTH', 'RESOLUTION', 'NAME']);

const sha256 = (text) => crypto.createHash('sha256').update(text).digest('hex');

function parseAttrs(raw) {
  const attrs = {};
  for (const m of raw.matchAll(/([A-Z0-9-]+)=("[^"]*"|[^,]*)/g)) attrs[m[1]] = m[2].replace(/^"|"$/g, '');
  return attrs;
}

function parseMaster(text) {
  const lines = String(text).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines[0] !== '#EXTM3U') return { reason: 'no #EXTM3U' };
  const entries = [];
  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (line === '#EXT-X-VERSION:3') continue;
    if (!line.startsWith('#EXT-X-STREAM-INF:')) return { reason: `unexpected line: ${line.slice(0, 40)}` };
    const uri = lines[i + 1];
    if (!uri || uri.startsWith('#')) return { reason: 'stream-inf without a uri' };
    const attrs = parseAttrs(line.slice('#EXT-X-STREAM-INF:'.length));
    const extra = Object.keys(attrs).find((k) => !KNOWN_ATTRS.has(k));
    if (extra) return { reason: `unexpected attribute: ${extra}` };
    entries.push({ uri, name: attrs.NAME || null, resolution: attrs.RESOLUTION || null, bandwidth: Number(attrs.BANDWIDTH) });
    i += 1;
  }
  if (!entries.length) return { reason: 'no stream-inf entries' };
  return { entries };
}

// status: ok = already AppX's menu, change = rewrite to `after`, unknown = leave alone.
function planMaster(text) {
  const parsed = parseMaster(text);
  if (!parsed.entries) return { status: 'unknown', reason: parsed.reason };
  const bandwidth = new Map();
  for (const e of parsed.entries) {
    if (!LADDER.some((r) => r.uri === e.uri)) return { status: 'unknown', reason: `unexpected file: ${e.uri}` };
    if (!(e.bandwidth > 0)) return { status: 'unknown', reason: `invalid bandwidth on ${e.uri}` };
    bandwidth.set(e.uri, Math.max(bandwidth.get(e.uri) || 0, e.bandwidth));
  }
  const wanted = LADDER.filter((r) => bandwidth.has(r.uri))
    .flatMap((r) => r.labels.map(([name, resolution]) => ({ uri: r.uri, name, resolution, bandwidth: bandwidth.get(r.uri) })));
  const shape = (list) => list.map((e) => `${e.name}|${e.resolution}|${e.uri}`).sort().join('\n');
  const before = parsed.entries.map((e) => `${e.name || e.resolution}->${e.uri}`);
  const labels = wanted.map((e) => `${e.name}->${e.uri}`);
  if (shape(parsed.entries) === shape(wanted)) return { status: 'ok', before, labels };
  const lines = ['#EXTM3U', '#EXT-X-VERSION:3'];
  for (const e of wanted) {
    lines.push(`#EXT-X-STREAM-INF:BANDWIDTH=${e.bandwidth},RESOLUTION=${e.resolution},NAME="${e.name}"`, e.uri);
  }
  return { status: 'change', before, labels, after: `${lines.join('\n')}\n` };
}

// store = { get(key) -> { text, etag, contentType, cacheControl }, etag(key), put(key, text, meta) }
async function commitOne(store, key, classId, appendLedger) {
  const current = await store.get(key);
  const plan = planMaster(current.text);
  if (plan.status !== 'change') return plan.status;
  appendLedger({
    at: new Date().toISOString(), classId, key, etag: current.etag, contentType: current.contentType,
    cacheControl: current.cacheControl, beforeSha: sha256(current.text), afterSha: sha256(plan.after),
    before: current.text, after: plan.after,
  });
  if ((await store.etag(key)) !== current.etag) throw new Error(`${key} changed while planning`);
  await store.put(key, plan.after, current);
  if (sha256((await store.get(key)).text) !== sha256(plan.after)) throw new Error(`${key} read-back differs`);
  return 'changed';
}

// Restores only masters still holding this run's output; anything edited since is reported.
async function rollbackEntries(store, entries, commit) {
  const out = { restored: 0, wouldRestore: 0, drifted: [] };
  for (const e of entries.slice().reverse()) {
    const current = await store.get(e.key);
    if (sha256(current.text) !== e.afterSha) { out.drifted.push(e.key); continue; }
    if (!commit) { out.wouldRestore += 1; continue; }
    await store.put(e.key, e.before, { contentType: e.contentType, cacheControl: e.cacheControl });
    if (sha256((await store.get(e.key)).text) !== e.beforeSha) throw new Error(`${e.key} rollback read-back differs`);
    out.restored += 1;
  }
  return out;
}

function selectTargets(classes) {
  const targets = [];
  const skipped = { noApxAsset: 0, noHls: 0, otherKeyForm: [] };
  for (const c of classes) {
    const key = c.hlsAsset && c.hlsAsset.key;
    if (!c.apxAssetKey) skipped.noApxAsset += 1;
    else if (!key) skipped.noHls += 1;
    else if (!MASTER_KEY.test(key) || !key.includes(String(c._id))) skipped.otherKeyForm.push({ classId: String(c._id), key });
    else targets.push({ classId: String(c._id), key });
  }
  return { targets, skipped };
}

function parseArgs(argv) {
  const args = { commit: false, all: false, targetsOnly: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--commit') args.commit = true;
    else if (a === '--all') args.all = true;
    else if (a === '--targets-only') args.targetsOnly = true;
    else if (a === '--snapshot') args.snapshot = argv[++i];
    else if (a === '--rollback') args.rollback = argv[++i];
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--limit') args.limit = Number(argv[++i]);
    else if (a === '--probe') args.probe = Number(argv[++i]);
    else throw new Error(`unknown argument ${a}`);
  }
  if (args.commit && !args.rollback && !args.all && !(args.limit > 0)) throw new Error('--commit needs --limit N or --all');
  return args;
}

async function loadClasses(args) {
  if (args.snapshot) return JSON.parse(fs.readFileSync(path.join(args.snapshot, 'classes.json'), 'utf8'));
  const { MongoClient } = require(`${BACKEND}/node_modules/mongoose`).mongo;
  const env = require(`${BACKEND}/node_modules/dotenv`).parse(fs.readFileSync(`${BACKEND}/.env.development`));
  const client = new MongoClient(env.MONGO_URI, { serverSelectionTimeoutMS: 15000 });
  await client.connect();
  try {
    return await client.db(DB_NAME).collection('classes')
      .find({ apxAssetKey: { $exists: true, $nin: [null, ''] } }, { projection: { apxAssetKey: 1, 'hlsAsset.key': 1 } }).toArray();
  } finally { await client.close(); }
}

function r2Store() {
  const { S3Client, GetObjectCommand, HeadObjectCommand, PutObjectCommand } = require(`${BACKEND}/node_modules/@aws-sdk/client-s3`);
  const env = require(`${BACKEND}/node_modules/dotenv`).parse(fs.readFileSync(path.join(BRAIN, '.env.development')));
  if (env.VIDYAGRAM_R2_BUCKET !== BUCKET) throw new Error('VIDYAGRAM_R2_BUCKET is not the Vidyagram bucket');
  const s3 = new S3Client({
    endpoint: env.VIDYAGRAM_R2_ENDPOINT, region: 'auto', maxAttempts: 3,
    credentials: { accessKeyId: env.VIDYAGRAM_R2_ACCESS_KEY_ID, secretAccessKey: env.VIDYAGRAM_R2_SECRET_ACCESS_KEY },
  });
  return {
    async get(key) {
      const r = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
      return { text: await r.Body.transformToString(), etag: r.ETag, contentType: r.ContentType, cacheControl: r.CacheControl };
    },
    async bytes(key) {
      const r = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
      return Buffer.from(await r.Body.transformToByteArray());
    },
    async etag(key) { return (await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }))).ETag; },
    async put(key, text, meta) {
      await s3.send(new PutObjectCommand({
        Bucket: BUCKET, Key: key, Body: text,
        ContentType: (meta && meta.contentType) || 'application/vnd.apple.mpegurl',
        ...(meta && meta.cacheControl ? { CacheControl: meta.cacheControl } : {}),
      }));
    },
    destroy() { s3.destroy(); },
  };
}

// Reads rung 0's first segment per physical file and compares its pixels with the ladder.
async function probeMaster(store, key) {
  const dir = path.posix.dirname(key);
  const parsed = parseMaster((await store.get(key)).text);
  const out = [];
  for (const uri of new Set((parsed.entries || []).map((e) => e.uri))) {
    const playlist = (await store.get(`${dir}/${uri}`)).text;
    const seg = playlist.split(/\r?\n/).map((l) => l.trim()).find((l) => l && !l.startsWith('#'));
    const p = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', '-i', 'pipe:0'],
      { input: await store.bytes(`${dir}/${seg.split('?')[0]}`), encoding: 'buffer', maxBuffer: 1 << 28 });
    const size = p.stdout.toString().trim().split('\n')[0];
    const height = Number(size.split(',')[1]);
    const rung = LADDER.find((r) => r.uri === uri);
    out.push({ uri, size: size.replace(',', 'x'), matches: rung && rung.realHeight ? height === rung.realHeight : height > 480 });
  }
  return out;
}

async function mapLimit(items, limit, fn) {
  let next = 0;
  await Promise.all(Array.from({ length: limit }, async () => {
    while (next < items.length) { const i = next; next += 1; await fn(items[i], i); }
  }));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.rollback) {
    const entries = fs.readFileSync(args.rollback, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    const store = r2Store();
    console.log(JSON.stringify(await rollbackEntries(store, entries, args.commit)));
    store.destroy();
    return;
  }
  const { targets, skipped } = selectTargets(await loadClasses(args));
  const counts = { targets: targets.length, noApxAsset: skipped.noApxAsset, noHls: skipped.noHls, otherKeyForm: skipped.otherKeyForm.length };
  console.log(JSON.stringify(counts));
  if (args.targetsOnly) return;

  const runId = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
  const out = args.out || path.join(BRAIN, 'vidyagram/reports', `apx-menu-master-${runId}`);
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'skipped-other-key-form.json'), JSON.stringify(skipped.otherKeyForm, null, 1));
  const store = r2Store();
  const scope = args.limit > 0 ? targets.slice(0, args.limit) : targets;

  if (args.commit) {
    const ledgerPath = path.join(out, 'ledger.jsonl');
    const appendLedger = (row) => fs.appendFileSync(ledgerPath, `${JSON.stringify(row)}\n`, { mode: 0o600 });
    const tally = {};
    for (const t of targets) {
      if (args.limit > 0 && (tally.changed || 0) >= args.limit) break;
      const result = await commitOne(store, t.key, t.classId, appendLedger);
      tally[result] = (tally[result] || 0) + 1;
    }
    console.log(JSON.stringify({ ...tally, ledger: ledgerPath }));
    store.destroy();
    return;
  }

  const planStream = fs.createWriteStream(path.join(out, 'plan.jsonl'));
  const summary = { ok: 0, change: 0, unknown: 0, missing: 0, menus: {}, unknownReasons: {} };
  const probeable = [];
  await mapLimit(scope, 12, async (t) => {
    let plan;
    try { plan = planMaster((await store.get(t.key)).text); } catch (e) {
      summary.missing += 1;
      planStream.write(`${JSON.stringify({ ...t, status: 'missing', error: e.name })}\n`);
      return;
    }
    summary[plan.status] += 1;
    if (plan.status === 'unknown') summary.unknownReasons[plan.reason] = (summary.unknownReasons[plan.reason] || 0) + 1;
    else {
      const menu = plan.before.join(' ');
      summary.menus[menu] = (summary.menus[menu] || 0) + 1;
      probeable.push(t);
    }
    planStream.write(`${JSON.stringify({ ...t, ...plan })}\n`);
  });
  planStream.end();
  if (args.probe > 0) {
    const step = Math.max(1, Math.floor(probeable.length / args.probe));
    summary.probe = [];
    for (let i = 0; i < probeable.length && summary.probe.length < args.probe; i += step) {
      summary.probe.push({ classId: probeable[i].classId, rungs: await probeMaster(store, probeable[i].key) });
    }
  }
  fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify(summary, null, 1));
  console.log(JSON.stringify({ ...summary, out }, null, 1));
  store.destroy();
}

if (require.main === module) main().catch((e) => { console.error(e.name, e.message); process.exit(1); });
module.exports = { planMaster, parseMaster, parseArgs, selectTargets, commitOne, rollbackEntries, sha256, LADDER };
