// Read-only, refuses any DB but vidyagramdb. Two questions from the 11-09 match report:
//  A. "Keep prices in sync with AppX": per AppX course with a Course, AppX enable/price/mrp/lengths from the mirror's
//     last done capture against Course.status/price/discountPrice/apxPrice, Course.selling's price options, the plans that
//     sell the course (single-course plans and courseSale plans) and any live Bulk Sale holding a price. Prints the change
//     a sync would make, ADR-0009 rules (priceFieldsFor + price -1 / enable 0 = off sale), plus buyers on those plans.
//  B. Combos (COMBOS, default 71,75,100): AppX state, what each grants, our side, plans with the same contents, AppX orders.
// JSON lines on stdout, no links. Run from the nightly checkout on test-uday (nvm PATH as in vidyagram-nightly-gcp-run.sh):
//   cd <nightly checkout> && node - < vidyagram-appx-price-sync-preview.cjs
require('dotenv').config({ path: '.env.development', quiet: true });
const mongoose = require('mongoose');

const COMBOS = (process.env.COMBOS || '71,75,100').split(',').map((s) => s.trim()).filter(Boolean);
const str = (v) => (v === null || v === undefined ? '' : String(v).trim());
const num = (v) => { const n = Number(String(v ?? '').replace(/[^\d.-]/g, '')); return str(v) === '' || !Number.isFinite(n) ? null : n; };
const idList = (v) => str(v).split(',').map((s) => s.trim()).filter((s) => s && s !== '-1');
const key = (s) => str(s).normalize('NFKC').toLowerCase().replace(/\s+/g, ' ');
const out = (o) => console.log(JSON.stringify(o));

// apxCourseStatusSync.priceFieldsFor + resolveStoreVisibility (ADR-0009), copied so this needs no ts-node.
const priceFieldsFor = (apxPrice, apxMrp) => {
  const set = { apxPrice };
  if (apxPrice > 0) { set.price = apxMrp !== null && apxMrp > apxPrice ? apxMrp : apxPrice; set.discountPrice = apxPrice; set.isFree = false; }
  else if (apxPrice === -10) { set.price = 0; set.discountPrice = 0; set.isFree = true; }
  else if (apxPrice === -1) set.isFree = false;
  return set;
};
const visibility = (enable, apxPrice) => (apxPrice === -1 ? 0 : enable === '1' ? 1 : enable === '0' ? 0 : null);

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: 'vidyagramdb', readPreference: 'secondaryPreferred', autoIndex: false, autoCreate: false });
  try {
    const db = mongoose.connection.db;
    if (db.databaseName !== 'vidyagramdb') throw new Error('wrong db');
    const all = (c, f = {}, p = {}) => db.collection(c).find(f, { projection: p }).toArray();

    const mirror = await all('apxcatalogcourses', { customerId: '781' }, { apxCourseId: 1, listRow: 1, detail: 1, 'capture.runId': 1 });
    const courses = await all('courses', {}, { apxCourseId: 1, title: 1, status: 1, price: 1, discountPrice: 1, apxPrice: 1, isFree: 1, validity: 1, isCombo: 1, selling: 1 });
    const byApx = new Map(courses.filter((c) => c.apxCourseId).map((c) => [str(c.apxCourseId), c]));
    const byId = new Map(courses.map((c) => [String(c._id), c]));
    const plans = await all('plans', {}, { name: 1, status: 1, amount: 1, duration: 1, course: 1, courseSale: 1, ebook: 1, packages: 1 });
    const liveSales = new Set((await all('bulksales', { $or: [{ state: 'running' }, { state: 'pending', endDate: { $gt: new Date() } }] }, { _id: 1 })).map((s) => String(s._id)));
    const holds = new Map(); // planId or courseId → fields a live sale holds
    for (const s of await all('bulksaleplansnapshots', { status: { $in: ['captured', 'applied'] } }, { bulkSaleId: 1, planId: 1, field: 1, target: 1 })) {
      if (!liveSales.has(String(s.bulkSaleId))) continue;
      const k = String(s.planId); holds.set(k, [...(holds.get(k) || []), `${s.target || 'plan'}.${s.field}`]);
    }
    const ordersOn = async (planIds) => {
      if (!planIds.length) return 0;
      try { return await db.collection('orders').countDocuments({ planId: { $in: [...planIds, ...planIds.map(String)] } }, { maxTimeMS: 20000 }); } catch (e) { return `err ${e.codeName || e.message}`; }
    };

    // A. Prices and status
    const totals = {};
    for (const m of mirror) {
      const id = str(m.apxCourseId);
      const c = byApx.get(id);
      const d = m.detail || {};
      if (!c) continue;
      const enable = str(d.enable ?? m.listRow?.enable);
      const apxPrice = num(d.price ?? m.listRow?.price);
      const apxMrp = num(d.mrp);
      let options = [];
      try { options = typeof d.price_planningData === 'string' ? JSON.parse(d.price_planningData) : d.price_planningData || []; } catch { options = []; }
      const lengths = str(d.enable_pricing_plan) === '1' && Array.isArray(options) ? options.filter((o) => str(o.status) !== '0').map((o) => ({ v: `${str(o.validity)} ${str(o.validity_type)}`, price: num(o.price), mrp: num(o.mrp) })) : [];

      const target = {};
      const vis = visibility(enable, apxPrice);
      if (vis !== null) target.status = vis;
      if (apxPrice !== null) Object.assign(target, priceFieldsFor(apxPrice, apxMrp));
      const change = Object.fromEntries(Object.entries(target).filter(([k, v]) => c[k] !== v).map(([k, v]) => [k, [c[k] ?? null, v]]));

      const sells = plans.filter((p) => (p.courseSale && String(p.courseSale.courseId) === String(c._id))
        || (Array.isArray(p.course) && p.course.length === 1 && String(p.course[0]) === String(c._id) && !(p.ebook || []).length && !(p.packages || []).length));
      const live = sells.filter((p) => p.status === 1);
      const planChange = apxPrice > 0 ? live.filter((p) => num(p.amount) !== apxPrice).map((p) => ({ plan: String(p._id), name: p.name, key: p.courseSale?.key || '', amount: [num(p.amount), apxPrice], days: p.duration })) : [];
      const selling = c.selling ? { connected: true, options: (c.selling.options || []).map((o) => ({ price: o.price, mrp: o.mrp, v: `${o.validity?.n ?? ''} ${o.validity?.unit ?? ''}`.trim() })), allowPayment: c.selling.allowPayment ?? null } : { connected: false };
      const held = [String(c._id), ...live.map((p) => String(p._id))].flatMap((k) => holds.get(k) || []);
      const kind = !Object.keys(change).length && !planChange.length ? 'in sync' : Object.keys(change).every((k) => k === 'apxPrice') && !planChange.length ? 'apxPrice field only' : 'changes';
      totals[kind] = (totals[kind] || 0) + 1;
      if (kind === 'in sync') continue;
      out({ part: 'A', apxCourseId: id, title: c.title, kind, appx: { enable, price: apxPrice, mrp: apxMrp, lengths }, ours: { status: c.status, price: c.price, discountPrice: c.discountPrice, apxPrice: c.apxPrice, validity: c.validity }, change, planChange, plansLive: live.length, plansOff: sells.length - live.length, selling, bulkSaleHolds: held, orders: await ordersOn(sells.map((p) => p._id)) });
    }
    out({ part: 'A-totals', totals, liveBulkSales: liveSales.size });

    // B. Combos
    const apxOrders = db.collection('apx_orders_new');
    for (const id of COMBOS) {
      const m = mirror.find((x) => str(x.apxCourseId) === id);
      const d = m?.detail || {};
      const grants = idList(d.allotment_id).filter((x) => x !== id);
      const c = byApx.get(id);
      const granted = grants.map((g) => { const gc = byApx.get(g); const gm = mirror.find((x) => str(x.apxCourseId) === g); return { apx: g, appxTitle: str(gm?.detail?.title || gm?.listRow?.title), appxEnable: str(gm?.detail?.enable ?? gm?.listRow?.enable), appxPrice: str(gm?.detail?.price ?? gm?.listRow?.price), ourCourse: gc ? { title: gc.title, status: gc.status } : null }; });
      const grantIds = new Set(grants.map((g) => byApx.get(g)).filter(Boolean).map((gc) => String(gc._id)));
      const overlap = plans.filter((p) => Array.isArray(p.course) && p.course.length > 1).map((p) => {
        const ids = p.course.map(String);
        return { p, hit: ids.filter((x) => grantIds.has(x)).length, size: ids.length };
      }).filter((x) => x.hit >= Math.max(2, Math.ceil(grantIds.size * 0.6))).sort((a, b) => b.hit - a.hit).slice(0, 5)
        .map(({ p, hit, size }) => ({ plan: String(p._id), name: p.name, status: p.status, amount: p.amount, days: p.duration, granted: hit, ofGrants: grantIds.size, planSize: size, extra: p.course.map(String).filter((x) => !grantIds.has(x)).map((x) => byId.get(x)?.apxCourseId || x) }));
      const sameName = plans.filter((p) => key(p.name) === key(d.title)).map((p) => ({ plan: String(p._id), status: p.status, amount: p.amount, courses: (p.course || []).map((x) => byId.get(String(x))?.apxCourseId || String(x)) }));
      let orders = null;
      try {
        orders = await apxOrders.aggregate([
          { $match: { item_id: { $in: [id, Number(id)] } } },
          { $group: { _id: { type: '$item_type', processed: '$processed', month: { $substrCP: [{ $toString: { $ifNull: ['$created_at', '$created_at2'] } }, 0, 7] } }, n: { $sum: 1 } } },
          { $sort: { '_id.month': 1 } },
        ], { maxTimeMS: 60000 }).toArray();
      } catch (e) { orders = `err ${e.codeName || e.message}`; }
      out({ part: 'B', apxCourseId: id, appx: { title: str(d.title || m?.listRow?.title), enable: str(d.enable ?? m?.listRow?.enable), price: str(d.price), mrp: str(d.mrp), validity: `${str(d.validity)} ${str(d.validity_type)}`, created: str(d.created_at), folder: str(d.parent_id), exams: str(d.exam_name).replace(/<[^>]+>/g, ' '), captured: Boolean(m?.capture) }, ourCourse: c ? { id: String(c._id), title: c.title, status: c.status, isCombo: !!c.isCombo, combo: c.selling?.combo || null } : null, grants: granted, sameNamePlans: sameName, plansWithMostOfTheseCourses: overlap, apxOrders: orders });
    }
  } finally { await mongoose.disconnect(); }
})().catch((e) => { console.error(String(e.stack || e.message).replace(/https?:\/\/\S+/g, '[url]')); process.exitCode = 1; });
