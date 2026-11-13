// Generates the tasks 01–03 + 12 Postman collection (variables included) from one table of cases.
//   node build-postman.cjs   → writes into reference/postman/
// Edit the cases here, not the JSON.
const fs = require('fs');
const path = require('path');

const OUT = path.resolve(__dirname, '../../postman');
const NAME = 'automatic-plan-extension';

const ENV = {
  base_on: 'http://localhost:3106',
  base_off: 'http://localhost:3107',
  base_custom: 'http://localhost:3108',
  base_window: 'http://localhost:3109',
  plan_p: 'a0e000000000000000000001',
  plan_s: 'a0e000000000000000000002',
  plan_t1: 'a0e000000000000000000003',
  plan_t2: 'a0e000000000000000000004',
  plan_r: 'a0e000000000000000000005',
  plan_w: 'a0e000000000000000000006',
  plan_i: 'a0e000000000000000000007',
  user_lapsed: 'b0e000000000000000000001',
  user_active: 'b0e000000000000000000002',
  user_stranger: 'b0e000000000000000000003',
  user_renewed: 'b0e000000000000000000004',
  user_granted: 'b0e000000000000000000005',
  user_zero_paid: 'b0e000000000000000000006',
  user_round: 'b0e000000000000000000007',
  user_couponed: 'b0e000000000000000000008',
  user_prec: 'b0e000000000000000000009',
  user_retired: 'b0e00000000000000000000a',
  user_two_paid: 'b0e00000000000000000000b',
  user_in_window: 'b0e00000000000000000000c',
  user_far: 'b0e00000000000000000000d',
  user_iw_paid: 'b0e00000000000000000000e',
  user_iw_zero: 'b0e00000000000000000000f',
  order_lapsed: 'c0e000000000000000000001',
  order_renewed_ext: 'c0e000000000000000000005',
  order_prec_s: 'c0e00000000000000000000b',
  order_prec_t2: 'c0e00000000000000000000d',
  order_active_now: 'c0e000000000000000000003',
  order_in_window: 'c0e000000000000000000011',
  order_iw_paid: 'c0e000000000000000000013',
  coupon: 'WINBACK20',
};

// ── script snippets ──────────────────────────────────────────────────────────
const lines = (...ls) => ls.flat().filter(Boolean);

/** Assert one listing row. `find` = plan env key when the response is a list to search. */
const rowTests = (label, exp, find) => lines(
  `pm.test('${label}: 200', () => pm.response.to.have.status(200));`,
  `const data = pm.response.json().data || [];`,
  find
    ? `const row = data.find(p => p.id === pm.variables.get('${find}'));`
    : `const row = data[0];`,
  `pm.test('${label}: plan is listed', () => pm.expect(row, 'row').to.be.an('object'));`,
  `if (row) {`,
  ...Object.entries(exp).map(([k, v]) => v === undefined
    ? `  pm.test('${label}: ${k} absent', () => pm.expect(row.${k}).to.be.undefined);`
    : `  pm.test('${label}: ${k} = ${JSON.stringify(v)}', () => pm.expect(row.${k}).to.eql(${JSON.stringify(v)}));`),
  `}`,
);

// An extension card is titled "<plan title> : Extension" (both `title` and `name`); every other row keeps the plan's title.
const PLAN_P = 'AutoExt Plan P';
const EXT_TITLE = (plan) => ({ name: `${plan} : Extension`, title: `${plan} : Extension` });
const OFFER = (amount, duration = 183, plan = PLAN_P) => ({ amount: String(amount), duration, is_expire: 1, is_upgrade: 0, is_buy: 0, ...EXT_TITLE(plan) });
// Inside the Extension window the holder still holds the plan: is_buy stays 1 beside is_expire 1 (D12).
const WINDOW_OFFER = (amount, plan) => ({ ...OFFER(amount, 183, plan), is_buy: 1 });
const LIST = (amount, isBuy = 0, plan = PLAN_P) => ({ amount: String(amount), duration: 365, originalAmount: undefined, is_expire: 0, is_upgrade: 0, is_buy: isBuy, name: plan, title: plan });

/** The plan must NOT be in the response (subscriptionId ⇒ empty data; lists ⇒ no row with that id). */
const notListedTests = (label, find) => lines(
  `pm.test('${label}: 200', () => pm.response.to.have.status(200));`,
  `const data = pm.response.json().data || [];`,
  find
    ? `pm.test('${label}: plan not listed', () => pm.expect(data.find(p => p.id === pm.variables.get('${find}'))).to.be.undefined);`
    : `pm.test('${label}: nothing listed', () => pm.expect(data).to.have.length(0));`,
);

const req = (name, method, url, { body, tests = [], description } = {}) => ({
  name,
  request: {
    method,
    header: body ? [{ key: 'Content-Type', value: 'application/json' }] : [],
    url,
    ...(body ? { body: { mode: 'raw', raw: JSON.stringify(body, null, 2), options: { raw: { language: 'json' } } } } : {}),
    ...(description ? { description } : {}),
  },
  event: tests.length ? [{ listen: 'test', script: { type: 'text/javascript', exec: ['{', ...tests, '}'] } }] : [],
});
const folder = (name, item, description) => ({ name, item, ...(description ? { description } : {}) });

// listing helpers ───────────────────────────────────────────────────────────
const single = (base, name, user, plan, exp) => req(name, 'POST', `{{${base}}}/api/plans/filter-active/{{${user}}}`, {
  body: { subscriptionId: `{{${plan}}}` }, tests: rowTests(name, exp),
});
const filtered = (base, name, user, plan, exp) => req(name, 'POST', `{{${base}}}/api/plans/filter-active/{{${user}}}`, {
  body: {}, tests: rowTests(name, exp, plan),
});
const activeFor = (base, name, user, plan, exp) => req(name, 'GET', `{{${base}}}/api/plans/active/{{${user}}}`, {
  tests: rowTests(name, exp, plan),
});
const threeShapes = (base, who, user, plan, exp) => [
  single(base, `${who} — filter-active (subscriptionId)`, user, plan, exp),
  filtered(base, `${who} — filter-active (all)`, user, plan, exp),
  activeFor(base, `${who} — active/:userId`, user, plan, exp),
];

// checkout helpers ──────────────────────────────────────────────────────────
const PATHS = [
  ['app Razorpay', '/api/orders/get-razorpay-order'],
  ['website Razorpay', '/api/orders/get-website-razorpay-order'],
  ['payment link', '/api/orders/payment-link'],
];
const checkoutBody = (user, plan, grandTotal, extra = {}) => ({
  userId: `{{${user}}}`, planId: `{{${plan}}}`, grandTotal, type: 'subscription', duration: 365, ...extra,
});
const accepted = (name) => lines(
  `pm.test('${name}: 201', () => pm.response.to.have.status(201));`,
  `const d = pm.response.json().data || {};`,
  `pm.collectionVariables.set('last_rzp_ref', d.paymentLinkId || d.razorpayOrderId);`,
);
const rejected = (name, expected) => lines(
  `pm.test('${name}: 400', () => pm.response.to.have.status(400));`,
  `pm.test('${name}: message says expected ${expected}', () => pm.expect(pm.response.json().message).to.match(/expected ${expected}\\b/));`,
);
const closed = (name) => lines(
  `pm.test('${name}: 403', () => pm.response.to.have.status(403));`,
);
const checkout = (base, name, apiPath, user, plan, total, tests, extra) =>
  req(name, 'POST', `{{${base}}}${apiPath}`, { body: checkoutBody(user, plan, total, extra), tests });

/** Reads back the order the previous checkout created. `exp` values may be `{{var}}` refs. */
const verifyOrder = (base, name, exp) => req(name, 'GET', `{{${base}}}/api/orders/by-razorpay/{{last_rzp_ref}}`, {
  tests: lines(
    `pm.test('${name}: 200', () => pm.response.to.have.status(200));`,
    `const o = pm.response.json().data || {};`,
    ...Object.entries(exp).map(([k, v]) => {
      if (v === undefined) return `pm.test('${name}: ${k} absent', () => pm.expect(o.${k}).to.be.undefined);`;
      const m = typeof v === 'string' && v.match(/^{{(\w+)}}$/);
      const rhs = m ? `pm.variables.get('${m[1]}')` : JSON.stringify(v);
      return `pm.test('${name}: ${k} = ${m ? m[1] : JSON.stringify(v)}', () => pm.expect(o.${k}).to.eql(${rhs}));`;
    }),
  ),
});
const EXT_ORDER = (total, source = '{{order_lapsed}}', duration = 183) => ({
  orderStatus: 'initiated', grandTotal: total, duration, isExtensionOrder: true, extendsOrderId: source, isUpgradeOrder: undefined,
});
const PLAIN_ORDER = (total) => ({ orderStatus: 'initiated', grandTotal: total, duration: 365, isExtensionOrder: undefined, extendsOrderId: undefined });

// ── the collection ───────────────────────────────────────────────────────────
const items = [];

items.push(folder('0. Servers up', [
  ['on', 'base_on'], ['off', 'base_off'], ['custom 30%/90d', 'base_custom'], ['window 30d', 'base_window'],
].map(([n, b]) => req(`Server ${n}`, 'GET', `{{${b}}}/api/plans/active`, {
  tests: [`pm.test('200', () => pm.response.to.have.status(200));`],
})), 'Re-seed first (README). Each server reads the same local DB with a different LAPSED_EXTENSION_* env.'));

items.push(folder('1. Listings — switch ON', [
  ...threeShapes('base_on', 'Lapsed holder (paid ₹499) ⇒ ₹250/183d', 'user_lapsed', 'plan_p',
    { ...OFFER(250), originalAmount: '1000', originalDuration: 365 }),
  ...threeShapes('base_on', 'Active holder ⇒ list, is_buy 1', 'user_active', 'plan_p', LIST(1000, 1)),
  ...threeShapes('base_on', 'Stranger ⇒ list', 'user_stranger', 'plan_p', LIST(1000)),
  req('Anonymous /active never carries the offer', 'GET', '{{base_on}}/api/plans/active', {
    tests: rowTests('Anonymous', { amount: '1000', duration: 365, is_expire: undefined, originalAmount: undefined }, 'plan_p'),
  }),
  single('base_on', 'Paid ₹900 then lapsed extension ₹450 ⇒ ₹450 (extension never the base)', 'user_renewed', 'plan_p', OFFER(450)),
  single('base_on', 'Only ₹0 orders ⇒ ₹500 (half of list)', 'user_granted', 'plan_p', OFFER(500)),
  single('base_on', 'Paid ₹700 then newer ₹0 ⇒ ₹350 (paid wins)', 'user_zero_paid', 'plan_p', OFFER(350)),
  single('base_on', 'Paid ₹333 ⇒ ₹167 (halves up)', 'user_round', 'plan_p', OFFER(167)),
  single('base_on', 'Coupon-reduced paid ₹800 ⇒ ₹400', 'user_couponed', 'plan_p', OFFER(400)),
  single('base_on', 'Two paid (₹600 old, ₹800 recent) ⇒ ₹300 (oldest = original purchase wins)', 'user_two_paid', 'plan_p', OFFER(300)),
  single('base_on', 'Retired per-plan config (₹10/30d) ignored ⇒ ₹500/183d', 'user_retired', 'plan_r', OFFER(500, 183, 'AutoExt Retired-config R')),
  single('base_on', 'Precedence T1: upgrade ₹600 < ext ₹1000 ⇒ upgrade wins', 'user_prec', 'plan_t1',
    { amount: '600', duration: 365, is_expire: 0, is_upgrade: 1, is_buy: 0, title: 'AutoExt Target T1 (upgrade 600)' }),
  single('base_on', 'Precedence T2: upgrade ₹1000 = ext ₹1000 ⇒ tie goes to extension', 'user_prec', 'plan_t2',
    { amount: '1000', duration: 183, is_expire: 1, is_upgrade: 0, is_buy: 0, ...EXT_TITLE('AutoExt Target T2 (upgrade 1000)') }),
]));

items.push(folder('2. Checkout — switch ON', [
  ...PATHS.map(([label, p]) => folder(label, [
    checkout('base_on', `${label}: offer price ₹250 accepted`, p, 'user_lapsed', 'plan_p', 250, accepted(`${label} ₹250`)),
    verifyOrder('base_on', `${label}: order is an Extension order, 183d, source = lapsed order`, EXT_ORDER(250)),
    checkout('base_on', `${label}: ₹248 rejected (beyond ₹1 tolerance)`, p, 'user_lapsed', 'plan_p', 248, rejected(`${label} ₹248`, 250)),
    checkout('base_on', `${label}: ₹249 accepted (within ₹1 tolerance)`, p, 'user_lapsed', 'plan_p', 249, accepted(`${label} ₹249`)),
    checkout('base_on', `${label}: coupon — ₹150 rejected (20% off ₹250, not off ₹1000)`, p, 'user_lapsed', 'plan_p', 150,
      rejected(`${label} coupon ₹150`, 200), { couponCode: '{{coupon}}' }),
    checkout('base_on', `${label}: coupon — ₹200 accepted`, p, 'user_lapsed', 'plan_p', 200,
      accepted(`${label} coupon ₹200`), { couponCode: '{{coupon}}' }),
    verifyOrder('base_on', `${label}: coupon order is still an Extension order`, { ...EXT_ORDER(200), couponCode: '{{coupon}}' }),
  ])),
  checkout('base_on', 'Stranger at ₹250 rejected', '/api/orders/get-razorpay-order', 'user_stranger', 'plan_p', 250, rejected('Stranger', 1000)),
  checkout('base_on', 'Active holder at ₹250 rejected', '/api/orders/get-razorpay-order', 'user_active', 'plan_p', 250, rejected('Active holder', 1000)),
  checkout('base_on', 'Renewed user at ₹450 accepted', '/api/orders/get-razorpay-order', 'user_renewed', 'plan_p', 450, accepted('Renewed ₹450')),
  verifyOrder('base_on', 'Renewed: source is the furthest-expiring lapsed order (the extension order)', EXT_ORDER(450, '{{order_renewed_ext}}')),
  checkout('base_on', 'Precedence T1 at ₹600 accepted', '/api/orders/get-razorpay-order', 'user_prec', 'plan_t1', 600, accepted('T1 ₹600')),
  verifyOrder('base_on', 'Precedence T1: Upgrade order, not Extension', {
    grandTotal: 600, duration: 365, isUpgradeOrder: true, upgradesFromOrderId: '{{order_prec_s}}', isExtensionOrder: undefined,
  }),
  checkout('base_on', 'Precedence T2 at ₹1000 accepted', '/api/orders/get-razorpay-order', 'user_prec', 'plan_t2', 1000, accepted('T2 ₹1000')),
  verifyOrder('base_on', 'Precedence T2: Extension order (tie)', EXT_ORDER(1000, '{{order_prec_t2}}')),
  req('Lapsed order is untouched', 'GET', '{{base_on}}/api/orders/{{order_lapsed}}', {
    tests: lines(
      `pm.test('200', () => pm.response.to.have.status(200));`,
      `const o = pm.response.json().data || pm.response.json();`,
      `pm.test('grandTotal still 499', () => pm.expect(o.grandTotal).to.eql(499));`,
      `pm.test('still success', () => pm.expect(o.orderStatus).to.eql('success'));`,
      `pm.test('still lapsed', () => pm.expect(new Date(o.expireDate).getTime()).to.be.below(Date.now()));`,
      `pm.test('never marked', () => { pm.expect(o.isExtensionOrder).to.be.undefined; pm.expect(o.extendsOrderId).to.be.undefined; });`,
    ),
  }),
]));

items.push(folder('3. Switch OFF — same fixtures, no offer anywhere', [
  ...threeShapes('base_off', 'Lapsed holder ⇒ list', 'user_lapsed', 'plan_p', LIST(1000)),
  single('base_off', 'Retired per-plan config still ignored ⇒ list', 'user_retired', 'plan_r', LIST(1000, 0, 'AutoExt Retired-config R')),
  single('base_off', 'Precedence T1: upgrade still works with the switch off', 'user_prec', 'plan_t1',
    { amount: '600', duration: 365, is_expire: 0, is_upgrade: 1 }),
  single('base_off', 'Precedence T2: no extension ⇒ upgrade ₹1000 shown', 'user_prec', 'plan_t2',
    { amount: '1000', duration: 365, is_expire: 0, is_upgrade: 1, title: 'AutoExt Target T2 (upgrade 1000)' }),
  ...PATHS.map(([label, p]) => folder(label, [
    checkout('base_off', `${label}: ₹250 rejected`, p, 'user_lapsed', 'plan_p', 250, rejected(`${label} off ₹250`, 1000)),
    checkout('base_off', `${label}: list ₹1000 accepted`, p, 'user_lapsed', 'plan_p', 1000, accepted(`${label} off ₹1000`)),
    verifyOrder('base_off', `${label}: plain order, 365d, no Extension marks`, PLAIN_ORDER(1000)),
  ])),
]));

items.push(folder('4. Custom config — 30% / 90d', [
  single('base_custom', 'Lapsed ₹499 ⇒ ₹150 (30% of 499 = 149.70) / 90d', 'user_lapsed', 'plan_p', OFFER(150, 90)),
  checkout('base_custom', 'Checkout ₹150 accepted', '/api/orders/get-razorpay-order', 'user_lapsed', 'plan_p', 150, accepted('custom ₹150')),
  verifyOrder('base_custom', 'Order runs 90 days', EXT_ORDER(150, '{{order_lapsed}}', 90)),
]));

const notListed = (base, who, user, plan) => [
  req(`${who} — filter-active (subscriptionId)`, 'POST', `{{${base}}}/api/plans/filter-active/{{${user}}}`, {
    body: { subscriptionId: `{{${plan}}}` }, tests: notListedTests(who),
  }),
  req(`${who} — filter-active (all)`, 'POST', `{{${base}}}/api/plans/filter-active/{{${user}}}`, {
    body: {}, tests: notListedTests(who, plan),
  }),
  req(`${who} — active/:userId`, 'GET', `{{${base}}}/api/plans/active/{{${user}}}`, {
    tests: notListedTests(who, plan),
  }),
];

items.push(folder('5. Extension window — 30 days (3109) vs closed (3106)', [
  folder('Listings — window 30', [
    ...threeShapes('base_window', 'In window (20d left, paid ₹800) ⇒ ₹400/183d, is_buy 1, is_expire 1', 'user_in_window', 'plan_w',
      { ...WINDOW_OFFER(400, 'AutoExt Window W'), originalAmount: '1000', originalDuration: 365 }),
    ...threeShapes('base_window', '40d left ⇒ list, is_buy 1, is_expire 0', 'user_far', 'plan_w', LIST(1000, 1, 'AutoExt Window W')),
    single('base_window', 'Task-01 "active" user (20d left, oldest paid ₹800) is now in the window ⇒ ₹400', 'user_active', 'plan_p', WINDOW_OFFER(400)),
    single('base_window', 'Lapsed holder unchanged by the window ⇒ ₹250/183d, is_buy 0', 'user_lapsed', 'plan_p', OFFER(250)),
    single('base_window', 'Stranger unchanged ⇒ list', 'user_stranger', 'plan_p', LIST(1000)),
    ...threeShapes('base_window', 'INACTIVE plan, in-window PAID holder (₹799, list ₹599) ⇒ ₹300, still listed', 'user_iw_paid', 'plan_i',
      WINDOW_OFFER(300, 'AutoExt Inactive I')),
    ...notListed('base_window', 'INACTIVE plan, in-window ₹0-only holder ⇒ not listed', 'user_iw_zero', 'plan_i'),
  ]),
  folder('Checkout — window 30', [
    ...PATHS.map(([label, p]) => folder(label, [
      checkout('base_window', `${label}: in-window holder at ₹400 accepted`, p, 'user_in_window', 'plan_w', 400, accepted(`${label} window ₹400`)),
      verifyOrder('base_window', `${label}: Extension order, 183d, source = the live (in-window) order`, EXT_ORDER(400, '{{order_in_window}}')),
    ])),
    checkout('base_window', '40d-left holder at ₹400 rejected', '/api/orders/get-razorpay-order', 'user_far', 'plan_w', 400, rejected('Far ₹400', 1000)),
    checkout('base_window', 'Task-01 "active" user at ₹400 accepted', '/api/orders/get-razorpay-order', 'user_active', 'plan_p', 400, accepted('Active ₹400')),
    verifyOrder('base_window', 'Task-01 "active" user: source = the live order', EXT_ORDER(400, '{{order_active_now}}')),
    checkout('base_window', 'INACTIVE plan, in-window paid holder at ₹300 accepted', '/api/orders/get-razorpay-order', 'user_iw_paid', 'plan_i', 300, accepted('IW paid ₹300')),
    verifyOrder('base_window', 'INACTIVE plan, in-window paid holder: Extension order', EXT_ORDER(300, '{{order_iw_paid}}')),
    checkout('base_window', 'INACTIVE plan, in-window ₹0 holder at list ₹599 is closed (403)', '/api/orders/get-razorpay-order', 'user_iw_zero', 'plan_i', 599, closed('IW zero ₹599')),
  ]),
  folder('Window closed (3106, window unset) — same fixtures', [
    ...threeShapes('base_on', 'In-window user with the window closed ⇒ list, is_buy 1, is_expire 0', 'user_in_window', 'plan_w', LIST(1000, 1, 'AutoExt Window W')),
    checkout('base_on', 'In-window user at ₹400 rejected with the window closed', '/api/orders/get-razorpay-order', 'user_in_window', 'plan_w', 400, rejected('Closed ₹400', 1000)),
    ...notListed('base_on', 'INACTIVE plan, paid holder with 20d left, window closed ⇒ not listed (active holder, no offer)', 'user_iw_paid', 'plan_i'),
  ]),
], 'Task 12. Stacking at payment (old expiry + 183d) needs a signed Razorpay webhook and is covered by ' +
  'extensionWindow.integration.test.ts in the LMS repo, not here. Course Extend flags likewise.'));

const collection = {
  info: {
    name: 'Automatic plan extension — tasks 01–03 + 12 (window) + oldest-order base + extension title (local)',
    description: 'ADR 0023 task 01 acceptance, over the real routes on a local throwaway DB. ' +
      'Setup and fixture table: reference/postman/automatic-plan-extension.README.md. Re-seed before every run.',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  item: items,
  // Self-contained: every id and base URL is a collection variable (Variables tab), so importing
  // this one file is enough. last_rzp_ref is written by the checkout tests and read by the next request.
  variable: [...Object.entries(ENV), ['last_rzp_ref', '']].map(([key, value]) => ({ key, value, type: 'string' })),
};

fs.writeFileSync(path.join(OUT, `${NAME}.postman_collection.json`), JSON.stringify(collection, null, 2) + '\n');
console.log(`wrote ${OUT}/${NAME}.postman_collection.json`);
