// READ-ONLY
const now = new Date();
const empty = db.plans.find({ unmatchedMigratedItem: { $ne: null } }).toArray().filter(p => !['course','packages','ebook','practiceBatch','batchCourse'].some(k => (p[k] || []).length));
const ids = empty.flatMap(p => [p._id, String(p._id)]);
const rows = db.orders.aggregate([
  { $match: { planId: { $in: ids }, orderStatus: 'success', status: { $ne: 0 }, grandTotal: { $gt: 0 } } },
  { $group: { _id: { u: '$userId', p: '$planId' }, maxExp: { $max: '$expireDate' }, trx: { $addToSet: '$trxId' } } },
  { $match: { maxExp: { $lt: now } } },
], { allowDiskUse: true }).toArray();
let twin = 0, alone = 0; const aloneUsers = new Set(), byPlan = {};
for (const r of rows) {
  const trx = r.trx.filter(Boolean);
  const hasTwin = trx.length > 0 && db.orders.countDocuments({ userId: r._id.u, trxId: { $in: trx }, planId: { $nin: ids }, orderStatus: 'success' }, { limit: 1 }) > 0;
  if (hasTwin) twin++; else { alone++; aloneUsers.add(String(r._id.u)); byPlan[String(r._id.p)] = (byPlan[String(r._id.p)] || 0) + 1; }
}
print(`empty copy plans: ${empty.length}; lapsed paid pairs: ${rows.length}; same payment also on a real plan: ${twin}; copy-only: ${alone} (${aloneUsers.size} users)`);
const t = {}; empty.forEach(p => (t[String(p._id)] = `${p.title} [status ${p.status}]`));
Object.entries(byPlan).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => print(`  ${v}\t${t[k]}`));
