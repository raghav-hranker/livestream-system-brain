// Plan-extension probe — READ-ONLY. Run on the prod box from the backend checkout:
//   cd /var/www/backend.quicktricksbysahilsir.com/quicktricks-backend && node plan_extension_probe.js [planId] [--order <orderId>]
// Prints: plans with the Extension offer enabled; for one plan, a lapsed-only user
// (should get is_expire:1) and an active holder (should get is_expire:0); with
// --order, the extension marks on that order row.
require("dotenv").config({ path: ".env.development" });
const mongoose = require("mongoose");
(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const Plans = require("./dist/src/models/Plans").default;
  const Order = require("./dist/src/models/Order").default;
  const args = process.argv.slice(2);
  const oi = args.indexOf("--order");
  if (oi >= 0) {
    const o = await Order.findById(args[oi + 1]).select("userId planId orderStatus grandTotal duration expireDate isExtensionOrder extendsOrderId orderDate gateway").lean();
    console.log("order:", o);
    return mongoose.disconnect();
  }
  const plans = await Plans.find({ extensionEnabled: true, extensionValidity: { $gt: 0 } })
    .select("_id title name amount duration extensionPrice extensionValidity status").lean();
  console.log(`plans with the offer enabled: ${plans.length}`);
  for (const p of plans) console.log(` ${p._id}  "${p.title || p.name}"  amount=${p.amount} dur=${p.duration}  ext=${p.extensionPrice}/${p.extensionValidity}d  status=${p.status}`);
  const planId = args.find(a => !a.startsWith("--")) || (plans[0] && String(plans[0]._id));
  if (!planId) return mongoose.disconnect();
  const now = new Date();
  const orders = await Order.find({ planId, orderStatus: "success", status: { $ne: 0 } })
    .select("userId expireDate daysLeft").lean();
  const byUser = new Map();
  for (const o of orders) {
    const u = byUser.get(o.userId) || { active: 0, lapsed: 0 };
    const active = (o.expireDate && new Date(o.expireDate) >= now) || (!o.expireDate && Number(o.daysLeft) > 0);
    active ? u.active++ : u.lapsed++;
    byUser.set(o.userId, u);
  }
  const lapsedOnly = [...byUser].filter(([, u]) => u.lapsed > 0 && u.active === 0).slice(0, 3);
  const activeHolders = [...byUser].filter(([, u]) => u.active > 0).slice(0, 3);
  console.log(`\nplan ${planId}: ${orders.length} successful orders, ${byUser.size} users`);
  console.log("lapsed-only users (expect is_buy:0, is_expire:1, extension amount):", lapsedOnly.map(([id]) => id));
  console.log("active holders   (expect is_buy:1, is_expire:0, original amount):", activeHolders.map(([id]) => id));
  await mongoose.disconnect();
})().catch(e => { console.error(e); process.exit(1); });
