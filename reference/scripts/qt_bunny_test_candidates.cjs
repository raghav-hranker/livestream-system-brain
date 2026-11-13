// read-only: old, low-traffic recorded classes in popular courses, each walked through Bunny and Cloudflare using the
// `?cdn=` mint option, so nothing is switched and no view is recorded. For a same-video CDN test: the class must be
// recorded-zone and predate the 2026-09-10 cutover, because Bunny reads the old bucket.
// Prints status, cache and bytes per file only, never a URL or token.
// run: ssh webserver2-2 'export PATH=<nvm>/bin:$PATH; cd <backend> && node -' < qt_bunny_test_candidates.cjs
//   env MAX_VIEWS (default 10 per class in 14 days), TOP_COURSES (8), LIMIT (classes walked, 12),
//   MOB (a student's mobile: list only classes that student can open, ranked by fewest viewers)
const path = require('path');
require(path.resolve('node_modules/dotenv')).config({ path: '.env.development' });
const mongoose = require(path.resolve('node_modules/mongoose'));
const { getPlaybackUrl } = require(path.resolve('dist/src/controllers/playbackController.js'));
const authz = require(path.resolve('dist/src/services/classAccessAuthz.js'));
const MAX_VIEWS = Number(process.env.MAX_VIEWS || 10), TOP = Number(process.env.TOP_COURSES || 8), LIMIT = Number(process.env.LIMIT || 12);
const CUTOVER = new Date('2026-09-10T00:00:00Z');

const mint = (classId, cdn) => new Promise((resolve) => {
  const res = { status(c) { this.code = c; return this; }, json(b) { resolve(b.data && b.data.url); return this; } };
  getPlaybackUrl({ user: { admin_id: 'bunny-candidates' }, params: { classId }, query: { cdn }, headers: {}, ip: '127.0.0.1', socket: {} }, res, () => resolve(null));
});
const get = async (url) => {
  const r = await fetch(url); const body = Buffer.from(await r.arrayBuffer());
  return { status: r.status, cache: r.headers.get('cdn-cache') || r.headers.get('cf-cache-status') || '-', bytes: body.length, text: body.toString('latin1') };
};
const entries = (text) => text.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
const resolve = (base, line, q) => { const u = new URL(line, base); if (q && !u.search) u.search = q; return u.toString(); };
// Follow the 480p rung (the app's default) to a segment a quarter of the way in, plus the last one.
const walk = async (classId, cdn) => {
  const url = await mint(classId, cdn);
  if (!url) return { cdn, ok: false, note: 'no url' };
  const q = new URL(url).search;
  const master = await get(url);
  if (master.status !== 200) return { cdn, ok: false, note: `master ${master.status}` };
  const rungs = entries(master.text);
  const rung = rungs.find((l) => l.includes('480')) || rungs[0];
  const child = await get(resolve(url, rung, q));
  if (child.status !== 200) return { cdn, ok: false, note: `child ${child.status}` };
  const segs = entries(child.text);
  const minutes = Math.round([...child.text.matchAll(/#EXTINF:([\d.]+)/g)].reduce((a, m) => a + Number(m[1]), 0) / 60);
  const childUrl = resolve(url, rung, q);
  const mid = await get(resolve(childUrl, segs[Math.floor(segs.length / 4)], q));
  const last = await get(resolve(childUrl, segs[segs.length - 1], q));
  return { cdn, ok: mid.status === 200 && last.status === 200, host: new URL(url).hostname, minutes, note: `seg ${mid.status}/${mid.cache}/${mid.bytes}B last ${last.status}/${last.bytes}B` };
};

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { autoIndex: false, readPreference: 'secondaryPreferred' });
  const db = mongoose.connection.db;
  const since = new Date(Date.now() - 14 * 86400000);
  const views = await db.collection('views').aggregate([
    { $match: { viewedAt: { $gte: since } } },
    { $group: { _id: { c: { $toString: '$classId' }, u: { $toString: '$userId' } }, n: { $sum: 1 } } },
    { $group: { _id: '$_id.c', users: { $sum: 1 }, views: { $sum: '$n' } } },
  ], { maxTimeMS: 120000 }).toArray();
  const byClass = new Map(views.map((v) => [v._id, v]));

  const placements = await db.collection('courseclasses').find({}).project({ classId: 1, courseId: 1, course: 1, class: 1 }).toArray();
  const courseOf = (p) => String(p.courseId || p.course), classOf = (p) => String(p.classId || p.class);
  const reach = new Map();
  for (const p of placements) {
    const v = byClass.get(classOf(p)); if (!v) continue;
    reach.set(courseOf(p), (reach.get(courseOf(p)) || 0) + v.users);
  }
  const top = [...reach].sort((a, b) => b[1] - a[1]).map(([id]) => id).filter((id) => /^[0-9a-f]{24}$/.test(id));
  const courses = await db.collection('courses').find({ _id: { $in: top.map((i) => new mongoose.Types.ObjectId(i)) }, status: 1 }).project({ title: 1 }).toArray();
  const title = new Map(courses.map((c) => [String(c._id), c.title]));
  let topIds = top.filter((id) => title.has(id)).slice(0, TOP);
  let student = null;
  if (process.env.MOB) {
    const m = process.env.MOB;
    student = await db.collection('users').findOne({ mobile: { $in: [Number(m), Number('91' + m), m, '91' + m] } }, { projection: { _id: 1 } });
    if (!student) throw new Error('no user for that mobile');
    // The student's own classes: start from what they watched, then every course placement of those classes that they can open.
    const seen = await db.collection('views').distinct('classId', { userId: { $in: [student._id, String(student._id)] } });
    const seenIds = new Set(seen.map(String));
    const ids = [...new Set(placements.filter((p) => seenIds.has(classOf(p))).map(courseOf))].filter((id) => /^[0-9a-f]{24}$/.test(id));
    const own = await db.collection('courses').find({ _id: { $in: ids.map((i) => new mongoose.Types.ObjectId(i)) }, status: 1 }).project({ title: 1 }).toArray();
    own.forEach((c) => title.set(String(c._id), c.title));
    topIds = own.map((c) => String(c._id));
  }
  console.log(student ? 'courses of classes this student watched:' : 'top courses by recent viewers:'); topIds.forEach((id) => console.log(`  ${String(title.get(id)).slice(0, 60)}`));

  const inTop = new Map();
  for (const p of placements) if (topIds.includes(courseOf(p))) (inTop.get(classOf(p)) || inTop.set(classOf(p), new Set()).get(classOf(p))).add(courseOf(p));
  const ids = [...inTop.keys()].filter((id) => /^[0-9a-f]{24}$/.test(id) && (byClass.get(id)?.views || 0) <= MAX_VIEWS);
  const classes = await db.collection('classes').find({
    _id: { $in: ids.map((i) => new mongoose.Types.ObjectId(i)) }, status: 1, 'hlsAsset.bucket': 'recorded',
    createdAt: { $lt: CUTOVER }, playbackCdn: { $exists: false },
  }).project({ title: 1, createdAt: 1 }).toArray();
  let pool = classes;
  if (student) {
    const allowed = [];
    for (const c of classes) {
      const r = await authz.authorizeClassAccess({ userId: String(student._id), isAdmin: false, classId: String(c._id), accessKind: 'play' }, authz.mongoAuthorizationDeps, { enforceOrderExpiry: true });
      if (r.allowed) allowed.push(c);
    }
    pool = allowed;
  }
  const seenBy = (c) => (byClass.get(String(c._id))?.users || 0);
  const ranked = pool.map((c) => ({ c, n: inTop.get(String(c._id)).size })).sort((a, b) => (student ? seenBy(a.c) - seenBy(b.c) : b.n - a.n)).slice(0, LIMIT * 3);
  console.log(`candidates ${classes.length}; walking up to ${ranked.length} until ${LIMIT} pass`);

  let passed = 0;
  for (const { c, n } of ranked) {
    if (passed >= LIMIT) break;
    const id = String(c._id), v = byClass.get(id) || { views: 0, users: 0 };
    const [b, f] = [await walk(id, 'bunny'), await walk(id, 'cloudflare')];
    const ok = b.ok && f.ok && b.minutes >= 20; if (ok) passed++;
    console.log(`${ok ? 'PASS' : 'FAIL'} ${id} "${String(c.title).slice(0, 44)}" created=${c.createdAt.toISOString().slice(0, 10)} ${b.minutes ?? '?'}min views14d=${v.views} users=${v.users}`);
    console.log(`  bunny ${b.host || ''} ${b.note}\n  cf    ${f.host || ''} ${f.note}`);
    if (ok) console.log(`  courses: ${[...inTop.get(id)].map((i) => String(title.get(i)).slice(0, 40)).join(' | ')}`);
  }
  await mongoose.disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
