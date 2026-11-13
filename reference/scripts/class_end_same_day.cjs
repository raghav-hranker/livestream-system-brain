// **writes with COMMIT=1**: sets a Class's endDate, and the endDate of its placements that have not
//   had a real end applied, to the end of the start's IST day. For a class whose end spilled into the
//   next day (see class_end_spill.cjs). Prints before/after; without COMMIT=1 it only prints the plan.
//   run on webserver2-2 from the tenant's backend checkout, over ssh stdin:
//   CLASS_ID=<id> [COMMIT=1] DOTENV_CONFIG_PATH=.env.development NODE_PATH=$PWD/node_modules node -r dotenv/config - < class_end_same_day.cjs
const mongoose = require('mongoose');
const OFF = 330 * 60000, DAY = 86400000;
(async () => {
  await mongoose.connect(process.env.MONGO_URI, { readPreference: 'primary' });
  const db = mongoose.connection.db;
  const _id = new mongoose.Types.ObjectId(process.env.CLASS_ID);
  const c = await db.collection('classes').findOne({ _id });
  if (!c || !c.startDate) throw new Error('class not found or has no startDate');
  const end = new Date(Math.floor((c.startDate.getTime() + OFF) / DAY) * DAY + DAY - 1 - OFF);
  const pFilter = { class: _id, actualEndAppliedAt: null, endDate: { $gt: end } };
  const placements = await db.collection('courseclasses').find(pFilter).project({ endDate: 1 }).toArray();
  console.log('db:', db.databaseName, '| class:', c.title);
  console.log('class endDate:', c.endDate && c.endDate.toISOString(), '->', end.toISOString(), c.actualEndedAt ? '(SKIP: class already ended)' : '');
  for (const p of placements) console.log('placement', String(p._id), p.endDate.toISOString(), '->', end.toISOString());
  if (process.env.COMMIT === '1' && !c.actualEndedAt) {
    const a = await db.collection('classes').updateOne({ _id, actualEndedAt: null, endDate: { $gt: end } }, { $set: { endDate: end } });
    const b = await db.collection('courseclasses').updateMany(pFilter, { $set: { endDate: end } });
    console.log('written: class', a.modifiedCount, '| placements', b.modifiedCount);
  } else console.log('plan only, nothing written');
  await mongoose.disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
