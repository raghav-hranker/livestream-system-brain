// Generates the course-search Postman collection from one table of cases.
//   node build-postman.cjs   → writes reference/postman/course-search.postman_collection.json
// Edit the cases here, not the JSON.
//
// The checks are CONTRACT checks — they hold on any data — so the same collection runs against the
// prod read-only server (real data) or a local seed. Signed-in requests carry a JWT the collection
// mints itself (HS256, CryptoJS) with `jwt_secret` = the test worktree's LOCAL JWT_SECRET; the
// server under test must be the local worktree, never prod.
const fs = require('fs');
const path = require('path');

const OUT = path.resolve(__dirname, '../../postman');
const NAME = 'course-search';

const VARS = {
  base: 'http://localhost:3110',
  // Local-only secret from ~/Projects/worktrees/qt-csearch-local-test/.env.development.
  jwt_secret: 'local-gsearch-jwt-secret-not-used-anywhere-else',
  // Railway Prime Batch (2026-27): the largest course (~900 class placements), owned by user_id.
  course_id: '6a4558e8ebb42f585d9a9f29',
  // An inactive course (status 0): searched normally (D11).
  inactive_course_id: '6a4558c2ebb42f585d9a8326',
  // Test account; owns course_id and has real ClassProgress in it.
  user_id: '6a7eb7ce543dd0b9881e0a27',
  query: 'percentage',
  query_typo: 'alligation',
  query_words: 'mixture part 2',
  query_broad: 'ra',
  query_ebook: 'ebook',
  query_test: 'test',
  // A class user_id has real progress in (prod: resume point on Day 23 || LCM & HCF Part-1).
  query_progress: 'lcm hcf part 1',
  limit: '10',
};

const TABS = ['today', 'upcoming', 'previous', null];
const WATCH = ['not_watched', 'partial', 'watched'];

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

/** Contract checks on a 200 course-search response.
 *  opts: { guest, max, expect: ['classes'|'ebooks'|'tests'], save, sameAs, signedIn } */
const contract = (label, opts = {}) => lines(
  `const res = pm.response.json();`,
  `pm.test('${label}: 200', () => pm.response.to.have.status(200));`,
  `const d = res.data || {};`,
  `pm.test('${label}: exactly the three sections, all arrays', () => { pm.expect(Object.keys(d).sort()).to.eql(['classes', 'ebooks', 'tests']); ['classes', 'ebooks', 'tests'].forEach((k) => pm.expect(d[k]).to.be.an('array')); });`,
  `const max = ${opts.max || `Number(pm.variables.get('limit'))`};`,
  `pm.test('${label}: every section within the limit (' + max + ')', () => ['classes', 'ebooks', 'tests'].forEach((k) => pm.expect(d[k].length, k).to.be.at.most(max)));`,
  (opts.expect || []).map((k) => `pm.test('${label}: ${k} not empty', () => pm.expect(d.${k}.length).to.be.above(0));`),
  `const cl = d.classes || [], pd = d.ebooks || [], ts = d.tests || [];`,
  `const bad = (rule, arr, pred, id) => { const v = arr.filter((x) => !pred(x)).map(id || ((x) => x._id + ' ' + (x.title || x.series_name))); pm.test('${label}: ' + rule, () => pm.expect(v, v.join(' | ')).to.eql([])); };`,
  `bad('classes: tab is today/upcoming/previous/null', cl, (c) => ${JSON.stringify(TABS)}.includes(c.tab));`,
  `bad('classes: every item belongs to this course', cl, (c) => String(c.course) === pm.variables.get('cid'));`,
  `bad('classes: no duplicates', cl, (c) => cl.filter((o) => o._id === c._id).length === 1);`,
  `bad('classes: card fields present (title, classId, classPdf[], watch fields)', cl, (c) => typeof c.title === 'string' && c.classId && Array.isArray(c.classPdf) && ${JSON.stringify(WATCH)}.includes(c.watchStatus) && typeof c.watchTime === 'number' && typeof c.manualCompleted === 'boolean');`,
  `bad('classes: upcoming keeps the pinned defaults', cl, (c) => c.tab !== 'upcoming' || (c.watchStatus === 'not_watched' && c.watchTime === 0 && c.manualCompleted === false && !c.videoPosition));`,
  opts.guest && `bad('guest: every class is Not watched, no resume point', cl, (c) => c.watchStatus === 'not_watched' && c.watchTime === 0 && c.manualCompleted === false && !c.videoPosition);`,
  `bad('ebooks: no uploadPdf / storage key / signed URL', pd, (p) => !('uploadPdf' in p) && !('pdfAsset' in p) && !(p.asset && 'key' in p.asset) && !/[?&](token|expires)=/.test(JSON.stringify(p)));`,
  `bad('ebooks: title + booleans isFree/isDownloadable', pd, (p) => typeof p.title === 'string' && typeof p.isFree === 'boolean');`,
  `bad('tests: series_name present', ts, (t) => typeof t.series_name === 'string');`,
  opts.guest && `bad('guest: tests carry no attempts', ts, (t) => !t.is_attempted && !t.attempted_count);`,
  opts.save && `pm.collectionVariables.set('${opts.save}', JSON.stringify(d));`,
  opts.sameAs && `pm.test('${label}: byte-identical to the guest response', () => pm.expect(JSON.stringify(d)).to.eql(pm.collectionVariables.get('${opts.sameAs}')));`,
  opts.signedIn && `const g = JSON.parse(pm.collectionVariables.get('${opts.signedIn}') || '{}');`,
  opts.signedIn && `pm.test('${label}: same results as the guest (identity changes state, not matching)', () => pm.expect(cl.map((c) => c._id)).to.eql((g.classes || []).map((c) => c._id)));`,
  opts.signedIn && `console.log('${label}: signed-in watch states', cl.map((c) => c.title + ' → ' + c.watchStatus + ' ' + c.watchTime + 's pos ' + (c.videoPosition || 0)));`,
);

const status = (label, code, msgHint) => lines(
  `pm.test('${label}: ${code}', () => pm.response.to.have.status(${code}));`,
  msgHint && `pm.test('${label}: message', () => pm.expect(JSON.stringify(pm.response.json())).to.match(/${msgHint}/i));`,
);

// ── request builders ─────────────────────────────────────────────────────────
const jsonBody = (obj) => ({ mode: 'raw', raw: JSON.stringify(obj, null, 2), options: { raw: { language: 'json' } } });

const search = (name, { course = '{{course_id}}', body, token, tests, description }) => ({
  name,
  event: [
    { listen: 'prerequest', script: { type: 'text/javascript', exec: lines(
      `pm.variables.set('cid', pm.variables.replaceIn('${course}'));`,
      token ? mint(token) : [],
    ) } },
    { listen: 'test', script: { type: 'text/javascript', exec: tests } },
  ],
  request: {
    method: 'POST',
    description,
    header: [
      { key: 'Content-Type', value: 'application/json' },
      token && { key: 'Authorization', value: 'Bearer {{token}}' },
    ].filter(Boolean),
    url: {
      raw: `{{base}}/api/courses/${course}/search`,
      host: ['{{base}}'],
      path: ['api', 'courses', course, 'search'],
    },
    body: jsonBody(body),
  },
});

const folder = (name, description, item) => ({ name, description, item });

const collection = {
  info: {
    name: 'Course search (POST /api/courses/:courseId/search)',
    description: [
      'Course search: one course\'s classes, course PDFs ("Ebooks") and tests, ranked by title.',
      'Local server on feat/course-search, prod data read-only (see reference/postman/course-search.README.md).',
      'Signed-in requests mint their own JWT with the LOCAL jwt_secret — point {{base}} only at the local',
      'server, never at prod.',
    ].join('\n'),
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  variable: Object.entries(VARS).map(([key, value]) => ({ key, value })),
  item: [
    folder('1 Guest', 'No token. Guest defaults on every class; no test attempts.', [
      search('guest: {{query}}', { body: { query: '{{query}}' }, tests: contract('guest query', { guest: true, expect: ['classes'], save: 'guest_query' }) }),
      search('guest: typo {{query_typo}}', { body: { query: '{{query_typo}}' }, tests: contract('typo', { guest: true, expect: ['classes'] }) }),
      search('guest: words in any order {{query_words}}', { body: { query: '{{query_words}}' }, tests: contract('word order', { guest: true, expect: ['classes'] }) }),
      search('guest: broad two letters {{query_broad}}', { body: { query: '{{query_broad}}' }, tests: contract('broad', { guest: true, expect: ['classes'] }) }),
      search('guest: body userId is ignored (spoof)', {
        body: { query: '{{query}}', userId: '{{user_id}}' },
        description: 'The buyer\'s id in the body without a token must not reveal their progress.',
        tests: contract('spoof', { guest: true, sameAs: 'guest_query' }),
      }),
    ]),
    folder('2 Signed in', 'Valid token for {{user_id}}: same matches, per-student watch state from the token.', [
      search('signed in: {{query}}', { token: 'valid', body: { query: '{{query}}' }, tests: contract('signed in', { expect: ['classes'], signedIn: 'guest_query' }) }),
      search('signed in: progress {{query_progress}}', {
        token: 'valid', body: { query: '{{query_progress}}' },
        description: 'A class the test account watched: its result must carry that student\'s state (compare with its class-tabs card).',
        tests: lines(contract('signed in progress', { expect: ['classes'] }),
          `pm.test('signed in progress: some class carries this student\'s state', () => pm.expect(cl.some((c) => c.watchStatus !== 'not_watched' || c.videoPosition > 0 || c.manualCompleted)).to.be.true);`),
      }),
      search('guest: progress {{query_progress}} shows none', {
        body: { query: '{{query_progress}}', userId: '{{user_id}}' },
        tests: contract('guest progress', { guest: true }),
      }),
      search('signed in: broad {{query_broad}}', { token: 'valid', body: { query: '{{query_broad}}', limit: 50 }, tests: contract('signed in broad', { max: 50 }) }),
    ]),
    folder('3 Bad tokens', 'Expired / forged / garbage ⇒ 200 and byte-identical to the guest response, never 401.', [
      search('expired token', { token: 'expired', body: { query: '{{query}}' }, tests: contract('expired', { guest: true, sameAs: 'guest_query' }) }),
      search('forged token', { token: 'forged', body: { query: '{{query}}' }, tests: contract('forged', { guest: true, sameAs: 'guest_query' }) }),
      search('garbage token', { token: 'garbage', body: { query: '{{query}}' }, tests: contract('garbage', { guest: true, sameAs: 'guest_query' }) }),
    ]),
    folder('4 Each section', 'A query aimed at one section. Tests: prod has no active course test placement today, so expect [] (the live Tests tab is empty too).', [
      search('ebooks: {{query_ebook}}', { body: { query: '{{query_ebook}}' }, tests: contract('ebooks', { guest: true, expect: ['ebooks'] }) }),
      search('tests: {{query_test}}', { body: { query: '{{query_test}}' }, tests: contract('tests', { guest: true }) }),
    ]),
    folder('5 Limits and errors', '', [
      search('no limit ⇒ at most 10', { body: { query: '{{query_broad}}' }, tests: contract('default limit', { max: 10 }) }),
      search('limit 500 ⇒ at most 50', { body: { query: '{{query_broad}}', limit: 500 }, tests: contract('clamped limit', { max: 50 }) }),
      search('inactive course ⇒ 200', { course: '{{inactive_course_id}}', body: { query: '{{query_broad}}' }, tests: contract('inactive course', { guest: true }) }),
      search('one character ⇒ 400', { body: { query: 'a' }, tests: status('short query', 400) }),
      search('blank after trim ⇒ 400', { body: { query: '   ' }, tests: status('blank query', 400) }),
      search('missing query ⇒ 400', { body: {}, tests: status('missing query', 400) }),
      search('bad course id ⇒ 400', { course: 'not-an-id', body: { query: '{{query}}' }, tests: status('bad id', 400) }),
      search('unknown course ⇒ 404', { course: '000000000000000000000000', body: { query: '{{query}}' }, tests: status('unknown course', 404) }),
    ]),
  ],
};

fs.mkdirSync(OUT, { recursive: true });
const file = path.join(OUT, `${NAME}.postman_collection.json`);
fs.writeFileSync(file, JSON.stringify(collection, null, 2) + '\n');
console.log('wrote', file);
