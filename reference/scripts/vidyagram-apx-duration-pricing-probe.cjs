// Read-only. Refuses any DB but vidyagramdb. Does any AppX course use Access Duration Based Pricing? Prints field names of
// apxcatalogcourses.detail that look price- or duration-related, how many courses fill each, and short numeric or text values
// for those fields only. Run on webserver2-2 from the Vidyagram checkout:
// node -r dotenv/config - dotenv_config_path=.env.development < script
const mongoose = require('mongoose');
const NAME = /pric|valid|duration|upsell|emi|plan|month|expir|access/i;
const SKIP = /url|link|token|key|secret|image|thumb|video|desc|html/i;
const filled = v => !(v === null || v === undefined || v === '' || v === '0' || v === 0 || v === '-1' || (Array.isArray(v) && !v.length) || (typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length));
(async () => {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 8000, readPreference: 'secondaryPreferred' });
  const db = mongoose.connection.db;
  if (db.databaseName !== 'vidyagramdb') throw new Error('refusing: connected to ' + db.databaseName);
  const stats = {};
  let total = 0;
  for await (const row of db.collection('apxcatalogcourses').find({}, { projection: { detail: 1 } })) {
    total += 1;
    for (const [k, v] of Object.entries(row.detail || {})) {
      if (!NAME.test(k) || SKIP.test(k)) continue;
      const s = (stats[k] = stats[k] || { filled: 0, kinds: {}, values: {} });
      if (!filled(v)) continue;
      s.filled += 1;
      const kind = Array.isArray(v) ? 'array' : typeof v;
      s.kinds[kind] = (s.kinds[kind] || 0) + 1;
      if (kind === 'string' || kind === 'number') { const t = String(v).slice(0, 24); s.values[t] = (s.values[t] || 0) + 1; }
      else { const t = JSON.stringify(v).slice(0, 160); if (Object.keys(s.values).length < 3) s.values[t] = (s.values[t] || 0) + 1; }
    }
  }
  const out = Object.entries(stats).map(([k, s]) => ({ k, filled: s.filled, kinds: s.kinds, distinct: Object.keys(s.values).length,
    top: Object.entries(s.values).sort((a, b) => b[1] - a[1]).slice(0, 5) })).sort((a, b) => a.k.localeCompare(b.k));
  console.log(JSON.stringify({ total, fields: out }));
  // Courses with pricing plans: each option as AppX shows it, and the single-course plans we sell the same course through.
  const rows = [];
  for await (const row of db.collection('apxcatalogcourses').find({ 'detail.price_planningData': { $exists: true } })) {
    const d = row.detail || {};
    let options = [];
    try { options = typeof d.price_planningData === 'string' ? JSON.parse(d.price_planningData) : d.price_planningData; } catch { options = []; }
    if (!Array.isArray(options) || !options.length) continue;
    const apxId = String(row.apxId ?? row.apx_id ?? d.id ?? '');
    const course = await db.collection('courses').findOne({ $or: [{ apxCourseId: apxId }, { apxCourseId: Number(apxId) }, { apx_course_id: apxId }, { apx_legacy_id: apxId }] }, { projection: { title: 1, status: 1, price: 1, discountPrice: 1, validity: 1 } });
    const plans = course ? await db.collection('plans').find({ course: { $in: [course._id, String(course._id)] } }).project({ amount: 1, duration: 1, status: 1, course: 1 }).toArray() : [];
    rows.push({
      apxId,
      title: String(d.course_name || d.title || row.title || '').slice(0, 60),
      enabled: d.enable_pricing_plan, price: d.price, validity: d.validity, type: d.validity_type,
      options: options.map(o => ({ name: String(o.name || '').trim().slice(0, 26), mrp: o.mrp, price: o.price, v: o.validity, t: o.validity_type, st: o.status })),
      local: course ? { status: course.status, price: course.price, validity: course.validity } : null,
      localSingle: plans.filter(pl => Array.isArray(pl.course) && pl.course.length === 1).map(pl => ({ amount: pl.amount, days: pl.duration, st: pl.status })),
    });
  }
  console.log(JSON.stringify({ priced: rows }));
  await mongoose.disconnect();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
