// WRITES with COMMIT=1. Restores rooms into Atlas test.rooms from rooms-rebuild-2026-11-02.ndjson. Insert-only: an existing classId is
// never changed. New records carry restoredFrom, so they can be told apart and undone: rooms.deleteMany({ restoredFrom: TAG }).
// MODE=dump prints every current room as EJSON instead (the copy to take first). Default is a dry run.
// The rows are prepended as `const ROWS = [...]` by the caller. Run on the GPU box from the checkout that serves the API:
//   (printf 'const ROWS = '; node -e '<filter>' ; printf ';\n'; cat rooms_restore_apply.cjs) | ssh ... 'cd /root/livestream-futurekul/backend && COMMIT=1 node -'
const path = require('path');
const { MongoClient, BSON } = require(path.join(process.cwd(), 'node_modules/mongoose')).mongo;
const TAG = process.env.TAG || 'rooms-rebuild-2026-11-02';
const BATCH = 100;

(async () => {
  const client = new MongoClient(require(path.join(process.cwd(), 'config/config')).dbUri, { serverSelectionTimeoutMS: 20000, socketTimeoutMS: 120000 });
  await client.connect();
  const rooms = client.db('test').collection('rooms');

  if (process.env.MODE === 'dump') {
    for await (const r of rooms.find({})) console.log(BSON.EJSON.stringify(r));
    await client.close();
    return;
  }

  const ids = ROWS.map((r) => r.classId);
  if (new Set(ids).size !== ids.length) throw new Error('a classId appears twice in the rows');
  const existing = await rooms.find({ classId: { $in: ids } }, { projection: { classId: 1, mp4Recordings: 1 } }).toArray();
  const empty = existing.filter((r) => !(r.mp4Recordings || []).length).map((r) => r.classId);
  console.log(`rows ${ROWS.length}; already have a room ${existing.length} (of those, no recordings: ${empty.length}); rooms now ${await rooms.estimatedDocumentCount()}`);
  if (empty.length) console.log('existing rooms left without recordings:', empty.slice(0, 20).join(' '));
  if (process.env.COMMIT !== '1') {
    console.log(`dry run: would insert ${ROWS.length - existing.length}`);
    await client.close();
    return;
  }

  const now = new Date();
  const counts = { inserted: 0, alreadyThere: 0, failed: 0 };
  for (let i = 0; i < ROWS.length; i += BATCH) {
    const ops = ROWS.slice(i, i + BATCH).map((r) => ({
      updateOne: {
        filter: { classId: r.classId },
        update: {
          $setOnInsert: {
            clientId: r.clientId,
            roomId: r.classId,
            status: 'recorded',
            messages: [],
            mp4Recordings: r.recordings.map((x) => ({ url: x.url, quality: x.quality, createdAt: now, ...(x.size ? { size: x.size } : {}) })),
            createdAt: now,
            updatedAt: now,
            __v: 0,
            restoredFrom: TAG,
          },
        },
        upsert: true,
      },
    }));
    try {
      const res = await rooms.bulkWrite(ops, { ordered: false });
      counts.inserted += res.upsertedCount;
      counts.alreadyThere += res.matchedCount;
    } catch (e) {
      const done = e.result || {};
      counts.inserted += done.upsertedCount || 0;
      counts.alreadyThere += done.matchedCount || 0;
      counts.failed += (e.writeErrors || []).length || ops.length;
      console.log(`batch at ${i}: ${e.message.slice(0, 140)}`);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  console.log('done', JSON.stringify(counts), `rooms now ${await rooms.estimatedDocumentCount()}; tagged ${await rooms.countDocuments({ restoredFrom: TAG })}`);
  await client.close();
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
