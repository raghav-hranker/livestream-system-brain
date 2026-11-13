// vidyagram-builder-v2-local-check.mjs <local base url> <local mongo uri> <backend .env.localpreview>
//
// LOCAL ONLY (refuses non-localhost URLs). Course Builder task 14 check: eBooks extra, validity tiers,
// Revision only paused, against a local backend on a scratch copy of Vidyagram courses (docker
// vgplay-e2e-mongo :27033). Opens a throwaway AdminSession for the first active admin, saves eBooks +
// validity on one builder course, reads the app's builder GET, quotes each tier, refuses bad saves,
// grants a 6-month build to a local user and reads the order's duration/expiry. Restores the course's
// builder settings and deletes the session and the granted order at the end.
//
// Run from a Vidyagram backend checkout (needs its node_modules for mongoose + jsonwebtoken):
//   cd ~/Projects/worktrees/vg-bldv2-backend && node <this> http://localhost:5934 \
//     "mongodb://127.0.0.1:27033/vidyagramdb?directConnection=true" .env.localpreview
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const require = createRequire(process.cwd() + '/package.json');
const { MongoClient } = require('mongoose').mongo; // mongodb is not a direct dependency
const jwt = require('jsonwebtoken');

const [base, mongoUri, envFile] = process.argv.slice(2);
if (!base || !mongoUri || !envFile) { console.error('usage: <base url> <mongo uri> <env file>'); process.exit(2); }
for (const url of [base, mongoUri]) {
  if (!/^(http|mongodb):\/\/(127\.0\.0\.1|localhost)[:/]/.test(url)) { console.error(`refusing non-local ${url}`); process.exit(2); }
}
const secret = readFileSync(envFile, 'utf8').match(/^JWT_SECRET=(.*)$/m)?.[1]?.replace(/^"|"$/g, '');
if (!secret) { console.error('no JWT_SECRET in env file'); process.exit(2); }

let pass = 0, fail = 0;
const check = (ok, name, detail = '') => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`); };
const call = async (method, path, token, body) => {
  const res = await fetch(base + '/api' + path, { method, headers: { 'content-type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  let json = null; try { json = await res.json(); } catch {}
  return { status: res.status, json };
};

const client = await MongoClient.connect(mongoUri);
const db = client.db('vidyagramdb');
const admin = await db.collection('admins').findOne({ status: 1 });
const course = await db.collection('courses').findOne({ 'builder.enabled': true }, { sort: { _id: 1 } });
const user = await db.collection('users').findOne({});
const sessionId = randomUUID();
const now = new Date();
await db.collection('adminsessions').insertOne({ sessionId, adminId: admin._id, ip: null, browser: 'builder-v2-check', createdAt: now, lastSeenAt: now, endedAt: null, endReason: null });
const token = jwt.sign({ admin_id: String(admin._id), session_id: sessionId, role: admin.role ?? 'admin' }, secret, { expiresIn: '1h' });
const savedBuilder = course.builder;
let grantedOrderId = null;
const id = String(course._id);
console.log(`course ${id} "${course.title}", admin ${admin._id}, user ${user._id}`);

try {
  const got = await call('GET', `/admin/courses/${id}/builder`, token);
  check(got.status === 200, 'admin settings GET', `HTTP ${got.status}`);
  const settings = got.json?.data?.builder ?? got.json?.data;
  check(settings?.validity?.included === 'lifetime' || settings?.validity?.included, 'unsaved course reads a validity', JSON.stringify(settings?.validity));
  check(settings?.extras?.ebooks?.offered === false || settings?.extras?.ebooks, 'unsaved course reads an eBooks extra', JSON.stringify(settings?.extras?.ebooks));

  const min = settings.minPrice, max = settings.maxPrice;
  const body = {
    enabled: true, minPrice: min, maxPrice: max, mrp: settings.mrp ?? null,
    chapters: settings.chapters.map(({ topicId, weight, customPrice }) => ({ topicId: String(topicId), weight, customPrice: customPrice ?? null })),
    extras: {
      notes: { offered: true, value: 50, defaultOn: true },
      tests: { offered: true, value: 50, defaultOn: true },
      ebooks: { offered: true, value: 49, defaultOn: false },
    },
    revisionOnly: { offered: true, discount: 10 },
    validity: { included: '1y', options: [
      { key: '1m', offered: true, priceChange: -50 }, { key: '6m', offered: true, priceChange: -25 },
      { key: '1y', offered: true, priceChange: 0 }, { key: 'lifetime', offered: true, priceChange: 100 },
    ] },
  };
  const bad = await call('PUT', `/admin/courses/${id}/builder`, token, { ...body, validity: { included: '1y', options: [{ key: '1m', offered: true, priceChange: -min }, { key: '1y', offered: true, priceChange: 0 }] } });
  check(bad.status === 400, 'a tier taking off the whole minimum is refused', `${bad.status} ${bad.json?.msg ?? bad.json?.message}`);
  const bad2 = await call('PUT', `/admin/courses/${id}/builder`, token, { ...body, validity: { included: '1y', options: [{ key: '1y', offered: false, priceChange: 0 }] } });
  check(bad2.status === 400, 'an unoffered included tier is refused', `${bad2.status} ${bad2.json?.msg ?? bad2.json?.message}`);

  const put = await call('PUT', `/admin/courses/${id}/builder`, token, body);
  check(put.status === 200, 'save eBooks + validity', `${put.status} ${put.json?.msg ?? put.json?.message ?? ''}`);
  const stored = (await db.collection('courses').findOne({ _id: course._id })).builder;
  check(stored.extras?.ebooks?.value === 49 && stored.validity?.included === '1y', 'stored eBooks and validity', JSON.stringify({ ebooks: stored.extras?.ebooks, validity: stored.validity }));
  check(stored.revisionOnly?.offered === false, 'Revision only stored off while paused');

  const app = await call('GET', `/courses/${id}/builder`);
  const d = app.json?.data;
  check(app.status === 200, 'app builder GET', `HTTP ${app.status}`);
  check(d?.extras?.ebooks?.offered === true && d.extras.ebooks.value === 49, 'app sees eBooks ₹49');
  check(d?.revisionOnly?.offered === false, 'app sees Revision only off');
  check(d?.validityDays === 365, 'app validityDays = 365', String(d?.validityDays));
  console.log('     app validity menu:', (d?.validity?.options ?? []).map((o) => `${o.label} · ${o.priceChange === 0 ? 'Included' : (o.priceChange < 0 ? '−' : '+') + '₹' + Math.abs(o.priceChange)}`).join(' | '));
  check((d?.validity?.options ?? []).map((o) => o.key).join() === '1m,6m,1y,lifetime', 'offered tiers only, in order');

  const topics = body.chapters.slice(0, 3).map((c) => c.topicId);
  const quote = async (validity, extrasOn = ['notes', 'tests']) => (await call('POST', `/admin/courses/${id}/builder/quote`, token, { settings: body, picks: { topicIds: topics, extrasOn, revisionOnly: false, ...(validity ? { validity } : {}) } })).json?.data?.price;
  const q1y = await quote(null), q1m = await quote('1m'), qLife = await quote('lifetime'), qEb = await quote(null, ['notes', 'tests', 'ebooks']);
  console.log(`     quotes for 3 chapters: 1y ₹${q1y?.final}  1m ₹${q1m?.final}  lifetime ₹${qLife?.final}  1y+eBooks ₹${qEb?.final}  (min ₹${min}, atMinimum ${q1y?.atMinimum})`);
  check(q1y?.validity?.key === '1y', 'no validity pick = included tier');
  check(q1m?.final === Math.max(q1y?.final - 50, min) && qLife?.final === q1y?.final + 100, '1 month −₹50 but never below the minimum, lifetime +₹100');
  check(q1y?.atMinimum ? qEb?.final === q1y?.final : qEb?.final >= q1y?.final, 'eBooks on never lowers the price');

  const rev = await call('POST', `/admin/courses/${id}/builder/quote`, token, { settings: body, picks: { topicIds: topics, extrasOn: [], revisionOnly: true } });
  check(rev.status === 400, 'Revision only quote refused while paused', `${rev.status} ${rev.json?.msg ?? rev.json?.message}`);

  const grant = await call('POST', '/orders/build-grant', token, { userId: String(user._id), courseId: id, topicIds: topics, extrasOn: ['notes', 'ebooks'], revisionOnly: false, validity: '6m', remarks: 'builder-v2 local check' });
  check(grant.status === 201 || grant.status === 200, 'grant a 6-month build', `${grant.status} ${grant.json?.msg ?? grant.json?.message ?? ''}`);
  const order = await db.collection('orders').findOne({ userId: { $in: [String(user._id), user._id] }, 'build.courseId': course._id }, { sort: { _id: -1 } });
  grantedOrderId = order?._id;
  const days = order?.expireDate ? Math.round((new Date(order.expireDate) - Date.now()) / 86400000) : null;
  check(order?.duration === 180 && days === 180, 'order duration 180 and expires in 180 days', `duration ${order?.duration}, expires in ${days} d`);
  check(order?.build?.rules === 2 && order?.build?.validity?.key === '6m' && order?.build?.extrasOn?.includes('ebooks'), 'snapshot has rules 2, 6m, ebooks', JSON.stringify({ rules: order?.build?.rules, validity: order?.build?.validity, extrasOn: order?.build?.extrasOn }));
} finally {
  await db.collection('courses').updateOne({ _id: course._id }, savedBuilder ? { $set: { builder: savedBuilder } } : { $unset: { builder: '' } });
  if (grantedOrderId) await db.collection('orders').deleteOne({ _id: grantedOrderId });
  await db.collection('adminsessions').deleteOne({ sessionId });
  await client.close();
}
console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
