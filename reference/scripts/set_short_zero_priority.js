// Move every Short at priority 0 (or with no priority) to one value (user request 2026-09-21: 20),
// so the admin-ranked shorts (1..n) lead the ASC-sorted feed/table.
// Run from the quicktricks-backend checkout on the prod box so mongoose/dotenv resolve:
//
//   node set_short_zero_priority.js 20              # dry-run: counts + current distribution
//   node set_short_zero_priority.js 20 --commit     # backup affected {_id, priority} to JSON, then updateMany
//   node set_short_zero_priority.js --restore <file> # put those shorts back to their backed-up priority
//
// Env: MONGO_URI from .env.development (override with DOTENV_CONFIG_PATH).
const path = require('path');
const fs = require('fs');
require(path.resolve('node_modules/dotenv')).config({
  path: process.env.DOTENV_CONFIG_PATH || '.env.development',
});
const mongoose = require(path.resolve('node_modules/mongoose'));

const ZERO = { $or: [{ priority: 0 }, { priority: { $exists: false } }, { priority: null }] };

async function main() {
  const args = process.argv.slice(2);
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI is not set');
  await mongoose.connect(uri, { autoIndex: false });
  const shorts = mongoose.connection.db.collection('shorts');

  const restoreIdx = args.indexOf('--restore');
  if (restoreIdx !== -1) {
    const rows = JSON.parse(fs.readFileSync(args[restoreIdx + 1], 'utf8'));
    const ops = rows.map((r) => ({
      updateOne: {
        filter: { _id: new mongoose.Types.ObjectId(r._id) },
        update: r.priority === null ? { $unset: { priority: '' } } : { $set: { priority: r.priority } },
      },
    }));
    const res = ops.length ? await shorts.bulkWrite(ops) : { matchedCount: 0, modifiedCount: 0 };
    console.log(`[restore] rows=${rows.length} matched=${res.matchedCount} modified=${res.modifiedCount}`);
    return;
  }

  const value = Number(args[0]);
  if (!Number.isFinite(value)) throw new Error('usage: node set_short_zero_priority.js <number> [--commit]');
  const commit = args.includes('--commit');

  const total = await shorts.countDocuments({});
  const zero = await shorts.countDocuments(ZERO);
  const dist = await shorts
    .aggregate([{ $group: { _id: '$priority', n: { $sum: 1 } } }, { $sort: { _id: 1 } }])
    .toArray();
  console.log(`[priority] total=${total} atZero=${zero} willChange=${zero}`);
  console.log(`[priority] current values: ${dist.map((d) => `${d._id}:${d.n}`).join(', ')}`);

  if (!commit) {
    console.log('[priority] DRY-RUN — nothing written. Re-run with --commit.');
    return;
  }

  const backup = await shorts.find(ZERO, { projection: { _id: 1, priority: 1 } }).toArray();
  const file = path.resolve(`short-priority-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(
    file,
    JSON.stringify(backup.map((s) => ({ _id: String(s._id), priority: s.priority ?? null })), null, 0),
  );
  console.log(`[priority] backup of ${backup.length} shorts written to ${file}`);

  const res = await shorts.updateMany({ _id: { $in: backup.map((s) => s._id) } }, { $set: { priority: value } });
  console.log(`[priority] COMMIT matched=${res.matchedCount} modified=${res.modifiedCount}`);
  console.log(`[priority] restore: node set_short_zero_priority.js --restore ${file}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
