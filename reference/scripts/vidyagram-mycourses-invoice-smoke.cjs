// Read-only smoke check for Vidyagram My courses invoice links (invoiceDownloadUrl = the stored public PDF).
// Run on webserver2-2 from the Vidyagram checkout: `node - < vidyagram-mycourses-invoice-smoke.cjs`.
// Mints an admin and a student token in memory (never printed), calls the live API on :4100, and checks:
//   1. own-checkout buyers: each card's link equals the order's stored invoiceUrl, and the link serves a PDF;
//   2. the student's own token gets the same links;
//   3. an AppX buyer gets no links; no token gets no links.
// Side effect by design: a paid own-checkout order with no stored PDF gets one made by the my-courses call.
require('dotenv').config({ path: '.env.development' });
const mongoose = require('mongoose');
const { UserAuthService } = require('./dist/src/services/userAuthService');

const API = process.env.SMOKE_API || 'http://127.0.0.1:4100/api';
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`); };

const myCourses = async (userId, token) => {
  const res = await fetch(`${API}/courses/my-courses`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ userId }),
  });
  const body = await res.json();
  const cards = (body.data || []).flatMap(g => [...(g.liveCourses || []), ...(g.recordedCourses || [])]);
  return { status: res.status, cards };
};

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  if (db.databaseName !== 'vidyagramdb') throw new Error(`refusing: connected to ${db.databaseName}`);
  const Orders = db.collection('orders');

  const ownPaid = { orderStatus: 'success', grandTotal: { $gt: 0 }, gateway: 'razorpay', orderNumber: { $not: /^APX-/ }, status: { $ne: 0 } };
  const buyers = await Orders.distinct('userId', ownPaid);
  console.log(`own-checkout paid buyers: ${buyers.length}`);
  const admin = UserAuthService.generateToken({ admin_id: new mongoose.Types.ObjectId(), role: 'admin' });

  let links = 0;
  for (const userId of buyers.slice(0, 5)) {
    const { status, cards } = await myCourses(String(userId), admin);
    const linked = cards.filter(c => c.invoiceDownloadUrl);
    links += linked.length;
    let match = true;
    for (const card of linked) {
      const order = await Orders.findOne({ _id: new mongoose.Types.ObjectId(card.invoiceId) }, { projection: { invoiceUrl: 1 } });
      if (order?.invoiceUrl !== card.invoiceDownloadUrl) match = false;
    }
    check(`admin token, buyer …${String(userId).slice(-4)}: links = stored invoiceUrl`, status === 200 && match, `${linked.length}/${cards.length} cards linked`);
    if (linked[0]) {
      const pdf = await fetch(linked[0].invoiceDownloadUrl);
      const type = pdf.headers.get('content-type') || '';
      const head = Buffer.from(await pdf.arrayBuffer()).subarray(0, 5).toString();
      check(`  link serves a PDF`, pdf.status === 200 && head === '%PDF-', `${pdf.status} ${type}`);
    }
  }
  check('at least one card carries a link', links > 0, `${links} links`);

  if (buyers[0]) {
    const studentToken = UserAuthService.generateToken({ user_id: String(buyers[0]) });
    const [asAdmin, asStudent, anonymous] = await Promise.all([
      myCourses(String(buyers[0]), admin), myCourses(String(buyers[0]), studentToken), myCourses(String(buyers[0])),
    ]);
    const pick = r => r.cards.map(c => [c.id, c.invoiceDownloadUrl]).sort().join('|');
    check('student token gets the same links as admin', pick(asAdmin) === pick(asStudent));
    check('no token gets no ids and no links', anonymous.cards.every(c => c.invoiceId === null && c.invoiceDownloadUrl === null), `${anonymous.cards.length} cards`);
  }

  const apxBuyer = (await Orders.find({ orderNumber: /^APX-/, orderStatus: 'success', grandTotal: { $gt: 0 } }, { projection: { userId: 1 } }).limit(1).toArray())[0];
  if (apxBuyer) {
    const { cards } = await myCourses(String(apxBuyer.userId), admin);
    const apxLinked = [];
    for (const card of cards.filter(c => c.invoiceDownloadUrl)) {
      const order = await Orders.findOne({ _id: new mongoose.Types.ObjectId(card.invoiceId) }, { projection: { orderNumber: 1 } });
      if (/^APX-/.test(order?.orderNumber || '')) apxLinked.push(card.invoiceId);
    }
    check('AppX orders get no link', apxLinked.length === 0, `${cards.length} cards`);
  }

  console.log(`${results.filter(Boolean).length}/${results.length} PASS`);
  await mongoose.disconnect();
  process.exit(results.every(Boolean) ? 0 : 1);
})().catch(e => { console.error(e.message); process.exit(2); });
