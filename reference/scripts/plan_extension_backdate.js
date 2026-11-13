// Toggle the test user's order between lapsed and its original expiry.
//   node plan_extension_backdate.js lapse     -> expireDate = yesterday, daysLeft 0
//   node plan_extension_backdate.js restore   -> expireDate = 2027-09-01T12:27:06.941Z, daysLeft 349
//   node plan_extension_backdate.js void      -> all success orders for USER on PLAN -> aborted (keeps rows)
//   node plan_extension_backdate.js show      -> print the user's orders on the plan (newest first)
require("dotenv").config({ path: ".env.development" });
const mongoose = require("mongoose");
const ORDER = "6a96c49a4a53e50e3fc0e725", USER = "6a7eb7ce543dd0b9881e0a27", PLAN = "6a7b02ea4b68522b0d415397";
const ORIGINAL = new Date("2027-09-01T12:27:06.941Z");
(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const O = require("./dist/src/models/Order").default;
  const mode = process.argv[2];
  if (mode === "lapse") {
    const r = await O.updateOne({ _id: ORDER }, { $set: { expireDate: new Date(Date.now() - 86400000), daysLeft: 0, remarks: "TEST: backdated 2026-09-18 for extension check; original expireDate " + ORIGINAL.toISOString() } });
    console.log("lapse:", r.matchedCount, r.modifiedCount);
  } else if (mode === "void") {
    // Take the test user off the plan entirely: every reader keys on orderStatus === 'success',
    // so 'aborted' removes access, is_buy, and extension eligibility while keeping the rows.
    const r = await O.updateMany({ userId: USER, planId: PLAN, orderStatus: "success" },
      { $set: { orderStatus: "aborted", remarks: "TEST: voided 2026-09-18 after extension-offer acceptance (was success)" } });
    console.log("void:", r.matchedCount, r.modifiedCount);
  } else if (mode === "restore") {
    const r = await O.updateOne({ _id: ORDER }, { $set: { expireDate: ORIGINAL, daysLeft: 349 }, $unset: { remarks: "" } });
    console.log("restore:", r.matchedCount, r.modifiedCount);
  }
  const rows = await O.find({ userId: USER, planId: PLAN }).sort({ _id: -1 }).limit(5)
    .select("orderStatus status grandTotal duration expireDate daysLeft isExtensionOrder extendsOrderId gateway orderVia").lean();
  console.log(rows);
  await mongoose.disconnect();
})().catch(e => { console.error(e); process.exit(1); });
