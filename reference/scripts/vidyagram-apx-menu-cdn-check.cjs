// Read-only, Vidyagram only, on webserver2-2 from /var/www/backend.vidyagramar.com/vidyagram-backend via `node -`
// (env CLASS, CDNS=cloudflare,bunny): mints an admin preview (no view recorded) per CDN and checks what viewers would
// get: the master's menu and cache age, then each listed rung and one segment of it. Prints no tokens.
const path = require('path');
require(path.resolve('node_modules/dotenv')).config({ path: '.env.development' });
const mongoose = require(path.resolve('node_modules/mongoose'));
const { getPlaybackUrl } = require(path.resolve('dist/src/controllers/playbackController.js'));

const mint = (classId, query) => new Promise((resolve) => {
  const res = { status(c) { this.code = c; return this; }, json(b) { resolve({ code: this.code, data: b.data }); return this; } };
  const ip = '127.0.0.1';
  getPlaybackUrl({ user: { admin_id: 'menu-check' }, params: { classId }, query, headers: { 'x-forwarded-for': ip }, ip, socket: {} }, res, () => resolve({ code: 500 }));
});
const cacheInfo = (r) => `${r.headers.get('cf-cache-status') || r.headers.get('cdn-cache') || 'no-cache-header'}, age ${r.headers.get('age') || 0}, cache-control ${r.headers.get('cache-control') || '-'}, modified ${r.headers.get('last-modified') || '-'}, pop ${(r.headers.get('cf-ray') || '').split('-')[1] || '-'}`;
const read = async (url) => {
  const r = await fetch(url);
  return { status: r.status, cache: cacheInfo(r), text: Buffer.from(await r.arrayBuffer()).toString('latin1') };
};
const child = (base, ref) => {
  const u = new URL(ref, base);
  if (!u.search) u.search = new URL(base).search;
  return u.toString();
};
const refs = (text) => text.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { autoIndex: false });
  for (const cdn of process.env.CDNS.split(',')) {
    const { code, data } = await mint(process.env.CLASS, { cdn });
    if (code !== 200) { console.log(`${cdn}: mint ${code}`); continue; }
    const master = await read(data.url);
    const list = refs(master.text);
    console.log(`\n${cdn}: host ${new URL(data.url).host}, master ${master.status} (${master.cache}), files: ${list.join(' ')}`);
    for (const rung of [...new Set([...list, '144p.m3u8', '720p.m3u8'])]) {
      const rungUrl = child(data.url, rung);
      const r = await read(rungUrl);
      if (r.status !== 200) { console.log(`  ${rung}: ${r.status} (${r.cache})`); continue; }
      const seg = refs(r.text)[0];
      const s = await fetch(child(rungUrl, seg), { method: 'GET', headers: { Range: 'bytes=0-1023' } });
      await s.arrayBuffer();
      console.log(`  ${rung}: 200 (${r.cache}), ${refs(r.text).length} segments, first ${seg} ${s.status}`);
    }
  }
  await mongoose.disconnect();
})().catch((e) => { console.error(e.message.replace(/mongodb(\+srv)?:\/\/\S+/g, '<uri>').replace(/https?:\/\/\S+/g, '<url>')); process.exit(1); });
