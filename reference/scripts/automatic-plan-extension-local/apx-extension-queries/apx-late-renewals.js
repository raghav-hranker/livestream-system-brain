// READ-ONLY. Paid ~6-month orders bought AFTER an earlier order on the same plan had lapsed.
// Are they discounted renewals (late extensions) or genuine 6-month products?
const DAY = 86400000, NOW = new Date();
const plans = {};
db.plans.find({}, { amount: 1, duration: 1 }).forEach(p => (plans[String(p._id)] = p));
const groups = db.orders.aggregate([
  { $match: { orderStatus: 'success', status: { $ne: 0 }, planId: { $nin: [null, ''] }, orderNumber: { $not: /^TS-/ } } },
  { $project: { userId: 1, planId: 1, grandTotal: 1, expireDate: 1, isExtensionOrder: 1, orderNumber: 1, od: { $ifNull: ['$orderDate', '$createdAt'] } } },
  { $sort: { od: 1 } },
  { $group: { _id: { u: '$userId', p: '$planId' }, os: { $push: { id: '$_id', n: '$orderNumber', gt: '$grandTotal', exp: '$expireDate', od: '$od' } } } },
  { $match: { 'os.1': { $exists: true } } },
], { allowDiskUse: true }).toArray();

const bucketOf = d => (d <= 30 ? '003-30d' : d <= 90 ? '031-90d' : d <= 180 ? '091-180d' : d <= 365 ? '181-365d' : '>365d');
const stat = {};
const samples = {};
let latestLapsed = 0, latest = 0;
for (const g of groups) {
  const plan = plans[String(g._id.p)] || {};
  const list = Number(plan.amount), planDur = Number(plan.duration);
  const os = g.os;
  const paid = os.filter(o => Number(o.gt) > 0);
  for (const x of os) {
    if (!(Number(x.gt) > 0) || !x.exp) continue;
    const valid = (x.exp - x.od) / DAY;
    if (valid < 170 || valid > 200) continue;                         // a ~6-month order
    const earlier = os.filter(p => p !== x && p.exp && p.od < x.od);
    if (!earlier.length) continue;
    const lastExp = Math.max(...earlier.map(p => +p.exp));
    const lapseDays = Math.round((x.od - lastExp) / DAY);
    if (lapseDays <= 2) continue;                                      // on time: the 181–185 rule already covers it
    const fullBefore = paid.filter(p => p.od < x.od && (p.exp - p.od) / DAY > 300);
    const ref = fullBefore.length ? Number(fullBefore[fullBefore.length - 1].gt) : list;
    const pct = ref > 0 ? (100 * x.gt) / ref : null;
    const priceBand = pct === null ? 'n/a' : pct <= 65 ? '<=65% (renewal-priced)' : pct <= 90 ? '66-90%' : '>90% (full-priced)';
    const planKind = planDur >= 300 ? 'year plan' : planDur >= 150 && planDur <= 200 ? '6-month plan' : 'other plan';
    const k = `${bucketOf(lapseDays)} | ${planKind} | ${priceBand}`;
    stat[k] = (stat[k] || 0) + 1;
    if (!samples[k]) samples[k] = `${x.n} paid ${x.gt} on ${x.od.toISOString().slice(0, 10)}, lapsed ${lapseDays}d, last full ${ref}, list ${list}, plan ${planDur}d`;
    if (paid.length && String(paid[paid.length - 1].id) === String(x.id)) {
      latest++;
      if (!os.some(o => o.exp && o.exp >= NOW)) latestLapsed++;
    }
  }
}
print('late (>2d after lapse) paid ~6-month orders, by lapse | plan kind | price vs last full purchase:');
Object.keys(stat).sort().forEach(k => print(`  ${String(stat[k]).padStart(6)}  ${k}   e.g. ${samples[k]}`));
print(`\nof these, latest paid order on the pair: ${latest} (student lapsed now: ${latestLapsed})`);
