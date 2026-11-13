// Read-only, refuses any DB but vidyagramdb: AppX test packages (course detail.test_series_id) in our mirror and in `packages`, with
// their tests and any same-numbered purchases. IDS=85,72 picks the packages. Prints no student data.
// Run from the nightly checkout on test-uday: IDS=85,72 node - < vidyagram-apx-package-lookup.cjs
require('dotenv').config({ path: '.env.development', quiet: true });
const mongoose = require('mongoose');

const IDS = String(process.env.IDS || '').split(',').filter(Boolean);
const both = IDS.flatMap((i) => [i, Number(i)]);

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: 'vidyagramdb', readPreference: 'secondaryPreferred', autoIndex: false, autoCreate: false });
  try {
    const db = mongoose.connection.db;
    if (db.databaseName !== 'vidyagramdb') throw new Error('wrong db');
    const raws = await db.collection('apx_package_raw').find({ $or: [{ apxId: { $in: both } }, { apxPackageId: { $in: both } }] }, { projection: { apxId: 1, apxPackageId: 1, exam: 1, title: 1, name: 1, enable: 1, price: 1, attached_course: 1, deleted: 1 } }).toArray();
    const packages = await db.collection('packages').find({ apx_legacy_id: { $in: both } }, { projection: { apx_legacy_id: 1, packageName: 1, status: 1, price: 1, isFree: 1, assignedSeries: 1 } }).toArray();
    for (const id of IDS) {
      const raw = raws.find((r) => String(r.apxId) === id || String(r.apxPackageId) === id);
      const pkg = packages.find((p) => String(p.apx_legacy_id) === id);
      const appxTests = await db.collection('apx_testseries_raw').countDocuments({ apxPackageId: { $in: [id, Number(id)] } });
      const linkedSeries = pkg ? await db.collection('packageseries').countDocuments({ packageId: pkg._id }) : 0;
      console.log(JSON.stringify({
        package: id,
        mirror: raw ? { title: String(raw.exam ?? raw.title ?? raw.name ?? '').slice(0, 60), enable: raw.enable, price: raw.price, deleted: raw.deleted, attachedCourse: raw.attached_course } : null,
        ours: pkg ? { name: String(pkg.packageName).slice(0, 60), status: pkg.status, price: pkg.price, isFree: pkg.isFree, assignedSeries: (pkg.assignedSeries || []).length, packageSeries: linkedSeries } : null,
        appxTestsInMirror: appxTests,
      }));
    }
    const noItem = await db.collection('apx_orders_new').find({ item_id: { $in: ['146', 146] }, item_type: 'Digital Products' }, { projection: { processedSkipReason: 1, selling_price: 1, transaction_id: 1 } }).toArray();
    console.log(JSON.stringify({ course146Purchases: noItem.map((r) => ({ skip: r.processedSkipReason, price: r.selling_price, paymentId: String(r.transaction_id).replace(/[A-Za-z0-9]{6,}/g, '#').slice(0, 20) })) }));
  } finally { await mongoose.disconnect(); }
})().catch((e) => { console.error(String(e.message).replace(/https?:\/\/\S+/g, '[url]')); process.exitCode = 1; });
