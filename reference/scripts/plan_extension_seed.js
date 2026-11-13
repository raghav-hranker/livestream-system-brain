// Seed a LAPSED plan order for one test user so the Extension offer becomes visible.
//   node plan_extension_seed.js <mobile> [planId] [--commit]
// Dry run by default: prints the user, the offer-enabled plans and the order it WOULD insert.
require("dotenv").config({ path: ".env.development" });
const mongoose = require("mongoose");
(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const Plans = require("./dist/src/models/Plans").default;
  const Order = require("./dist/src/models/Order").default;
  const User = require("./dist/src/models/User").default;
  const { CUSTOMER_ID } = require("./dist/src/config/baseConstants");
  const args = process.argv.slice(2);
  const commit = args.includes("--commit");
  const [mobile, planArg] = args.filter(a => !a.startsWith("--"));
  const user = await User.findOne({ mobile: Number(mobile), customer_id: CUSTOMER_ID }).select("_id name mobile").lean()
            || await User.findOne({ mobile: Number(mobile) }).select("_id name mobile customer_id").lean();
  if (!user) { console.log("no user with mobile", mobile); return mongoose.disconnect(); }
  console.log("user:", user);
  const plans = await Plans.find({ extensionEnabled: true, extensionValidity: { $gt: 0 } }).select("_id title name amount duration extensionPrice extensionValidity status").lean();
  console.log(`plans with the offer enabled: ${plans.length}`);
  for (const p of plans) console.log(` ${p._id}  "${p.title || p.name}"  amount=${p.amount} dur=${p.duration}  ext=${p.extensionPrice}/${p.extensionValidity}d status=${p.status}`);
  const plan = planArg ? plans.find(p => String(p._id) === planArg) : plans[0];
  if (!plan) { console.log("no usable plan"); return mongoose.disconnect(); }
  const existing = await Order.find({ userId: String(user._id), planId: String(plan._id), orderStatus: "success", status: { $ne: 0 } }).select("_id expireDate daysLeft").lean();
  console.log(`user's existing successful orders on this plan: ${existing.length}`, existing);
  const now = new Date();
  const dur = Number(plan.duration) || 30;
  const expireDate = new Date(now.getTime() - 24 * 3600 * 1000);                 // lapsed yesterday
  const orderDate = new Date(expireDate.getTime() - dur * 24 * 3600 * 1000);
  const doc = {
    userId: String(user._id), planId: String(plan._id), grandTotal: 0, originalAmount: Number(plan.amount) || 0,
    orderStatus: "success", status: 1, gateway: "manual", orderVia: "extension-test-seed", planFor: plan.title || plan.name,
    type: "subscription", duration: dur, daysLeft: 0, expireDate, orderDate: orderDate.toISOString(),
    givenForFree: true, assignedByAdmin: true, remarks: "seed: lapsed order for extension-offer test (2026-09-18)",
    customer_id: CUSTOMER_ID, orderNumber: `SEED-${Date.now()}-${Math.floor(Math.random() * 1e4)}`,
  };
  console.log(commit ? "INSERTING:" : "DRY RUN — would insert:", doc);
  if (commit) { const o = await Order.create(doc); console.log("inserted order", String(o._id)); }
  console.log(`\nverify: curl -s -X POST https://backend.quicktricksbysahilsir.com/api/plans/filter-active/${user._id} -H 'Content-Type: application/json' -d '{}' | jq '.data[] | select(.id=="${plan._id}") | {is_buy,is_expire,isExtensionOffer,amount,duration}'`);
  await mongoose.disconnect();
})().catch(e => { console.error(e); process.exit(1); });
