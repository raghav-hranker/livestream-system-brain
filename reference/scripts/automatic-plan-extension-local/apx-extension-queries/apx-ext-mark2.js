// READ-ONLY. The start<purchase paid rows, and start==purchase rows with ~6-month validity.
const toD = s => (s ? new Date(String(s).replace(' ', 'T') + 'Z') : null);
const day = 86400000;
const paid = { selling_price: { $nin: ['-', '0', '', null] } };
const hist = (xs, edges) => { const h = {}; xs.forEach(x => { const e = edges.find(e => x <= e); const k = e === undefined ? '>' + edges[edges.length - 1] : '<=' + e; h[k] = (h[k] || 0) + 1; }); return h; };
function report(label, rows) {
  print(`\n=== ${label}: ${rows.length} rows ===`);
  print('  validity(start->end): ' + JSON.stringify(hist(rows.map(r => Math.round((toD(r.enddatetime) - toD(r.datetime)) / day)), [30, 90, 150, 200, 300, 400])));
  print('  purchase-start (days late): ' + JSON.stringify(hist(rows.map(r => Math.round((toD(r.created_at) - toD(r.datetime)) / day)), [0, 1, 7, 30, 90, 365])));
  print('  start at midnight: ' + rows.filter(r => / 00:00:00$/.test(r.datetime)).length);
  const nums = rows.map(r => 'APX-' + r.apxId);
  const startBy = {}; rows.forEach(r => (startBy['APX-' + r.apxId] = toD(r.datetime)));
  let success = 0, chained = 0, prior = 0;
  db.orders.find({ orderNumber: { $in: nums }, orderStatus: 'success', planId: { $nin: [null, ''] } }, { orderNumber: 1, userId: 1, planId: 1, orderDate: 1 }).forEach(o => {
    success++;
    const s = startBy[o.orderNumber];
    const earlier = db.orders.find({ userId: o.userId, planId: o.planId, orderStatus: 'success', _id: { $ne: o._id }, orderDate: { $lt: o.orderDate } }, { expireDate: 1 }).toArray();
    if (earlier.length) prior++;
    if (earlier.some(e => e.expireDate && Math.abs(e.expireDate - s) <= 2 * day)) chained++;
  });
  print(`  success plan orders: ${success}, with an earlier order on the plan: ${prior}, start = an earlier expiry (±2d): ${chained}`);
}
report('start<purchase, paid', db.apx_orders_new.find({ $expr: { $lt: ['$datetime', '$created_at'] }, ...paid }, { apxId: 1, datetime: 1, created_at: 1, enddatetime: 1 }).toArray());
const same = db.apx_orders_new.find({ $expr: { $eq: ['$datetime', '$created_at'] }, ...paid }, { apxId: 1, datetime: 1, created_at: 1, enddatetime: 1 }).toArray()
  .filter(r => { const v = (toD(r.enddatetime) - toD(r.datetime)) / day; return v >= 170 && v <= 200; });
report('start==purchase, paid, 170-200 day validity', same);
