// Global search usage report — READ-ONLY.
//
// Source: prod quicktricksdb.searchlogs (one row per POST /api/search) and
// searchclicklogs (one row per POST /api/search/click). userId comes from the
// request body (auth is off on /api/search), so user counts are as the app reports them.
//
// Run (from ../quicktricks-backend, which holds MONGO_URI in .env.development):
//   mongosh "$MONGO_URI" --quiet --eval 'var DAYS=7' --file <path>/search-usage.js
// DAYS = how many IST days the daily table shows (default 14).
// Reads from a secondary so a live report never loads the primary.

db.getMongo().setReadPref('secondaryPreferred');

const DAYS_SHOWN = typeof DAYS === 'number' ? DAYS : 14;
const TZ = '+05:30';
const s = db.searchlogs;
const c = db.searchclicklogs;

const uniqueUsers = (coll, match) =>
  (coll.aggregate([{ $match: match }, { $group: { _id: '$userId' } }, { $count: 'n' }]).toArray()[0] || { n: 0 }).n;

const istDayStart = (daysAgo) => {
  const d = new Date(Date.now() + 5.5 * 36e5);
  d.setUTCHours(0, 0, 0, 0);
  return new Date(d.getTime() - 5.5 * 36e5 - daysAgo * 864e5);
};

const summary = (label, match) => {
  const searches = s.countDocuments(match);
  const clicks = c.countDocuments(match);
  return {
    period: label,
    searches,
    'users searching': uniqueUsers(s, match),
    clicks,
    'users clicking': uniqueUsers(c, match),
    'clicks/search': searches ? +(clicks / searches).toFixed(2) : 0,
    'zero-result %': searches ? Math.round((100 * s.countDocuments({ ...match, totalResults: 0 })) / searches) : 0,
  };
};

print(`\nSearch usage — generated ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST\n`);

console.table([
  summary('today (IST)', { ts: { $gte: istDayStart(0) } }),
  summary('last 7 days', { ts: { $gte: istDayStart(6) } }),
  summary('last 30 days', { ts: { $gte: istDayStart(29) } }),
  summary('all time', {}),
]);

const daily = (coll) =>
  Object.fromEntries(
    coll
      .aggregate([
        { $match: { ts: { $gte: istDayStart(DAYS_SHOWN - 1) } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$ts', timezone: TZ } },
            n: { $sum: 1 },
            users: { $addToSet: '$userId' },
          },
        },
      ])
      .toArray()
      .map((d) => [d._id, { n: d.n, users: d.users.length }])
  );
const ds = daily(s);
const dc = daily(c);
print(`\nDaily, last ${DAYS_SHOWN} IST days`);
console.table(
  [...new Set([...Object.keys(ds), ...Object.keys(dc)])].sort().map((day) => ({
    day,
    searches: ds[day]?.n || 0,
    'users searching': ds[day]?.users || 0,
    clicks: dc[day]?.n || 0,
    'users clicking': dc[day]?.users || 0,
  }))
);

const since = { ts: { $gte: istDayStart(DAYS_SHOWN - 1) } };
print(`\nClicks by result type, last ${DAYS_SHOWN} days`);
console.table(
  c
    .aggregate([
      { $match: since },
      { $group: { _id: '$type', clicks: { $sum: 1 }, users: { $addToSet: '$userId' } } },
      { $sort: { clicks: -1 } },
    ])
    .toArray()
    .map((d) => ({ type: d._id, clicks: d.clicks, users: d.users.length }))
);

print(`\nTop 10 searches, last ${DAYS_SHOWN} days`);
console.table(
  s
    .aggregate([
      { $match: since },
      { $group: { _id: '$qNormalized', searches: { $sum: 1 }, zeroResult: { $sum: { $cond: [{ $eq: ['$totalResults', 0] }, 1, 0] } } } },
      { $sort: { searches: -1 } },
      { $limit: 10 },
    ])
    .toArray()
    .map((d) => ({ query: d._id, searches: d.searches, 'zero-result': d.zeroResult }))
);

print(`\nTop 10 searches that found nothing, last ${DAYS_SHOWN} days`);
console.table(
  s
    .aggregate([
      { $match: { ...since, totalResults: 0 } },
      { $group: { _id: '$qNormalized', searches: { $sum: 1 } } },
      { $sort: { searches: -1 } },
      { $limit: 10 },
    ])
    .toArray()
    .map((d) => ({ query: d._id, searches: d.searches }))
);
