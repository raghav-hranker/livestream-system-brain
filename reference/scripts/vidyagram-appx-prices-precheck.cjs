// Read-only. Exit 0 and print the run id when the newest Vidyagram nightly finished its capture and the AppX price step has
// not yet run for it; exit 3 (skip) otherwise. Used by vidyagram-appx-prices-run.sh on test-uday. Refuses any DB but vidyagramdb.
require('dotenv').config({ path: '.env.development', quiet: true });
const fs = require('fs');
const mongoose = require('mongoose');
const STAMP = process.env.STAMP || '/home/raghav/vidyagram-nightly/prices-last-run';
(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: 'vidyagramdb', readPreference: 'primary' });
  try {
    const db = mongoose.connection.db;
    if (db.databaseName !== 'vidyagramdb') throw new Error('wrong db');
    const run = await db.collection('apxnightlysyncruns').find({ customerId: '781' }, { projection: { state: 1, startedAt: 1, 'steps.capture': 1 } }).sort({ startedAt: -1 }).limit(1).next();
    const done = fs.existsSync(STAMP) ? fs.readFileSync(STAMP, 'utf8').trim() : '';
    if (!run) { console.log('skip: no nightly run'); process.exitCode = 3; return; }
    if (Date.now() - new Date(run.startedAt).getTime() > 30 * 3600e3) { console.log(`skip: newest run ${run._id} started over 30 h ago`); process.exitCode = 3; return; }
    if (run.steps?.capture?.state !== 'done') { console.log(`skip: run ${run._id} capture ${run.steps?.capture?.state}`); process.exitCode = 3; return; }
    if (run.state === 'running') { console.log(`skip: run ${run._id} still running`); process.exitCode = 3; return; }
    if (done === String(run._id)) { console.log(`skip: prices already synced for ${run._id}`); process.exitCode = 3; return; }
    console.log(String(run._id));
  } finally { await mongoose.disconnect(); }
})().catch((e) => { console.error(String(e.message).replace(/mongodb(\+srv)?:\/\/\S+/g, '[uri]')); process.exitCode = 1; });
