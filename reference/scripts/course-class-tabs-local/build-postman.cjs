// Generates the course-class-tabs Postman collection from one table of cases.
//   node build-postman.cjs   → writes reference/postman/course-class-tabs.postman_collection.json
// Edit the cases here, not the JSON.
//
// Endpoint: POST /api/courses/:courseId/class-tabs  { tab, watch?, cursor?, limit?, search? }
// Spec: docs/plans/prd-course-class-tabs.md + docs/plans/tasks/course-class-tabs/.
//
// The checks are CONTRACT checks: they hold on any data, so the collection runs against the prod
// read-only server (real data) on any day. The card/envelope contract runs from a COLLECTION-level
// test script, so it applies to every response (folder 0 only smoke-tests each tab). IST days are
// computed in the test scripts from the client clock, which assumes the test machine and the server
// agree on "now". Near IST midnight a run can straddle two days, so avoid 23:59–00:01 IST.
//
// Signed-in requests carry a JWT the collection mints itself (HS256, CryptoJS) with
// `jwt_secret` = the test worktree's LOCAL JWT_SECRET. That only verifies on the local server:
// never point {{base}} at prod.
//
// Folder 6 covers task 04 (watchStatus / watchTime / watch filter). Its watch-dependent tests SKIP
// (pm.test.skip) only when cards carry no `watchStatus`, i.e. against a server older than task 04.
//
// Folder 7 covers `search` (fork 3dbd03295, Class tab search). Needs a server with that commit.
const fs = require('fs');
const path = require('path');

const OUT = path.resolve(__dirname, '../../postman');
const NAME = 'course-class-tabs';

const VARS = {
  base: 'http://localhost:3110',
  // Railway Prime Batch (2026-27): daily live classes (Today), ~900 playable past classes
  // (Previous) and the next few days scheduled (Upcoming).
  course_id: '6a4558e8ebb42f585d9a9f29',
  // The test account: owns Railway Prime Batch, has ClassProgress in it (19 completed, ~3 h watched).
  user_id: '6a7eb7ce543dd0b9881e0a27',
  // Local-only secret from ~/Projects/worktrees/qt-classtabs-local-test/.env.development.
  jwt_secret: 'local-gsearch-jwt-secret-not-used-anywhere-else',
};

const PREV_LIMIT = 5;      // Previous scroll chain page size
const PREV_MAX_PAGES = 6;  // stop the Previous chain after this many pages (the course has ~180 at 5)
const UP_LIMIT = 4;        // Upcoming chain page size (small, so a few days of schedule gives 2+ pages)
const UP_MAX_PAGES = 15;   // Upcoming chain safety cap
const WATCH_LIMIT = 5;     // filtered Previous page size (task 04)
const UNKNOWN_COURSE = '000000000000000000000000';

// ── script snippets ──────────────────────────────────────────────────────────
const lines = (...ls) => ls.flat().filter((l) => l !== null && l !== undefined && l !== false);
const js = (...ls) => ({ type: 'text/javascript', exec: lines(...ls) });

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

const STREAM_STATUSES = [null, 'preparing', 'live', 'reconnecting', 'processing', 'ended'];
const LIVE = ['live', 'reconnecting'];
const WATCH_STATUSES = ['watched', 'partial', 'not_watched'];
// Always present on a card (computed or placement-owned).
const REQUIRED = ['_id', 'courseClassId', 'course', 'classId', 'isActive', 'status', 'startDate',
  'isFree', 'isBlinking', 'classPdf', 'classTest', 'title', 'isYoutubeRedirect', 'class_link', 'hasPlayback',
  'mainCategory', 'category', 'internalSection', 'topic'];
// Projected from the Class / placement, so absent when the source field is missing (same as today's classes).
// endDate: absent when neither the placement nor the Class has one (APX imports) — same as today's classes.
const OPTIONAL = ['endDate', 'priority', 'addedAt', 'classCreatedAt', 'classUpdatedAt', 'description', 'teacherName',
  'duration', 'isLive', 'isShort', 'isChat', 'isTopper', 'image', 'link', 'streamStatus', 'viewCount',
  'uniqueViewCount', 'watchStatus', 'watchTime', 'videoPosition', 'manualCompleted', 'searchMatch'];
// Volatile or per-viewer fields dropped before comparing two responses.
const VOLATILE = ['watchStatus', 'watchTime', 'videoPosition', 'manualCompleted', 'viewCount', 'uniqueViewCount', 'classUpdatedAt'];
const SEARCH = 'percentage'; // a common word in Railway Prime Batch titles (course search found 14 classes)

/** Shared helpers, prepended to every request test script. */
const helpers = lines(
  `const IST_MS = 330 * 60 * 1000;`,
  `const istDay = (d) => new Date(new Date(d).getTime() + IST_MS).toISOString().slice(0, 10);`,
  `const TODAY = istDay(Date.now());`,
  `const LIVE = ${JSON.stringify(LIVE)};`,
  `const isLive = (c) => LIVE.includes(c.streamStatus);`,
  `const res = pm.response.code === 200 ? pm.response.json() : {};`,
  `const cl = (res.data && Array.isArray(res.data.classes)) ? res.data.classes : [];`,
  `const next = res.data ? res.data.nextCursor : undefined;`,
  `const ids = cl.map((c) => c._id);`,
  `const key = (c) => [new Date(c.startDate).getTime(), c._id];`,
  `const cmp = (a, b) => (a[0] - b[0]) || (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0);`,
  `const bad = (rule, pred) => { const v = cl.filter((c) => !pred(c)).map((c) => c._id + ' ' + istDay(c.startDate) + ' ' + c.streamStatus + ' ' + (c.title || '').slice(0, 30)); pm.test(rule, () => pm.expect(v, v.join(' | ')).to.eql([])); };`,
  `const stable = (list) => JSON.stringify(list.map((c) => { const o = Object.assign({}, c); ${JSON.stringify(VOLATILE)}.forEach((k) => delete o[k]); return o; }));`,
  `const hasWatch = cl.length > 0 && cl.every((c) => 'watchStatus' in c);`,
  `if (hasWatch) pm.collectionVariables.set('server_has_watch', 'true');`,
  `// An empty list says nothing about the server; once any card carried watchStatus this run, the server has task 04.`,
  `const watchOn = hasWatch || pm.collectionVariables.get('server_has_watch') === 'true';`,
  `const watchTest = (name, fn) => (watchOn ? pm.test : pm.test.skip)('[task 04] ' + name, fn);`,
  `const ok200 = () => pm.test('200', () => pm.response.to.have.status(200));`,
);

/** Contract on every response — the collection-level test script. */
const contract = lines(
  `// [contract] runs on EVERY response in the collection.`,
  `const code = pm.response.code;`,
  `let body; try { body = pm.response.json(); } catch (e) { body = null; }`,
  `pm.test('[contract] JSON body with state = HTTP status and a msg', () => {`,
  `  pm.expect(body, 'JSON body').to.be.an('object');`,
  `  pm.expect(body.state).to.eql(code); pm.expect(body.msg).to.be.a('string'); });`,
  `if (pm.request.url.getPath().endsWith('/class-tabs') && code === 200 && body) {`,
  `  const d = body.data || {};`,
  `  const searched = 'search' in d;
  pm.test('[contract] data is { classes, nextCursor, totalCount, tabCounts } (+ search when searching)', () => pm.expect(Object.keys(d).sort()).to.eql(['classes', 'nextCursor', ...(searched ? ['search'] : []), 'tabCounts', 'totalCount']));
  pm.test('[contract] totalCount a number; tabCounts { today, upcoming, previous } numbers', () => { pm.expect(d.totalCount).to.be.a('number'); pm.expect(Object.keys(d.tabCounts || {}).sort()).to.eql(['previous', 'today', 'upcoming']); });`,
  `  pm.test('[contract] nextCursor is a non-empty string or null', () => pm.expect(d.nextCursor === null || (typeof d.nextCursor === 'string' && d.nextCursor.length > 0)).to.be.true);`,
  `  const cl = Array.isArray(d.classes) ? d.classes : [];`,
  `  pm.test('[contract] classes is an array', () => pm.expect(d.classes).to.be.an('array'));`,
  `  const course = pm.request.url.getPath().split('/').slice(-2)[0];`,
  `  const REQUIRED = ${JSON.stringify(REQUIRED)};`,
  `  const ALLOWED = REQUIRED.concat(${JSON.stringify(OPTIONAL)});`,
  `  const bad = (rule, pred) => { const v = cl.filter((c) => !pred(c)).map((c) => c._id + ' ' + (c.title || '').slice(0, 30)); pm.test('[contract] ' + rule, () => pm.expect(v, v.join(' | ')).to.eql([])); };`,
  `  bad('every card has the required fields', (c) => REQUIRED.every((k) => k in c));`,
  `  bad('no unexpected field (no asset, no internals)', (c) => Object.keys(c).every((k) => ALLOWED.includes(k)));`,
  `  bad('no isCompleted (today\\'s-classes only)', (c) => !('isCompleted' in c));`,
  `  bad('no asset leakage (hlsAsset / pdfAsset / videoAsset absent, also nested)', (c) => !/"(hlsAsset|pdfAsset|videoAsset)"/.test(JSON.stringify(c)));`,
  `  bad('streamStatus is a known state or null/absent', (c) => ${JSON.stringify(STREAM_STATUSES)}.includes(c.streamStatus === undefined ? null : c.streamStatus));`,
  `  bad('_id = courseClassId, course = the requested course', (c) => c._id === c.courseClassId && String(c.course) === course);`,
  `  bad('placement is eligible (isActive, status 1)', (c) => c.isActive === true && c.status === 1);`,
  `  bad('isFree / isBlinking / hasPlayback / isYoutubeRedirect are booleans', (c) => ['isFree', 'isBlinking', 'hasPlayback', 'isYoutubeRedirect'].every((k) => typeof c[k] === 'boolean'));`,
  `  bad('isBlinking only when streamStatus is live (reconnecting never blinks)', (c) => c.isBlinking === (c.streamStatus === 'live'));`,
  `  bad('startDate is a valid date', (c) => !Number.isNaN(new Date(c.startDate).getTime()));`,
  `  bad('taxonomy is null or { _id, name }', (c) => [['mainCategory', 'mainCategoryName'], ['category', 'categoryName'], ['internalSection', 'sectionName'], ['topic', 'topicName']].every(([k, n]) => c[k] === null || (c[k]._id && n in c[k])));`,
  `  bad('no duplicate placement in one page', (c) => cl.filter((o) => o._id === c._id).length === 1);`,
  `  bad('videoPosition, when present: whole seconds ≥ 0', (c) => !('videoPosition' in c) || (Number.isInteger(c.videoPosition) && c.videoPosition >= 0));`,
  `  bad('watch fields, when present: watchStatus known, watchTime a number ≥ 0', (c) => !('watchStatus' in c) || (${JSON.stringify(WATCH_STATUSES)}.includes(c.watchStatus) && typeof c.watchTime === 'number' && c.watchTime >= 0));`,
  `  bad('searchMatch (exact|similar) on every card exactly when the response is searched', (c) => searched ? ['exact', 'similar'].includes(c.searchMatch) : !('searchMatch' in c));`,
  `}`,
);

// ── request builders ─────────────────────────────────────────────────────────
const jsonRaw = (raw) => ({ mode: 'raw', raw, options: { raw: { language: 'json' } } });
const url = (p) => ({ raw: `{{base}}${p}`, host: ['{{base}}'], path: p.replace(/^\//, '').split('/') });

/** Body as literal JSON text so numbers stay numbers and {{vars}} can sit inside strings. */
const bodyText = (fields) => '{\n' + Object.entries(fields)
  .map(([k, v]) => `  "${k}": ${typeof v === 'string' && !v.startsWith('RAW:') ? JSON.stringify(v) : String(v).replace(/^RAW:/, '')}`)
  .join(',\n') + '\n}';

const tabs = (name, { body, token, pre, tests, course = '{{course_id}}', description }) => ({
  name,
  event: [
    (token || pre) && { listen: 'prerequest', script: js(token ? mint(token) : [], pre || []) },
    { listen: 'test', script: js(helpers, tests || []) },
  ].filter(Boolean),
  request: {
    method: 'POST',
    description,
    header: [
      { key: 'Content-Type', value: 'application/json' },
      token && { key: 'Authorization', value: 'Bearer {{token}}' },
    ].filter(Boolean),
    url: url(`/api/courses/${course}/class-tabs`),
    body: jsonRaw(bodyText(body)),
  },
});

const error = (name, status, body, extra = {}) => tabs(name, {
  body,
  course: extra.course,
  pre: extra.pre,
  description: extra.description,
  tests: lines(
    `pm.test('${status}', () => pm.response.to.have.status(${status}));`,
    extra.msg && `pm.test('msg mentions ${extra.msg}', () => pm.expect(pm.response.json().msg).to.include(${JSON.stringify(extra.msg)}));`,
  ),
});

// ── tab-specific checks ──────────────────────────────────────────────────────
const todayChecks = lines(
  `ok200();`,
  `bad('Today: effective start is today (IST) or the class is Live', (c) => istDay(c.startDate) === TODAY || isLive(c));`,
  `pm.test('Today: Live cards first', () => { const f = cl.findIndex((c) => !isLive(c)); pm.expect(f === -1 || cl.slice(f).every((c) => !isLive(c)), ids.join(',')).to.be.true; });`,
  `pm.test('Today: start ascending, then placement id, within Live and within the rest', () => {`,
  `  const grp = (live) => cl.filter((c) => isLive(c) === live).map(key);`,
  `  [true, false].forEach((g) => grp(g).forEach((k, i, a) => { if (i) pm.expect(cmp(a[i - 1], k), 'order at ' + k[1]).to.be.below(0); })); });`,
  `pm.test('Today: nextCursor is null (unpaginated)', () => pm.expect(next).to.eql(null));`,
);

/** A scroll chain: page 1 resets the accumulators; "next page" repeats itself via setNextRequest. */
const chain = ({ prefix, tab, dir, limit, maxPages, extraBad, watch, search }) => {
  const acc = `${prefix}_seen`;
  const cursorVar = `${prefix}_cursor`;
  const pageChecks = lines(
    `ok200();`,
    extraBad,
    `pm.test('${tab}: ≤ limit cards, a full page whenever nextCursor is set', () => { pm.expect(cl.length).to.be.at.most(${limit}); if (next) pm.expect(cl.length).to.eql(${limit}); });`,
    `pm.test('${tab}: ${dir > 0 ? 'ascending' : 'descending'} by (start, placement id) within the page', () => cl.map(key).forEach((k, i, a) => { if (i) pm.expect(${dir} * cmp(a[i - 1], k), 'order at ' + k[1]).to.be.below(0); }));`,
    `const seen = JSON.parse(pm.collectionVariables.get('${acc}') || '{"ids":[],"last":null,"pages":0}');`,
    `pm.test('${tab}: no card repeated from an earlier page', () => { const dup = ids.filter((i) => seen.ids.includes(i)); pm.expect(dup, dup.join(',')).to.eql([]); });`,
    `if (seen.last && cl.length) pm.test('${tab}: continues ${dir > 0 ? 'after' : 'before'} the previous page\\'s last card', () => pm.expect(${dir} * cmp(seen.last, key(cl[0]))).to.be.below(0));`,
    `seen.ids = seen.ids.concat(ids); seen.pages += 1; if (cl.length) seen.last = key(cl[cl.length - 1]);`,
    `pm.collectionVariables.set('${acc}', JSON.stringify(seen));`,
    `pm.collectionVariables.set('${cursorVar}', next || '');`,
  );
  const body = (withCursor) => Object.assign({ tab }, watch ? { watch } : {}, search ? { search } : {}, withCursor ? { cursor: `{{${cursorVar}}}` } : {}, { limit: `RAW:${limit}` });
  const Tab = tab[0].toUpperCase() + tab.slice(1) + (search ? ` · search="${search}"` : '');
  return [
    tabs(`${Tab}${watch ? ` · watch=${watch}` : ''} · page 1 (limit ${limit})`, {
      body: body(false),
      token: watch ? 'valid' : undefined,
      pre: [`pm.collectionVariables.set('${acc}', '');`],
      tests: lines(
        pageChecks,
        `if (seen.pages === 1) pm.collectionVariables.set('${prefix}_p1_cursor', next || '');`,
        !watch && !search && `pm.test('${tab}: page 1 has a nextCursor (enough data for a chain)', () => pm.expect(next).to.be.a('string'));`,
        watch && `if (!next) console.log('${prefix}: one page only for this filter');`,
      ),
    }),
    tabs(`${Tab}${watch ? ` · watch=${watch}` : ''} · next page (repeats until nextCursor null or ${maxPages} pages)`, {
      body: body(true),
      token: watch ? 'valid' : undefined,
      description: `Sends {{${cursorVar}}} from the previous page. In the collection runner it re-queues itself with setNextRequest until nextCursor is null or ${maxPages} pages; with Send it fetches one more page per click.`,
      tests: lines(
        pageChecks,
        `const stop = !next || seen.pages >= ${maxPages};`,
        `if (!stop) pm.execution.setNextRequest(pm.info.requestName);`,
        `if (stop) pm.test('${tab}: chain covered ≥ ${watch || search ? 2 : 3} pages (' + seen.pages + ', ' + seen.ids.length + ' cards, ' + (next ? 'stopped at the page cap' : 'reached the end: nextCursor null') + ')', () => pm.expect(seen.pages).to.be.at.least(${watch || search ? 2 : 3}));`,
      ),
    }),
  ];
};

// ── cases ────────────────────────────────────────────────────────────────────
const folders = [
  {
    name: '0. Contract smoke — every tab (the contract itself runs on every response)',
    description: 'The collection-level test script checks the envelope and every card on every 200 from /class-tabs: required fields, no isCompleted, no asset, streamStatus known or null, eligibility, isBlinking rule, taxonomy shape.',
    item: [
      tabs('Smoke · Today · guest', { body: { tab: 'today' }, pre: [`pm.collectionVariables.set('server_has_watch', '');`], tests: [`ok200();`] }),
      tabs('Smoke · Upcoming · guest', { body: { tab: 'upcoming' }, tests: [`ok200();`] }),
      tabs('Smoke · Previous · guest (default limit 20)', { body: { tab: 'previous' }, tests: [`ok200();`, `pm.test('default limit 20', () => pm.expect(cl.length).to.eql(20));`] }),
      tabs('Smoke · Previous · signed in, limit 50 (max)', { body: { tab: 'previous', limit: 'RAW:50' }, token: 'valid', tests: [`ok200();`, `pm.test('≤ 50 cards', () => pm.expect(cl.length).to.be.at.most(50));`] }),
      tabs('Smoke · Previous · limit 1 (min)', { body: { tab: 'previous', limit: 'RAW:1' }, tests: [`ok200();`, `pm.test('1 card', () => pm.expect(cl.length).to.eql(1));`] }),
    ],
  },
  {
    name: '1. Today — today\'s IST day + any Live class, Live first, unpaginated',
    item: [
      tabs('Today · guest', {
        body: { tab: 'today' },
        tests: lines(todayChecks,
          `console.log('Today (' + TODAY + '): ' + cl.length + ' cards, ' + cl.filter(isLive).length + ' Live');`,
          `pm.collectionVariables.set('today_guest', stable(cl));`,
          `pm.collectionVariables.set('today_ids', JSON.stringify(ids));`),
      }),
      tabs('Today · limit 1 + a garbage cursor → both ignored, same list', {
        body: { tab: 'today', limit: 'RAW:1', cursor: 'not-a-cursor' },
        description: 'Today is served whole: limit and cursor are ignored (a limit must still be a valid number).',
        tests: lines(todayChecks,
          `pm.test('same cards as the plain Today request', () => pm.expect(JSON.stringify(ids)).to.eql(pm.collectionVariables.get('today_ids')));`),
      }),
      tabs('Today · signed in → same cards as guest (watch fields aside)', {
        body: { tab: 'today' }, token: 'valid',
        tests: lines(todayChecks,
          `pm.test('identical to the guest Today, ignoring watch fields', () => pm.expect(stable(cl)).to.eql(pm.collectionVariables.get('today_guest')));`),
      }),
      {
        name: 'Cross-check · legacy todays-classes, same day → same card shape (+ isCompleted)',
        event: [{ listen: 'test', script: js(
          `pm.test('200', () => pm.response.to.have.status(200));`,
          `const legacy = pm.response.json().data.classes;`,
          `const tabs = JSON.parse(pm.collectionVariables.get('today_guest') || '[]');`,
          `const IST_MS = 330 * 60 * 1000; const istDay = (d) => new Date(new Date(d).getTime() + IST_MS).toISOString().slice(0, 10); const TODAY = istDay(Date.now());`,
          `const byId = Object.fromEntries(legacy.map((c) => [c._id, c]));`,
          `const nonLive = tabs.filter((c) => istDay(c.startDate) === TODAY);  // a Live card from another day is not in todays-classes`,
          `pm.test('every same-day Today card is also in todays-classes', () => { const miss = nonLive.filter((c) => !byId[c._id]).map((c) => c._id); pm.expect(miss, miss.join(',')).to.eql([]); });`,
          `pm.test('shared cards: same fields, except todays-classes adds isCompleted', () => nonLive.filter((c) => byId[c._id]).forEach((c) => {`,
          `  const legacyKeys = Object.keys(byId[c._id]).filter((k) => k !== 'isCompleted' && !${JSON.stringify(VOLATILE)}.includes(k)).sort();`,
          `  const tabKeys = Object.keys(c).filter((k) => !['watchStatus', 'watchTime', 'videoPosition'].includes(k)).sort();`,
          `  pm.expect(tabKeys, c._id).to.eql(legacyKeys); }));`,
          `const extra = legacy.filter((c) => !tabs.some((t) => t._id === c._id)).map((c) => c._id + ' status=' + c.status);`,
          `if (extra.length) console.log('in todays-classes only (expected: status-0 placements or inactive Class, PRD "out of scope"): ' + extra.join(', '));`,
        ) }],
        request: {
          method: 'POST',
          header: [{ key: 'Content-Type', value: 'application/json' }],
          url: url('/api/courses/{{course_id}}/todays-classes'),
          body: jsonRaw(bodyText({})),
          description: 'The PRD says class-tabs cards are exactly the today\'s-classes card minus isCompleted (plus watch fields). Guest call: no userId.',
        },
      },
    ],
  },
  {
    name: '2. Upcoming — IST days after today, soonest first, cursor pages',
    item: chain({
      prefix: 'up', tab: 'upcoming', dir: 1, limit: UP_LIMIT, maxPages: UP_MAX_PAGES,
      extraBad: [
        `bad('Upcoming: effective start on an IST day after today', (c) => istDay(c.startDate) > TODAY);`,
        `bad('Upcoming: never a Live class', (c) => !isLive(c));`,
      ],
    }),
  },
  {
    name: `3. Previous — IST days before today, playable, newest first, scroll with limit ${PREV_LIMIT}`,
    item: chain({
      prefix: 'prev', tab: 'previous', dir: -1, limit: PREV_LIMIT, maxPages: PREV_MAX_PAGES,
      extraBad: [
        `bad('Previous: effective start on an IST day before today', (c) => istDay(c.startDate) < TODAY);`,
        `bad('Previous: every card is playable (hasPlayback true)', (c) => c.hasPlayback === true);`,
        `bad('Previous: never a Live class', (c) => !isLive(c));`,
      ],
    }),
  },
  {
    name: '4. Auth — the token alone identifies the student; bad tokens are guests',
    description: 'All on Previous, limit 10. The guest response is the baseline; every other response must match it exactly once watch fields and view counters are removed.',
    item: [
      tabs('Guest (no token) — baseline', {
        body: { tab: 'previous', limit: 'RAW:10' },
        tests: [`ok200();`, `pm.collectionVariables.set('auth_guest', stable(cl) + '|' + next);`],
      }),
      ...[
        ['Guest + body userId = the test student → ignored', { body: { tab: 'previous', limit: 'RAW:10', userId: '{{user_id}}' } }],
        ['Signed in (valid token for user_id)', { token: 'valid' }],
        ['Signed in + body userId of someone else → ignored', { token: 'valid', body: { tab: 'previous', limit: 'RAW:10', userId: '000000000000000000000001' } }],
        ['Expired token → guest', { token: 'expired' }],
        ['Forged token (wrong secret) → guest', { token: 'forged' }],
        ['Garbage token → guest', { token: 'garbage' }],
      ].map(([name, o]) => tabs(name, {
        body: o.body || { tab: 'previous', limit: 'RAW:10' },
        token: o.token,
        tests: [`ok200();`, `pm.test('same cards + nextCursor as the guest baseline (watch fields aside)', () => pm.expect(stable(cl) + '|' + next).to.eql(pm.collectionVariables.get('auth_guest')));`,
          (o.token && o.token !== 'valid') || !o.token
            ? `watchTest('treated as a guest: every card not_watched, watchTime 0', () => pm.expect(cl.every((c) => c.watchStatus === 'not_watched' && c.watchTime === 0)).to.be.true);`
            : null],
      })),
    ],
  },
  {
    name: '5. Errors — 400 for bad input, 404 for an unknown course',
    item: [
      error('Bad tab → 400', 400, { tab: 'yesterday' }),
      error('Missing tab → 400', 400, { limit: 'RAW:5' }),
      error('Bad watch value → 400', 400, { tab: 'previous', watch: 'half' }),
      error('limit 0 → 400', 400, { tab: 'previous', limit: 'RAW:0' }),
      error('limit 51 → 400', 400, { tab: 'previous', limit: 'RAW:51' }),
      error('Fractional limit 2.5 → 400', 400, { tab: 'previous', limit: 'RAW:2.5' }),
      error('limit as a string "5" → 400 (must be a JSON number)', 400, { tab: 'previous', limit: '5' }),
      error('Empty cursor "" → 400', 400, { tab: 'previous', cursor: '' }),
      error('Malformed cursor → 400', 400, { tab: 'previous', cursor: 'not-a-cursor' }, { msg: 'Invalid cursor' }),
      error('Tampered cursor (payload edited, old MAC) → 400', 400, { tab: 'previous', cursor: '{{tampered_cursor}}' }, {
        msg: 'Invalid cursor',
        description: 'Takes the real Previous page-1 cursor from folder 3, moves its start by 1 ms and keeps the old signature.',
        pre: lines(
                  `const c = pm.collectionVariables.get('prev_p1_cursor');`,
          `if (!c) throw new Error('run folder 3 first: no Previous cursor saved');`,
          `const [v, p, m] = c.split('.');`,
          `const b64 = p.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((p.length + 3) % 4);`,
          `const o = JSON.parse(CryptoJS.enc.Base64.parse(b64).toString(CryptoJS.enc.Utf8)); o.s -= 1;`,
          `const p2 = CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(JSON.stringify(o))).replace(/=+$/, '').replace(/\\+/g, '-').replace(/\\//g, '_');`,
          `pm.variables.set('tampered_cursor', [v, p2, m].join('.'));`,
        ),
      }),
      error('A Previous cursor sent on Upcoming → 400', 400, { tab: 'upcoming', cursor: '{{prev_p1_cursor}}' }, { msg: 'different tab' }),
      error('An Upcoming cursor sent on Previous → 400', 400, { tab: 'previous', cursor: '{{up_p1_cursor}}' }, { msg: 'different tab' }),
      error('Bad course id → 400', 400, { tab: 'previous' }, { course: 'not-an-object-id' }),
      error('Unknown course → 404', 404, { tab: 'previous' }, { course: UNKNOWN_COURSE }),
    ],
  },
  {
    name: '6. Watch filters — task 04 (watch tests skip only on a pre-04 server)',
    description: 'Signed in as {{user_id}} unless marked guest. Every watch-dependent test is named "[task 04] …" and is SKIPPED only when cards carry no watchStatus (a server older than task 04). Real data (2026-09-25): the test account has ~9 partial Previous classes and 1 partial Today class in Railway Prime Batch; nobody probed has a Watched one (no Class there has a duration, so only a manual completion can make Watched) — the watched requests therefore check an empty list.',
    item: [
      tabs('Previous · watch=all, signed in — watchStatus + watchTime on every card', {
        body: { tab: 'previous', watch: 'all', limit: 'RAW:50' }, token: 'valid',
        tests: lines(`ok200();`,
          `watchTest('every card has watchStatus ∈ watched|partial|not_watched and a numeric watchTime', () => pm.expect(cl.every((c) => ${JSON.stringify(WATCH_STATUSES)}.includes(c.watchStatus) && typeof c.watchTime === 'number')).to.be.true);`,
          `watchTest('watchTime never exceeds the class duration when one is set', () => pm.expect(cl.filter((c) => c.duration > 0 && c.watchTime > c.duration).map((c) => c._id)).to.eql([]));`,
          `watchTest('not_watched ⇒ watchTime < 60 s (or a manual uncomplete)', () => pm.expect(cl.filter((c) => c.watchStatus === 'not_watched' && c.watchTime >= 60).map((c) => c._id)).to.eql([]));`,
          `watchTest('partial ⇒ watchTime ≥ 60 s', () => pm.expect(cl.filter((c) => c.watchStatus === 'partial' && c.watchTime < 60).map((c) => c._id)).to.eql([]));`,
          `watchTest('the signed-in user has real progress: ≥ 1 partial/watched card in the first 50 (data: test account)', () => pm.expect(cl.some((c) => c.watchStatus !== 'not_watched')).to.be.true);`,
          `if (hasWatch) console.log('watch mix (first 50 Previous): ' + JSON.stringify(cl.reduce((m, c) => (m[c.watchStatus] = (m[c.watchStatus] || 0) + 1, m), {})));`),
      }),
      ...['watched'].map((w) => tabs(`Previous · watch=${w}, signed in — only ${w} cards`, {
        body: { tab: 'previous', watch: w, limit: `RAW:${WATCH_LIMIT}` }, token: 'valid',
        tests: lines(`ok200();`,
          `watchTest('every card is ${w}', () => pm.expect(cl.filter((c) => c.watchStatus !== '${w}').map((c) => c._id)).to.eql([]));`,
          `watchTest('a full page whenever nextCursor is set (filtered before paging)', () => { if (next) pm.expect(cl.length).to.eql(${WATCH_LIMIT}); });`,
          `if (!cl.length) console.log('watch=${w}: the test user has no ${w} Previous class in this course');`),
      })),
      ...chain({
        prefix: 'pw', tab: 'previous', dir: -1, limit: WATCH_LIMIT, maxPages: 3, watch: 'partial',
        extraBad: [`if (hasWatch) bad('[task 04] every card is partial with watchTime ≥ 60 s', (c) => c.watchStatus === 'partial' && c.watchTime >= 60);`],
      }),
      ...chain({
        prefix: 'nw', tab: 'previous', dir: -1, limit: WATCH_LIMIT, maxPages: 3, watch: 'not_watched',
        extraBad: [`if (hasWatch) bad('[task 04] every card is not_watched', (c) => c.watchStatus === 'not_watched');`],
      }),
      tabs('Today · watch=partial, signed in — only partial', {
        body: { tab: 'today', watch: 'partial' }, token: 'valid',
        tests: lines(`ok200();`,
          `watchTest('every card is partial', () => pm.expect(cl.filter((c) => c.watchStatus !== 'partial').map((c) => c._id)).to.eql([]));`,
          `const all = JSON.parse(pm.collectionVariables.get('today_ids') || '[]');`,
          `pm.test('a subset of the unfiltered Today, same order', () => pm.expect(all.filter((i) => ids.includes(i))).to.eql(ids));`,
          `pm.test('nextCursor null (Today)', () => pm.expect(next).to.eql(null));`),
      }),
      tabs('Today · watch=watched, signed in — only watched; a Live card is never watched', {
        body: { tab: 'today', watch: 'watched' }, token: 'valid',
        tests: lines(`ok200();`,
          `watchTest('every card is watched and none is Live', () => pm.expect(cl.filter((c) => c.watchStatus !== 'watched' || isLive(c)).map((c) => c._id)).to.eql([]));`,
          `pm.test('nextCursor null (Today)', () => pm.expect(next).to.eql(null));`),
      }),
      ...['watched', 'partial'].flatMap((w) => ['previous', 'today'].map((tab) => tabs(`Guest · ${tab} · watch=${w} → empty list`, {
        body: { tab, watch: w },
        tests: lines(`ok200();`,
          `const t = cl.length === 0 || hasWatch ? pm.test : pm.test.skip;`,
          `t('[task 04] guest ${w} → classes []', () => pm.expect(ids).to.eql([]));`,
          `t('[task 04] guest ${w} → nextCursor null', () => pm.expect(next).to.eql(null));`),
      }))),
      tabs('Guest · previous · watch=not_watched → the whole tab, all not_watched', {
        body: { tab: 'previous', watch: 'not_watched', limit: 'RAW:10' },
        tests: lines(`ok200();`,
          `watchTest('every card not_watched with watchTime 0', () => pm.expect(cl.every((c) => c.watchStatus === 'not_watched' && c.watchTime === 0)).to.be.true);`,
          `pm.test('same cards as the unfiltered guest baseline (folder 4)', () => pm.expect(stable(cl) + '|' + next).to.eql(pm.collectionVariables.get('auth_guest')));`),
      }),
      tabs('Upcoming · watch=watched, signed in → watch ignored', {
        body: { tab: 'upcoming', watch: 'watched', limit: `RAW:${UP_LIMIT}` }, token: 'valid',
        tests: lines(`ok200();`,
          `const seen = JSON.parse(pm.collectionVariables.get('up_seen') || '{"ids":[]}');`,
          `pm.test('same first page as the unfiltered Upcoming chain (folder 2)', () => pm.expect(ids).to.eql(seen.ids.slice(0, ${UP_LIMIT})));`,
          `watchTest('Upcoming cards are not_watched with watchTime 0', () => pm.expect(cl.every((c) => c.watchStatus === 'not_watched' && c.watchTime === 0)).to.be.true);`),
      }),
    ],
  },
  {
    name: `7. Search — search="${SEARCH}" narrows the tab; order, watch and paging unchanged`,
    description: 'Class tab search (fork 3c89b0a37). Matching = course search rules on the card title. Needs folders 3 and 4 first (baselines + cursors).',
    item: [
      tabs(`Previous · search="${SEARCH}" · plain counts first`, {
        body: { tab: 'previous', limit: 'RAW:1' },
        tests: [`ok200();`, `pm.collectionVariables.set('plain_tab_counts', JSON.stringify(res.data.tabCounts));`],
      }),
      ...chain({
        prefix: 'ps', tab: 'previous', dir: -1, limit: PREV_LIMIT, maxPages: 4, search: SEARCH,
        extraBad: [
          `bad('search: every exact card has the word in its title', (c) => c.searchMatch !== 'exact' || c.title.toLowerCase().includes('${SEARCH}'));`,
          `pm.test('search: data.search.query echoes the text', () => pm.expect(res.data.search.query).to.eql('${SEARCH}'));`,
          `pm.test('search: tabCounts ≤ the plain tab sizes; totalCount = tabCounts.previous (watch all)', () => { const plain = JSON.parse(pm.collectionVariables.get('plain_tab_counts') || '{}'); ['today', 'upcoming', 'previous'].forEach((t) => pm.expect(res.data.tabCounts[t]).to.be.at.most(plain[t])); pm.expect(res.data.totalCount).to.eql(res.data.tabCounts.previous); });`,
          `bad('Previous: effective start on an IST day before today', (c) => istDay(c.startDate) < TODAY);`,
        ],
      }),
      tabs(`Today · search="${SEARCH}" — a subset of Today, same order`, {
        body: { tab: 'today', search: SEARCH },
        tests: lines(todayChecks,
          `const all = JSON.parse(pm.collectionVariables.get('today_ids') || '[]');`,
          `pm.test('a subset of the unsearched Today, same order', () => pm.expect(all.filter((i) => ids.includes(i))).to.eql(ids));`,
          `pm.test('totalCount = cards = tabCounts.today', () => { pm.expect(res.data.totalCount).to.eql(cl.length); pm.expect(res.data.tabCounts.today).to.eql(cl.length); });`),
      }),
      tabs(`Previous · search="  ${SEARCH.toUpperCase()} " — case/space variant keeps the searched cursor`, {
        body: { tab: 'previous', search: `  ${SEARCH.toUpperCase()} `, cursor: '{{ps_p1_cursor}}', limit: `RAW:${PREV_LIMIT}` },
        tests: [`ok200();`, `const seen = JSON.parse(pm.collectionVariables.get('ps_seen') || '{"ids":[]}');`,
          `pm.test('same page 2 as the chain', () => pm.expect(ids).to.eql(seen.ids.slice(${PREV_LIMIT}, ${PREV_LIMIT * 2})));`],
      }),
      tabs('Previous · search="   " (blank) → the plain guest baseline (folder 4)', {
        body: { tab: 'previous', limit: 'RAW:10', search: '   ' },
        tests: [`ok200();`, `pm.test('identical to the unsearched guest baseline', () => pm.expect(stable(cl) + '|' + next).to.eql(pm.collectionVariables.get('auth_guest')));`,
          `pm.test('no data.search', () => pm.expect('search' in res.data).to.be.false);`],
      }),
      tabs('Previous · search="alligation" — close spellings labelled similar', {
        body: { tab: 'previous', search: 'alligation', limit: 'RAW:50' },
        tests: [`ok200();`, `console.log('alligation: ' + cl.length + ' cards, similarSpellings ' + JSON.stringify(res.data.search && res.data.search.similarSpellings));`,
          `bad('a similar card does not contain the typed word', (c) => c.searchMatch !== 'similar' || !c.title.toLowerCase().includes('alligation'));`],
      }),
      error('search 1 character → 400', 400, { tab: 'previous', search: 'p' }),
      error('search not a string → 400', 400, { tab: 'previous', search: 'RAW:42' }),
      error('Searched cursor with another search → 400', 400, { tab: 'previous', search: 'ratio', cursor: '{{ps_p1_cursor}}' }, { msg: 'different search' }),
      error('Searched cursor without search → 400', 400, { tab: 'previous', cursor: '{{ps_p1_cursor}}' }, { msg: 'different search' }),
      error('Plain cursor with a search → 400', 400, { tab: 'previous', search: SEARCH, cursor: '{{prev_p1_cursor}}' }, { msg: 'different search' }),
    ],
  },
];

const collection = {
  info: {
    name: 'Course class tabs — Today / Upcoming / Previous',
    description: [
      'Contract checks for POST /api/courses/:courseId/class-tabs, runnable against the prod read-only',
      'server (real data). Setup: reference/postman/course-class-tabs.README.md. Signed-in requests mint',
      'their own JWT with the LOCAL jwt_secret — point {{base}} only at the local test worktree, never at',
      'prod. Folder 6 needs task 04 (its watch tests skip on an older server).',
    ].join(' '),
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  event: [{ listen: 'test', script: js(contract) }],
  item: folders,
  variable: [
    ...Object.entries(VARS).map(([key, value]) => ({ key, value, type: 'string' })),
    ...['token', 'today_guest', 'today_ids', 'auth_guest', 'up_seen', 'up_cursor', 'up_p1_cursor',
      'prev_seen', 'prev_cursor', 'prev_p1_cursor', 'nw_seen', 'nw_cursor', 'nw_p1_cursor',
      'pw_seen', 'pw_cursor', 'pw_p1_cursor', 'ps_seen', 'ps_cursor', 'ps_p1_cursor', 'plain_tab_counts', 'server_has_watch']
      .map((key) => ({ key, value: '', type: 'string' })),
  ],
};

fs.mkdirSync(OUT, { recursive: true });
const file = path.join(OUT, `${NAME}.postman_collection.json`);
fs.writeFileSync(file, JSON.stringify(collection, null, 2) + '\n');
const count = folders.reduce((n, f) => n + f.item.length, 0);
console.log(`wrote ${path.relative(process.cwd(), file)} — ${folders.length} folders, ${count} requests`);
