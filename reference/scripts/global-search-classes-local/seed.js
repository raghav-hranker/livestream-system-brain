// Local fixtures for the global-search-classes Postman collection (tasks 01–03).
// mongosh "mongodb://127.0.0.1:27027/qt_gsearch_test?directConnection=true" seed.js
//
// Idempotent: deletes and re-inserts only the fixture ids below. Dates are relative to "now".
// Refuses to run against anything but localhost / qt_gsearch_test. Restart the servers after
// seeding (run-servers.sh restarts them) — the title-spelling vocabulary is cached for 5 min.

const uri = db.getMongo().getURI();
const hosts = uri.replace(/^mongodb(\+srv)?:\/\/([^@]*@)?/, '').split(/[/?]/)[0].split(',');
if (!hosts.every(h => /^(127\.0\.0\.1|localhost)(:\d+)?$/.test(h))) {
  throw new Error(`refusing to seed non-local host(s): ${hosts.join(',')}`);
}
if (db.getName() !== 'qt_gsearch_test') throw new Error(`refusing to seed db ${db.getName()}`);

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();
const at = (days) => new Date(now + days * DAY);
const oid = (hex) => ObjectId(hex);

// ── ids (build-postman.cjs mirrors these) ────────────────────────────────────
const C = {
  A:     'd1e000000000000000000001', // active, priority 10
  B:     'd1e000000000000000000002', // active, priority 5
  FREE:  'd1e000000000000000000003', // active, Course.isFree
  OLD:   'd1e000000000000000000004', // INACTIVE (status 0) — attaches only for a buyer
  PLANC: 'd1e000000000000000000005', // active, priority 7, granted by the active plan
  DEADC: 'd1e000000000000000000006', // active, but MULTI's placement in it is deactivated
};
const K = {
  MULTI:        'd2e000000000000000000001', // A, B, PLANC, OLD + deactivated DEADC
  MIXREV:       'd2e000000000000000000002', // starts with "Mixture and Allegation" (older)
  PL_FREECLASS: 'd2e000000000000000000003', // Class.isFree
  PL_FREEPLACE: 'd2e000000000000000000004', // placement isFree in B
  TW_FREECOURSE:'d2e000000000000000000005', // only in the free course
  TW_INACTIVE:  'd2e000000000000000000006', // Class.status 0 — never shown
  NS_OLDONLY:   'd2e000000000000000000007', // only in the inactive OLD course
  NS_ORPHAN:    'd2e000000000000000000008', // no placement — never shown
  PTITLE:       'd2e000000000000000000009', // own title "Internal Asset 7781"; placement titles differ
  ALG_LIVE:     'd2e00000000000000000000a',
  ALG_UPCOMING: 'd2e00000000000000000000b',
  ALG_PROC:     'd2e00000000000000000000c',
  ALG_REC:      'd2e00000000000000000000d',
  ALG_YT:       'd2e00000000000000000000e',
  RATIO2:       'd2e00000000000000000000f',
  RATIO12:      'd2e000000000000000000010',
};
const PLAN = {
  ACTIVE:   'd6e000000000000000000001', // status 1 → PLANC
  INACTIVE: 'd6e000000000000000000002', // status 0 → B (grants nothing)
};
const U = {
  STRANGER:      'd4e000000000000000000001', // no orders
  BUYER_A:       'd4e000000000000000000002', // courseId [A]
  OLD:           'd4e000000000000000000003', // courseId [OLD] (inactive course)
  PLAN:          'd4e000000000000000000004', // planId ACTIVE → PLANC
  INACTIVE_PLAN: 'd4e000000000000000000005', // planId INACTIVE → nothing
  LATEST:        'd4e000000000000000000006', // latestCourseId ["B"]
  EXPIRED:       'd4e000000000000000000007', // courseId [OLD], accessUntil 5 days ago
};

// ── wipe fixtures ────────────────────────────────────────────────────────────
db.courses.deleteMany({ _id: { $in: Object.values(C).map(oid) } });
db.classes.deleteMany({ _id: { $in: Object.values(K).map(oid) } });
db.courseclasses.deleteMany({ class: { $in: Object.values(K).map(oid) } });
db.plans.deleteMany({ _id: { $in: Object.values(PLAN).map(oid) } });
db.orders.deleteMany({ userId: { $in: Object.values(U) } });

// ── courses ──────────────────────────────────────────────────────────────────
const course = (id, title, extra) => ({
  _id: oid(id), title, shortDescription: `${title} — local fixture`, banner: `https://img.local/${id}.png`,
  status: 1, priority: 50, price: 999, discountPrice: 999, isFree: false, isLive: true, isRecorded: false,
  createdAt: at(-30), updatedAt: at(-30), ...extra,
});
db.courses.insertMany([
  course(C.A, 'GS Prime Batch A', { priority: 10, price: 999 }),
  course(C.B, 'GS Prime Batch B', { priority: 5, price: 1499 }),
  course(C.FREE, 'GS Free Foundation', { priority: 20, price: 0, isFree: true }),
  course(C.OLD, 'GS Old Batch 2025', { priority: 1, price: 799, status: 0 }),
  course(C.PLANC, 'GS Plan Course', { priority: 7, price: 1999 }),
  course(C.DEADC, 'GS Deactivated Placement Course', { priority: 1 }),
]);

// ── classes ──────────────────────────────────────────────────────────────────
const TAX = oid('d9e000000000000000000001');
const cls = (id, title, createdDaysAgo, extra) => ({
  _id: oid(id), title, teacherName: 'Sahil Sir', status: 1, isFree: false, isLive: false, isChat: false,
  isShort: false, isTopper: false, isPrivate: false, priority: 0, image: `https://img.local/${id}.png`,
  mainCategory: TAX, category: TAX, section: TAX, seriesIds: [], pdfIds: [], viewCount: 0, uniqueViewCount: 0,
  createdAt: at(-createdDaysAgo), updatedAt: at(-createdDaysAgo), ...extra,
});
db.classes.insertMany([
  cls(K.MULTI, 'Class - 44 || Mixture and Allegation Part -2', 10, { duration: 3600, streamStatus: 'ended',
    hlsAsset: { bucket: 'recorded', key: 'gs/multi/master.m3u8' } }),
  cls(K.MIXREV, 'Mixture and Allegation Revision', 20),
  cls(K.PL_FREECLASS, 'Profit and Loss Basics', 5, { isFree: true }),
  cls(K.PL_FREEPLACE, 'Profit and Loss Advanced', 5),
  cls(K.TW_FREECOURSE, 'Time and Work Shortcuts', 5),
  cls(K.TW_INACTIVE, 'Time and Work Retired Lecture', 5, { status: 0 }),
  cls(K.NS_OLDONLY, 'Number System Old Batch Lecture', 5),
  cls(K.NS_ORPHAN, 'Number System Orphan Lecture', 5),
  cls(K.PTITLE, 'Internal Asset 7781', 5),
  cls(K.ALG_LIVE, 'Algebra Live Session', 1, { streamStatus: 'live', isLive: true }),
  cls(K.ALG_UPCOMING, 'Algebra Upcoming Session', 2),
  cls(K.ALG_PROC, 'Algebra Processing Session', 3, { streamStatus: 'processing' }),
  cls(K.ALG_REC, 'Algebra Recorded Session', 4, { streamStatus: 'ended', duration: 3600,
    hlsAsset: { bucket: 'recorded', key: 'gs/alg-rec/master.m3u8' } }),
  cls(K.ALG_YT, 'Algebra YouTube Class', 6, { link: 'https://youtu.be/gsLocalFixture' }),
  cls(K.RATIO2, 'Class - 2 || Ratio Basics', 5),
  cls(K.RATIO12, 'Class - 12 || Ratio Advanced', 5),
]);

// ── placements (course ↔ class) ──────────────────────────────────────────────
let prio = 1;
const place = (classId, courseId, extra) => ({
  course: oid(courseId), class: oid(classId), priority: prio++, isActive: true, status: 1, isFree: false,
  addedAt: at(-10), createdAt: at(-10), updatedAt: at(-10), startDate: at(-10), endDate: at(-10 + 1 / 24),
  ...extra,
});
db.courseclasses.insertMany([
  place(K.MULTI, C.A),
  place(K.MULTI, C.B),
  place(K.MULTI, C.PLANC),
  place(K.MULTI, C.OLD),
  place(K.MULTI, C.DEADC, { isActive: false }),
  place(K.MIXREV, C.A),
  place(K.PL_FREECLASS, C.A),
  place(K.PL_FREEPLACE, C.B, { isFree: true }),
  place(K.TW_FREECOURSE, C.FREE),
  place(K.TW_INACTIVE, C.A),
  place(K.NS_OLDONLY, C.OLD),
  place(K.PTITLE, C.A, { title: 'Simplification Tricks Day 3' }),
  place(K.PTITLE, C.B, { apxTitle: 'Percentage Magic APX' }),
  place(K.ALG_LIVE, C.A),
  place(K.ALG_UPCOMING, C.A, { startDate: at(2), endDate: at(2 + 1 / 24) }),
  place(K.ALG_PROC, C.A),
  place(K.ALG_REC, C.A),
  place(K.ALG_YT, C.A),
  place(K.RATIO2, C.A),
  place(K.RATIO12, C.A),
]);

// ── plans + orders ───────────────────────────────────────────────────────────
db.plans.insertMany([
  { _id: oid(PLAN.ACTIVE), name: 'GS Active Plan', status: 1, course: [oid(C.PLANC)], amount: 1999 },
  { _id: oid(PLAN.INACTIVE), name: 'GS Inactive Plan', status: 0, course: [oid(C.B)], amount: 1499 },
]);
const order = (userId, extra) => ({
  userId, orderStatus: 'success', status: 1, customer_id: 472, courseId: [], latestCourseId: [],
  amount: 999, createdAt: at(-20), updatedAt: at(-20), accessUntil: at(300), ...extra,
});
db.orders.insertMany([
  order(U.BUYER_A, { courseId: [oid(C.A)] }),
  order(U.OLD, { courseId: [oid(C.OLD)] }),
  order(U.PLAN, { planId: PLAN.ACTIVE }),
  order(U.INACTIVE_PLAN, { planId: PLAN.INACTIVE }),
  order(U.LATEST, { latestCourseId: [C.B] }),
  order(U.EXPIRED, { courseId: [oid(C.OLD)], accessUntil: at(-5) }),
]);

print(`seeded ${db.courses.countDocuments({ _id: { $in: Object.values(C).map(oid) } })} courses, ` +
  `${db.classes.countDocuments({ _id: { $in: Object.values(K).map(oid) } })} classes, ` +
  `${db.courseclasses.countDocuments({ class: { $in: Object.values(K).map(oid) } })} placements, ` +
  `${db.orders.countDocuments({ userId: { $in: Object.values(U) } })} orders`);
