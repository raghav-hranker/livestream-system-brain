// Read-only, refuses any DB but vidyagramdb. Every Course with course selling's combo switched on (selling.combo.on):
// the combo's own state, and each sub course's status, apxPrice, AppX state (mirror), other combos holding it, and
// whether any active Plan sells it outside a combo (on a screen). Answers "which combos' Sub Courses tab loses entries
// because a sub course is status 0" (subCourseListsFor lists status 1 only).
// JSON lines on stdout, then totals. Run from a Vidyagram backend checkout (its .env.development holds MONGO_URI):
//   cd ~/Projects/worktrees/vg-backend && node - < ~/Projects/system-brain/reference/scripts/vidyagram-combo-sub-status-probe.cjs
require('dotenv').config({ path: '.env.development', quiet: true });
const mongoose = require('mongoose');

const str = (v) => (v === null || v === undefined ? '' : String(v).trim());
const out = (o) => console.log(JSON.stringify(o));

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { readPreference: 'secondaryPreferred' });
  try {
    const db = mongoose.connection.db;
    if (db.databaseName !== 'vidyagramdb') throw new Error(`refusing: ${db.databaseName}`);
    const combos = await db.collection('courses').find({ 'selling.combo.on': true }, { projection: { title: 1, status: 1, apxCourseId: 1, apxPrice: 1, isCombo: 1, 'selling.combo': 1 } }).toArray();
    const subIds = [...new Set(combos.flatMap((c) => (c.selling.combo.subCourses || []).map(String)))];
    const subs = await db.collection('courses').find({ _id: { $in: subIds.map((id) => new mongoose.Types.ObjectId(id)) } }, { projection: { title: 1, status: 1, apxCourseId: 1, apxPrice: 1, banner: 1 } }).toArray();
    const subById = new Map(subs.map((s) => [String(s._id), s]));
    const apxIds = subs.map((s) => str(s.apxCourseId)).filter(Boolean);
    const mirror = await db.collection('apxcatalogcourses').find({ customerId: '781', apxCourseId: { $in: apxIds } }, { projection: { apxCourseId: 1, 'detail.enable': 1, 'detail.price': 1, 'listRow.enable': 1, 'listRow.price': 1 } }).toArray();
    const mirrorById = new Map(mirror.map((m) => [str(m.apxCourseId), m]));
    const plans = await db.collection('plans').find({ status: 1, course: { $in: [...subIds, ...subIds.map((id) => new mongoose.Types.ObjectId(id))] } }, { projection: { name: 1, course: 1, displayOn: 1, amount: 1 } }).toArray();
    const totals = { combos: combos.length, combosWithHiddenSubs: 0, hiddenSubs: 0, missingSubs: 0 };
    for (const c of combos) {
      const ids = (c.selling.combo.subCourses || []).map(String);
      const rows = ids.map((id) => {
        const s = subById.get(id);
        if (!s) { totals.missingSubs++; return { id, missing: true }; }
        const m = mirrorById.get(str(s.apxCourseId));
        const others = combos.filter((o) => String(o._id) !== String(c._id) && (o.selling.combo.subCourses || []).map(String).includes(id)).map((o) => str(o.apxCourseId) || String(o._id));
        const sellers = plans.filter((p) => (p.course || []).map(String).includes(id) && (p.displayOn || []).length > 0)
          .map((p) => ({ plan: String(p._id), name: str(p.name).slice(0, 40), courses: (p.course || []).length, amount: p.amount, displayOn: p.displayOn }));
        return { id, apx: str(s.apxCourseId) || null, title: str(s.title).slice(0, 50), status: s.status, apxPrice: s.apxPrice ?? null, banner: !!s.banner,
          appx: m ? { enable: str(m.detail?.enable ?? m.listRow?.enable), price: str(m.detail?.price ?? m.listRow?.price) } : null, otherCombos: others, onScreenPlans: sellers };
      });
      const hidden = rows.filter((r) => !r.missing && r.status !== 1).length;
      if (hidden) { totals.combosWithHiddenSubs++; totals.hiddenSubs += hidden; }
      out({ combo: String(c._id), apx: str(c.apxCourseId) || null, title: str(c.title).slice(0, 60), status: c.status, apxPrice: c.apxPrice ?? null, isCombo: c.isCombo === true,
        tabShows: 1 + rows.filter((r) => r.status === 1).length, of: 1 + ids.length, subs: rows });
    }
    out({ totals });
  } finally {
    await mongoose.disconnect();
  }
})().catch((e) => { console.error(e); process.exit(1); });
