// Read-only, on webserver2-2 from the backend checkout via `node -` (env CLASS, IPS="label=ip,..."): mints an admin
// preview (no view recorded) as if from each address, then fetches master -> rung -> segment. Shows which CDN each
// network gets. Prints no tokens.
const path = require('path');
require(path.resolve('node_modules/dotenv')).config({ path: '.env.development' });
const mongoose = require(path.resolve('node_modules/mongoose'));
const { getPlaybackUrl } = require(path.resolve('dist/src/controllers/playbackController.js'));

const mint = (classId, ip, query = {}) => new Promise((resolve) => {
  const res = { status(c) { this.code = c; return this; }, json(b) { resolve({ code: this.code, data: b.data }); return this; } };
  getPlaybackUrl({ user: { admin_id: 'routing-check' }, params: { classId }, query, headers: { 'x-forwarded-for': ip }, ip, socket: {} }, res, () => resolve({ code: 0 }));
});
const fetchStatus = async (url) => {
  const r = await fetch(url);
  return { status: r.status, text: Buffer.from(await r.arrayBuffer()).toString('latin1') };
};
const nextUrl = (base, text) => {
  const u = new URL(text.split('\n').map((l) => l.trim()).find((l) => l && !l.startsWith('#')), base);
  if (!u.search) u.search = new URL(base).search;
  return u.toString();
};
const walk = async (url) => {
  const master = await fetchStatus(url);
  if (master.status !== 200) return `master ${master.status}`;
  const rungUrl = nextUrl(url, master.text);
  const rung = await fetchStatus(rungUrl);
  if (rung.status !== 200) return `rung ${rung.status}`;
  return `master 200, rung 200, segment ${(await fetchStatus(nextUrl(rungUrl, rung.text))).status}`;
};

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { autoIndex: false });
  const nowUnix = Math.floor(Date.now() / 1000);
  for (const [label, ip, cdn] of process.env.IPS.split(',').map((x) => x.split('='))) {
    const { code, data } = await mint(process.env.CLASS, ip, cdn ? { cdn } : {});
    if (code !== 200) { console.log(`${label}: mint ${code}`); continue; }
    const hours = ((data.expiresAt - nowUnix) / 3600).toFixed(1);
    console.log(`${label}: ${new URL(data.url).host}, ${hours} h, ${await walk(data.url)}`);
  }
  await mongoose.disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
