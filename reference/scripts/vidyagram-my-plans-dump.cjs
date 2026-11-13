// Vidyagram my-plans dump — READ-ONLY. Run on webserver2-2 from the Vidyagram checkout (copy to /tmp first):
//   cd /var/www/backend.vidyagramar.com/vidyagram-backend && node /tmp/vidyagram-my-plans-dump.cjs <userId> [--platform ios]
//   ... --plan <planId>         first holder of that plan (e.g. the app team's test plan)
//   ... --with-extend-offer     first recently lapsed user whose card carries an Extend offer
//   ... --dist <dir>            load the services from <dir> (a shadow of dist/src holding an unreleased build)
// Prints the `data` that GET /api/users/me/plans returns for that user, built by the deployed loadPlanCards,
// with no token minted. Same env file and code as the running pm2 92; it does not prove the running process.
const path = require("path");
const req = require("module").createRequire(path.join(process.cwd(), "probe.js"));
req("dotenv").config({ path: ".env.development" });
const mongoose = req("mongoose");
const distFlag = process.argv.indexOf("--dist");
const distDir = distFlag >= 0 ? process.argv[distFlag + 1] : path.join(process.cwd(), "dist/src");
const dist = p => req(path.join(distDir, p));

(async () => {
  const uri = process.env.MONGO_URI || "";
  if (!/vidyagramdb/.test(uri)) throw new Error("refusing: MONGO_URI is not vidyagramdb");
  await mongoose.connect(uri);
  const User = dist("models/User").default;
  const Order = dist("models/Order").default;
  const { loadPlanCards } = dist("services/myPlans.service");
  const args = process.argv.slice(2);
  const flag = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
  const platform = flag("--platform");

  const cardsFor = async userId => {
    const user = await User.findById(userId).select("user_id").lean();
    if (!user) throw new Error(`no user ${userId}`);
    const ids = [...new Set([String(userId), user.user_id ? String(user.user_id) : ""].filter(Boolean))];
    return loadPlanCards(ids, String(userId), { platform });
  };

  let userId = args.find(a => /^[0-9a-f]{24}$/i.test(a) && a !== flag("--plan"));
  let plans;
  if (!userId && flag("--plan")) {
    const o = await Order.findOne({ planId: flag("--plan"), orderStatus: "success" }).sort({ createdAt: -1 }).select("userId").lean();
    userId = o && String(o.userId);
  } else if (!userId && args.includes("--with-extend-offer")) {
    const pairs = await Order.aggregate([
      { $match: { orderStatus: "success", status: { $ne: 0 }, expireDate: { $lt: new Date() } } },
      { $sort: { expireDate: -1 } }, { $group: { _id: "$userId" } }, { $limit: 300 },
    ]);
    for (const { _id } of pairs) {
      if (!mongoose.Types.ObjectId.isValid(String(_id))) continue;
      const cards = await cardsFor(String(_id)).catch(() => []);
      if (cards.some(c => c.extendOffers.length)) { userId = String(_id); plans = cards; break; }
    }
  }
  if (!userId) throw new Error("no user found");
  plans = plans || await cardsFor(userId);
  console.log(`user ${userId}${platform ? ` platform=${platform}` : ""}`);
  console.log(JSON.stringify({ state: 200, msg: "ok", data: { plans } }, null, 2));
  await mongoose.disconnect();
})().catch(e => { console.error(e); process.exit(1); });
