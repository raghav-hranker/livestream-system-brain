#!/usr/bin/env node
// Local-only API check for the Course Builder Playground (course-playground task 07, 2026-10-28), after
// vidyagram-playground-e2e-seed.cjs and one admin click-through that created a course titled $TITLE.
// Refuses a non-localhost URL. Writes LOCAL Mongo only: two students tagged e2eSeed, one revision tag on the
// created course, free build grants, and one more course created through the API (left off sale).
//
//   NODE_PATH=~/Projects/worktrees/vg-backend/node_modules JWT_SECRET=<local backend secret> \
//   TITLE='SSC Maths + Polity Builder (local test)' node vidyagram-playground-e2e-check.mjs http://localhost:5933 <seed out.json> mongodb://127.0.0.1:27033/
//
// Playback answers 403 when access is refused; any other status (404 no HLS asset locally, 425, 200) means allowed.
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(process.env.NODE_PATH + '/');
const jwt = require('jsonwebtoken');
const { MongoClient, ObjectId } = require('mongoose').mongo;

const [base, seedFile, mongoUri] = process.argv.slice(2);
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base || '')) { console.error(`refusing: ${base} is not local`); process.exit(1); }
if (!/^mongodb:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(mongoUri || '')) { console.error(`refusing: ${mongoUri} is not local`); process.exit(1); }
const seed = JSON.parse(fs.readFileSync(seedFile, 'utf8'));
const TITLE = process.env.TITLE;

let pass = 0, fail = 0;
const check = (ok, name, detail = '') => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : `  (${detail})`}`); };
const call = async (method, path, token, body) => {
  const res = await fetch(base + '/api' + path, { method, headers: { 'content-type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  let json = null; try { json = await res.json(); } catch {}
  return { status: res.status, json };
};

const login = await call('POST', '/admins/login', null, { email: seed.admin.email, password: seed.admin.password });
const admin = login.json?.data?.token;
check(!!admin, 'admin login', `HTTP ${login.status}`);

const client = await MongoClient.connect(mongoUri, { directConnection: true });
const db = client.db('vidyagramdb');
const course = await db.collection('courses').findOne({ title: TITLE });
check(!!course, `created course "${TITLE}" exists`);
const courseId = String(course._id);
check(course.status === 0, 'created off sale (status 0)', `status ${course.status}`);

const settings = (await call('GET', `/admin/courses/${courseId}/builder`, admin)).json?.data?.builder;
check(settings?.enabled === true, 'builder enabled');
check(settings?.extras?.revision?.offered === true && settings.extras.revision.value === 150, 'Revision extra saved (shown, ₹150)', JSON.stringify(settings?.extras?.revision));
check(settings?.extras?.tests?.offered === false, 'Tests hidden');
check(Math.abs(settings.chapters.reduce((s, c) => s + c.weight, 0) - 100) < 1e-9, 'chapter weights sum to 100');

const studentData = (await call('GET', `/courses/${courseId}/builder`, seed.student.token)).json?.data;
const extraKeys = JSON.stringify(studentData?.builder?.extras ?? studentData?.extras ?? {});
check(!/tests/i.test(extraKeys) && /revision/i.test(extraKeys) && /notes/i.test(extraKeys), 'student builder data shows Notes and Revision, not Tests', extraKeys.slice(0, 200));

// One chapter, one ordinary and one revision class in it.
const chapter = String(settings.chapters[0].topicId);
const placements = await db.collection('courseclasses').find({ course: course._id, topic: new ObjectId(chapter), isActive: true }).sort({ priority: 1 }).limit(2).toArray();
check(placements.length === 2, 'chapter has two classes to test with');
const [plain, rev] = placements;
const tag = await call('PUT', `/admin/courses/${courseId}/placements/revision`, admin, { placementIds: [String(rev._id)], isRevision: true });
check(tag.status === 200, 'tag one class as revision', `HTTP ${tag.status}`);

const student = async (name) => {
  const _id = new ObjectId();
  await db.collection('users').insertOne({ _id, first_name: name, last_name: 'E2E', mobile: `8${String(Date.now()).slice(-9)}${Math.floor(Math.random() * 9)}`.slice(0, 10), customer_id: 781, e2eSeed: true });
  return { id: String(_id), token: jwt.sign({ user_id: String(_id), customer_id: 781 }, process.env.JWT_SECRET, { expiresIn: '1d' }) };
};
// Builds are only granted on a course that is on sale: switch it on the way the course list does (a toggle).
const toggled = await call('PUT', `/courses/${courseId}/status`, admin);
const onSale = await db.collection('courses').findOne({ _id: course._id });
check(toggled.status === 200 && onSale.status === 1, 'admin puts the course on sale', `HTTP ${toggled.status} status ${onSale.status}`);
const grant = (user, picks) => call('POST', '/orders/build-grant', admin, { userId: user.id, courseId, topicIds: [chapter], extrasOn: [], ...picks });
const play = async (user, classId) => (await call('GET', `/classes/${classId}/playback`, user.token)).status;

const a = await student('NoRevision');
const ga = await grant(a, { extrasOn: ['notes'] });
check(ga.status === 200 || ga.status === 201, 'grant a build without Revision', `HTTP ${ga.status} ${ga.json?.msg ?? ga.json?.message ?? ''}`);
const order = await db.collection('orders').findOne({ userId: a.id, 'build.courseId': { $exists: true } }, { sort: { _id: -1 } });
check(order?.build?.rules === 2, 'new build order carries build.rules 2', JSON.stringify(order?.build ?? null).slice(0, 160));
check((await play(a, plain.class)) !== 403, 'without Revision: ordinary class opens');
check((await play(a, rev.class)) === 403, 'without Revision: revision class refused');

const b = await student('WithRevision');
const gb = await grant(b, { extrasOn: ['notes', 'revision'] });
check(gb.status === 200 || gb.status === 201, 'grant a build with Revision', `HTTP ${gb.status} ${gb.json?.msg ?? gb.json?.message ?? ''}`);
check((await play(b, plain.class)) !== 403, 'with Revision: ordinary class opens');
check((await play(b, rev.class)) !== 403, 'with Revision: revision class opens');

const c = await student('Refused');
const ro = await grant(c, { revisionOnly: true });
check(ro.status === 400, 'Revision only refused (400)', `HTTP ${ro.status}`);
const hidden = await grant(c, { extrasOn: ['tests'] });
check(hidden.status === 400, 'hidden Tests extra cannot be granted (400)', `HTTP ${hidden.status}`);
check((await play(c, plain.class)) === 403, 'refused grants opened nothing');

// Create over real HTTP: two classes from one source course, renamed nothing, off sale.
const src = await db.collection('courseclasses').find({ course: { $ne: course._id }, isActive: true, status: { $ne: 0 }, topic: { $ne: null } }).limit(50).toArray();
const outline = (await call('GET', `/admin/course-playground/sources/${src[0].course}/outline`, admin)).json?.data;
const sec = outline.sections.find((s) => s.id && s.topics.some((t) => t.id && t.subtopics.some((x) => x.items.some((i) => i.kind === 'class'))));
const top = sec.topics.find((t) => t.id && t.subtopics.some((x) => x.items.some((i) => i.kind === 'class')));
const sub = top.subtopics.find((x) => x.items.some((i) => i.kind === 'class'));
const body = {
  details: { title: `API create check ${Date.now()}`, mainCategory: String(course.mainCategory), category: String(course.category), isLive: false, isRecorded: true, faculties: [], validity: '12 Months' },
  outline: [{ name: sec.name, sourceId: sec.id, topics: [{ name: top.name, sourceId: top.id, subtopics: [{ name: sub.name, ...(sub.id ? { sourceId: sub.id } : {}), items: sub.items.filter((i) => i.kind === 'class').slice(0, 2).map((i) => ({ kind: i.kind, id: i.id, sourceCourseId: String(src[0].course) })) }] }] }],
  builder: { minPrice: 99, maxPrice: 499, mrp: 999, chapters: [{ sectionIndex: 0, topicIndex: 0, weight: 100 }], extras: { notes: { offered: true, value: 50, defaultOn: true }, tests: { offered: false, value: 0, defaultOn: false }, revision: { offered: false, value: 0, defaultOn: false } } },
  status: 0,
};
const created = await call('POST', '/admin/course-playground/courses', admin, body);
check(created.status === 201 && !!created.json?.data?.courseId, 'create over HTTP returns 201', `HTTP ${created.status} ${created.json?.msg ?? ''} ${created.json?.path ?? ''}`);
if (created.json?.data?.courseId) {
  const doc = await db.collection('courses').findOne({ _id: new ObjectId(created.json.data.courseId) });
  check(doc.discountPrice === 499 && doc.price === 999, 'listing price: discountPrice = max, price = MRP', `discountPrice ${doc.discountPrice} price ${doc.price}`);
  const n = await db.collection('courseclasses').countDocuments({ course: doc._id });
  check(n === Math.min(2, sub.items.filter((i) => i.kind === 'class').length), 'API-created course has its classes placed', `${n}`);
  const again = await call('POST', '/admin/course-playground/courses', admin, body);
  check(again.status === 400, 'same title again is refused (400)', `HTTP ${again.status}`);
}
const studentCreate = await call('POST', '/admin/course-playground/courses', seed.student.token, body);
check(studentCreate.status === 401 || studentCreate.status === 403, 'student token refused on create', `HTTP ${studentCreate.status}`);

await client.close();
console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
