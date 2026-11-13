// Set Course.priority to one value for EVERY course (user request 2026-09-21: 118).
// Run from the quicktricks-backend checkout on the prod box so mongoose/dotenv resolve:
//
//   node set_course_priority.js 118              # dry-run: counts + current distribution
//   node set_course_priority.js 118 --commit     # backup every {_id, priority} to JSON, then updateMany
//   node set_course_priority.js --restore <file> # put every course back to its backed-up priority
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
  const courses = mongoose.connection.db.collection('courses');

  const restoreIdx = args.indexOf('--restore');
  if (restoreIdx !== -1) {
    const rows = JSON.parse(fs.readFileSync(args[restoreIdx + 1], 'utf8'));
    const ops = rows.map((r) => ({
      updateOne: {
        filter: { _id: new mongoose.Types.ObjectId(r._id) },
        update: r.priority === null ? { $unset: { priority: '' } } : { $set: { priority: r.priority } },
      },
    }));
    const res = ops.length ? await courses.bulkWrite(ops) : { matchedCount: 0, modifiedCount: 0 };
    console.log(`[restore] rows=${rows.length} matched=${res.matchedCount} modified=${res.modifiedCount}`);
    return;
  }

  const value = Number(args[0]);
  if (!Number.isFinite(value)) throw new Error('usage: node set_course_priority.js <number> [--commit]');
  const commit = args.includes('--commit');

  const total = await courses.countDocuments({});
  const already = await courses.countDocuments({ priority: value });
  const dist = await courses
    .aggregate([{ $group: { _id: '$priority', n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 10 }])
    .toArray();
  console.log(`[priority] total=${total} alreadyAt${value}=${already} willChange=${total - already}`);
  console.log(`[priority] current top values: ${dist.map((d) => `${d._id}:${d.n}`).join(', ')}`);

  if (!commit) {
    console.log('[priority] DRY-RUN — nothing written. Re-run with --commit.');
    return;
  }

  const backup = await courses.find({}, { projection: { _id: 1, priority: 1 } }).toArray();
  const file = path.resolve(`course-priority-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(
    file,
    JSON.stringify(backup.map((c) => ({ _id: String(c._id), priority: c.priority ?? null })), null, 0),
  );
  console.log(`[priority] backup of ${backup.length} courses written to ${file}`);

  const res = await courses.updateMany({}, { $set: { priority: value } });
  console.log(`[priority] COMMIT matched=${res.matchedCount} modified=${res.modifiedCount}`);
  console.log(`[priority] restore: node set_course_priority.js --restore ${file}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
