#!/usr/bin/env node
'use strict';
// Read-only, Vidyagram only. For a few migrated classes: asks AppX which file each menu label
// plays (get_video_token, no view registered), ffprobes the first segment behind each label,
// and does the same for our master in R2. Prints labels, folders and pixels, never URLs or tokens.
//
//   node vidyagram-appx-quality-verify.cjs [--count 3] [--class <id>] [--gap-ms 3000]
//
// Spends one AppX CMS call per video plus 2 CDN reads per label. --count is capped at 10.
const fs = require('fs');
const https = require('https');
const path = require('path');
const { spawnSync } = require('child_process');

const BACKEND = '/Users/raghav/Projects/worktrees/vg-backend';
const BRAIN = path.resolve(__dirname, '..', '..');
const BUCKET = 'recordedvideos-vidyagram';
const APX = 'https://cms.appx.co.in';
const CDN_ORIGIN = 'https://appx-play.akamai.net.in';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36';
const axios = require(`${BACKEND}/node_modules/axios`);
const agent = new https.Agent({ family: 4, keepAlive: true });

const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : fallback; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const firstUri = (text) => text.split(/\r?\n/).map((l) => l.trim()).find((l) => l && !l.startsWith('#'));

function pixels(buf) {
  const p = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', '-i', 'pipe:0'],
    { input: buf, encoding: 'buffer', maxBuffer: 1 << 28 });
  return p.stdout.toString().trim().split('\n')[0].replace(',', 'x') || 'unreadable';
}

const cdnGet = (url, responseType) => axios.get(url, {
  httpsAgent: agent, timeout: 30000, responseType, validateStatus: () => true,
  headers: { 'User-Agent': UA, Referer: `${CDN_ORIGIN}/`, Origin: CDN_ORIGIN },
});

// A relative uri with no token of its own inherits the signed parent's query.
function child(uri, parent) {
  const u = new URL(uri, parent);
  if (!u.search) u.search = new URL(parent).search;
  return u.toString();
}

async function appxLabel(link) {
  const folder = (new URL(link).pathname.match(/\/(\d+p)\//) || [])[1] || 'no-folder';
  let playlistUrl = link;
  let r = await cdnGet(playlistUrl, 'text');
  if (r.status !== 200) return { folder, size: `playlist HTTP ${r.status}` };
  if (String(r.data).includes('#EXT-X-STREAM-INF')) {
    playlistUrl = child(firstUri(r.data), playlistUrl);
    r = await cdnGet(playlistUrl, 'text');
    if (r.status !== 200) return { folder, size: `child HTTP ${r.status}` };
  }
  const seg = await cdnGet(child(firstUri(r.data), playlistUrl), 'arraybuffer');
  if (seg.status !== 200) return { folder, size: `segment HTTP ${seg.status}` };
  return { folder, size: pixels(Buffer.from(seg.data)) };
}

async function ourMenu(s3, Get, masterKey) {
  const read = async (key) => (await s3.send(new Get({ Bucket: BUCKET, Key: key }))).Body;
  const dir = path.posix.dirname(masterKey);
  const text = await (await read(masterKey)).transformToString();
  const rows = [...text.matchAll(/#EXT-X-STREAM-INF:([^\n]*)\n([^\n]+)/g)].map((m) => ({
    label: (m[1].match(/NAME="([^"]+)"/) || [])[1] || (m[1].match(/RESOLUTION=(\d+x\d+)/) || [])[1],
    uri: m[2].trim(),
  }));
  const sizes = new Map();
  for (const uri of new Set(rows.map((r) => r.uri))) {
    const playlist = await (await read(`${dir}/${uri}`)).transformToString();
    const bytes = await (await read(`${dir}/${firstUri(playlist).split('?')[0]}`)).transformToByteArray();
    sizes.set(uri, pixels(Buffer.from(bytes)));
  }
  return rows.map((r) => ({ ...r, size: sizes.get(r.uri) }));
}

async function main() {
  const count = Math.min(Number(arg('--count', 3)), 10);
  const gapMs = Math.max(Number(arg('--gap-ms', 3000)), 1000);
  const only = arg('--class', null);
  const { MongoClient, ObjectId } = require(`${BACKEND}/node_modules/mongoose`).mongo;
  const dotenv = require(`${BACKEND}/node_modules/dotenv`);
  const dbEnv = dotenv.parse(fs.readFileSync(`${BACKEND}/.env.development`));
  const r2Env = dotenv.parse(fs.readFileSync(path.join(BRAIN, '.env.development')));
  if (r2Env.VIDYAGRAM_R2_BUCKET !== BUCKET) throw new Error('VIDYAGRAM_R2_BUCKET is not the Vidyagram bucket');
  const { S3Client, GetObjectCommand } = require(`${BACKEND}/node_modules/@aws-sdk/client-s3`);
  const s3 = new S3Client({
    endpoint: r2Env.VIDYAGRAM_R2_ENDPOINT, region: 'auto', maxAttempts: 2,
    credentials: { accessKeyId: r2Env.VIDYAGRAM_R2_ACCESS_KEY_ID, secretAccessKey: r2Env.VIDYAGRAM_R2_SECRET_ACCESS_KEY },
  });
  // MONGO_TUNNEL_PORT: reach rs0 through `ssh -L <port>:148.113.8.241:27017` when this Mac's IP is not allowlisted.
  const tunnel = process.env.MONGO_TUNNEL_PORT;
  const uri = tunnel
    ? `${dbEnv.MONGO_URI.replace(/^mongodb:\/\/([^@]*@)?[^/]*/, (m, auth) => `mongodb://${auth || ''}127.0.0.1:${tunnel}`).replace(/([?&])replicaSet=[^&]*&?/, '$1').replace(/[?&]$/, '')}${dbEnv.MONGO_URI.includes('?') ? '&' : '?'}directConnection=true`
    : dbEnv.MONGO_URI;
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 25000 });
  await client.connect();
  try {
    const db = client.db('vidyagramdb');
    const session = await db.collection('apxsessions').findOne({ orgId: '2177599', customerId: '781', isActive: true }, { projection: { session_id: 1 } });
    if (!session || !session.session_id) throw new Error('no active AppX session');
    const jobQuery = { status: 'done', video_url: { $exists: true, $ne: '' } };
    if (only) jobQuery.classId = { $in: [only, new ObjectId(only)] };
    const jobs = only
      ? await db.collection('apxingestjobs').find(jobQuery).limit(1).toArray()
      : await db.collection('apxingestjobs').aggregate([{ $match: jobQuery }, { $sample: { size: count } }]).toArray();
    for (const job of jobs) {
      const cls = await db.collection('classes').findOne({ _id: new ObjectId(String(job.classId)) }, { projection: { title: 1, 'hlsAsset.key': 1 } });
      const form = new URLSearchParams({
        course_id: job.course_id ?? '', video_id: job.video_id ?? '', ytflag: '1', folder_wise_course: '1',
        recaptcha_token: '', video_url: job.video_url ?? '', uhsVersion: '0.00',
      });
      const minted = await axios.post(`${APX}/common/get_video_token`, form.toString(), {
        httpsAgent: agent, timeout: 20000, validateStatus: () => true,
        headers: {
          Accept: 'application/json, */*; q=0.01', 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          Cookie: `apx-aside-collapse=1; ci_session=${session.session_id}`, Referer: `${APX}/`, 'User-Agent': UA, 'X-Requested-With': 'XMLHttpRequest',
        },
      });
      const urls = Array.isArray(minted.data && minted.data.urls) ? minted.data.urls : [];
      console.log(`\n${job.classId}  ${cls && cls.title}  (AppX HTTP ${minted.status}, ${urls.length} labels)`);
      for (const u of urls) {
        const seen = await appxLabel(u.path).catch((e) => ({ folder: '?', size: e.code || e.name }));
        console.log(`  AppX ${String(u.quality).padEnd(6)} folder /${seen.folder}/  pixels ${seen.size}`);
        await sleep(200);
      }
      if (cls && cls.hlsAsset && cls.hlsAsset.key) {
        for (const row of await ourMenu(s3, GetObjectCommand, cls.hlsAsset.key)) {
          console.log(`  ours ${String(row.label).padEnd(6)} file ${row.uri.padEnd(11)} pixels ${row.size}`);
        }
      }
      await sleep(gapMs);
    }
  } finally {
    await client.close();
    s3.destroy();
    agent.destroy();
  }
}

main().catch((e) => { console.error(e.name, e.message.replace(/mongodb:\/\/\S+/g, '<uri>')); process.exit(1); });
