// READ-ONLY. Structural APX extension mark: access start (`datetime`) later than purchase (`created_at`).
const toD = s => (s ? new Date(String(s).replace(' ', 'T') + 'Z') : null);
const day = 86400000;

print('=== 1. apx_orders_new: start vs purchase ===');
db.apx_orders_new.aggregate([
  { $project: {
      paid: { $and: [{ $ne: ['$selling_price', '-'] }, { $gt: [{ $toDouble: { $ifNull: [{ $convert: { input: '$selling_price', to: 'double', onError: 0, onNull: 0 } }, 0] } }, 0] }] },
      rel: { $cond: [{ $eq: ['$datetime', '$created_at'] }, 'same', { $cond: [{ $gt: ['$datetime', '$created_at'] }, 'start>purchase', 'start<purchase'] }] },
      edit: '$canEditPurchase',
  } },
  { $group: { _id: { rel: '$rel', paid: '$paid', edit: '$edit' }, n: { $sum: 1 } } },
  { $sort: { '_id.rel': 1, '_id.paid': -1, '_id.edit': 1 } },
]).forEach(r => print(`  ${r._id.rel}\tpaid=${r._id.paid}\tcanEdit=${r._id.edit}\t${r.n}`));

print('\n=== 2. the start>purchase paid rows: validity from START, gap purchase->start, time of day of start ===');
const rows = db.apx_orders_new.find(
  { $expr: { $gt: ['$datetime', '$created_at'] }, selling_price: { $nin: ['-', '0', '', null] } },
  { apxId: 1, datetime: 1, created_at: 1, enddatetime: 1, selling_price: 1, item_purchase: 1, canEditPurchase: 1 }
).toArray();
const hist = (xs, edges) => { const h = {}; xs.forEach(x => { const e = edges.find(e => x <= e); const k = e === undefined ? '>' + edges[edges.length - 1] : '<=' + e; h[k] = (h[k] || 0) + 1; }); return h; };
const validity = rows.map(r => Math.round((toD(r.enddatetime) - toD(r.datetime)) / day));
const gap = rows.map(r => Math.round((toD(r.datetime) - toD(r.created_at)) / day));
print('  rows: ' + rows.length);
print('  validity(days, start->end): ' + JSON.stringify(hist(validity, [30, 90, 150, 200, 300, 400])));
print('  gap(days, purchase->start): ' + JSON.stringify(hist(gap, [0, 1, 7, 30, 90, 180, 365])));
print('  start at midnight: ' + rows.filter(r => / 00:00:00$/.test(r.datetime)).length);

print('\n=== 3. chain check: does START equal an earlier order\'s expiry for the same user+plan? ===');
const byNum = {};
db.orders.find({ orderNumber: { $in: rows.map(r => 'APX-' + r.apxId) } }, { orderNumber: 1, userId: 1, planId: 1, orderStatus: 1, grandTotal: 1 })
  .forEach(o => (byNum[o.orderNumber] = o));
let inOrders = 0, success = 0, chained = 0, unchained = [];
const startByNum = {};
rows.forEach(r => (startByNum['APX-' + r.apxId] = toD(r.datetime)));
const successOrders = Object.values(byNum).filter(o => o.orderStatus === 'success' && o.planId);
inOrders = Object.keys(byNum).length; success = successOrders.length;
for (const o of successOrders) {
  const start = startByNum[o.orderNumber];
  const prev = db.orders.findOne({
    userId: o.userId, planId: o.planId, orderStatus: 'success', _id: { $ne: o._id },
    expireDate: { $gte: new Date(start - 2 * day), $lte: new Date(+start + 2 * day) },
  }, { _id: 1 });
  if (prev) chained++; else if (unchained.length < 5) unchained.push(o.orderNumber);
}
print(`  in orders: ${inOrders}, success plan orders: ${success}, chained to a prior expiry (±2d): ${chained}`);
print('  unchained samples: ' + unchained.join(', '));

print('\n=== 4. impact on the base price: user+plan pairs whose LATEST paid order is a marked extension ===');
const marked = new Set(successOrders.map(o => String(o._id)));
const pairs = db.orders.aggregate([
  { $match: { orderStatus: 'success', status: { $ne: 0 }, planId: { $nin: [null, ''] }, grandTotal: { $gt: 0 }, isExtensionOrder: { $ne: true } } },
  { $sort: { orderDate: 1, createdAt: 1 } },
  { $group: { _id: { u: '$userId', p: '$planId' }, os: { $push: { id: '$_id', gt: '$grandTotal', exp: '$expireDate' } } } },
], { allowDiskUse: true }).toArray();
let latestMarked = 0, latestMarkedLapsed = 0, latestMarkedActive = 0, noFullLeft = 0, now = new Date();
const drops = [];
for (const g of pairs) {
  const last = g.os[g.os.length - 1];
  if (!marked.has(String(last.id))) continue;
  latestMarked++;
  const anyActive = g.os.some(o => o.exp && o.exp >= now);
  anyActive ? latestMarkedActive++ : latestMarkedLapsed++;
  const full = g.os.filter(o => !marked.has(String(o.id)));
  if (full.length === 0) noFullLeft++;
  else drops.push(full[full.length - 1].gt / last.gt);
}
drops.sort((a, b) => a - b);
print(`  pairs: ${latestMarked} (lapsed now: ${latestMarkedLapsed}, still active: ${latestMarkedActive})`);
print(`  of those, no unmarked paid order left (base would fall back to list price): ${noFullLeft}`);
if (drops.length) print(`  full-price / extension-price ratio: median ${drops[Math.floor(drops.length / 2)].toFixed(2)}, p10 ${drops[Math.floor(drops.length * 0.1)].toFixed(2)}, p90 ${drops[Math.floor(drops.length * 0.9)].toFixed(2)}`);

print('\n=== 5. RRB precedent user ===');
db.orders.find({ userId: '6a449e673aed5ba9f311765f', planId: '6a4e29966fa69a07a377e485', grandTotal: { $gt: 0 } }, { orderNumber: 1, grandTotal: 1 }).forEach(o => {
  const r = String(o.orderNumber || '').startsWith('APX-') ? db.apx_orders_new.findOne({ apxId: o.orderNumber.slice(4) }, { created_at: 1, datetime: 1, enddatetime: 1, canEditPurchase: 1 }) : null;
  print(`  ${o.orderNumber} gt=${o.grandTotal} purchase=${r && r.created_at} start=${r && r.datetime} end=${r && r.enddatetime} canEdit=${r && r.canEditPurchase}`);
});
