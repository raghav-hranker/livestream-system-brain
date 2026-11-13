// Read-only: calls the deployed /playback handler in-process as an admin preview (no view recorded)
// and prints only the signed URL's host. Run from the quicktricks-backend checkout.
const path = require('path');
require(path.resolve('node_modules/dotenv')).config({ path: '.env.development' });
const mongoose = require(path.resolve('node_modules/mongoose'));
const { getPlaybackUrl } = require(path.resolve('dist/src/controllers/playbackController.js'));

const call = (classId) => new Promise((resolve) => {
  const res = { status(c) { this.code = c; return this; }, json(b) { resolve({ code: this.code, body: b }); return this; } };
  getPlaybackUrl({ user: { admin_id: 'playback-host-check' }, params: { classId }, query: {}, headers: {}, ip: '127.0.0.1', socket: {} }, res, (e) => resolve({ code: 'next', body: String(e) }));
});

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { autoIndex: false });
  const ids = process.argv.slice(2);
  const other = await mongoose.connection.db.collection('classes').findOne(
    { 'hlsAsset.bucket': 'recorded', playbackCdn: { $exists: false }, _id: { $nin: ids.map((i) => new mongoose.Types.ObjectId(i)) } },
    { projection: { _id: 1 }, sort: { _id: -1 } });
  for (const id of [...ids, String(other._id)]) {
    const r = await call(id);
    const host = r.body?.data?.url ? new URL(r.body.data.url).host : JSON.stringify(r.body).slice(0, 120);
    console.log(id, ids.includes(id) ? 'pilot' : 'control', r.code, host);
  }
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
