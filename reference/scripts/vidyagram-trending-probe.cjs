// Read-only: what is in the shared trending Redis keys, whose documents they are, and what each tenant's own click
// log says its trending list should be. Redis: ZREVRANGE, GET, TTL only. Mongo: quicktricksdb + vidyagramdb on a
// secondary. Prints titles, ids of content and counts, never a student's id. Run on webserver2-2:
//   cd /var/www/backend.vidyagramar.com/vidyagram-backend
//   nice -n 10 node -r dotenv/config - dotenv_config_path=.env.development < vidyagram-trending-probe.cjs
// Score rule copied from trendingService.ts: distinct (user, UTC day) per document over 7 UTC days, minimum 10.
'use strict';

const from = (name) => require(require.resolve(name, { paths: [process.cwd()] }));
const mongoose = from('mongoose');
const Redis = from('ioredis');

const WINDOW_DAYS = 7;
const THRESHOLD = 10;
const LIMITS = { course: 3, ebook: 2, test: 2 };
const COLLECTION = { course: 'courses', ebook: 'ebooks', test: 'series' };
const AI_TEST = /^ai/i;

const utcDay = (d) => d.toISOString().slice(0, 10);
const lastDays = () => Array.from({ length: WINDOW_DAYS }, (_, i) => utcDay(new Date(Date.now() - i * 86400000)));
const toId = (s) => (mongoose.Types.ObjectId.isValid(s) ? new mongoose.Types.ObjectId(s) : s);
const titleOf = (doc) => doc.title || doc.series_name || doc.name || doc.courseName || '(no title)';

const lookup = async (db, type, ids) => {
  const col = COLLECTION[type];
  if (!col || !ids.length) return new Map();
  const docs = await db.collection(col)
    .find({ _id: { $in: ids.map(toId) } }, { projection: { title: 1, series_name: 1, name: 1, courseName: 1, status: 1, main_tab: 1 } })
    .toArray();
  return new Map(docs.map((d) => [String(d._id), d]));
};

const clickScores = async (db, since) => db.collection('searchclicklogs').aggregate([
  { $match: { ts: { $gte: since } } },
  { $group: { _id: { type: '$type', id: '$resultId', user: '$userId', day: { $dateToString: { date: '$ts', format: '%Y-%m-%d' } } } } },
  { $group: { _id: { type: '$_id.type', id: '$_id.id' }, score: { $sum: 1 } } },
  { $sort: { score: -1 } },
], { allowDiskUse: true, maxTimeMS: 120000 }).toArray();

const report = async (label, db, since, other) => {
  const counts = await db.collection('searchclicklogs').aggregate([
    { $match: { ts: { $gte: since } } },
    { $group: { _id: '$userId', clicks: { $sum: 1 } } },
    { $group: { _id: null, clicks: { $sum: '$clicks' }, users: { $sum: 1 } } },
  ], { allowDiskUse: true, maxTimeMS: 120000 }).toArray();
  const searches = await db.collection('searchlogs').countDocuments({ ts: { $gte: since } }, { maxTimeMS: 120000 });
  console.log(`\n== ${label} click log, last ${WINDOW_DAYS} days`);
  console.log(`searches ${searches}, clicks ${counts[0]?.clicks || 0}, distinct users ${counts[0]?.users || 0}`);

  const scores = await clickScores(db, since);
  for (const type of Object.keys(LIMITS)) {
    const rows = scores.filter((r) => r._id.type === type);
    const ids = rows.map((r) => String(r._id.id));
    const own = await lookup(db, type, ids);
    const foreign = await lookup(other, type, ids);
    const missing = rows.filter((r) => !own.has(String(r._id.id)));
    const missingForeign = missing.filter((r) => foreign.has(String(r._id.id)));
    console.log(`${type}: ${rows.length} clicked docs, ${rows.filter((r) => r.score >= THRESHOLD).length} at ${THRESHOLD}+; ` +
      `${missing.length} not in this db (${missingForeign.length} of them in the other tenant's db, ` +
      `score total ${missingForeign.reduce((n, r) => n + r.score, 0)})`);
    const eligible = rows.filter((r) => {
      const doc = own.get(String(r._id.id));
      return doc && doc.status === 1 && !(type === 'test' && AI_TEST.test(String(doc.main_tab || '')));
    });
    eligible.slice(0, LIMITS[type] + 3).forEach((r, i) => {
      const doc = own.get(String(r._id.id));
      const mark = i < LIMITS[type] && r.score >= THRESHOLD ? 'SHOWN' : 'below';
      console.log(`  ${mark} ${String(r.score).padStart(5)}  ${r._id.id}  ${titleOf(doc)}`);
    });
    missingForeign.slice(0, 3).forEach((r) => {
      console.log(`  OTHER ${String(r.score).padStart(5)}  ${r._id.id}  ${titleOf(foreign.get(String(r._id.id)))}`);
    });
  }
};

(async () => {
  const conn = await mongoose.createConnection(process.env.MONGO_URI, { readPreference: 'secondaryPreferred' }).asPromise();
  const qt = conn.useDb('quicktricksdb').db;
  const vg = conn.useDb('vidyagramdb').db;
  const password = process.env.REDIS_PASSWORD?.trim();
  const redis = new Redis({ host: process.env.REDIS_HOST, port: Number(process.env.REDIS_PORT) || 6379, ...(password ? { password } : {}) });

  const merged = new Map();
  console.log('== Redis daily keys (search:trending:docs:<day>)');
  for (const day of lastDays()) {
    const flat = await redis.zrevrange(`search:trending:docs:${day}`, 0, -1, 'WITHSCORES');
    console.log(`${day}: ${flat.length / 2} members`);
    for (let i = 0; i < flat.length; i += 2) merged.set(flat[i], (merged.get(flat[i]) || 0) + Number(flat[i + 1]));
  }

  const byType = {};
  for (const [member, score] of merged) {
    const sep = member.indexOf(':');
    (byType[member.slice(0, sep)] ||= []).push({ id: member.slice(sep + 1), score });
  }
  console.log('\n== Whose documents are in the merged scores');
  for (const [type, rows] of Object.entries(byType)) {
    rows.sort((a, b) => b.score - a.score);
    // Trending never hydrates classes, so there is no owner to look up for them.
    if (!COLLECTION[type]) {
      console.log(`${type}: ${rows.length} members, ${rows.filter((r) => r.score >= THRESHOLD).length} at ${THRESHOLD}+; owner not checked`);
      continue;
    }
    const ids = rows.map((r) => r.id);
    const inQt = await lookup(qt, type, ids);
    const inVg = await lookup(vg, type, ids);
    const tally = { qt: 0, vg: 0, both: 0, neither: 0 };
    for (const id of ids) {
      if (inQt.has(id) && inVg.has(id)) tally.both++;
      else if (inQt.has(id)) tally.qt++;
      else if (inVg.has(id)) tally.vg++;
      else tally.neither++;
    }
    const at = rows.filter((r) => r.score >= THRESHOLD).length;
    console.log(`${type}: ${rows.length} members, ${at} at ${THRESHOLD}+; quicktricks only ${tally.qt}, vidyagram only ${tally.vg}, both ${tally.both}, neither ${tally.neither}`);
    rows.slice(0, 5).forEach((r) => {
      const owner = inQt.has(r.id) && inVg.has(r.id) ? 'both' : inQt.has(r.id) ? 'qt' : inVg.has(r.id) ? 'vg' : 'none';
      const doc = inQt.get(r.id) || inVg.get(r.id);
      console.log(`  ${String(r.score).padStart(5)} ${owner.padEnd(4)} ${r.id}  ${doc ? titleOf(doc) : ''}`);
    });
  }

  const cached = await redis.get('search:trending:cached');
  console.log(`\n== search:trending:cached: ttl ${await redis.ttl('search:trending:cached')} s`);
  if (cached) {
    const parsed = JSON.parse(cached);
    for (const [section, items] of Object.entries(parsed)) if (items.length) console.log(`${section}: ${items.map((x) => x.title).join(' | ')}`);
  }

  const since = new Date(`${lastDays()[WINDOW_DAYS - 1]}T00:00:00.000Z`);
  await report('vidyagramdb', vg, since, qt);
  await report('quicktricksdb', qt, since, vg);

  redis.disconnect();
  await conn.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
