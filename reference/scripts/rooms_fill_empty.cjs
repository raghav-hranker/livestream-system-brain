// WRITES with COMMIT=1. Fills mp4Recordings on existing Atlas test.rooms records that are still empty, from rows of
// rooms-rebuild-2026-11-02.ndjson. For rooms created after the 10-30 loss (rooms_restore_apply.cjs is insert-only and skips them).
// Only an empty list on the same classId + clientId is ever changed; status and every other field stay as they are.
// Filled records carry filledFrom. Undo: rooms.updateMany({ filledFrom: TAG }, { $set: { mp4Recordings: [] }, $unset: { filledFrom: '' } }).
// The rows are prepended as `const ROWS = [...]` by the caller. Default is a dry run. Run on the GPU box from the checkout that serves the API:
//   (printf 'const ROWS = '; node -e '<filter>' ; printf ';\n'; cat rooms_fill_empty.cjs) | ssh ... 'cd /root/livestream-futurekul/backend && COMMIT=1 node -'
const path = require('path');
const { MongoClient } = require(path.join(process.cwd(), 'node_modules/mongoose')).mongo;
const TAG = 'rooms-rebuild-2026-11-02';

(async () => {
  const client = new MongoClient(require(path.join(process.cwd(), 'config/config')).dbUri, { serverSelectionTimeoutMS: 20000 });
  await client.connect();
  const rooms = client.db('test').collection('rooms');
  const now = new Date();
  for (const r of ROWS) {
    const found = await rooms.find({ classId: r.classId }, { projection: { clientId: 1, status: 1, mp4Recordings: 1, createdAt: 1 } }).toArray();
    const state = found.map((d) => `${d.clientId}/${d.status}/${(d.mp4Recordings || []).length} recordings`).join(', ') || 'no room';
    if (found.length !== 1 || String(found[0].clientId) !== String(r.clientId) || (found[0].mp4Recordings || []).length) {
      console.log(`SKIP ${r.classId}: ${state}`);
      continue;
    }
    if (process.env.COMMIT !== '1') {
      console.log(`DRY ${r.classId}: ${state}; would set ${r.recordings.map((x) => x.quality).join(',')}`);
      continue;
    }
    const res = await rooms.updateOne(
      { _id: found[0]._id, clientId: found[0].clientId, mp4Recordings: { $size: 0 } },
      { $set: { mp4Recordings: r.recordings.map((x) => ({ url: x.url, quality: x.quality, createdAt: now, ...(x.size ? { size: x.size } : {}) })), updatedAt: now, filledFrom: TAG } },
    );
    console.log(`FILLED ${r.classId}: matched ${res.matchedCount}, modified ${res.modifiedCount}`);
  }
  await client.close();
})().catch((e) => { console.error('FAILED', e.message.replace(/mongodb(\+srv)?:\/\/\S+/g, '<uri>')); process.exit(1); });
