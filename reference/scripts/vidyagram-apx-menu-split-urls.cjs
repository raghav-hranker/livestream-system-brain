#!/usr/bin/env node
'use strict';
// Vidyagram only. Rewrites migrated masters to AppX's exact menu, with one file address per label,
// so players that drop repeated addresses (Android Media3/ExoPlayer) keep every label:
//   with a 1080p level:    1080p, 720p, 480p, 360p, 240p
//   without a 1080p level: 720p, 480p, 360p, 240p, 144p
// 720p.m3u8 is a byte copy of 480p.m3u8 and 144p.m3u8 of 240p.m3u8. The copies name the same
// segments, so no video is copied. Any tag or file this script does not know is left alone.
//
//   node vidyagram-apx-menu-split-urls.cjs --class <id> [--commit]
//   node vidyagram-apx-menu-split-urls.cjs (--all | --limit N) [--commit] [--workers N] [--out <dir>]      needs MongoDB
//   node vidyagram-apx-menu-split-urls.cjs --rollback <ledger.jsonl> [--commit]
//
// MONGO_TUNNEL_PORT: reach rs0 through `ssh -L <port>:148.113.8.241:27017` when this Mac's IP is not allowlisted.
// Dry run unless --commit. Writes the copies first and the master last. The ledger, written before
// any change, holds the old master. Rollback restores masters only; copies stay, unused and harmless.
// Cloudflare keeps a served master far longer than 1 h (status TTL 1 year), so a change reaches
// viewers only after that master's URL is purged. Tested 11-04: 90 min later the old one was served.
const fs = require('fs');
const path = require('path');
const { parseMaster, selectTargets, sha256 } = require('./vidyagram-apx-menu-master.cjs');

const BRAIN = path.resolve(__dirname, '..', '..');
const BACKEND = '/Users/raghav/Projects/worktrees/vg-backend';
const COPIES = { '144p.m3u8': '240p.m3u8', '720p.m3u8': '480p.m3u8' };
const RUNGS = ['240p.m3u8', '360p.m3u8', '480p.m3u8', '1080p.m3u8'];

// status: change = rewrite to `after` using `copies`, done = already this menu, unknown = leave alone.
function planMenu(text) {
  const parsed = parseMaster(text);
  if (!parsed.entries) return { status: 'unknown', reason: parsed.reason };
  const bandwidth = new Map();
  for (const e of parsed.entries) {
    const rung = COPIES[e.uri] || e.uri;
    if (!RUNGS.includes(rung)) return { status: 'unknown', reason: `unexpected file: ${e.uri}` };
    if (!(e.bandwidth > 0)) return { status: 'unknown', reason: `invalid bandwidth on ${e.uri}` };
    bandwidth.set(rung, Math.max(bandwidth.get(rung) || 0, e.bandwidth));
  }
  const has = (rung) => bandwidth.has(rung);
  const menu = [
    ...(has('240p.m3u8') && !has('1080p.m3u8') ? [['144p', '256x144', '144p.m3u8']] : []),
    ...(has('240p.m3u8') ? [['240p', '426x240', '240p.m3u8']] : []),
    ...(has('360p.m3u8') ? [['360p', '638x360', '360p.m3u8']] : []),
    ...(has('480p.m3u8') ? [['480p', '854x480', '480p.m3u8'], ['720p', '1280x720', '720p.m3u8']] : []),
    ...(has('1080p.m3u8') ? [['1080p', '1920x1080', '1080p.m3u8']] : []),
  ];
  const lines = ['#EXTM3U', '#EXT-X-VERSION:3'];
  for (const [name, resolution, uri] of menu) {
    lines.push(`#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth.get(COPIES[uri] || uri)},RESOLUTION=${resolution},NAME="${name}"`, uri);
  }
  const after = `${lines.join('\n')}\n`;
  const labels = menu.map(([name]) => name);
  if (String(text) === after) return { status: 'done', labels };
  return { status: 'change', after, labels, copies: menu.map(([, , uri]) => uri).filter((uri) => COPIES[uri]) };
}

// A copy only works if the playlist names its segments relative to its own folder.
function assertRelativeSegments(text, file) {
  const refs = String(text).split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  if (!refs.length) throw new Error(`${file} lists no segments`);
  if (refs.some((r) => r.includes('/') || r.includes('?'))) throw new Error(`${file} has a non-relative segment reference`);
}

// store = { get(key) -> { text, etag, contentType, cacheControl } | throws NoSuchKey, etag(key), put(key, text, meta) }
async function applyClass(store, classId, { commit, appendLedger }) {
  const dir = `781/${classId}/hls`;
  const masterKey = `${dir}/master.m3u8`;
  const master = await store.get(masterKey);
  const plan = planMenu(master.text);
  if (plan.status !== 'change') return plan;

  const copies = [];
  for (const file of plan.copies) {
    const source = await store.get(`${dir}/${COPIES[file]}`);
    assertRelativeSegments(source.text, COPIES[file]);
    let existing = null;
    try { existing = await store.get(`${dir}/${file}`); } catch (e) {
      if (e.name !== 'NoSuchKey' && e.name !== 'NotFound') throw e;
    }
    if (existing && sha256(existing.text) !== sha256(source.text)) throw new Error(`${file} exists with other content`);
    copies.push({ key: `${dir}/${file}`, source, exists: Boolean(existing), sha: sha256(source.text) });
  }
  const summary = { ...plan, copies: copies.map((c) => ({ key: c.key, sha: c.sha, exists: c.exists })) };
  if (!commit) return summary;

  appendLedger({
    at: new Date().toISOString(), classId, key: masterKey, etag: master.etag, contentType: master.contentType,
    cacheControl: master.cacheControl, beforeSha: sha256(master.text), afterSha: sha256(plan.after),
    before: master.text, after: plan.after, copies: summary.copies,
  });
  for (const c of copies) {
    if (c.exists) continue;
    await store.put(c.key, c.source.text, c.source);
    if (sha256((await store.get(c.key)).text) !== c.sha) throw new Error(`${c.key} read-back differs`);
  }
  if ((await store.etag(masterKey)) !== master.etag) throw new Error(`${masterKey} changed while planning`);
  await store.put(masterKey, plan.after, master);
  if (sha256((await store.get(masterKey)).text) !== sha256(plan.after)) throw new Error(`${masterKey} read-back differs`);
  return { ...summary, status: 'changed' };
}

// Restores only masters still holding this run's output; anything edited since is reported.
async function rollbackMenu(store, entries, commit) {
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

// Runs every target; a commit run stops after maxErrors failures, a dry run records them all.
async function applyMany(store, targets, { commit, limit, appendLedger, onRow, concurrency = 12, maxErrors = 5 }) {
  const tally = {};
  const menus = {};
  let next = 0;
  let errors = 0;
  let written = 0;
  // One worker under --limit, so it can never overshoot.
  const workers = limit > 0 ? 1 : concurrency;
  await Promise.all(Array.from({ length: workers }, async () => {
    while (next < targets.length && !(commit && errors >= maxErrors) && !(limit > 0 && written >= limit)) {
      const t = targets[next]; next += 1;
      let row;
      try {
        const r = await applyClass(store, t.classId, { commit, appendLedger });
        row = { classId: t.classId, status: r.status, reason: r.reason, labels: r.labels, newCopies: (r.copies || []).filter((c) => !c.exists).length };
        if (r.status === 'change' || r.status === 'changed') written += 1;
      } catch (e) {
        errors += 1;
        row = { classId: t.classId, status: 'error', reason: `${e.name}: ${e.message}` };
      }
      tally[row.status] = (tally[row.status] || 0) + 1;
      if (row.labels) { const menu = row.labels.join(' '); menus[menu] = (menus[menu] || 0) + 1; }
      onRow(row);
    }
  }));
  return { tally, menus, stoppedEarly: commit && errors >= maxErrors };
}

// A few classes point at a master in another folder. Each folder is one target, once.
function allFolders(own, otherKeyForm) {
  const folders = new Set(own.map((t) => t.classId));
  for (const { key } of otherKeyForm) {
    const m = /^781\/([0-9a-f]{24})\/hls\/master\.m3u8$/.exec(key);
    if (m) folders.add(m[1]);
  }
  return [...folders].map((classId) => ({ classId }));
}

function parseArgs(argv) {
  const args = { commit: false, all: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--commit') args.commit = true;
    else if (a === '--all') args.all = true;
    else if (a === '--class') args.classId = argv[++i];
    else if (a === '--limit') args.limit = Number(argv[++i]);
    else if (a === '--workers') args.workers = Number(argv[++i]);
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--rollback') args.rollback = argv[++i];
    else throw new Error(`unknown argument ${a}`);
  }
  if (args.rollback) return args;
  if (args.classId && !/^[0-9a-f]{24}$/.test(args.classId)) throw new Error('--class needs a 24-hex id');
  if (!args.classId && !args.all && !(args.limit > 0)) throw new Error('name --class <id>, --all or --limit N');
  if (args.classId && (args.all || args.limit)) throw new Error('--class cannot be combined with --all or --limit');
  return args;
}

function r2Store() {
  const { S3Client, GetObjectCommand, HeadObjectCommand, PutObjectCommand } = require(`${BACKEND}/node_modules/@aws-sdk/client-s3`);
  const env = require(`${BACKEND}/node_modules/dotenv`).parse(fs.readFileSync(path.join(BRAIN, '.env.development')));
  const Bucket = 'recordedvideos-vidyagram';
  if (env.VIDYAGRAM_R2_BUCKET !== Bucket) throw new Error('VIDYAGRAM_R2_BUCKET is not the Vidyagram bucket');
  const s3 = new S3Client({
    endpoint: env.VIDYAGRAM_R2_ENDPOINT, region: 'auto', maxAttempts: 3,
    credentials: { accessKeyId: env.VIDYAGRAM_R2_ACCESS_KEY_ID, secretAccessKey: env.VIDYAGRAM_R2_SECRET_ACCESS_KEY },
  });
  return {
    async get(key) {
      const r = await s3.send(new GetObjectCommand({ Bucket, Key: key }));
      return { text: await r.Body.transformToString(), etag: r.ETag, contentType: r.ContentType, cacheControl: r.CacheControl };
    },
    async etag(key) { return (await s3.send(new HeadObjectCommand({ Bucket, Key: key }))).ETag; },
    async put(key, text, meta) {
      await s3.send(new PutObjectCommand({
        Bucket, Key: key, Body: text,
        ContentType: (meta && meta.contentType) || 'application/vnd.apple.mpegurl',
        ...(meta && meta.cacheControl ? { CacheControl: meta.cacheControl } : {}),
      }));
    },
    destroy() { s3.destroy(); },
  };
}

async function loadTargets() {
  const { MongoClient } = require(`${BACKEND}/node_modules/mongoose`).mongo;
  const { MONGO_URI } = require(`${BACKEND}/node_modules/dotenv`).parse(fs.readFileSync(`${BACKEND}/.env.development`));
  const port = process.env.MONGO_TUNNEL_PORT;
  const uri = port
    ? `${MONGO_URI.replace(/^mongodb:\/\/([^@]*@)?[^/]*/, (m, auth) => `mongodb://${auth || ''}127.0.0.1:${port}`).replace(/([?&])replicaSet=[^&]*&?/, '$1').replace(/[?&]$/, '')}${MONGO_URI.includes('?') ? '&' : '?'}directConnection=true`
    : MONGO_URI;
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 25000 });
  await client.connect();
  try {
    const classes = await client.db('vidyagramdb').collection('classes')
      .find({ apxAssetKey: { $exists: true, $nin: [null, ''] } }, { projection: { apxAssetKey: 1, 'hlsAsset.key': 1 } }).toArray();
    return selectTargets(classes);
  } finally { await client.close(); }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const store = r2Store();
  try {
    if (args.rollback) {
      const entries = fs.readFileSync(args.rollback, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
      console.log(JSON.stringify(await rollbackMenu(store, entries, args.commit)));
      return;
    }
    const runId = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
    const out = args.out || path.join(BRAIN, 'vidyagram/reports', `apx-menu-split-${runId}`);
    const ledger = path.join(out, 'ledger.jsonl');
    const appendLedger = (row) => {
      fs.mkdirSync(out, { recursive: true });
      fs.appendFileSync(ledger, `${JSON.stringify(row)}\n`, { mode: 0o600 });
    };
    if (args.classId) {
      const r = await applyClass(store, args.classId, { commit: args.commit, appendLedger });
      console.log(JSON.stringify({ classId: args.classId, status: r.status, reason: r.reason, labels: r.labels, copies: r.copies, ledger: r.status === 'changed' ? ledger : undefined }, null, 1));
      if (r.after) console.log(r.after);
      return;
    }
    const { targets: own, skipped } = await loadTargets();
    const targets = allFolders(own, skipped.otherKeyForm);
    fs.mkdirSync(out, { recursive: true });
    const plan = fs.createWriteStream(path.join(out, 'plan.jsonl'));
    const result = await applyMany(store, targets, { commit: args.commit, limit: args.limit, concurrency: args.workers || 12, appendLedger, onRow: (row) => plan.write(`${JSON.stringify(row)}\n`) });
    plan.end();
    const summary = { commit: args.commit, targets: targets.length, skippedNoHls: skipped.noHls, skippedOtherKeyForm: skipped.otherKeyForm, ...result, out };
    fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify(summary, null, 1));
    console.log(JSON.stringify(summary, null, 1));
  } finally { store.destroy(); }
}

if (require.main === module) main().catch((e) => { console.error(e.name, e.message.replace(/mongodb:\/\/\S+/g, '<uri>')); process.exit(1); });
module.exports = { planMenu, applyClass, applyMany, allFolders, rollbackMenu, parseArgs, assertRelativeSegments };
