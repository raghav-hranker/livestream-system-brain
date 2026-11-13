// Playback CDN pilot: route chosen classes through Bunny (over B2) while the
// process default stays Cloudflare (over R2), and measure both edges per class.
//
// PROBE (runs anywhere, Node 18+, no deploy needed — uses the live ?cdn= override):
//   node playback_cdn_pilot.cjs probe --api https://backend.quicktricksbysahilsir.com \
//        --token <user-or-admin JWT> --runs 3 <classId> [<classId> ...]
//   For each class × {bunny, cloudflare}: mint via GET /api/classes/:id/playback?cdn=X,
//   then fetch master → first child playlist → first segment (carrying the Bunny query token the
//   way the apps do), recording HTTP status,
//   TTFB, total ms and the edge cache header (Bunny CDN-Cache, Cloudflare cf-cache-status).
//   Run 1 on Bunny is the cold-cache number; later runs show warm behaviour.
//   A non-200 on Bunny means the class's HLS objects are not in the B2 bucket — copy
//   R2 → B2 for that prefix before setting the override. Writes probe JSON to --out.
//
// SET / UNSET / LIST (run from the quicktricks-backend checkout on the prod box, like
// the other reference/scripts, so dotenv + mongoose resolve; needs the deployed code
// that reads Class.playbackCdn):
//   node playback_cdn_pilot.cjs list                          # classes with playbackCdn set
//   node playback_cdn_pilot.cjs set bunny <id> [<id> ...]     # dry-run
//   node playback_cdn_pilot.cjs set bunny <id> ... --commit   # backup JSON, then $set
//   node playback_cdn_pilot.cjs unset <id> ... --commit       # $unset (back to env default)
//   node playback_cdn_pilot.cjs --restore <backup.json>
//
// Env for set/unset: MONGO_URI from .env.development (override DOTENV_CONFIG_PATH).
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(name); return i === -1 ? undefined : args[i + 1]; };
const has = (name) => args.includes(name);
const ids = args.filter((a) => /^[0-9a-f]{24}$/.test(a));
const CDNS = ['bunny', 'cloudflare'];

// ---------------------------------------------------------------- probe

async function timedGet(url, headers = {}) {
  const t0 = performance.now();
  let ttfb = null;
  try {
    const res = await fetch(url, { headers, redirect: 'follow' });
    ttfb = performance.now() - t0;
    const buf = Buffer.from(await res.arrayBuffer());
    return {
      status: res.status,
      ttfbMs: Math.round(ttfb),
      totalMs: Math.round(performance.now() - t0),
      bytes: buf.length,
      cache: res.headers.get('cdn-cache') || res.headers.get('cf-cache-status') || res.headers.get('x-cache') || null,
      server: res.headers.get('server'),
      body: buf,
    };
  } catch (err) {
    return { status: 0, error: String(err.message || err), ttfbMs: ttfb, totalMs: Math.round(performance.now() - t0) };
  }
}

const firstLine = (text, pred) => text.split('\n').map((l) => l.trim()).find((l) => l && !l.startsWith('#') && pred(l));

async function probeOne(api, token, classId, cdn, pathTpl) {
  const mintUrl = `${api}${pathTpl.replace(':id', classId)}?cdn=${cdn}`;
  const mint = await timedGet(mintUrl, { Authorization: `Bearer ${token}` });
  const row = { classId, cdn, mint: { status: mint.status, ms: mint.totalMs } };
  if (mint.status !== 200) { row.error = `mint ${mint.status}: ${mint.body?.toString().slice(0, 200)}`; return row; }
  const url = JSON.parse(mint.body.toString()).data?.url;
  if (!url) { row.error = 'mint returned no data.url'; return row; }
  row.host = new URL(url).host;

  const master = await timedGet(url);
  row.master = pick(master);
  if (master.status !== 200) return row;
  const childRel = firstLine(master.body.toString(), () => true);
  if (!childRel) { row.error = 'master has no child playlist'; return row; }
  // Bunny's directory token rides the query string, which relative resolution drops; the apps
  // re-append it (Android) or move it into the path (iOS). Carry it like they do. Cloudflare's
  // /v/<token>/ prefix lives in the path and survives resolution on its own.
  const carry = (rel, base) => { const u = new URL(rel, base); if (!u.search) u.search = new URL(url).search; return u.toString(); };
  const childUrl = carry(childRel, url);
  const child = await timedGet(childUrl);
  row.child = pick(child);
  if (child.status !== 200) return row;
  const segRel = firstLine(child.body.toString(), (l) => !l.endsWith('.m3u8'));
  if (!segRel) { row.error = 'child has no segment'; return row; }
  const seg = await timedGet(carry(segRel, childUrl));
  row.segment = pick(seg);
  return row;
}
const pick = (r) => ({ status: r.status, ttfbMs: r.ttfbMs, totalMs: r.totalMs, bytes: r.bytes, cache: r.cache, error: r.error });

async function probe() {
  const api = (flag('--api') || 'https://backend.quicktricksbysahilsir.com').replace(/\/+$/, '');
  const token = flag('--token') || process.env.PLAYBACK_TOKEN;
  const runs = Number(flag('--runs') || 1);
  const pathTpl = flag('--path') || '/api/classes/:id/playback';
  const out = flag('--out') || `playback-cdn-probe-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  if (!token) throw new Error('--token <JWT> (or PLAYBACK_TOKEN) is required');
  if (!ids.length) throw new Error('give at least one 24-hex classId');

  const rows = [];
  for (let run = 1; run <= runs; run++) {
    for (const classId of ids) {
      for (const cdn of CDNS) {
        const row = await probeOne(api, token, classId, cdn, pathTpl);
        row.run = run;
        rows.push(row);
        const s = (k) => row[k] ? `${row[k].status} ${row[k].ttfbMs ?? '-'}ms ${row[k].cache ?? ''}`.trim() : '-';
        console.log(`run ${run} ${classId} ${cdn.padEnd(10)} ${String(row.host || '').padEnd(36)} master ${s('master').padEnd(22)} child ${s('child').padEnd(22)} seg ${s('segment').padEnd(22)} ${row.error || ''}`);
      }
    }
  }
  fs.writeFileSync(out, JSON.stringify({ api, runs, generatedAt: new Date().toISOString(), rows }, null, 2));
  console.log(`\nwrote ${out}`);
  const bad = rows.filter((r) => r.cdn === 'bunny' && (r.error || [r.master, r.child, r.segment].some((x) => x && x.status !== 200)));
  if (bad.length) console.log(`\nBunny NOT serving ${new Set(bad.map((b) => b.classId)).size} class(es) — objects missing in B2 or key/zone mismatch. Do not set playbackCdn for them yet.`);
}

// ---------------------------------------------------------------- set / unset / list / restore

async function withMongo(fn) {
  require(path.resolve('node_modules/dotenv')).config({ path: process.env.DOTENV_CONFIG_PATH || '.env.development' });
  const mongoose = require(path.resolve('node_modules/mongoose'));
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is not set');
  await mongoose.connect(process.env.MONGO_URI, { autoIndex: false });
  try { await fn(mongoose, mongoose.connection.db.collection('classes')); } finally { await mongoose.disconnect(); }
}

const oid = (m, id) => new m.Types.ObjectId(id);

async function list() {
  await withMongo(async (m, classes) => {
    const rows = await classes.find({ playbackCdn: { $exists: true } }, { projection: { title: 1, playbackCdn: 1, 'hlsAsset.bucket': 1, 'hlsAsset.key': 1 } }).toArray();
    console.table(rows.map((r) => ({ id: String(r._id), playbackCdn: r.playbackCdn, bucket: r.hlsAsset?.bucket, key: r.hlsAsset?.key, title: r.title })));
  });
}

async function setOrUnset(value) {
  if (!ids.length) throw new Error('give at least one 24-hex classId');
  await withMongo(async (m, classes) => {
    const rows = await classes.find({ _id: { $in: ids.map((i) => oid(m, i)) } }, { projection: { title: 1, playbackCdn: 1, hlsAsset: 1 } }).toArray();
    const missing = ids.filter((i) => !rows.some((r) => String(r._id) === i));
    if (missing.length) console.log(`not found: ${missing.join(', ')}`);
    const noAsset = rows.filter((r) => !r.hlsAsset || r.hlsAsset.bucket !== 'recorded');
    if (noAsset.length) console.log(`WARNING no recorded hlsAsset (playback will not use the override): ${noAsset.map((r) => String(r._id)).join(', ')}`);
    console.table(rows.map((r) => ({ id: String(r._id), before: r.playbackCdn ?? null, after: value ?? null, key: r.hlsAsset?.key, title: r.title })));
    if (!has('--commit')) { console.log('dry-run; add --commit to write'); return; }
    const backup = `playback-cdn-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    fs.writeFileSync(backup, JSON.stringify(rows.map((r) => ({ _id: String(r._id), playbackCdn: r.playbackCdn ?? null })), null, 2));
    const update = value ? { $set: { playbackCdn: value } } : { $unset: { playbackCdn: '' } };
    const res = await classes.updateMany({ _id: { $in: rows.map((r) => r._id) } }, update);
    console.log(`matched ${res.matchedCount} modified ${res.modifiedCount}; backup ${backup}`);
  });
}

async function restore(file) {
  await withMongo(async (m, classes) => {
    const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
    const res = await classes.bulkWrite(rows.map((r) => ({
      updateOne: {
        filter: { _id: oid(m, r._id) },
        update: r.playbackCdn === null ? { $unset: { playbackCdn: '' } } : { $set: { playbackCdn: r.playbackCdn } },
      },
    })));
    console.log(`restored ${res.modifiedCount}/${rows.length}`);
  });
}

(async () => {
  const cmd = args[0];
  if (has('--restore')) return restore(flag('--restore'));
  if (cmd === 'probe') return probe();
  if (cmd === 'list') return list();
  if (cmd === 'set') {
    if (!CDNS.includes(args[1])) throw new Error(`set <${CDNS.join('|')}> <ids...>`);
    return setOrUnset(args[1]);
  }
  if (cmd === 'unset') return setOrUnset(undefined);
  throw new Error('usage: probe | list | set <bunny|cloudflare> | unset | --restore <file>  (see header)');
})().catch((e) => { console.error(e.message || e); process.exit(1); });
