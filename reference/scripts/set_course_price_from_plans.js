// Backfill Course.price + Course.discountPrice from each course's plan amount
// (user request 2026-09-24; preview course-price-from-plans-preview-2026-09-24.csv, group 1).
// Plan.amount == Course.discountPrice on every already-priced course; plans carry no MRP, so price = discountPrice.
// Run from the quicktricks-backend checkout on the prod box so mongoose/dotenv resolve:
//
//   node set_course_price_from_plans.js <targets.json>            # dry-run: re-checks every row against live data
//   node set_course_price_from_plans.js <targets.json> --commit   # backup {_id, price, discountPrice}, then write
//   node set_course_price_from_plans.js --restore <backup.json>   # put every course back
//
// A row is written only if the course still has price 0/null AND discountPrice 0/null AND its plan's amount
// still equals the target — so a course edited in the admin since the preview is skipped, never overwritten.
const path = require('path');
const fs = require('fs');
require(path.resolve('node_modules/dotenv')).config({ path: process.env.DOTENV_CONFIG_PATH || '.env.development' });
const mongoose = require(path.resolve('node_modules/mongoose'));
const { ObjectId } = mongoose.Types;
const ZERO = { $in: [0, null] };

async function main() {
  const args = process.argv.slice(2);
  await mongoose.connect(process.env.MONGO_URI, { autoIndex: false });
  const courses = mongoose.connection.db.collection('courses');
  const plans = mongoose.connection.db.collection('plans');

  const restoreIdx = args.indexOf('--restore');
  if (restoreIdx !== -1) {
    const rows = JSON.parse(fs.readFileSync(args[restoreIdx + 1], 'utf8'));
    const res = await courses.bulkWrite(rows.map((r) => ({
      updateOne: { filter: { _id: new ObjectId(r._id) }, update: { $set: { price: r.price, discountPrice: r.discountPrice } } },
    })));
    console.log(`[restore] rows=${rows.length} matched=${res.matchedCount} modified=${res.modifiedCount}`);
    return;
  }

  const targets = JSON.parse(fs.readFileSync(args[0], 'utf8'));
  const commit = args.includes('--commit');
  const ok = [];
  const skipped = [];
  for (const t of targets) {
    const c = await courses.findOne({ _id: new ObjectId(t._id) }, { projection: { price: 1, discountPrice: 1 } });
    const p = await plans.findOne({ _id: new ObjectId(t.planId) }, { projection: { amount: 1 } });
    if (!c) skipped.push([t.title, 'course missing']);
    else if (c.price || c.discountPrice) skipped.push([t.title, `already priced ${c.price}/${c.discountPrice}`]);
    else if (!p || Number(p.amount) !== t.price) skipped.push([t.title, `plan amount now ${p && p.amount}`]);
    else ok.push({ t, c });
  }
  console.log(`[course-price] targets=${targets.length} willWrite=${ok.length} skipped=${skipped.length}`);
  for (const s of skipped) console.log(`  skip: ${s[0]} — ${s[1]}`);
  if (!commit) { console.log('[course-price] DRY-RUN — nothing written. Re-run with --commit.'); return; }

  const backup = ok.map(({ t, c }) => ({ _id: t._id, price: c.price ?? null, discountPrice: c.discountPrice ?? null }));
  const file = path.resolve(`course-price-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(file, JSON.stringify(backup));
  console.log(`[course-price] backup of ${backup.length} courses written to ${file}`);

  const res = await courses.bulkWrite(ok.map(({ t }) => ({
    updateOne: {
      filter: { _id: new ObjectId(t._id), price: ZERO, discountPrice: ZERO },
      update: { $set: { price: t.price, discountPrice: t.price } },
    },
  })));
  console.log(`[course-price] matched=${res.matchedCount} modified=${res.modifiedCount}`);
}

main().then(() => mongoose.disconnect()).catch((e) => { console.error(e); process.exit(1); });
