// READ-ONLY. Did a bulk delete empty Atlas test.rooms, and which classes lost their record? Prints the oplog's command and delete ops
// in a window (default 2026-10-30 20:30 to 21:00 IST), then per client how many completed transcoder jobs have outputs but no room
// (what the recording API now refuses, and what a rebuild from transcoder.videos could restore).
// Run on the GPU box from the checkout that serves the API:
//   ssh ... 'cd /root/livestream-futurekul/backend && node -' < rooms_wipe_evidence.cjs
const path = require('path');
const fs = require('fs');
const { MongoClient, Timestamp } = require(path.join(process.cwd(), 'node_modules/mongoose')).mongo;
const ist = (d) => (d ? new Date(new Date(d).getTime() + 5.5 * 36e5).toISOString().slice(0, 16).replace('T', ' ') : '-');
const start = new Date(process.env.WINDOW_START || '2026-10-30T15:00:00Z');
const end = new Date(process.env.WINDOW_END || '2026-10-30T15:30:00Z');
const ts = (d) => Timestamp.fromBits(0, Math.floor(d.getTime() / 1000));
const when = (o) => ist(new Date(o.ts.getHighBits() * 1000));

(async () => {
  const atlas = new MongoClient(require(path.join(process.cwd(), 'config/config')).dbUri, { serverSelectionTimeoutMS: 20000, socketTimeoutMS: 180000 });
  await atlas.connect();
  const oplog = atlas.db('local').collection('oplog.rs');
  const inWindow = { ts: { $gte: ts(start), $lte: ts(end) } };
  const cmds = await oplog.find({ ...inWindow, op: 'c' }, { projection: { ts: 1, ns: 1, o: 1 } }).limit(40).toArray();
  console.log(`command ops ${ist(start)} to ${ist(end)} IST: ${cmds.length}`);
  for (const o of cmds) {
    const inner = o.o.applyOps ? `applyOps ${o.o.applyOps.length} ops, first ${o.o.applyOps[0]?.ns} ${o.o.applyOps[0]?.op}` : JSON.stringify(o.o).slice(0, 110);
    console.log(`  ${when(o)}  ${o.ns}  ${inner}`);
  }
  const dels = await oplog.find({ ...inWindow, op: 'd', ns: 'test.rooms' }, { projection: { ts: 1 } }).limit(5).toArray();
  console.log(`single deletes on test.rooms in window: ${await oplog.countDocuments({ ...inWindow, op: 'd', ns: 'test.rooms' })}${dels[0] ? `, first ${when(dels[0])}` : ''}`);
  const firstInsert = await oplog.find({ op: 'i', ns: 'test.rooms' }, { projection: { ts: 1, o: 1 } }).sort({ $natural: 1 }).limit(3).toArray();
  console.log('earliest room inserts in the oplog:', firstInsert.map((o) => `${when(o)} class ${o.o.classId} room ${o.o.roomId}`).join(' | '));
  const lastUpdate = await oplog.find({ op: 'u', ns: 'test.rooms', ts: { $lte: ts(start) } }, { projection: { ts: 1 } }).sort({ $natural: -1 }).limit(1).hint({ $natural: -1 }).toArray().catch(() => []);
  console.log('last room update before the window:', lastUpdate[0] ? when(lastUpdate[0]) : '-');

  const present = new Set((await atlas.db('test').collection('rooms').find({}, { projection: { classId: 1 } }).toArray()).map((r) => String(r.classId)));
  await atlas.close();

  const line = fs.readFileSync('/root/video-transcoder/gpu-server/job-manager/.env', 'utf8').split('\n').find((l) => l.startsWith('MONGO_URI='));
  const jm = new MongoClient(line.slice(10).trim().replace(/^["']|["']$/g, ''), { serverSelectionTimeoutMS: 20000, socketTimeoutMS: 180000 });
  await jm.connect();
  const jobs = await jm.db('transcoder').collection('videos').find(
    { status: 'completed', 'outputs.0': { $exists: true } },
    { projection: { clientId: 1, classId: 1, completedAt: 1 } },
  ).toArray();
  const perClient = {};
  for (const j of jobs) {
    if (!/^\d+$/.test(String(j.clientId)) || !j.classId) continue;
    const c = (perClient[j.clientId] ||= { classes: new Set(), missing: new Set() });
    c.classes.add(String(j.classId));
    if (!present.has(String(j.classId))) c.missing.add(String(j.classId));
  }
  console.log('\nclient  classes-with-outputs  no-room-record');
  let total = 0;
  for (const [id, c] of Object.entries(perClient).sort((a, b) => b[1].missing.size - a[1].missing.size)) {
    total += c.missing.size;
    console.log(id.padEnd(7), String(c.classes.size).padStart(20), String(c.missing.size).padStart(15));
  }
  console.log(`total classes a rebuild could restore: ${total}`);
  await jm.close();
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
