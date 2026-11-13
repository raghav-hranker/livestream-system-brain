// Read-only, on webserver2-2 from the backend checkout via `node -` (env CLASSES=id,id; RUNGS=1,0; PIECES=20): plays a
// stretch of a live-bucket replay as a player does, one piece after another on a kept-alive connection, through the
// routed Bunny zone and Cloudflare. Compares download time with the time each piece plays for: under 1.0 keeps up. Starts
// mid-class, so cold pieces show too. From this box only, so it can find a CDN fault, not a Vi route fault. No tokens.
const path = require('path');
require(path.resolve('node_modules/dotenv')).config({ path: '.env.development' });
const mongoose = require(path.resolve('node_modules/mongoose'));
const { signAssetUrl } = require(path.resolve('dist/src/services/bunnyAssetSigner.js'));
const { signCloudflareFolderAsset } = require(path.resolve('dist/src/services/cloudflareFolderSigner.js'));
const { loadCloudflareLiveConfig, loadVideoProtectionConfig, loadAsnBunnyRouting } = require(path.resolve('dist/src/config/videoProtection.js'));

const RUNGS = (process.env.RUNGS || '1,0').split(',').map(Number);
const PIECES = Number(process.env.PIECES || 20);
const hop = (base, rel) => { const u = new URL(rel, base); if (!u.search) u.search = new URL(base).search; return u.toString(); };
const uris = (t) => t.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
const pieces = (t) => {
  const out = []; let dur = 0;
  for (const raw of t.split('\n')) {
    const l = raw.trim();
    if (l.startsWith('#EXTINF:')) dur = parseFloat(l.slice(8));
    else if (l && !l.startsWith('#')) out.push({ uri: l, dur });
  }
  return out;
};
const get = async (url) => {
  const t = performance.now();
  const r = await fetch(url);
  const b = await r.arrayBuffer();
  return { status: r.status, ms: performance.now() - t, kb: b.byteLength / 1024, cache: r.headers.get('cdn-cache') || r.headers.get('cf-cache-status') };
};
const quant = (a, q) => a.slice().sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * q))];

const walk = async (name, master, rung) => {
  const rungUrl = hop(master, uris(await (await fetch(master)).text())[rung]);
  const all = pieces(await (await fetch(rungUrl)).text());
  const start = Math.floor(all.length * (0.3 + Math.random() * 0.4));
  const stretch = all.slice(start, start + PIECES);
  const rows = [];
  for (const p of stretch) rows.push({ ...(await get(hop(rungUrl, p.uri))), dur: p.dur });
  const ms = rows.map((r) => r.ms);
  const bad = rows.filter((r) => r.status !== 200).length;
  const miss = rows.filter((r) => r.cache !== 'HIT').length;
  const slow = rows.filter((r) => r.ms / 1000 >= r.dur).length;
  const secs = ms.reduce((a, b) => a + b, 0) / 1000;
  const plays = rows.reduce((a, r) => a + r.dur, 0);
  const kb = rows.reduce((a, r) => a + r.kb, 0);
  console.log(`${name.padEnd(10)} rung ${rung} from piece ${start}: ${rows.length} pieces, ${(kb / rows.length).toFixed(0)} KB each, plays ${plays.toFixed(0)} s, download ${secs.toFixed(1)} s, ratio ${(secs / plays).toFixed(2)}, median ${quant(ms, 0.5).toFixed(0)} ms, worst ${Math.max(...ms).toFixed(0)} ms, ${(kb / secs).toFixed(0)} KB/s, not-HIT ${miss}, slower than playback ${slow}, errors ${bad}`);
};

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { readPreference: 'secondaryPreferred', autoIndex: false });
  const ids = process.env.CLASSES.split(',');
  const docs = await mongoose.connection.db.collection('classes').find({ _id: { $in: ids.map((i) => new mongoose.Types.ObjectId(i)) } }).project({ hlsAsset: 1 }).toArray();
  await mongoose.disconnect();
  const zone = loadAsnBunnyRouting().zones.live;
  const config = { ...loadVideoProtectionConfig(), buckets: { live: zone } };
  const cf = loadCloudflareLiveConfig();
  const now = Math.floor(Date.now() / 1000);
  for (const d of docs) {
    console.log(`== ${String(d._id)}`);
    const bunny = signAssetUrl(d.hlsAsset, null, now + 21600, config).url;
    const cloudflare = signCloudflareFolderAsset(d.hlsAsset, now, cf).url;
    for (const rung of RUNGS) {
      await walk('Bunny', bunny, rung);
      await walk('Cloudflare', cloudflare, rung);
    }
  }
})().catch((e) => { console.error(e.message); process.exit(1); });
