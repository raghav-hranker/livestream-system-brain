// Set Plan.duration to one value for EVERY plan (validity in days) (user request 2026-09-22: 365 = validity in days).
// Run from the quicktricks-backend checkout on the prod box so mongoose/dotenv resolve:
//
//   node set_plan_duration.js 365              # dry-run: counts + current distribution
//   node set_plan_duration.js 365 --commit     # backup every {_id, duration} to JSON, then updateMany
//   node set_plan_duration.js --restore <file> # put every plan back to its backed-up duration
//
// Env: MONGO_URI from .env.development (override with DOTENV_CONFIG_PATH).
const path = require('path');
const fs = require('fs');
require(path.resolve('node_modules/dotenv')).config({
  path: process.env.DOTENV_CONFIG_PATH || '.env.development',
});
const mongoose = require(path.resolve('node_modules/mongoose'));

async function main() {
  const args = process.argv.slice(2);
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI is not set');
  await mongoose.connect(uri, { autoIndex: false });
  const plans = mongoose.connection.db.collection('plans');

  const restoreIdx = args.indexOf('--restore');
  if (restoreIdx !== -1) {
    const rows = JSON.parse(fs.readFileSync(args[restoreIdx + 1], 'utf8'));
    const ops = rows.map((r) => ({
      updateOne: {
        filter: { _id: new mongoose.Types.ObjectId(r._id) },
        update: r.duration === null ? { $unset: { duration: '' } } : { $set: { duration: r.duration } },
      },
    }));
    const res = ops.length ? await plans.bulkWrite(ops) : { matchedCount: 0, modifiedCount: 0 };
    console.log(`[restore] rows=${rows.length} matched=${res.matchedCount} modified=${res.modifiedCount}`);
    return;
  }

  const value = Number(args[0]);
  if (!Number.isFinite(value)) throw new Error('usage: node set_plan_duration.js <number> [--commit]');
  const commit = args.includes('--commit');

  const total = await plans.countDocuments({});
  const already = await plans.countDocuments({ duration: value });
  const dist = await plans
    .aggregate([{ $group: { _id: '$duration', n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 10 }])
    .toArray();
  console.log(`[duration] total=${total} alreadyAt${value}=${already} willChange=${total - already}`);
  console.log(`[duration] current top values: ${dist.map((d) => `${d._id}:${d.n}`).join(', ')}`);

  if (!commit) {
    console.log('[duration] DRY-RUN — nothing written. Re-run with --commit.');
    return;
  }

  const backup = await plans.find({}, { projection: { _id: 1, duration: 1 } }).toArray();
  const file = path.resolve(`plan-duration-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(
    file,
    JSON.stringify(backup.map((c) => ({ _id: String(c._id), duration: c.duration ?? null })), null, 0),
  );
  console.log(`[duration] backup of ${backup.length} plans written to ${file}`);

  const res = await plans.updateMany({}, { $set: { duration: value } });
  console.log(`[duration] COMMIT matched=${res.matchedCount} modified=${res.modifiedCount}`);
  console.log(`[duration] restore: node set_plan_duration.js --restore ${file}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
