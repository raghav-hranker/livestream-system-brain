// Dashboard hourly trend — READ-ONLY.
//
// Reuses the deployed dashboard pipelines (dist) so the numbers match the admin tiles,
// but groups by IST hour instead of IST day. Prints today's hours plus the same hours
// averaged over the previous DAYS days (default 7) for comparison.
//
// Run on the box from the quicktricks-backend checkout:
//   DOTENV_CONFIG_PATH=.env.development node -r dotenv/config <path>/dashboard_hourly.js [DAYS]
const path = require('path');
const mongoose = require(require.resolve('mongoose', { paths: [process.cwd()] }));
const root = process.cwd();
const dash = require(path.join(root, 'dist/src/controllers/dashboardAnalyticsController.js'));
const signup = require(path.join(root, 'dist/src/services/dashboardSignupReporting.js'));
const { CUSTOMER_ID } = require(path.join(root, 'dist/src/config/baseConstants.js'));
const User = require(path.join(root, 'dist/src/models/User.js')).default;
const Order = require(path.join(root, 'dist/src/models/Order.js')).default;

const DAYS = Number(process.argv[2] || 7);
const IST = 5.5 * 36e5;
// Walk plain objects/arrays only, so Dates and ObjectIds pass through untouched.
const hourly = (v) => {
  if (v === '%Y-%m-%d') return '%Y-%m-%d %H';
  if (Array.isArray(v)) return v.map(hourly);
  if (v && Object.getPrototypeOf(v) === Object.prototype) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, hourly(x)]));
  return v;
};

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.DB_NAME, readPreference: 'secondaryPreferred' });
  const todayStart = new Date(Math.floor((Date.now() + IST) / 864e5) * 864e5 - IST);
  const start = new Date(todayStart.getTime() - DAYS * 864e5), end = new Date();
  const base = { customer_id: CUSTOMER_ID, status: { $ne: 0 }, createdAt: { $gte: start, $lte: end } };
  const excluded = await signup.signupDuplicateIds(CUSTOMER_ID);
  const orderStages = hourly(dash.orderAnalyticsPipeline(base, false, false, false, {}));
  // keep only the revenue facet — the rest is unused here
  const facet = orderStages.find((s) => s.$facet); facet.$facet = { revenue: facet.$facet.revenue };
  const userStages = hourly(dash.userAnalyticsPipeline(base, false, false, excluded));
  const uf = userStages.find((s) => s.$facet); uf.$facet = { signups: uf.$facet.signups };
  const [[o], [u]] = await Promise.all([Order.aggregate(orderStages).allowDiskUse(true), User.aggregate(userStages).allowDiskUse(true)]);

  const todayKey = new Date(Date.now() + IST).toISOString().slice(0, 10);
  const rows = {};
  const put = (id, f, v) => { const [d, h] = id.split(' '); const r = (rows[h] ||= { t: { rev: 0, ord: 0, sig: 0 }, p: { rev: 0, ord: 0, sig: 0 } }); r[d === todayKey ? 't' : 'p'][f] += v; };
  for (const r of o.revenue) { put(r._id, 'rev', r.revenue); put(r._id, 'ord', r.orders); }
  for (const r of u.signups) put(r._id, 'sig', r.count);

  const nowH = new Date(Date.now() + IST).getUTCHours();
  let cum = { rev: 0, ord: 0, sig: 0 }, pcum = 0, pTot = 0;
  for (let h = 0; h < 24; h++) pTot += rows[String(h).padStart(2, '0')]?.p.rev || 0;
  const table = [];
  for (let h = 0; h < 24; h++) {
    const r = rows[String(h).padStart(2, '0')] || { t: { rev: 0, ord: 0, sig: 0 }, p: { rev: 0, ord: 0, sig: 0 } };
    if (h <= nowH) { cum.rev += r.t.rev; cum.ord += r.t.ord; cum.sig += r.t.sig; }
    pcum += r.p.rev;
    table.push({ hour: `${String(h).padStart(2, '0')}:00`,
      revenue: h <= nowH ? Math.round(r.t.rev) : '', orders: h <= nowH ? r.t.ord : '', signups: h <= nowH ? r.t.sig : '',
      cumRevenue: h <= nowH ? Math.round(cum.rev) : '',
      [`avgRev_${DAYS}d`]: Math.round(r.p.rev / DAYS), [`avgOrd_${DAYS}d`]: +(r.p.ord / DAYS).toFixed(1), [`avgSig_${DAYS}d`]: +(r.p.sig / DAYS).toFixed(1),
      [`cumShare_${DAYS}d`]: pTot ? `${(100 * pcum / pTot).toFixed(1)}%` : '' });
  }
  console.table(table);
  console.log(JSON.stringify({ today: cum, prevDaysAvgRevenue: Math.round(pTot / DAYS), nowHourIST: nowH }));
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
