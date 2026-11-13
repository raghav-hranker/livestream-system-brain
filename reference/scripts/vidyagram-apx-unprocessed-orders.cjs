// Read-only, refuses any DB but vidyagramdb, aggregate only: unprocessed AppX "Digital Products" purchases (apx_orders_new) with no
// pay_ id. Tallies payment id shape, skip reason, price and purchase year. For each row whose course exists here, asks whether
// the buyer holds that course through a success order (courseId, latestCourseId or a plan's courses) and whether AppX still shows it
// valid. Prints no student data. Run from the nightly checkout on test-uday: nice -n 10 node - < vidyagram-apx-unprocessed-orders.cjs
require('dotenv').config({ path: '.env.development', quiet: true });
const mongoose = require('mongoose');

const bump = (m, k, n = 1) => { m[k] = (m[k] || 0) + n; return m; };
const top = (m, n = 20) => Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, n);
const shape = (t) => String(t ?? '').trim().replace(/[0-9]+/g, '#').replace(/[A-Z0-9]{8,}/g, '@').slice(0, 24).toLowerCase() || '(blank)';
const dmy = (s) => { const m = /^(\d{2})-(\d{2})-(\d{4})/.exec(String(s ?? '')); return m ? new Date(`${m[3]}-${m[2]}-${m[1]}T00:00:00Z`) : null; };
const ids = (v) => (Array.isArray(v) ? v : v == null ? [] : [v]).map(String);

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: 'vidyagramdb', readPreference: 'secondaryPreferred', autoIndex: false, autoCreate: false });
  try {
    const db = mongoose.connection.db;
    if (db.databaseName !== 'vidyagramdb') throw new Error('wrong db');
    const rows = await db.collection('apx_orders_new').find(
      { processed: { $ne: true }, item_type: 'Digital Products', transaction_id: { $not: /^pay_/ } },
      { projection: { transaction_id: 1, processedSkipReason: 1, selling_price: 1, item_price: 1, created_at2: 1, enddatetime2: 1, item_id: 1, user_id: 1, userid: 1, refund: 1, enable: 1 } },
    ).toArray();
    console.log('Rows', rows.length);
    const year = (r) => dmy(r.created_at2)?.getUTCFullYear() ?? 'unknown';
    console.log('Payment id shape:', JSON.stringify(top(rows.reduce((m, r) => bump(m, shape(r.transaction_id)), {}))));
    console.log('Skip reason:', JSON.stringify(top(rows.reduce((m, r) => bump(m, String(r.processedSkipReason ?? 'none').slice(0, 50)), {}))));
    console.log('Selling price zero:', rows.filter((r) => Number(r.selling_price) === 0).length, '| item price zero:', rows.filter((r) => Number(r.item_price) === 0).length);
    console.log('Year:', JSON.stringify(rows.reduce((m, r) => bump(m, year(r)), {})));
    console.log('Enable:', JSON.stringify(rows.reduce((m, r) => bump(m, String(r.enable).slice(0, 8)), {})));

    const courses = new Map((await db.collection('courses').find({ apxCourseId: { $exists: true, $nin: [null, ''] } }, { projection: { apxCourseId: 1 } }).toArray()).map((c) => [String(c.apxCourseId), String(c._id)]));
    const plans = new Map((await db.collection('plans').find({}, { projection: { courses: 1, courseId: 1, courseIds: 1 } }).toArray()).map((p) => [String(p._id), [...ids(p.courses), ...ids(p.courseId), ...ids(p.courseIds)]]));
    const buyers = [...new Set(rows.map((r) => String(r.user_id ?? r.userid)))];
    const userByApx = new Map();
    for (let i = 0; i < buyers.length; i += 2000) {
      const b = buyers.slice(i, i + 2000);
      for (const u of await db.collection('users').find({ usersApxId: { $in: [...b, ...b.map(Number).filter(Number.isFinite)] } }, { projection: { usersApxId: 1 } }).toArray()) userByApx.set(String(u.usersApxId), u._id);
    }
    const held = new Map();
    const userIds = [...userByApx.values()];
    for (let i = 0; i < userIds.length; i += 2000) {
      const b = userIds.slice(i, i + 2000);
      const cur = db.collection('orders').find({ userId: { $in: [...b, ...b.map(String)] }, orderStatus: 'success', status: { $ne: 0 } }, { projection: { userId: 1, courseId: 1, latestCourseId: 1, planId: 1 } });
      for await (const o of cur) {
        const k = String(o.userId);
        if (!held.has(k)) held.set(k, new Set());
        const s = held.get(k);
        for (const c of [...ids(o.courseId), ...ids(o.latestCourseId), ...ids(o.planId).flatMap((p) => plans.get(p) || [])]) s.add(c);
      }
    }
    const now = new Date();
    const out = {};
    const missingByCourse = {};
    for (const r of rows) {
      const end = dmy(r.enddatetime2);
      const valid = end ? (end >= now ? 'valid in AppX' : 'expired in AppX') : 'no end date';
      const course = courses.get(String(r.item_id));
      const u = userByApx.get(String(r.user_id ?? r.userid));
      const has = course && u && held.get(String(u))?.has(course);
      const state = !course ? 'no Course' : !u ? 'no user here' : has ? 'buyer holds it' : 'buyer lacks it';
      bump(out, `${valid} | ${state}`);
      if (state === 'buyer lacks it' && valid === 'valid in AppX') bump(missingByCourse, String(r.item_id));
    }
    console.log('Access:', JSON.stringify(top(out)));
    console.log('Valid in AppX, buyer lacks it, by AppX course:', JSON.stringify(top(missingByCourse, 25)));

    const noUser = await db.collection('apx_orders_new').find(
      { processed: { $ne: true }, item_type: 'Digital Products', processedSkipReason: 'no-user' },
      { projection: { user_id: 1, userid: 1, phone: 1, email: 1, item_id: 1, created_at2: 1, syncedAt: 1 } },
    ).toArray();
    const apxIds = new Set(noUser.map((r) => String(r.user_id ?? r.userid ?? '')));
    const phones = [...new Set(noUser.map((r) => String(r.phone ?? '').replace(/\D/g, '').slice(-10)).filter((p) => p.length === 10))];
    console.log('\nNo-user rows', noUser.length, '| distinct AppX user ids', apxIds.size, '| blank id', noUser.filter((r) => !String(r.user_id ?? r.userid ?? '').trim()).length, '| usable phones', phones.length, '| masked or blank phone', noUser.filter((r) => String(r.phone ?? '').replace(/\D/g, '').length < 10).length);
    let byPhone = 0;
    for (let i = 0; i < phones.length; i += 2000) {
      const b = phones.slice(i, i + 2000);
      byPhone += await db.collection('users').countDocuments({ $or: [{ mobile: { $in: b } }, { mobile: { $in: b.map(Number) } }, { mobile: { $in: b.map((p) => `91${p}`) } }] }, { maxTimeMS: 60000 });
    }
    console.log('Users here matching those phones:', byPhone);
    console.log('By AppX course, top:', JSON.stringify(top(noUser.reduce((m, r) => bump(m, String(r.item_id)), {}), 15)));
    console.log('By purchase month:', JSON.stringify(Object.entries(noUser.reduce((m, r) => { const d = dmy(r.created_at2); return bump(m, d ? d.toISOString().slice(0, 7) : 'unknown'); }, {})).sort()));
    console.log('Last synced month:', JSON.stringify(Object.entries(noUser.reduce((m, r) => bump(m, r.syncedAt ? new Date(r.syncedAt).toISOString().slice(0, 10) : 'unknown'), {})).sort().slice(-5)));
  } finally { await mongoose.disconnect(); }
})().catch((e) => { console.error(String(e.stack || e.message).replace(/https?:\/\/\S+/g, '[url]')); process.exitCode = 1; });
