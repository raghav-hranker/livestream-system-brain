// Switch plans.inAppPurchaseProductId from `com.quicktricks.sahilsir.<planId>` to the consumable
// form `com.quicktricks.sahilsir.c.<planId>`. Dry run by default; `--commit` writes.
//
// Run on the box from the backend checkout AFTER the consumable products exist and are approved
// in App Store Connect (old app builds keep working: the backend resolves both forms):
//   DOTENV_CONFIG_PATH=.env.development node -r dotenv/config apple_plans_to_consumable.cjs [--commit] [--only <file>]
//
// `--only <file>`: one consumable product id per line; only those plans are switched (use the
// developer's list of products that were actually created). Without it every plan with a
// non-empty product id is switched, active or not.
//
// A backup of {_id, inAppPurchaseProductId} for every plan that would change is written to
// apple_plans_backup_<timestamp>.json in the current directory before any write.
const fs = require('fs');
const mongoose = require(require.resolve('mongoose', { paths: [process.cwd()] }));

const commit = process.argv.includes('--commit');
const onlyIdx = process.argv.indexOf('--only');
const only = onlyIdx > -1 ? new Set(fs.readFileSync(process.argv[onlyIdx + 1], 'utf8').split(/\r?\n/).map(s => s.trim()).filter(Boolean)) : null;

const toConsumable = (id) => {
  const segs = String(id).split('.');
  const last = segs.pop();
  if (segs[segs.length - 1] === 'c') segs.pop();
  return [...segs, 'c', last].join('.');
};

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { readPreference: 'primary' });
  const plans = mongoose.connection.db.collection('plans');
  const all = await plans.find({ inAppPurchaseProductId: { $type: 'string', $ne: '' } }, { projection: { inAppPurchaseProductId: 1, title: 1, status: 1 } }).toArray();

  const changes = [];
  for (const p of all) {
    const cur = String(p.inAppPurchaseProductId);
    const next = toConsumable(cur);
    if (cur === next) continue;                 // already consumable
    if (only && !only.has(next)) continue;      // product not created yet
    changes.push({ _id: p._id, title: p.title, status: p.status, from: cur, to: next });
  }

  console.log(`${all.length} plans with a product id; ${changes.length} would change${only ? ` (restricted to ${only.size} created products)` : ''}`);
  for (const c of changes) console.log(`${c._id} [status ${c.status}] ${c.from} -> ${c.to}  ${c.title}`);
  if (only) {
    const known = new Set(all.map(p => toConsumable(p.inAppPurchaseProductId)));
    const unknown = [...only].filter(id => !known.has(id));
    if (unknown.length) console.log(`WARNING ${unknown.length} ids in --only match no plan:`, unknown.join(', '));
  }

  if (!commit) { console.log('\nDry run. Re-run with --commit to apply.'); await mongoose.disconnect(); return; }
  if (!changes.length) { await mongoose.disconnect(); return; }

  const backupFile = `apple_plans_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  fs.writeFileSync(backupFile, JSON.stringify(changes.map(c => ({ _id: c._id, inAppPurchaseProductId: c.from })), null, 1));
  console.log(`backup written: ${backupFile}`);

  let n = 0;
  for (const c of changes) {
    // Guard on the current value so a concurrent edit is never overwritten.
    const r = await plans.updateOne({ _id: c._id, inAppPurchaseProductId: c.from }, { $set: { inAppPurchaseProductId: c.to, updatedAt: new Date() } });
    n += r.modifiedCount;
  }
  console.log(`updated ${n}/${changes.length}`);
  await mongoose.disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
