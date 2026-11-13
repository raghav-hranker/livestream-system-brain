// Read-only: mint (admin preview, no view) and walk master -> child -> first segment, carrying the query token.
const path = require('path');
require(path.resolve('node_modules/dotenv')).config({ path: '.env.development' });
const mongoose = require(path.resolve('node_modules/mongoose'));
const { getPlaybackUrl } = require(path.resolve('dist/src/controllers/playbackController.js'));
const mint = (classId) => new Promise((resolve) => {
  const res = { status(c) { this.code = c; return this; }, json(b) { resolve(b.data.url); return this; } };
  getPlaybackUrl({ user: { admin_id: 'playback-walk' }, params: { classId }, query: {}, headers: {}, ip: '127.0.0.1', socket: {} }, res, () => resolve(null));
});
const get = async (url, label) => {
  const t = Date.now(); const r = await fetch(url); const body = Buffer.from(await r.arrayBuffer());
  console.log(label, r.status, r.headers.get('cdn-cache') || r.headers.get('cf-cache-status') || '-', `${Date.now() - t}ms`, `${body.length}B`, new URL(url).host);
  return body.toString('latin1');
};
const next = (base, text, query) => {
  const line = text.split('\n').find((l) => l && !l.startsWith('#'));
  const u = new URL(line.trim(), base); if (query && !u.search) u.search = query; return u.toString();
};
(async () => {
  await mongoose.connect(process.env.MONGO_URI, { autoIndex: false });
  const url = await mint(process.argv[2]);
  const q = new URL(url).search;
  const master = await get(url, 'master ');
  const childUrl = next(url, master, q);
  const child = await get(childUrl, 'child  ');
  await get(next(childUrl, child, q), 'segment');
  await mongoose.disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
