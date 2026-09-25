// Generates the global-search-classes Postman collection (tasks 01–03) from one table of cases.
//   node build-postman.cjs   → writes reference/postman/global-search-classes.postman_collection.json
// Edit the cases here, not the JSON.
//
// The checks are CONTRACT checks — they hold on any data — so the same collection runs against the
// prod read-only server (real data) or the local seeded bed. Signed-in requests carry a JWT the
// collection mints itself (HS256, CryptoJS) with `jwt_secret` = the test worktree's LOCAL
// JWT_SECRET; the server under test must be the local worktree, never prod.
const fs = require('fs');
const path = require('path');

const OUT = path.resolve(__dirname, '../../postman');
const NAME = 'global-search-classes';

const VARS = {
  base: 'http://localhost:3110',
  // Local-only secret from ~/Projects/worktrees/qt-gsearch-local-test/.env.development.
  jwt_secret: 'local-gsearch-jwt-secret-not-used-anywhere-else',
  // A user whose purchases should show (prod: the test account; owns Railway Prime Batch 2026-27).
  user_id: '6a7eb7ce543dd0b9881e0a27',
  // A query whose classes sit in a course user_id bought (prod: "mixture" → Railway Prime Batch).
  query_owned: 'mixture',
  // Word order + typo + whole-number queries: expect at least one class.
  query_typo: 'alligation',
  query_words: 'mixture part 2',
  query_other: 'railway',
  limit: '10',
};

const SECTIONS = ['courses', 'classes', 'ebooks', 'words', 'editorials', 'books', 'tests'];
const STREAM_STATUSES = [null, 'preparing', 'live', 'reconnecting', 'processing', 'ended'];
const COURSE_FIELDS = ['id', 'title', 'imageUrl', 'deepLink', 'price', 'isLive', 'isRecorded',
  'isActive', 'isFree', 'isPurchased', 'classTitle', 'startDate', 'endDate'];

// ── script snippets ──────────────────────────────────────────────────────────
const lines = (...ls) => ls.flat().filter((l) => l !== null && l !== undefined && l !== false);

/** Pre-request: mint an HS256 JWT into {{token}}. mode: valid | expired | forged | garbage. */
const mint = (mode) => lines(
  `const b64u = (w) => CryptoJS.enc.Base64.stringify(w).replace(/=+$/, '').replace(/\\+/g, '-').replace(/\\//g, '_');`,
  `const enc = (o) => b64u(CryptoJS.enc.Utf8.parse(JSON.stringify(o)));`,
  `const now = Math.floor(Date.now() / 1000);`,
  `const sign = (payload, secret) => { const h = enc({ alg: 'HS256', typ: 'JWT' }); const p = enc(payload);`,
  `  return h + '.' + p + '.' + b64u(CryptoJS.HmacSHA256(h + '.' + p, secret)); };`,
  `const payload = { user_id: pm.variables.get('user_id'), email: 'postman@local', mobile: '0', iat: now - 120,`,
  `  exp: ${mode === 'expired' ? 'now - 60' : 'now + 3600'} };`,
  mode === 'garbage'
    ? `pm.variables.set('token', 'garbage');`
    : `pm.variables.set('token', sign(payload, ${mode === 'forged' ? `'not-the-local-secret'` : `pm.variables.get('jwt_secret')`}));`,
);

/** Contract checks on a POST /api/search response. opts: { guest, expectClasses, expectPurchase, save } */
const contract = (label, opts = {}) => lines(
  `const res = pm.response.json();`,
  `pm.test('${label}: 200', () => pm.response.to.have.status(200));`,
  `const d = res.data || {};`,
  `pm.test('${label}: sections in order, classes after courses', () => pm.expect(Object.keys(d)).to.eql(${JSON.stringify(SECTIONS)}));`,
  `const cl = Array.isArray(d.classes) ? d.classes : [];`,
  `pm.test('${label}: classes is an array within the limit', () => { pm.expect(d.classes).to.be.an('array'); pm.expect(cl.length).to.be.at.most(Number(pm.variables.get('limit'))); });`,
  opts.expectClasses && `pm.test('${label}: at least one class found', () => pm.expect(cl.length).to.be.above(0));`,
  `const bad = (rule, pred) => { const v = cl.filter((c) => !pred(c)).map((c) => c.id + ' ' + c.title); pm.test('${label}: ' + rule, () => pm.expect(v, v.join(' | ')).to.eql([])); };`,
  `const rank = (x) => (x.isPurchased ? 0 : x.isFree ? 1 : 2);`,
  `bad('envelope: type class, deepLink /classes/<id>', (c) => c.type === 'class' && c.deepLink === '/classes/' + c.id && typeof c.title === 'string');`,
  `bad('no duplicate classes', (c) => cl.filter((o) => o.id === c.id).length === 1);`,
  `bad('meta never carries Class.isLive or the asset', (c) => !('isLive' in c.meta) && !('hlsAsset' in c.meta));`,
  `bad('streamStatus is a known state or null', (c) => ${JSON.stringify(STREAM_STATUSES)}.includes(c.meta.streamStatus));`,
  `bad('hasPlayback / canPlay / isFree are booleans', (c) => ['hasPlayback', 'canPlay', 'isFree'].every((k) => typeof c.meta[k] === 'boolean'));`,
  `bad('every class has at least one attached course', (c) => Array.isArray(c.meta.courses) && c.meta.courses.length > 0);`,
  `bad('every attached course has the full field set', (c) => c.meta.courses.every((x) => ${JSON.stringify(COURSE_FIELDS)}.every((k) => k in x)));`,
  `bad('no course attached twice', (c) => new Set(c.meta.courses.map((x) => x.id)).size === c.meta.courses.length);`,
  `bad('an inactive course is attached only when bought', (c) => c.meta.courses.every((x) => x.isActive || x.isPurchased));`,
  `bad('canPlay = class free OR any course free/bought', (c) => c.meta.canPlay === (c.meta.isFree || c.meta.courses.some((x) => x.isFree || x.isPurchased)));`,
  `bad('courses ordered purchased → free → rest', (c) => c.meta.courses.every((x, i, a) => i === 0 || rank(a[i - 1]) <= rank(x)));`,
  opts.guest && `bad('guest view: nothing purchased', (c) => c.meta.courses.every((x) => x.isPurchased === false));`,
  opts.guest && `bad('guest view: no inactive course', (c) => c.meta.courses.every((x) => x.isActive === true));`,
  opts.expectPurchase && `pm.test('${label}: the signed-in user sees a purchased course', () => pm.expect(cl.some((c) => c.meta.courses.some((x) => x.isPurchased))).to.be.true);`,
  opts.expectPurchase && `pm.test('${label}: a class with a purchased course is playable', () => pm.expect(cl.filter((c) => c.meta.courses.some((x) => x.isPurchased)).every((c) => c.meta.canPlay)).to.be.true);`,
  opts.save && `if (cl[0]) pm.collectionVariables.set('first_class_id', cl[0].id);`,
  opts.save && `pm.collectionVariables.set('${opts.save}', JSON.stringify(cl.map((c) => c.id + ':' + c.meta.courses.map((x) => x.id + (x.isPurchased ? 'P' : '')).join(','))));`,
  opts.sameAs && `pm.test('${label}: identical to the guest response for the same query', () => pm.expect(JSON.stringify(cl.map((c) => c.id + ':' + c.meta.courses.map((x) => x.id + (x.isPurchased ? 'P' : '')).join(',')))).to.eql(pm.collectionVariables.get('${opts.sameAs}')));`,
);

// ── request builders ─────────────────────────────────────────────────────────
const jsonBody = (obj) => ({ mode: 'raw', raw: JSON.stringify(obj, null, 2), options: { raw: { language: 'json' } } });
const url = (p) => ({ raw: `{{base}}${p}`, host: ['{{base}}'], path: p.replace(/^\//, '').split('/') });

const search = (name, { query, token, tests, description }) => ({
  name,
  event: [
    token && { listen: 'prerequest', script: { type: 'text/javascript', exec: mint(token) } },
    { listen: 'test', script: { type: 'text/javascript', exec: tests } },
  ].filter(Boolean),
  request: {
    method: 'POST',
    description,
    header: [
      { key: 'Content-Type', value: 'application/json' },
      token && { key: 'Authorization', value: 'Bearer {{token}}' },
    ].filter(Boolean),
    url: url('/api/search'),
    body: jsonBody({ query: `{{${query}}}`, userId: '{{user_id}}', limit: '{{limit}}' }),
  },
});

const get = (name, p, tests, description) => ({
  name,
  event: [{ listen: 'test', script: { type: 'text/javascript', exec: tests } }],
  request: { method: 'GET', description, header: [], url: url(p) },
});

// ── cases ────────────────────────────────────────────────────────────────────
const folders = [
  {
    name: '0. Server up + capsules',
    item: [
      get('Collections — Classes capsule only with SEARCH_CLASSES_CAPSULE_ENABLED', '/api/search/collections', lines(
        `pm.test('200', () => pm.response.to.have.status(200));`,
        `const slugs = pm.response.json().data.map((c) => c.slug);`,
        `pm.test('all, courses first', () => pm.expect(slugs.slice(0, 2)).to.eql(['all', 'courses']));`,
        `pm.test('Classes capsule is either absent (flag off, the default) or right after Courses', () =>`,
        `  pm.expect(slugs.includes('classes') ? slugs[2] : 'absent').to.be.oneOf(['classes', 'absent']));`,
      ), 'The capsule is hidden unless the server runs with SEARCH_CLASSES_CAPSULE_ENABLED=true (the app cannot render classes yet). The classes SECTION is always returned.'),
    ],
  },
  {
    name: '1. Guest — no token (body userId must never reveal purchases)',
    item: [
      search('Guest · owned query (body userId = the buyer)', {
        query: 'query_owned', tests: contract('guest owned', { guest: true, expectClasses: true, save: 'guest_owned' }),
        description: 'No Authorization header. The body carries the buyer\'s userId — it must NOT mark anything purchased or attach an inactive course.',
      }),
      search('Guest · typo tolerance (alligation → allegation/alligation)', {
        query: 'query_typo', tests: contract('guest typo', { guest: true, expectClasses: true }),
      }),
      search('Guest · words in any order', {
        query: 'query_words', tests: contract('guest words', { guest: true, expectClasses: true }),
      }),
      search('Guest · other query', {
        query: 'query_other', tests: contract('guest other', { guest: true }),
      }),
    ],
  },
  {
    name: '2. Signed in — valid token for user_id',
    item: [
      search('Signed in · owned query → purchased course first, canPlay', {
        query: 'query_owned', token: 'valid',
        tests: contract('signed-in owned', { expectClasses: true, expectPurchase: true }),
        description: 'JWT minted in the pre-request with the LOCAL jwt_secret for {{user_id}}.',
      }),
      search('Signed in · other query (contract only)', {
        query: 'query_other', token: 'valid', tests: contract('signed-in other', {}),
      }),
    ],
  },
  {
    name: '3. Bad tokens → 200 + guest view, never an error',
    item: [
      search('Expired token', { query: 'query_owned', token: 'expired', tests: contract('expired', { guest: true, sameAs: 'guest_owned' }) }),
      search('Forged token (wrong secret)', { query: 'query_owned', token: 'forged', tests: contract('forged', { guest: true, sameAs: 'guest_owned' }) }),
      search('Garbage token', { query: 'query_owned', token: 'garbage', tests: contract('garbage', { guest: true, sameAs: 'guest_owned' }) }),
    ],
  },
  {
    name: '4. Clicks + trending',
    item: [
      {
        name: 'Click a class result → 204',
        event: [{ listen: 'test', script: { type: 'text/javascript', exec: [
          `pm.test('204', () => pm.response.to.have.status(204));`,
        ] } }],
        request: {
          method: 'POST',
          header: [{ key: 'Content-Type', value: 'application/json' }],
          url: url('/api/search/click'),
          body: jsonBody({ query: '{{query_owned}}', type: 'class', resultId: '{{first_class_id}}', userId: '{{user_id}}' }),
          description: 'Uses the first class id saved by the guest owned-query request. On the prod read-only server the Mongo click-log write is blocked by the guard (logged, harmless); Redis is local.',
        },
      },
      get('Trending → classes always []', '/api/search/trending', lines(
        `pm.test('200', () => pm.response.to.have.status(200));`,
        `const d = pm.response.json().data;`,
        `pm.test('sections in order', () => pm.expect(Object.keys(d)).to.eql(${JSON.stringify(SECTIONS)}));`,
        `pm.test('classes is empty', () => pm.expect(d.classes).to.eql([]));`,
      )),
    ],
  },
];

const collection = {
  info: {
    name: 'Global search — classes section (tasks 01–03)',
    description: [
      'Contract checks for the classes section of POST /api/search, runnable against the prod read-only',
      'server (real data) or the local seeded bed. Setup: reference/postman/global-search-classes.README.md.',
      'Signed-in requests mint their own JWT with the LOCAL jwt_secret — point {{base}} only at the local',
      'test worktree, never at prod.',
    ].join(' '),
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  item: folders,
  variable: [
    ...Object.entries(VARS).map(([key, value]) => ({ key, value, type: 'string' })),
    { key: 'first_class_id', value: '', type: 'string' },
    { key: 'guest_owned', value: '', type: 'string' },
    { key: 'token', value: '', type: 'string' },
  ],
};

fs.mkdirSync(OUT, { recursive: true });
const file = path.join(OUT, `${NAME}.postman_collection.json`);
fs.writeFileSync(file, JSON.stringify(collection, null, 2) + '\n');
const count = folders.reduce((n, f) => n + f.item.length, 0);
console.log(`wrote ${path.relative(process.cwd(), file)} — ${folders.length} folders, ${count} requests`);
