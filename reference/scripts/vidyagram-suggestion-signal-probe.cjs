// Read-only, aggregate, vidyagramdb only: which signals could feed "Suggested for you". Saved exam picks, app
// events, search logs, paid-order baskets and co-purchase strength against the current catalogue. Prints counts and
// course titles, never a student's id, name or order. Lift = how many times likelier than chance two courses share a
// buyer. Run on webserver2-2 from the Vidyagram checkout, one heavy stage at a time, on a secondary:
//   cd /var/www/backend.vidyagramar.com/vidyagram-backend
//   nice -n 10 node -r dotenv/config - dotenv_config_path=.env.development < vidyagram-suggestion-signal-probe.cjs
// MIN_SHARED (30) is the fewest shared buyers a pair needs to count as a real link. RECENT_DAYS (90) sets "recent".
'use strict';

const mongoose = require(require.resolve('mongoose', { paths: [process.cwd()] }));
const MIN_SHARED = Number(process.env.MIN_SHARED || 30);
const RECENT_DAYS = Number(process.env.RECENT_DAYS || 90);
const OPTS = { allowDiskUse: true, maxTimeMS: 180000 };
const PAID = {
  orderStatus: 'success',
  grandTotal: { $gt: 0 },
  courseId: { $exists: true, $nin: [null, []] },
  parentOrderId: { $exists: false },
};

const safeCount = async (label, run) => {
  try { console.log(`${label}: ${await run()}`); } catch (e) { console.log(`${label}: failed (${e.codeName || e.message})`); }
};

(async () => {
  const conn = await mongoose.createConnection(process.env.MONGO_URI, { readPreference: 'secondaryPreferred' }).asPromise();
  const db = conn.useDb('vidyagramdb').db;
  const recentFrom = new Date(Date.now() - RECENT_DAYS * 86400000);

  const res = await fetch('https://backend.vidyagramar.com/api/courses/filter', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ tab: 'all' }),
  });
  const catalogue = (await res.json()).courses;
  const titles = new Map(catalogue.map((c) => [String(c.id), c.title]));
  console.log(`current catalogue: ${catalogue.length}`);

  console.log('\n== saved exam picks');
  const users = db.collection('users');
  console.log(`users (estimate): ${await users.estimatedDocumentCount()}`);
  await safeCount('users with categories[]', () => users.countDocuments({ 'categories.0': { $exists: true } }, { maxTimeMS: 60000 }));
  await safeCount('users with exam_preparing_for', () => users.countDocuments({ exam_preparing_for: { $nin: [null, ''] } }, { maxTimeMS: 60000 }));

  console.log('\n== app events and search');
  const events = db.collection('appevents');
  console.log(`appevents (estimate): ${await events.estimatedDocumentCount()}`);
  for (const eventName of ['COURSE_VIEW', 'COURSE_CLICK', 'PAYMENT_STARTED']) {
    await safeCount(`${eventName} last ${RECENT_DAYS} d`, () => events.countDocuments({ eventName, occurredAt: { $gte: recentFrom } }, { maxTimeMS: 60000 }));
  }
  console.log(`searchlogs (estimate): ${await db.collection('searchlogs').estimatedDocumentCount()}`);
  console.log(`searchclicklogs (estimate): ${await db.collection('searchclicklogs').estimatedDocumentCount()}`);
  console.log(`classprogresses (estimate): ${await db.collection('classprogresses').estimatedDocumentCount()}`);

  console.log('\n== paid baskets');
  const orders = db.collection('orders');
  console.log(`orders (estimate): ${await orders.estimatedDocumentCount()}`);
  const cursor = orders.aggregate([
    { $match: PAID },
    { $project: { userId: 1, courseId: 1 } },
    { $unwind: '$courseId' },
    { $group: { _id: '$userId', courses: { $addToSet: { $toString: '$courseId' } } } },
  ], OPTS).batchSize(5000);

  const buyersOf = new Map();
  const pairs = new Map();
  const sizes = { 1: 0, 2: 0, '3-5': 0, '6+': 0 };
  let baskets = 0;
  let boughtCurrent = 0;
  for await (const { courses } of cursor) {
    baskets += 1;
    const n = courses.length;
    sizes[n === 1 ? 1 : n === 2 ? 2 : n <= 5 ? '3-5' : '6+'] += 1;
    if (courses.some((id) => titles.has(id))) boughtCurrent += 1;
    for (const id of courses) buyersOf.set(id, (buyersOf.get(id) || 0) + 1);
    // Directed anchor -> target. A target must be on sale now; an anchor may be any course, retired batches too.
    if (n > 60) continue;
    for (const anchor of courses) {
      for (const target of courses) {
        if (anchor === target || !titles.has(target)) continue;
        const key = `${anchor}|${target}`;
        pairs.set(key, (pairs.get(key) || 0) + 1);
      }
    }
  }
  console.log(`students with a paid course order: ${baskets}; basket sizes ${JSON.stringify(sizes)}`);
  console.log(`of those, bought a course on sale now: ${boughtCurrent}`);
  console.log(`courses ever bought: ${buyersOf.size}; on sale now with a buyer: ${catalogue.filter((c) => buyersOf.has(String(c.id))).length}`);

  console.log('\n== co-purchase links');
  const linksFor = new Map();
  for (const [key, shared] of pairs) {
    if (shared < MIN_SHARED) continue;
    const [anchor, target] = key.split('|');
    const lift = (shared * baskets) / (buyersOf.get(anchor) * buyersOf.get(target));
    if (lift <= 1) continue;
    if (!linksFor.has(anchor)) linksFor.set(anchor, []);
    linksFor.get(anchor).push({ target, shared, lift, conf: shared / buyersOf.get(anchor) });
  }
  const anchoredBuyers = [...linksFor.keys()].reduce((sum, a) => sum + buyersOf.get(a), 0);
  console.log(`anchor courses with at least one link (shared >= ${MIN_SHARED}, lift > 1): ${linksFor.size}`);
  console.log(`on-sale courses reachable as a target: ${new Set([...linksFor.values()].flat().map((l) => l.target)).size} of ${catalogue.length}`);
  console.log(`buyer-course pairs on a linked anchor: ${anchoredBuyers}`);

  const best = catalogue.map((c) => String(c.id)).filter((id) => linksFor.has(id))
    .sort((a, b) => buyersOf.get(b) - buyersOf.get(a)).slice(0, 8);
  for (const anchor of best) {
    console.log(`\nbought "${titles.get(anchor)}" (${buyersOf.get(anchor)} buyers), also bought:`);
    for (const l of linksFor.get(anchor).sort((a, b) => b.lift - a.lift).slice(0, 4)) {
      console.log(`  lift ${l.lift.toFixed(1)}  ${(l.conf * 100).toFixed(0)}% of buyers  ${l.shared} shared  ${titles.get(l.target)}`);
    }
  }

  console.log('\n== best sellers on sale now');
  const recent = await orders.aggregate([
    { $match: { ...PAID, orderDate: { $gte: recentFrom } } },
    { $project: { userId: 1, courseId: 1 } },
    { $unwind: '$courseId' },
    { $group: { _id: { $toString: '$courseId' }, n: { $sum: 1 } } },
  ], OPTS).toArray();
  const recentBy = new Map(recent.map((r) => [r._id, r.n]));
  console.log(`paid course orders dated in the last ${RECENT_DAYS} d: ${recent.reduce((s, r) => s + r.n, 0)}`);
  const rows = catalogue.map((c) => ({ title: c.title, all: buyersOf.get(String(c.id)) || 0, recent: recentBy.get(String(c.id)) || 0 }))
    .sort((a, b) => b.recent - a.recent || b.all - a.all);
  for (const r of rows.slice(0, 12)) console.log(`  recent ${String(r.recent).padStart(6)}  all-time ${String(r.all).padStart(7)}  ${r.title}`);
  console.log(`on-sale courses with no paid buyer: ${rows.filter((r) => r.all === 0).length}`);

  await conn.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
