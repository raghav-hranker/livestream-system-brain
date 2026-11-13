// Read-only, on webserver2-2 from the backend checkout via `node -` (env SECONDS_TO_RUN, default 60; CLASS optional):
// follows one running class's rung playlist through the routed Bunny live zone and Cloudflare side by side, as a player
// does. Shows how far Bunny's playlist lags, its cache state, and whether each newly listed segment is fetchable at
// once. A stale playlist or 404s here would freeze students. Prints no tokens; the key stays in the box env.
const path = require('path');
require(path.resolve('node_modules/dotenv')).config({ path: '.env.development' });
const mongoose = require(path.resolve('node_modules/mongoose'));
const { signAssetUrl } = require(path.resolve('dist/src/services/bunnyAssetSigner.js'));
const { signCloudflareFolderAsset } = require(path.resolve('dist/src/services/cloudflareFolderSigner.js'));
const { loadCloudflareLiveConfig, loadVideoProtectionConfig, loadAsnBunnyRouting } = require(path.resolve('dist/src/config/videoProtection.js'));

const RUN_MS = Number(process.env.SECONDS_TO_RUN || 60) * 1000;
const lines = (t) => t.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
const hop = (base, rel) => { const u = new URL(rel, base); if (!u.search) u.search = new URL(base).search; return u.toString(); };
const lastSegment = (t) => { const n = lines(t).map((l) => Number((/segment_(\d+)/.exec(l) || [])[1])).filter(Number.isFinite); return n.length ? Math.max(...n) : -1; };
const timed = async (url) => {
  const t = Date.now();
  const r = await fetch(url);
  const body = await r.text();
  return { status: r.status, ms: Date.now() - t, body, cache: r.headers.get('cdn-cache') || r.headers.get('cf-cache-status'), cc: r.headers.get('cache-control') };
};
const rungOf = async (url) => hop(url, lines((await timed(url)).body)[1] ?? lines((await timed(url)).body)[0]);

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { readPreference: 'secondaryPreferred', autoIndex: false });
  const filter = process.env.CLASS ? { _id: new mongoose.Types.ObjectId(process.env.CLASS) } : { streamStatus: 'live', 'hlsAsset.bucket': 'live' };
  const cls = await mongoose.connection.db.collection('classes').find(filter).sort({ updatedAt: -1 }).limit(1).next();
  await mongoose.disconnect();
  if (!cls) { console.log('no running class now'); return; }
  const zone = loadAsnBunnyRouting().zones.live;
  if (!zone) { console.log('BUNNY_ROUTED_LIVE_* not set'); return; }
  const now = Math.floor(Date.now() / 1000);
  const config = { ...loadVideoProtectionConfig(), buckets: { live: zone } };
  const bunnyMaster = signAssetUrl(cls.hlsAsset, null, now + 21600, config).url;
  const cfMaster = signCloudflareFolderAsset(cls.hlsAsset, now, loadCloudflareLiveConfig()).url;
  const [bunnyRung, cfRung] = [await rungOf(bunnyMaster), await rungOf(cfMaster)];
  console.log(`class ${String(cls._id)} ${cls.streamStatus}, key ${cls.hlsAsset.key}`);

  const start = Date.now();
  const lag = [];
  let polls = 0, playlistErrors = 0, cacheHits = 0, sameAsLast = 0, prev = -1, newSeg = 0, seg404 = 0, segErr = 0;
  const segMs = [], playlistMs = [];
  let ccSeen = '';
  while (Date.now() - start < RUN_MS) {
    const [b, c] = await Promise.all([timed(bunnyRung), timed(cfRung)]);
    polls += 1;
    playlistMs.push(b.ms);
    ccSeen = b.cc || ccSeen;
    if (b.status !== 200 || c.status !== 200) { playlistErrors += 1; console.log(`playlist status bunny ${b.status} cloudflare ${c.status}`); }
    else {
      const [bn, cn] = [lastSegment(b.body), lastSegment(c.body)];
      if (b.cache === 'HIT') cacheHits += 1;
      lag.push(cn - bn);
      if (bn === prev) sameAsLast += 1;
      if (bn !== prev && bn >= 0) {
        const name = lines(b.body).filter((l) => /segment_/.test(l)).pop();
        const s = await timed(hop(bunnyRung, name));
        newSeg += 1;
        segMs.push(s.ms);
        if (s.status === 404) seg404 += 1; else if (s.status !== 200) segErr += 1;
        prev = bn;
      }
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  const mid = (a) => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];
  console.log(`playlist polls ${polls}, errors ${playlistErrors}, HIT ${cacheHits}, median ${mid(playlistMs)} ms, max ${Math.max(...playlistMs)} ms, cache-control ${ccSeen}`);
  console.log(`Bunny behind Cloudflare in segments: median ${mid(lag)}, max ${Math.max(...lag)}, min ${Math.min(...lag)}`);
  console.log(`new segments fetched at first sight ${newSeg}: 404 ${seg404}, other errors ${segErr}, median ${segMs.length ? mid(segMs) : '-'} ms, max ${segMs.length ? Math.max(...segMs) : '-'} ms`);
})().catch((e) => { console.error(e.message); process.exit(1); });
