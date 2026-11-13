// READ-ONLY. find/aggregate only, no writes. Run against readPreference=secondary.
// Prints no phone/email/name.
const UID = '6a4590c03aed5ba9f3156693';
const d = v => (v ? new Date(v).toISOString().slice(0, 10) : null);
const PII = /email|phone|mobile|name|address|device|ip|user_id|userid|contact/i;
const redact = row => {
  const out = {};
  for (const [k, v] of Object.entries(row || {})) {
    if (k === '_id') continue;
    if (PII.test(k) && !/^item_/.test(k)) { out[k] = '<redacted>'; continue; }
    out[k] = typeof v === 'string' && v.length > 120 ? v.slice(0, 120) + '…' : v;
  }
  return out;
};
const oid = s => (/^[a-f0-9]{24}$/i.test(String(s || '')) ? ObjectId(String(s)) : null);

print('=== A. the student: every plan order ===');
const orders = db.orders
  .find({ userId: { $in: [UID, ObjectId(UID)] }, planId: { $nin: [null, ''] } })
  .sort({ orderDate: 1, createdAt: 1 })
  .toArray();
const planIds = [...new Set(orders.map(o => String(o.planId)))];
const plans = {};
db.plans.find({ _id: { $in: planIds.map(oid).filter(Boolean) } }).forEach(p => (plans[String(p._id)] = p));
for (const pid of planIds) {
  const p = plans[pid] || {};
  print(`\nPLAN ${pid} "${p.title || p.name}" list=${p.amount} dur=${p.duration} status=${p.status} ext(old)=${p.extensionEnabled ?? p.isExtension ?? ''}`);
  for (const o of orders.filter(x => String(x.planId) === pid)) {
    print('  ' + [
      o.orderNumber, o.orderStatus, 'st=' + o.status, 'via=' + o.orderVia, 'gw=' + o.gateway,
      'gt=' + o.grandTotal, 'orig=' + o.originalAmount, 'disc=' + o.discountAmount, 'coupon=' + (o.couponCode || ''),
      'ordered=' + d(o.orderDate || o.createdAt), 'start=' + d(o.startDate), 'exp=' + d(o.expireDate),
      'dur=' + o.duration, 'daysLeft=' + o.daysLeft, 'ext=' + o.isExtensionOrder,
      'trx=' + (o.trxId || ''), 'planFor=' + (o.planFor || ''), 'remarks=' + (o.remarks || ''),
    ].join(' | '));
  }
}

print('\n=== A2. raw APX rows behind the APX-/CM- orders (PII redacted) ===');
for (const o of orders) {
  const n = String(o.orderNumber || '');
  if (n.startsWith('APX-')) {
    const raw = db.apx_orders_new.findOne({ apxId: n.slice(4) });
    print(`\n${n} apx_orders_new: ` + JSON.stringify(redact(raw)));
    const pay = String(o.trxId || '').match(/^pay_[A-Za-z0-9]+/);
    if (pay) print(`${n} apx_transactions: ` + JSON.stringify(redact(db.apx_transactions.findOne({ payment_id: pay[0] }))));
  } else if (n.startsWith('CM-')) {
    const colls = db.getCollectionNames().filter(c => /^apx_purchase/i.test(c));
    for (const c of colls) {
      const raw = db[c].findOne({ $or: [{ id: n.slice(3) }, { apxId: n.slice(3) }] });
      if (raw) print(`\n${n} ${c}: ` + JSON.stringify(redact(raw)));
    }
  }
}

print('\n=== B. every field name APX raw rows carry (union over 2000 rows) ===');
for (const c of ['apx_orders_new', 'apx_transactions', ...db.getCollectionNames().filter(c => /^apx_purchase/i.test(c))]) {
  const keys = new Set();
  db[c].find({}).limit(2000).forEach(r => Object.keys(r).forEach(k => keys.add(k)));
  print(c + ': ' + [...keys].sort().join(', '));
}

print('\n=== C. APX item names that say extension/renew/validity ===');
db.apx_orders_new.aggregate([
  { $match: { item_purchase: /exten|renew|validit|re-?new|upgrade/i } },
  { $group: { _id: '$item_purchase', n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 30 },
]).forEach(r => print(`  ${r.n}\t${r._id}`));
print('  plans titled so: ' + db.plans.countDocuments({ $or: [{ title: /exten|renew/i }, { name: /exten|renew/i }] }));

print('\n=== D. prod-wide: paid success plan orders by source x duration bucket ===');
db.orders.aggregate([
  { $match: { orderStatus: 'success', status: { $ne: 0 }, planId: { $nin: [null, ''] }, grandTotal: { $gt: 0 } } },
  { $project: {
      src: { $switch: { branches: [
        { case: { $regexMatch: { input: { $ifNull: ['$orderNumber', ''] }, regex: /^APX-/ } }, then: 'APX' },
        { case: { $regexMatch: { input: { $ifNull: ['$orderNumber', ''] }, regex: /^CM-/ } }, then: 'CM' },
      ], default: 'native' } },
      bucket: { $switch: { branches: [
        { case: { $lt: [{ $ifNull: ['$duration', -1] }, 0] }, then: 'none' },
        { case: { $lt: ['$duration', 150] }, then: '<150' },
        { case: { $lte: ['$duration', 200] }, then: '150-200' },
        { case: { $lt: ['$duration', 300] }, then: '201-299' },
        { case: { $lte: ['$duration', 400] }, then: '300-400' },
      ], default: '>400' } },
  } },
  { $group: { _id: { src: '$src', b: '$bucket' }, n: { $sum: 1 } } },
  { $sort: { '_id.src': 1, '_id.b': 1 } },
]).forEach(r => print(`  ${r._id.src}\t${r._id.b}\t${r.n}`));

print('\n=== E. prod-wide: extension-SHAPED paid orders (a heuristic, not a fact) ===');
// Shape: same user+plan has an EARLIER paid order, and this one is 150–200 days
// and priced <= 60% of that earlier order.
const shaped = db.orders.aggregate([
  { $match: { orderStatus: 'success', status: { $ne: 0 }, planId: { $nin: [null, ''] }, grandTotal: { $gt: 0 } } },
  { $project: { userId: 1, planId: 1, grandTotal: 1, duration: 1, orderNumber: 1, t: { $ifNull: ['$orderDate', '$createdAt'] } } },
  { $sort: { t: 1 } },
  { $group: { _id: { u: '$userId', p: '$planId' }, os: { $push: { gt: '$grandTotal', dur: '$duration', n: '$orderNumber', t: '$t' } } } },
  { $match: { 'os.1': { $exists: true } } },
], { allowDiskUse: true }).toArray();
let pairs = shaped.length, hits = 0, users = new Set(), affectsBase = 0, src = {};
for (const g of shaped) {
  let firstFull = g.os[0].gt, hitHere = false;
  for (let i = 1; i < g.os.length; i++) {
    const o = g.os[i];
    if (o.dur >= 150 && o.dur <= 200 && o.gt <= 0.6 * firstFull) {
      hits++; hitHere = true; users.add(String(g._id.u));
      const s = /^APX-/.test(o.n || '') ? 'APX' : /^CM-/.test(o.n || '') ? 'CM' : 'native';
      src[s] = (src[s] || 0) + 1;
    }
  }
  const last = g.os[g.os.length - 1];
  if (hitHere && last.dur >= 150 && last.dur <= 200 && last.gt <= 0.6 * firstFull) affectsBase++;
}
print(`  user+plan pairs with >=2 paid orders: ${pairs}`);
print(`  extension-shaped orders: ${hits} (by source ${JSON.stringify(src)}) across ${users.size} users`);
print(`  pairs whose LATEST paid order is extension-shaped (=> base would be the shrunken price): ${affectsBase}`);
