// READ-ONLY. How many classes in rooms-rebuild-2026-11-02.ndjson still make the recording API say "Recordings will be available soon":
// no room in Atlas test.rooms, or a room with an empty mp4Recordings. Prints per client, and samples of each.
// The rows are prepended as `const ROWS = [[clientId, classId], ...]` by the caller. Run on the GPU box from the checkout that serves the API:
//   (printf 'const ROWS = '; node -e '<ids>' ; printf ';\n'; cat rooms_gap_count.cjs) | ssh ... 'cd /root/livestream-futurekul/backend && node -'
const path = require('path');
const { MongoClient } = require(path.join(process.cwd(), 'node_modules/mongoose')).mongo;

(async () => {
  const client = new MongoClient(require(path.join(process.cwd(), 'config/config')).dbUri, { serverSelectionTimeoutMS: 20000, socketTimeoutMS: 120000 });
  await client.connect();
  const rooms = client.db('test').collection('rooms');
  const found = new Map();
  for (let i = 0; i < ROWS.length; i += 500) {
    const ids = ROWS.slice(i, i + 500).map((r) => r[1]);
    for (const d of await rooms.find({ classId: { $in: ids } }, { projection: { classId: 1, clientId: 1, mp4Recordings: 1 } }).toArray()) {
      const had = found.get(d.classId);
      if (!had || (d.mp4Recordings || []).length) found.set(d.classId, d);
    }
  }
  const by = {};
  const samples = { noRoom: {}, empty: {} };
  for (const [clientId, classId] of ROWS) {
    const c = (by[clientId] ||= { listed: 0, ok: 0, noRoom: 0, empty: 0 });
    c.listed++;
    const d = found.get(classId);
    const kind = !d ? 'noRoom' : (d.mp4Recordings || []).length ? 'ok' : 'empty';
    c[kind]++;
    if (kind !== 'ok') ((samples[kind][clientId] ||= []).length < 6) && samples[kind][clientId].push(classId);
  }
  console.log('client   listed       ok   noRoom    empty');
  const total = { listed: 0, ok: 0, noRoom: 0, empty: 0 };
  for (const [c, v] of Object.entries(by).sort((a, b) => b[1].noRoom + b[1].empty - a[1].noRoom - a[1].empty)) {
    console.log(c.padEnd(6), String(v.listed).padStart(8), String(v.ok).padStart(8), String(v.noRoom).padStart(8), String(v.empty).padStart(8));
    for (const k of Object.keys(total)) total[k] += v[k];
  }
  console.log('TOTAL ', String(total.listed).padStart(8), String(total.ok).padStart(8), String(total.noRoom).padStart(8), String(total.empty).padStart(8));
  console.log('rooms in collection:', await rooms.estimatedDocumentCount());
  console.log('samples, empty:', JSON.stringify(samples.empty));
  console.log('samples, no room:', JSON.stringify(samples.noRoom));
  await client.close();
})().catch((e) => { console.error('FAILED', e.message.replace(/mongodb(\+srv)?:\/\/\S+/g, '<uri>')); process.exit(1); });
