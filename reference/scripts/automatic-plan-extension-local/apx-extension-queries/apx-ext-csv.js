// READ-ONLY. Lists every paid plan order that either extension rule flags, as CSV.
//   expiry rule: this expiry − an earlier order's expiry (same user+plan) is 180–186 days
//   start rule:  APX access start (`datetime`) is within 2 days of an earlier order's expiry
// No names/phones/emails in the output.
const fs = require('fs');
const OUT = process.env.OUT;
const DAY = 86400000, IST = 5.5 * 3600000, NOW = new Date();
const ist = v => (v ? new Date(new Date(v).getTime() + IST).toISOString().slice(0, 10) : '');
const apxD = s => (s ? new Date(String(s).replace(' ', 'T') + '+05:30') : null);
const days = (a, b) => Math.round((a - b) / DAY);
const offer = b => Math.round(Number((b * 0.5).toFixed(6)));

const plans = {};
db.plans.find({}, { title: 1, name: 1, amount: 1, duration: 1, status: 1 }).forEach(p => (plans[String(p._id)] = p));

const groups = db.orders.aggregate([
  { $match: { orderStatus: 'success', status: { $ne: 0 }, planId: { $nin: [null, ''] } } },
  { $project: { userId: 1, planId: 1, grandTotal: 1, expireDate: 1, isExtensionOrder: 1, orderNumber: 1, od: { $ifNull: ['$orderDate', '$createdAt'] } } },
  { $sort: { od: 1 } },
  { $group: { _id: { u: '$userId', p: '$planId' }, os: { $push: { id: '$_id', n: '$orderNumber', gt: '$grandTotal', exp: '$expireDate', od: '$od', ext: '$isExtensionOrder' } } } },
  { $match: { 'os.1': { $exists: true } } },
], { allowDiskUse: true }).toArray();
print('pairs with >=2 orders: ' + groups.length);

// Raw APX rows for every APX order in those pairs.
const apxIds = [];
groups.forEach(g => g.os.forEach(o => /^APX-/.test(o.n || '') && apxIds.push(o.n.slice(4))));
const raw = {};
for (let i = 0; i < apxIds.length; i += 5000) {
  db.apx_orders_new.find({ apxId: { $in: apxIds.slice(i, i + 5000) } }, { apxId: 1, datetime: 1, created_at: 1, user_id: 1 })
    .forEach(r => (raw[r.apxId] = r));
}
print('raw APX rows loaded: ' + Object.keys(raw).length);

const cols = ['verdict', 'plan_title', 'plan_list_price', 'plan_duration', 'plan_active', 'user_id', 'apx_user_id',
  'original_order', 'original_price', 'original_paid', 'original_expiry',
  'prev_order', 'prev_price', 'prev_paid', 'prev_expiry',
  'this_order', 'this_price', 'this_paid', 'this_access_start', 'this_expiry',
  'expiry_gap_days', 'start_minus_prev_expiry_days', 'this_validity_days', 'price_vs_prev_pct', 'price_vs_list_pct',
  'is_latest_paid', 'student_lapsed_now', 'offer_now', 'offer_after_expiry_rule', 'offer_after_start_rule'];
const esc = v => { const s = v === undefined || v === null ? '' : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const rows = [];
const tally = {};

for (const g of groups) {
  const plan = plans[String(g._id.p)] || {};
  const list = Number(plan.amount);
  const os = g.os;
  const startOf = o => { const r = /^APX-/.test(o.n || '') ? raw[o.n.slice(4)] : null; return r && r.datetime ? apxD(r.datetime) : o.od; };
  const flagged = [];
  for (const x of os) {
    if (!(Number(x.gt) > 0) || !x.exp) continue;
    const earlier = os.filter(p => p !== x && p.exp && p.od < x.od)
      .sort((a, b) => (Number(a.gt) > 0) - (Number(b.gt) > 0) || a.od - b.od); // paid last, so .pop() prefers it
    const xs = startOf(x);
    const pA = earlier.filter(p => { const d = days(x.exp, p.exp); return d >= 180 && d <= 186; }).pop();
    const pB = earlier.filter(p => Math.abs(xs - p.exp) <= 2 * DAY).pop();
    if (!pA && !pB) continue;
    flagged.push({ x, xs, pA, pB, p: pA || pB });
  }
  if (!flagged.length) continue;

  const paid = os.filter(o => Number(o.gt) > 0 && o.ext !== true);
  const latestPaid = paid[paid.length - 1];
  const base = excl => { const c = paid.filter(o => !excl.has(String(o.id))); return c.length ? Number(c[c.length - 1].gt) : list; };
  const setA = new Set(flagged.filter(f => f.pA).map(f => String(f.x.id)));
  const setB = new Set(flagged.filter(f => f.pB).map(f => String(f.x.id)));
  const lapsed = !os.some(o => o.exp && o.exp >= NOW);
  const offNow = offer(base(new Set())), offA = offer(base(setA)), offB = offer(base(setB));

  for (const f of flagged) {
    const { x, xs, p } = f;
    const verdict = f.pA && f.pB ? 'both rules' : f.pA ? 'expiry rule only' : 'start rule only';
    tally[verdict] = (tally[verdict] || 0) + 1;
    const r = /^APX-/.test(x.n || '') ? raw[x.n.slice(4)] : null;
    const origs = paid.filter(o => o.od < x.od && !setA.has(String(o.id)));
    const og = origs[origs.length - 1];
    rows.push({
      original_order: og ? og.n : '(none - list price)', original_price: og ? og.gt : plan.amount, original_paid: og ? ist(og.od) : '', original_expiry: og ? ist(og.exp) : '',
      verdict, plan_title: plan.title || plan.name, plan_list_price: plan.amount, plan_duration: plan.duration, plan_active: plan.status === 1 ? 'yes' : 'no',
      user_id: g._id.u, apx_user_id: r ? r.user_id : '',
      prev_order: p.n, prev_price: p.gt, prev_paid: ist(p.od), prev_expiry: ist(p.exp),
      this_order: x.n, this_price: x.gt, this_paid: r ? r.created_at : ist(x.od), this_access_start: r ? r.datetime : ist(x.od), this_expiry: ist(x.exp),
      expiry_gap_days: days(x.exp, p.exp), start_minus_prev_expiry_days: days(xs, p.exp), this_validity_days: days(x.exp, xs),
      price_vs_prev_pct: Number(p.gt) > 0 ? Math.round((100 * x.gt) / p.gt) : '', price_vs_list_pct: list > 0 ? Math.round((100 * x.gt) / list) : '',
      is_latest_paid: latestPaid && String(latestPaid.id) === String(x.id) ? 'yes' : 'no', student_lapsed_now: lapsed ? 'yes' : 'no',
      offer_now: offNow, offer_after_expiry_rule: offA, offer_after_start_rule: offB,
    });
  }
}

const rank = { 'start rule only': 0, 'expiry rule only': 1, 'both rules': 2 };
rows.sort((a, b) => rank[a.verdict] - rank[b.verdict] || String(a.plan_title).localeCompare(String(b.plan_title)) || String(a.user_id).localeCompare(String(b.user_id)));
fs.writeFileSync(OUT, [cols.join(','), ...rows.map(r => cols.map(c => esc(r[c])).join(','))].join('\n') + '\n');
print('rows: ' + rows.length + ' ' + JSON.stringify(tally));
const changed = rows.filter(r => r.is_latest_paid === 'yes');
print('latest-paid rows (these change an offer): ' + changed.length + ', lapsed now: ' + changed.filter(r => r.student_lapsed_now === 'yes').length);
print('offer differs between the two rules on ' + changed.filter(r => r.offer_after_expiry_rule !== r.offer_after_start_rule).length + ' latest-paid rows');
print('expiry-rule-only rows priced >= 90% of list: ' + rows.filter(r => r.verdict === 'expiry rule only' && r.price_vs_list_pct >= 90).length);
print('written ' + OUT);
