// Read-only, refuses any DB but vidyagramdb: detail behind vidyagram-appx-parity-audit.cjs. Reads its gap file (GAPS, default
// ~/vidyagram-appx-parity-gaps.json on the box): distinct missing videos and PDFs, dead ingest job errors with URLs removed, what the
// MP4 classes hold, the PDF ledger by source kind, why rows are excluded, and unprocessed AppX orders in aggregate.
// Prints no student data. Run from the nightly checkout on test-uday:
//   nice -n 10 node --max-old-space-size=3072 - < vidyagram-appx-parity-gaps-detail.cjs
require('dotenv').config({ path: '.env.development', quiet: true });
require('ts-node/register/transpile-only');
const fs = require('fs');
const mongoose = require('mongoose');
const { loadMirrorCourses } = require(process.cwd() + '/src/services/apx/apxCatalogMirrorReader');
const { planCatalogue } = require(process.cwd() + '/src/services/apx/apxCatalogPlanner');

const GAPS = process.env.GAPS || `${process.env.HOME}/vidyagram-appx-parity-gaps.json`;
const bump = (m, k, n = 1) => { m[k] = (m[k] || 0) + n; return m; };
const top = (m, n = 15) => Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, n);
const clean = (s) => String(s ?? '').replace(/https?:\/\/\S+/g, '[url]').replace(/[0-9a-f]{24}/g, '[id]').replace(/\d{3,}/g, 'N').slice(0, 90);
const txClass = { $switch: { branches: [
  { case: { $regexMatch: { input: { $toString: { $ifNull: ['$transaction_id', ''] } }, regex: '^pay_' } }, then: 'pay_' },
  { case: { $eq: ['$transaction_id', 'free_course'] }, then: 'free_course' },
  { case: { $in: [{ $ifNull: ['$transaction_id', ''] }, ['', '0']] }, then: 'blank' },
], default: 'other' } };

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: 'vidyagramdb', readPreference: 'secondaryPreferred', autoIndex: false, autoCreate: false });
  try {
    const db = mongoose.connection.db;
    if (db.databaseName !== 'vidyagramdb') throw new Error('wrong db');
    const gaps = JSON.parse(fs.readFileSync(GAPS, 'utf8')).filter((g) => g.active);

    const { inputs } = await loadMirrorCourses(db, { customerId: '781', runId: null });
    const { plans } = planCatalogue(inputs);
    const keyOf = new Map();
    for (const p of plans) for (const i of p.items) keyOf.set(`${p.course.apxCourseId}:${i.rowId}`, i.assetKey);
    const excl = {};
    for (const p of plans) for (const e of p.excluded) bump(excl, `${e.reason} | ${e.detail ?? ''}`.slice(0, 70));
    console.log('Excluded rows by reason:', JSON.stringify(top(excl, 20)));
    console.log('AppX-unavailable by plan state:', JSON.stringify(plans.flatMap((p) => p.appxUnavailable.map((u) => String(u.inPlan).split(':')[0])).reduce((m, k) => bump(m, k), {})));
    console.log('Unfiled, top:', JSON.stringify(top(plans.flatMap((p) => p.unfiled.map((u) => `${p.course.apxCourseId}:${u.reason}`.slice(0, 60))).reduce((m, k) => bump(m, k), {}), 8)));

    const distinct = {};
    for (const g of gaps) (distinct[g.outcome] ||= new Set()).add(g.kind === 'PDF' ? `${g.apxCourseId}:${g.rowId}` : keyOf.get(`${g.apxCourseId}:${g.rowId}`));
    console.log('\nGaps: placements / distinct assets');
    for (const [k, s] of Object.entries(distinct)) console.log(' ', gaps.filter((g) => g.outcome === k).length, '/', s.size, k);
    for (const g of gaps.filter((x) => /no pdf|not in import ledger|not placed/.test(x.outcome))) console.log('   ', g.apxCourseId, g.rowId, g.kind, g.outcome.slice(0, 30), JSON.stringify(g.title).slice(0, 60), '|', String(g.path).slice(0, 60));

    const ledger = await db.collection('apxcatalogimports').find({ assetKey: { $in: [...new Set(keyOf.values())] } }, { projection: { assetKey: 1, classId: 1 } }).toArray();
    const classIdOf = new Map(ledger.map((l) => [l.assetKey, l.classId]));
    const idsFor = (o) => [...(distinct[o] || [])].map((k) => classIdOf.get(k)).filter(Boolean);

    const jobs = await db.collection('apxingestjobs').find({ classId: { $in: idsFor('placed, no video: job dead') } }, { projection: { error: 1, createdAt: 1 } }).toArray();
    console.log('\nDead ingest jobs by error:', JSON.stringify(top(jobs.reduce((m, j) => bump(m, clean(j.error)), {}), 12)));
    console.log('Dead jobs by created month:', JSON.stringify(top(jobs.reduce((m, j) => bump(m, String(j.createdAt?.toISOString?.()).slice(0, 7)), {}), 8)));

    const mp4Classes = await db.collection('classes').find({ _id: { $in: idsFor('placed, MP4 not copied') } }, { projection: { status: 1, mp4Recordings: 1, isYoutubeRedirect: 1 } }).toArray();
    console.log('\nMP4 classes:', mp4Classes.length, JSON.stringify(mp4Classes.reduce((m, c) => bump(m, `status ${c.status} mp4Recordings ${(c.mp4Recordings || []).length > 0}`), {})));
    console.log('MP4 placements by host:', JSON.stringify(top(gaps.filter((x) => x.outcome === 'placed, MP4 not copied').reduce((m, g) => bump(m, g.host), {}), 6)));

    const pdfLedger = await db.collection('apxcatalogpdfimports').aggregate([
      { $project: { status: 1, kinds: { $setUnion: ['$sources.kind', []] } } },
      { $group: { _id: { status: '$status', kinds: '$kinds' }, n: { $sum: 1 } } },
    ]).toArray();
    console.log('\nPDF ledger by status + source kinds:', JSON.stringify(pdfLedger.map((n) => [n._id.status, (n._id.kinds || []).join('+'), n.n])));

    const o = db.collection('apx_orders_new');
    const sample = await o.findOne({ processed: { $ne: true } });
    console.log('\nOrder row fields:', Object.keys(sample || {}).join(','));
    console.log('Orders, estimated total:', await o.estimatedDocumentCount());
    const cross = await o.aggregate([
      { $match: { processed: { $ne: true } } },
      { $group: { _id: { item: '$item_type', tx: txClass, month: { $substrBytes: [{ $toString: { $ifNull: ['$created_at2', ''] } }, 0, 7] } }, n: { $sum: 1 } } },
    ], { maxTimeMS: 180000, allowDiskUse: true }).toArray();
    const byItemTx = {};
    const byMonth = {};
    for (const c of cross) { bump(byItemTx, `${c._id.item} | ${c._id.tx}`, c.n); bump(byMonth, `${c._id.month} | ${c._id.tx}`, c.n); }
    console.log('Unprocessed by item type + payment id:', JSON.stringify(top(byItemTx, 25)));
    console.log('Unprocessed by month + payment id, newest:', JSON.stringify(Object.entries(byMonth).sort((a, b) => (a[0] < b[0] ? 1 : -1)).slice(0, 24)));

    const payRows = await o.find({ processed: { $ne: true }, transaction_id: { $regex: '^pay_' } }, { projection: { user_id: 1, transaction_id: 1, item_type: 1 } }).limit(60000).toArray();
    const ids = [...new Set(payRows.map((r) => String(r.user_id)))];
    const known = new Set();
    for (let i = 0; i < ids.length; i += 2000) {
      const batch = ids.slice(i, i + 2000);
      for (const u of await db.collection('users').find({ usersApxId: { $in: [...batch, ...batch.map(Number).filter(Number.isFinite)] } }, { projection: { usersApxId: 1 } }).toArray()) known.add(String(u.usersApxId));
    }
    console.log('Unprocessed pay_ rows:', payRows.length, '| buyers', ids.length, '| buyers with a user here', known.size, '| rows whose buyer is here', payRows.filter((r) => known.has(String(r.user_id))).length);
    const bare = [...new Set(payRows.map((r) => String(r.transaction_id).split(/[^A-Za-z0-9_]/)[0]))];
    let inTx = 0;
    for (let i = 0; i < bare.length; i += 2000) inTx += await db.collection('apx_transactions').countDocuments({ payment_id: { $in: bare.slice(i, i + 2000) } }, { maxTimeMS: 60000 });
    console.log('Their payment ids:', bare.length, '| found in apx_transactions', inTx);
  } finally { await mongoose.disconnect(); }
})().catch((e) => { console.error(String(e.stack || e.message).replace(/https?:\/\/\S+/g, '[url]')); process.exitCode = 1; });
