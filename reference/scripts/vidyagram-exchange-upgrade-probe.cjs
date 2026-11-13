// Vidyagram course exchange + plan upgrade probe for one student — READ-ONLY, refuses any DB but vidyagramdb.
// Run on webserver2-2 from the Vidyagram checkout, script over ssh stdin:
//   cd /var/www/backend.vidyagramar.com/vidyagram-backend && USER_ID=<id> COURSE_RE='maths?.*vod.*2' node -
// Runs the deployed dist rules (loadExchangeOptions, signals, resolvePlanOffersForUser, loadPlanCards) with the
// .env.development switches. Proves the env file + code, not the running pm2 process. Prints ids and titles, no
// student name, mobile or email.
const path = require("path");
const req = require("module").createRequire(path.join(process.cwd(), "probe.js"));
req("dotenv").config({ path: ".env.development" });
const mongoose = req("mongoose");
const dist = p => req(path.join(process.cwd(), "dist/src", p));

const USER_ID = process.env.USER_ID || "";
const COURSE_RE = new RegExp(process.env.COURSE_RE || "maths?.*vod.*2", "i");
const log = (label, value) => console.log(label, value === undefined ? "" : JSON.stringify(value));

(async () => {
  const uri = process.env.MONGO_URI || "";
  if (!/vidyagramdb/.test(uri)) throw new Error("refusing: MONGO_URI is not vidyagramdb");
  if (!mongoose.Types.ObjectId.isValid(USER_ID)) throw new Error("USER_ID must be an ObjectId");
  await mongoose.connect(uri);
  const Order = dist("models/Order").default;
  const Plans = dist("models/Plans").default;
  const Course = dist("models/Course").default;
  const User = dist("models/User").default;
  const { getCourseExchangeConfig } = dist("config/courseExchange");
  const { loadExchangeOptions, loadCourseExchangeSignals, readExchangeUsage } = dist("services/courseExchange.service");
  const { resolvePlanOffersForUser, PLAN_OFFER_FIELDS } = dist("services/planOffer.service");
  const { hasCourseUpgradeOffer } = dist("services/courseAccessState.service");
  const { isExcludedOrderKind, isAppxImport, orderPurchaseTime } = dist("services/courseExchangePolicy");
  const { loadPlanCards } = dist("services/myPlans.service");

  log("switches", {
    exchange: getCourseExchangeConfig(),
    LAPSED_EXTENSION_ENABLED: process.env.LAPSED_EXTENSION_ENABLED,
    LAPSED_EXTENSION_WINDOW_DAYS: process.env.LAPSED_EXTENSION_WINDOW_DAYS,
  });

  const user = await User.findById(USER_ID).select("user_id status customer_id createdAt").lean();
  log("user", user);
  if (!user) throw new Error("no such user in vidyagramdb");
  const now = new Date();

  const idForms = [USER_ID, new mongoose.Types.ObjectId(USER_ID)];
  if (user.user_id && String(user.user_id) !== USER_ID) idForms.push(String(user.user_id));
  const orders = await Order.collection.find({ userId: { $in: idForms } }).sort({ _id: -1 }).toArray();
  console.log(`\n== orders: ${orders.length}`);
  const planIds = [...new Set(orders.map(o => String(o.planId ?? "")).filter(id => mongoose.Types.ObjectId.isValid(id)))];
  const heldPlans = await Plans.find({ _id: { $in: planIds } })
    .select("name title status course amount duration exchangeToPlanIds upgradationEnabled upgradationPlanIds upgradationPrice").lean();
  const planById = new Map(heldPlans.map(p => [String(p._id), p]));
  for (const o of orders) {
    const plan = planById.get(String(o.planId ?? ""));
    log(`order ${o._id}`, {
      plan: plan ? plan.name || plan.title : null, planId: o.planId, userIdType: typeof o.userId, orderStatus: o.orderStatus, status: o.status,
      grandTotal: o.grandTotal, gateway: o.gateway, orderVia: o.orderVia, type: o.type, orderNumber: o.orderNumber,
      assignedByAdmin: o.assignedByAdmin, givenForFree: o.givenForFree, isUpgradeOrder: o.isUpgradeOrder,
      isExtensionOrder: o.isExtensionOrder, buildCourseId: o.build?.courseId, parentOrderId: o.parentOrderId,
      duration: o.duration, expireDate: o.expireDate, daysLeft: o.daysLeft, createdAt: o.createdAt,
      purchaseTime: orderPurchaseTime(o), excludedKind: isExcludedOrderKind(o), appxImport: isAppxImport(o), exchange: o.exchange,
      courseIds: o.courseId, latestCourseId: o.latestCourseId,
    });
    if (String(o.userId) === USER_ID) {
      const options = await loadExchangeOptions(USER_ID, String(o._id), now).catch(e => ({ error: e.message }));
      log("  exchange-options", options);
    }
  }

  console.log("\n== plans on the student's orders");
  for (const p of heldPlans) {
    const targets = (p.exchangeToPlanIds || []).map(String);
    const targetDocs = targets.length ? await Plans.find({ _id: { $in: targets } }).select("name status course").lean() : [];
    log(`plan ${p._id}`, {
      name: p.name, status: p.status, amount: p.amount, duration: p.duration, courseCount: (p.course || []).length, course: p.course,
      exchangeTo: targetDocs.map(t => ({ id: t._id, name: t.name, status: t.status, courses: (t.course || []).length })),
      upgradationEnabled: p.upgradationEnabled, upgradationPrice: p.upgradationPrice, upgradationPlanIds: p.upgradationPlanIds,
    });
  }

  const courses = await Course.collection.find({ title: COURSE_RE }, { projection: { title: 1, status: 1, price: 1 } }).limit(20).toArray();
  console.log(`\n== courses matching ${COURSE_RE}: ${courses.length}`);
  const courseIds = courses.map(c => String(c._id));
  const signals = await loadCourseExchangeSignals(USER_ID, courseIds, now);
  for (const c of courses) {
    const id = String(c._id);
    log(`course ${id}`, {
      title: c.title, status: c.status, exchangeSignal: signals.get(id) ?? null,
      isUpgrade: await hasCourseUpgradeOffer(id, USER_ID),
      usage: await readExchangeUsage(USER_ID, id),
    });
  }

  const forms = courseIds.flatMap(id => [id, new mongoose.Types.ObjectId(id)]);
  const named = await Plans.collection.find({ $or: [{ course: { $in: forms } }, { name: COURSE_RE }, { title: COURSE_RE }] })
    .project({ name: 1, status: 1, amount: 1, duration: 1, course: 1, exchangeToPlanIds: 1, upgradationEnabled: 1, upgradationPlanIds: 1, upgradationPrice: 1, customer_id: 1 })
    .toArray();
  console.log(`\n== plans holding those courses or matching by name: ${named.length}`);
  for (const p of named) {
    log(`plan ${p._id}`, {
      name: p.name, status: p.status, customer_id: p.customer_id, amount: p.amount, duration: p.duration, courseCount: (p.course || []).length,
      exchangeTo: (p.exchangeToPlanIds || []).length, exchangeToPlanIds: p.exchangeToPlanIds,
      upgradationEnabled: p.upgradationEnabled, upgradationPrice: p.upgradationPrice, upgradationPlanIds: p.upgradationPlanIds,
      heldByStudent: planById.has(String(p._id)),
    });
  }

  const sourceForms = [...planIds, ...named.map(p => String(p._id))].flatMap(id => [id, new mongoose.Types.ObjectId(id)]);
  const targets = await Plans.find({ upgradationPlanIds: { $in: sourceForms } }).select(`${PLAN_OFFER_FIELDS} name`).lean();
  const offers = await resolvePlanOffersForUser(targets, USER_ID, { now });
  console.log(`\n== upgrade targets naming the student's plans or the matched plans as a source: ${targets.length}`);
  for (const t of targets) {
    log(`target ${t._id}`, {
      name: t.name, status: t.status, amount: t.amount, duration: t.duration, enabled: t.upgradationEnabled, price: t.upgradationPrice,
      sources: t.upgradationPlanIds, offerForStudent: offers.get(String(t._id)) ?? null,
    });
  }

  const ids = [...new Set([USER_ID, user.user_id ? String(user.user_id) : ""].filter(Boolean))];
  const cards = await loadPlanCards(ids, USER_ID, {});
  console.log(`\n== My plans cards: ${cards.length}`);
  for (const c of cards) {
    log(`card ${c.planId ?? ""}`, {
      name: c.name, expiresAt: c.expiresAt,
      extendOffers: (c.extendOffers || []).map(o => ({ name: o.name, price: o.price })),
      upgradeOffers: (c.upgradeOffers || []).map(o => ({ name: o.name, price: o.price, planId: o.planId })),
    });
  }
  await mongoose.disconnect();
})().catch(e => { console.error(e); process.exit(1); });
