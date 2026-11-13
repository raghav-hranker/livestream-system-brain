// READ-ONLY: size the "holds X, never bought Y" pockets among existing buyers,
// so student offers get pointed at pairs with volume. Writes nothing.
// Copy into the backend checkout on the prod box and run there:
//   node ./.offer_pockets.js            # top 25 pairs
//   node ./.offer_pockets.js 50 ssc     # top 50 pairs, only targets whose name matches /ssc/i
//
// Output per row: source plan, target plan, holders of source who never had a
// success order on target (active and lapsed split), and what buyers of the
// source bought next most often (bought-together signal).
//
// Holder = a success order with status != 0 on the plan (same rule as
// planOffer.service.ts). Active = expireDate >= now or daysLeft > 0.
const dotenv = require("dotenv");
dotenv.config({ path: ".env.development" });
const mongoose = require("mongoose");

const TOP = Number(process.argv[2] || 25);
const TARGET_RE = process.argv[3] ? new RegExp(process.argv[3], "i") : null;

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const now = new Date();

  const plans = await db.collection("plans")
    .find({ isExtension: { $ne: true } }, { projection: { name: 1, amount: 1, status: 1, upgradationEnabled: 1, upgradationPlanIds: 1, upgradationPrice: 1 } })
    .toArray();
  const planName = new Map(plans.map(p => [String(p._id), p.name]));

  // userId -> Map(planId -> {active, lastAt})
  const orders = db.collection("orders").find(
    { orderStatus: "success", status: { $ne: 0 }, planId: { $exists: true, $ne: "" } },
    { projection: { userId: 1, planId: 1, expireDate: 1, daysLeft: 1, createdAt: 1 } },
  );
  const byUser = new Map();
  let n = 0;
  for await (const o of orders) {
    n++;
    const active = (o.expireDate && new Date(o.expireDate) >= now) || Number(o.daysLeft || 0) > 0;
    let m = byUser.get(o.userId);
    if (!m) { m = new Map(); byUser.set(o.userId, m); }
    const cur = m.get(o.planId);
    const at = o.createdAt ? new Date(o.createdAt) : null;
    if (!cur) m.set(o.planId, { active, at });
    else { cur.active = cur.active || active; if (at && (!cur.at || at > cur.at)) cur.at = at; }
  }

  // holders per plan, and pair pockets
  const holders = new Map();      // planId -> {active, lapsed}
  const pockets = new Map();      // "src|tgt" -> {active, lapsed}
  const nextBuy = new Map();      // src -> Map(tgt -> count) where tgt bought after src
  const targetIds = plans.filter(p => Number(p.status) === 1 && (!TARGET_RE || TARGET_RE.test(p.name || ""))).map(p => String(p._id));

  for (const [, m] of byUser) {
    for (const [src, s] of m) {
      const h = holders.get(src) || { active: 0, lapsed: 0 };
      s.active ? h.active++ : h.lapsed++;
      holders.set(src, h);
      for (const tgt of targetIds) {
        if (tgt === src) continue;
        const t = m.get(tgt);
        if (!t) {
          const k = src + "|" + tgt;
          const p = pockets.get(k) || { active: 0, lapsed: 0 };
          s.active ? p.active++ : p.lapsed++;
          pockets.set(k, p);
        } else if (s.at && t.at && t.at > s.at) {
          let nb = nextBuy.get(src); if (!nb) { nb = new Map(); nextBuy.set(src, nb); }
          nb.set(tgt, (nb.get(tgt) || 0) + 1);
        }
      }
    }
  }

  const rows = [...pockets.entries()]
    .map(([k, v]) => { const [src, tgt] = k.split("|"); return { src, tgt, ...v, total: v.active + v.lapsed }; })
    .sort((a, b) => b.total - a.total)
    .slice(0, TOP);

  console.log(`orders scanned ${n}, buyers ${byUser.size}, plans ${plans.length}, targets ${targetIds.length}\n`);
  console.log("source plan | target plan | holders of source w/o target (active / lapsed) | source buyers who later bought target | target already an Upgrade source?");
  for (const r of rows) {
    const later = nextBuy.get(r.src)?.get(r.tgt) || 0;
    const tgtPlan = plans.find(p => String(p._id) === r.tgt);
    const wired = tgtPlan?.upgradationEnabled && (tgtPlan.upgradationPlanIds || []).includes(r.src) ? `yes @₹${tgtPlan.upgradationPrice}` : "no";
    console.log(`${planName.get(r.src)} | ${planName.get(r.tgt)} | ${r.total} (${r.active} / ${r.lapsed}) | ${later} | ${wired}`);
  }

  console.log("\nholders per source plan (active / lapsed), top 15:");
  [...holders.entries()].sort((a, b) => (b[1].active + b[1].lapsed) - (a[1].active + a[1].lapsed)).slice(0, 15)
    .forEach(([id, h]) => console.log(`  ${planName.get(id)} | ${h.active} / ${h.lapsed}`));

  await mongoose.disconnect();
})().catch(e => { console.error(e); process.exit(1); });
