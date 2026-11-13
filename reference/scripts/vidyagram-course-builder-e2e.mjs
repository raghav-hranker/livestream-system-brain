// Course Builder end-to-end check against the LOCAL backend (:5914) and LOCAL Mongo (:27037) only.
// Pricing (admin quote + build checkout), access by HTTP for granted builds, and the student listings.
// Every document it adds is invented, tagged `e2eRun`, and removed at the end. --keep leaves them for a
// look in the admin; --clean removes every kept run and exits.
// Run: node e2e-builder.mjs <backend .env.localpreview> <admin.token> [--keep | --clean]
import { MongoClient, ObjectId } from '/Users/raghav/Projects/worktrees/vg-backend/node_modules/mongoose/node_modules/mongodb/lib/index.js';
import jwt from '/Users/raghav/Projects/worktrees/vg-builder-backend/node_modules/jsonwebtoken/index.js';
import fs from 'node:fs';

const API = 'http://localhost:5914/api';
const [envFile, adminTokenFile, ...flags] = process.argv.slice(2);
const keep = flags.includes('--keep');
const secret = fs.readFileSync(envFile, 'utf8').match(/^JWT_SECRET=(.*)$/m)[1];
const adminToken = fs.readFileSync(adminTokenFile, 'utf8').trim();
const client = await MongoClient.connect('mongodb://127.0.0.1:27037/?replicaSet=rs0');
const db = client.db('vidyagramdb');
const RUN = `e2e-builder-${Date.now()}`;
const added = { users: [], orders: [], classes: [], courseclasses: [], pdfs: [], coursepdfs: [], series: [], coursetests: [] };

const removeRuns = async (run) => {
  const userIds = (await db.collection('users').find({ e2eRun: run }).project({ _id: 1 }).toArray()).map((u) => String(u._id));
  await db.collection('orders').deleteMany({ userId: { $in: userIds } });
  await db.collection('razorpay_payment_logs').deleteMany({ userId: { $in: userIds } });
  for (const name of Object.keys(added)) await db.collection(name).deleteMany({ e2eRun: run });
  return userIds.length;
};
if (flags.includes('--clean')) {
  console.log(`removed ${await removeRuns(/^e2e-builder-/)} kept test users and everything they added`);
  await client.close();
  process.exit(0);
}

const course = await db.collection('courses').findOne({ 'builder.enabled': true });
const courseId = String(course._id);
const topicByName = new Map((await db.collection('topics').find().toArray()).map((t) => [t.topicName, t]));
const sectionByName = new Map((await db.collection('sections').find().toArray()).map((s) => [s.sectionName, s]));
const topicId = (name) => String(topicByName.get(name)._id);
const classId = async (title) => String((await db.collection('classes').findOne({ title }))._id);
const arithmetic = [...topicByName.values()].filter((t) => String(t.section) === String(sectionByName.get('Arithmetic Maths')._id)).map((t) => String(t._id));

const results = [];
const expect = (group, label, ok, detail) => results.push({ group, ok: Boolean(ok), line: `${ok ? 'PASS' : 'FAIL'}  [${group}] ${label}${detail !== undefined ? `  (${detail})` : ''}` });

const call = async (path, token, init = {}) => {
  const res = await fetch(API + path, { ...init, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.headers || {}) } });
  let body = null; try { body = await res.json(); } catch {}
  return { status: res.status, body };
};
const post = (path, token, body) => call(path, token, { method: 'POST', body: JSON.stringify(body) });
const insert = async (name, doc) => { const _id = new ObjectId(); await db.collection(name).insertOne({ _id, ...doc, e2eRun: RUN }); added[name].push(_id); return _id; };

const student = async (name) => {
  const _id = await insert('users', { name: `E2E ${name}`, mobile: `8${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`, status: 1, createdAt: new Date() });
  return { id: String(_id), token: jwt.sign({ user_id: String(_id) }, secret, { expiresIn: '1h' }) };
};
const grant = async (user, picks) => {
  const r = await post('/orders/build-grant', adminToken, { userId: user.id, courseId, topicIds: [], extrasOn: [], revisionOnly: false, ...picks });
  if (r.body?.data?.id) added.orders.push(new ObjectId(r.body.data.id));
  return r;
};
const play = async (token, id) => (await call(`/classes/${id}/playback`, token)).status;
const allowed = (s) => s !== 403 && s !== 401;

// ── 1. Pricing ─────────────────────────────────────────────────────────────────────────────
const settings = (await call(`/admin/courses/${courseId}/builder`, adminToken)).body.data.builder;
const settingsBody = {
  enabled: settings.enabled, minPrice: settings.minPrice, maxPrice: settings.maxPrice, mrp: settings.mrp ?? null,
  chapters: settings.chapters.map((c) => ({ topicId: String(c.topicId), weight: c.weight, customPrice: c.customPrice ?? null })),
  extras: settings.extras, revisionOnly: settings.revisionOnly,
};
const allChapters = settingsBody.chapters.map((c) => c.topicId);
const quote = async (picks, s = settingsBody) => (await post(`/admin/courses/${courseId}/builder/quote`, adminToken, { settings: s, picks })).body?.data?.price;

const buyer = await student('checkout buyer');
const checkoutPrice = async (picks, extra = {}) => {
  const r = await post('/orders/build-checkout', buyer.token, { courseId, ...picks, ...extra });
  const log = await db.collection('razorpay_payment_logs').find({ userId: buyer.id, title: /request sent/ }).sort({ _id: -1 }).limit(1).next();
  return { status: r.status, message: r.body?.message, amount: log ? log.payload.amount / 100 : null, logId: log?._id };
};

const cases = [
  ['whole course, Notes + Tests on', { topicIds: allChapters, extrasOn: ['notes', 'tests'], revisionOnly: false }, 799],
  ['whole course, Notes off', { topicIds: allChapters, extrasOn: ['tests'], revisionOnly: false }, 699],
  ['whole course, Tests off', { topicIds: allChapters, extrasOn: ['notes'], revisionOnly: false }, 649],
  ['whole course, both off', { topicIds: allChapters, extrasOn: [], revisionOnly: false }, 549],
  ['Arithmetic (51%) with Notes + Tests', { topicIds: arithmetic, extrasOn: ['notes', 'tests'], revisionOnly: false }, 407],
  ['Arithmetic, both off (157) floored', { topicIds: arithmetic, extrasOn: [], revisionOnly: false }, 199],
  ['Partnership (2%) alone floored', { topicIds: [topicId('Partnership')], extrasOn: ['notes', 'tests'], revisionOnly: false }, 199],
  ['Revision only, Notes + Tests on', { topicIds: [], extrasOn: ['notes', 'tests'], revisionOnly: true }, 449],
  ['Revision only, Notes off', { topicIds: [], extrasOn: ['tests'], revisionOnly: true }, 349],
  ['Revision only, both off (199) at the floor', { topicIds: [], extrasOn: [], revisionOnly: true }, 199],
];
let lastLog = null;
for (const [label, picks, want] of cases) {
  const q = await quote(picks);
  expect('pricing', `quote: ${label} = ₹${want}`, q?.final === want, `final ${q?.final}, atMinimum ${q?.atMinimum}`);
  const c = await checkoutPrice(picks, { grandTotal: 1, amount: 1 });
  const fresh = c.logId && String(c.logId) !== String(lastLog);
  lastLog = c.logId;
  expect('pricing', `checkout charges ₹${want} for ${label} (client amount 1 ignored)`, fresh && c.amount === want, `HTTP ${c.status}, Razorpay request amount ${c.amount}`);
}

const capSettings = { ...settingsBody, chapters: settingsBody.chapters.map((c, i) => (i < 2 ? { ...c, customPrice: 500 } : c)) };
const capPicks = { topicIds: allChapters.slice(0, 2), extrasOn: ['tests'], revisionOnly: false };
const cap = await quote(capPicks, capSettings);
expect('pricing', 'cap applies to chapters only: custom 500 + 500, Notes off = 799 − 100 = ₹699', cap?.final === 699 && cap?.capped === 799, `subtotal ${cap?.chaptersSubtotal}, capped ${cap?.capped}, final ${cap?.final}`);

const coupon = await post('/orders/build-checkout', buyer.token, { courseId, ...cases[0][1], couponCode: 'SAVE10' });
expect('pricing', 'coupon on a build is rejected', coupon.status === 400, `HTTP ${coupon.status} ${coupon.body?.message}`);
const anon = await post('/orders/build-checkout', null, { courseId, ...cases[0][1] });
expect('pricing', 'checkout without a token is rejected', anon.status === 401, `HTTP ${anon.status}`);
const foreign = await post('/orders/build-checkout', buyer.token, { courseId, topicIds: [String(new ObjectId())], extrasOn: [], revisionOnly: false });
expect('pricing', 'a topic outside the builder is rejected', foreign.status === 400, `HTTP ${foreign.status} ${foreign.body?.message}`);
const empty = await post('/orders/build-checkout', buyer.token, { courseId, topicIds: [], extrasOn: [], revisionOnly: false });
expect('pricing', 'an empty normal build is rejected', empty.status === 400, `HTTP ${empty.status} ${empty.body?.message}`);

await db.collection('courses').updateOne({ _id: course._id }, { $set: { status: 0 } });
try {
  const inactive = await post('/orders/build-checkout', buyer.token, { courseId, ...cases[0][1] });
  expect('pricing', 'inactive course (status 0) is rejected', inactive.status === 400, `HTTP ${inactive.status} ${inactive.body?.message}`);
} finally {
  await db.collection('courses').updateOne({ _id: course._id }, { $set: { status: course.status } });
}

const owner = await student('whole-course owner');
await insert('orders', { userId: owner.id, courseId: [course._id], orderStatus: 'success', status: 1, grandTotal: 799, orderDate: new Date(), expireDate: new Date(Date.now() + 365 * 864e5) });
const owned = await post('/orders/build-checkout', owner.token, { courseId, ...cases[4][1] });
expect('pricing', 'whole-course owner gets 409 at checkout', owned.status === 409, `HTTP ${owned.status} ${owned.body?.message}`);
const ownedGrant = await grant(owner, cases[4][1]);
expect('pricing', 'whole-course owner gets 409 at build-grant', ownedGrant.status === 409, `HTTP ${ownedGrant.status} ${ownedGrant.body?.message}`);

// ── 2. Access ─────────────────────────────────────────────────────────────────────────────
const section = (name) => sectionByName.get(name)._id;
const pdf = (title) => insert('pdfs', { title, uploadPdf: `https://example.invalid/${RUN}/${encodeURIComponent(title)}.pdf`, status: 1, isFree: false, createdAt: new Date() });
const pClassPercentage = await pdf('E2E Percentage class notes');
const pClassGeometry = await pdf('E2E Geometry class notes');
const pCoursePercentage = await pdf('E2E Percentage chapter PDF');
const pCourseGeometry = await pdf('E2E Geometry chapter PDF');

const lateClass = async (title, topic, sectionName, pdfIds) => {
  const id = await insert('classes', { title, topic: topicByName.get(topic)._id, section: section(sectionName), isFree: false, status: 1, pdfIds, createdAt: new Date() });
  await insert('courseclasses', { course: course._id, class: id, priority: 999, isActive: true, status: 1, isFree: false, createdAt: new Date() });
  return String(id);
};
const percentageLate = await lateClass('E2E Percentage · added after purchase', 'Percentage', 'Arithmetic Maths', [pClassPercentage]);
const geometryLate = await lateClass('E2E Geometry · with notes', 'Geometry', 'Advanced Maths', [pClassGeometry]);
await insert('coursepdfs', { course: course._id, pdf: pCoursePercentage, isActive: true, priority: 1, sectionName: 'Arithmetic Maths', topicName: 'Percentage', createdAt: new Date() });
await insert('coursepdfs', { course: course._id, pdf: pCourseGeometry, isActive: true, priority: 2, sectionName: 'Advanced Maths', topicName: 'Geometry', createdAt: new Date() });

const sTagged = await insert('series', { series_name: 'E2E Percentage test', is_free: false, status: 1, sectionId: section('Arithmetic Maths'), createdAt: new Date() });
const sUntagged = await insert('series', { series_name: 'E2E Advanced untagged test', is_free: false, status: 1, sectionId: section('Advanced Maths'), createdAt: new Date() });
await insert('coursetests', { course: course._id, test: sTagged, isActive: true, isFree: false, topic: topicByName.get('Percentage')._id, priority: 1, maxAttemptedLimit: 1, createdAt: new Date() });
await insert('coursetests', { course: course._id, test: sUntagged, isActive: true, isFree: false, priority: 2, maxAttemptedLimit: 1, createdAt: new Date() });

const A = await student('Percentage + Algebra, Notes');
const g = await grant(A, { topicIds: [topicId('Percentage'), topicId('Algebra')], extrasOn: ['notes'] });
expect('access', 'grant Percentage + Algebra with Notes', g.status === 201, `HTTP ${g.status} ${g.body?.message ?? ''}`);
const D = await student('Percentage, no extras');
await grant(D, { topicIds: [topicId('Percentage')], extrasOn: [] });
const E = await student('Percentage, Tests');
await grant(E, { topicIds: [topicId('Percentage')], extrasOn: ['tests'] });
const F = await student('Algebra, Tests');
await grant(F, { topicIds: [topicId('Algebra')], extrasOn: ['tests'] });
const B = await student('Revision only, Notes + Tests');
await grant(B, { revisionOnly: true, extrasOn: ['notes', 'tests'] });
const C = await student('no purchase');

const freePlacement = await db.collection('courseclasses').findOne({ course: course._id, isFree: true, e2eRun: { $exists: false } });
const revisionPlacement = await db.collection('courseclasses').findOne({ course: course._id, isRevision: true });

for (const [label, user, id, want] of [
  ['bought chapter class plays (Percentage · Class 2)', A, await classId('Percentage · Class 2'), true],
  ['bought chapter class plays (Algebra · Class 5)', A, await classId('Algebra · Class 5'), true],
  ['unbought chapter class refused (Geometry · Class 2)', A, await classId('Geometry · Class 2'), false],
  ['unbought chapter class refused (Number System · Class 3)', A, await classId('Number System · Class 3'), false],
  ['class added after purchase to a bought chapter plays', A, percentageLate, true],
  ['the same late class is refused to a non-buyer', C, percentageLate, false],
  ['free placement stays free for a non-buyer', C, String(freePlacement.class), true],
  ['free placement stays free for a partial buyer', D, String(freePlacement.class), true],
  ['Revision-only plays a tagged class', B, String(revisionPlacement.class), true],
  ['Revision-only refuses an untagged class (Number System · Class 3)', B, await classId('Number System · Class 3'), false],
  ['Revision-only refuses an untagged late class', B, percentageLate, false],
  ['no purchase refused', C, await classId('Percentage · Class 2'), false],
]) {
  const s = await play(user.token, id);
  expect('access', label, want ? allowed(s) : s === 403, `HTTP ${s}`);
}

const G = await student('deleted order');
const gDel = await grant(G, { topicIds: [topicId('Percentage')], extrasOn: ['notes'] });
const before = await play(G.token, await classId('Percentage · Class 2'));
await db.collection('orders').updateOne({ _id: new ObjectId(gDel.body.data.id) }, { $set: { status: 0 } });
const after = await play(G.token, await classId('Percentage · Class 2'));
expect('access', 'deleted (status 0) build order grants nothing', allowed(before) && after === 403, `before delete HTTP ${before}, after HTTP ${after}`);
const afterPdf = (await call(`/courses/${courseId}/pdfs/${pCoursePercentage}/access`, G.token)).status;
expect('access', 'deleted build order opens no chapter PDF', afterPdf === 403, `HTTP ${afterPdf}`);

const classPdf = async (user, cls, p) => (await call(`/classes/${cls}/pdfs/${p}/access`, user.token)).status;
const coursePdf = async (user, p) => (await call(`/courses/${courseId}/pdfs/${p}/access`, user.token)).status;
for (const [label, s, want] of [
  ['class notes open with Notes in a bought chapter', await classPdf(A, percentageLate, pClassPercentage), 200],
  ['class notes refused without Notes', await classPdf(D, percentageLate, pClassPercentage), 403],
  ['class notes refused in an unbought chapter', await classPdf(A, geometryLate, pClassGeometry), 403],
  ['chapter PDF opens with Notes in a bought chapter', await coursePdf(A, pCoursePercentage), 200],
  ['chapter PDF refused without Notes', await coursePdf(D, pCoursePercentage), 403],
  ['chapter PDF refused in an unbought chapter', await coursePdf(A, pCourseGeometry), 403],
  ['Revision-only with Notes opens a chapter PDF', await coursePdf(B, pCoursePercentage), 200],
  ['Revision-only refuses notes of an untagged class', await classPdf(B, percentageLate, pClassPercentage), 403],
  ['no purchase refused a chapter PDF', await coursePdf(C, pCoursePercentage), 403],
]) expect('access', label, s === want, `HTTP ${s}`);

const gate = async (user, series, { urlUser = user?.id, token = user?.token } = {}) => {
  const path = urlUser ? `/user-test/allow-user-test-course/${urlUser}/${series}/${courseId}` : `/user-test/allow-user-test-course/${series}/${courseId}`;
  return call(path, token);
};
const restrict = (r) => (r.status === 200 ? r.body?.restrict : `HTTP ${r.status}`);
for (const [label, r, want] of [
  ['tagged test opens with Tests + its chapter', await gate(E, sTagged), false],
  ['tagged test refused without Tests', await gate(D, sTagged), true],
  ['tagged test refused with Tests but another chapter', await gate(F, sTagged), true],
  ['untagged test opens with Tests + any chapter of its section', await gate(F, sUntagged), false],
  ['untagged test refused with Tests but no chapter of its section', await gate(E, sUntagged), true],
  ['Revision-only with Tests opens a tagged test', await gate(B, sTagged), false],
  ['whole-course owner opens a tagged test', await gate(owner, sTagged), false],
  ['token-only route answers for the token user', await gate(E, sTagged, { urlUser: null }), false],
]) expect('access', label, restrict(r) === want, `restrict ${restrict(r)}`);
const mismatch = await gate(D, sTagged, { urlUser: E.id, token: D.token });
expect('access', 'test gate refuses a URL userId that differs from the token user', mismatch.status === 403, `HTTP ${mismatch.status} ${mismatch.body?.message}`);
const noToken = await gate(null, sTagged, { urlUser: E.id, token: null });
expect('access', 'KNOWN OPEN: no token + a URL userId is still answered for that userId', noToken.status === 200 && noToken.body?.restrict === false, `HTTP ${noToken.status} restrict ${noToken.body?.restrict}`);

// ── 3. Listings ───────────────────────────────────────────────────────────────────────────
const findCourse = (node) => {
  if (!node || typeof node !== 'object') return null;
  if (String(node._id ?? node.id ?? '') === courseId && ('is_buy' in node || 'isPaid' in node)) return node;
  for (const value of Object.values(node)) { const hit = findCourse(value); if (hit) return hit; }
  return null;
};
const myCourse = async (user) => findCourse((await post('/courses/my-courses', null, { userId: user.id })).body?.data);
const detail = async (user) => findCourse((await post('/courses/by-id-2', null, { id: courseId, courseId, userId: user.id })).body);
const builderOwnership = async (user) => (await call(`/courses/${courseId}/builder`, user?.token)).body?.data?.ownership;
const sameSet = (a, b) => Array.isArray(a) && a.length === b.length && b.every((x) => a.includes(x));
const PARTIAL_KEYS = ['isPartial', 'ownedTopicIds', 'ownedExtras', 'revisionOnly', 'revisionTopicIds'];
const partialFields = (c) => (c ? JSON.stringify(Object.fromEntries(PARTIAL_KEYS.concat('is_buy').map((k) => [k, c[k]]))) : 'course not listed');

const aOwned = [topicId('Percentage'), topicId('Algebra')];
const isAPartial = (c) => c?.is_buy === 1 && c.isPartial === true && sameSet(c.ownedTopicIds, aOwned) && sameSet(c.ownedExtras, ['notes']) && c.revisionOnly === false && sameSet(c.revisionTopicIds, []);
const isBPartial = (c) => c?.is_buy === 1 && c.isPartial === true && sameSet(c.ownedTopicIds, allChapters) && sameSet(c.revisionTopicIds, allChapters) && c.revisionOnly === true && sameSet(c.ownedExtras, ['notes', 'tests']);
const noPartial = (c) => c && PARTIAL_KEYS.every((k) => !(k in c));

let c = await myCourse(A);
expect('listings', 'My Courses: build buyer sees the course with partial fields', isAPartial(c), partialFields(c));
c = await detail(A);
expect('listings', 'course detail (by-id-2): build buyer partial fields', isAPartial(c), partialFields(c));
c = await myCourse(B);
expect('listings', 'My Courses: Revision-only buyer has revisionOnly + every chapter as revision', isBPartial(c), partialFields(c));
c = await myCourse(owner);
expect('listings', 'My Courses: full owner unchanged (is_buy 1, no partial fields)', c?.is_buy === 1 && noPartial(c), partialFields(c));
c = await detail(owner);
expect('listings', 'course detail: full owner unchanged', c?.is_buy === 1 && noPartial(c), partialFields(c));
c = await myCourse(C);
expect('listings', 'My Courses: non-owner does not list the course', c === null, partialFields(c));
c = await detail(C);
expect('listings', 'course detail: non-owner is_buy 0, no partial fields', c?.is_buy === 0 && noPartial(c), partialFields(c));
c = await myCourse(G);
expect('listings', 'My Courses: deleted build order lists nothing', c === null, partialFields(c));

let o = await builderOwnership(A);
expect('listings', 'GET builder: build buyer ownership', o?.isPartial === true && o.ownsAll === false && sameSet(o.ownedTopicIds, aOwned) && sameSet(o.ownedExtras, ['notes']), JSON.stringify(o));
o = await builderOwnership(owner);
expect('listings', 'GET builder: full owner ownsAll', o?.ownsAll === true && o.isPartial === false, JSON.stringify(o && { ownsAll: o.ownsAll, isPartial: o.isPartial, n: o.ownedTopicIds?.length }));
o = await builderOwnership(C);
expect('listings', 'GET builder: non-owner owns nothing', o?.ownsAll === false && o.isPartial === false && o.ownedTopicIds?.length === 0, JSON.stringify(o));
o = await builderOwnership(null);
expect('listings', 'GET builder: signed out has no ownership block', o === undefined, JSON.stringify(o));

// ── cleanup ───────────────────────────────────────────────────────────────────────────────
if (!keep) await removeRuns(RUN);

for (const r of results) console.log(r.line);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed${keep ? `  (kept run ${RUN})` : ''}`);
await client.close();
process.exitCode = failed ? 1 : 0;
