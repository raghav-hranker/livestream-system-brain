// Vidyagram extension-offer probe — READ-ONLY. Run on webserver2-2 from the Vidyagram checkout:
//   cd /var/www/backend.vidyagramar.com/vidyagram-backend && node /tmp/vidyagram-extension-offer-probe.cjs [maxUsers]
// Reads the switch from .env.development, samples users whose successful plan order has lapsed, and runs the
// deployed offer rule (dist resolvePlanOffer) for each: prints how many get an extension offer, per plan.
// It runs the rule in its own process, so it proves the env file + code, not the running pm2 process.
const path = require("path");
const req = require("module").createRequire(path.join(process.cwd(), "probe.js"));
req("dotenv").config({ path: ".env.development" });
const mongoose = req("mongoose");
const dist = p => req(path.join(process.cwd(), "dist/src", p));

(async () => {
  const uri = process.env.MONGO_URI || "";
  if (!/vidyagramdb/.test(uri)) throw new Error("refusing: MONGO_URI is not vidyagramdb");
  await mongoose.connect(uri);
  const Order = dist("models/Order").default;
  const Plans = dist("models/Plans").default;
  const { resolvePlanOffer } = dist("services/planOffer.service");
  const maxUsers = Number(process.argv[2]) || 300;
  console.log("LAPSED_EXTENSION_ENABLED =", process.env.LAPSED_EXTENSION_ENABLED,
    "| WINDOW_DAYS =", process.env.LAPSED_EXTENSION_WINDOW_DAYS ?? "(unset)");

  const now = new Date();
  const lapsed = await Order.aggregate([
    { $match: { orderStatus: "success", status: { $ne: 0 }, expireDate: { $lt: now }, planId: { $ne: null } } },
    { $sort: { expireDate: -1 } },
    { $group: { _id: { u: "$userId", p: "$planId" } } },
    { $limit: maxUsers },
  ]);
  console.log(`sampled ${lapsed.length} lapsed (user, plan) pairs`);

  const perPlan = new Map();
  let offers = 0, sample = null;
  for (const { _id } of lapsed) {
    const offer = await resolvePlanOffer(String(_id.p), String(_id.u));
    const key = String(_id.p);
    const row = perPlan.get(key) || { pairs: 0, offers: 0, prices: new Set() };
    row.pairs++;
    if (offer) { row.offers++; offers++; row.prices.add(offer.price ?? offer.amount); sample = sample || offer; }
    perPlan.set(key, row);
  }
  console.log(`pairs with an offer: ${offers}/${lapsed.length}`);
  const titles = await Plans.find({ _id: { $in: [...perPlan.keys()] } }).select("title name amount status").lean();
  const byId = new Map(titles.map(t => [String(t._id), t]));
  for (const [id, r] of [...perPlan].sort((a, b) => b[1].offers - a[1].offers).slice(0, 15)) {
    const t = byId.get(id) || {};
    console.log(` ${id} "${t.title || t.name}" list=${t.amount} status=${t.status}  offers ${r.offers}/${r.pairs}  prices=${[...r.prices].join(",")}`);
  }
  if (sample) console.log("sample offer:", JSON.stringify(sample));
  await mongoose.disconnect();
})().catch(e => { console.error(e); process.exit(1); });
