#!/usr/bin/env node
// Read-only, no DB: lists every Express route mounted after the commented global
// `app.use(authenticateToken)` line in a backend checkout, with the auth middleware
// Express actually runs for it (app-level + router-level + route-level).
//
// Usage: node route_auth_inventory.cjs <backend checkout> [out.tsv]
// Loads each router module through ts-node (transpile-only) with a dead MONGO_URI
// and DISABLE_CRONS=true; nothing is started or connected on purpose.
const fs = require('fs');
const path = require('path');

const root = path.resolve(process.argv[2] || '.');
const out = process.argv[3];
process.env.MONGO_URI = 'mongodb://127.0.0.1:1/route-inventory';
process.env.DISABLE_CRONS = 'true';
process.env.TS_NODE_TRANSPILE_ONLY = 'true';
process.env.TS_NODE_PROJECT = path.join(root, 'tsconfig.json');
require(require.resolve('ts-node/register', { paths: [root] }));

const AUTH_NAMES = new Set([
  'authenticateToken', 'requireAuth', 'requireAdmin', 'optionalAuthenticateToken',
  'authenticateIfPresent', 'authenticateUserOrStreamer', 'requireTranscoderSecret',
  'requireSelfOrAdmin', 'requireAuditAdmin', 'apxIngestSecretGate',
]);

// The per-group route gate (src/middleware/routeGate.ts, Vidyagram): every gate() returns a function named
// `routeGate`, so the group is lost in the Express stack. Rename each one to `routeGate:<GROUP>:<allow>` before
// any router loads. A checkout without the file (quicktricks) is left alone.
const routeGatePath = path.join(root, 'src/middleware/routeGate.ts');
if (fs.existsSync(routeGatePath)) {
  const routeGateModule = require(routeGatePath);
  const originalGate = routeGateModule.gate;
  Object.defineProperty(routeGateModule, 'gate', {
    configurable: true,
    writable: true,
    value: (options) => {
      const handler = originalGate(options);
      Object.defineProperty(handler, 'name', { value: `routeGate:${options.group}:${options.allow}` });
      return handler;
    },
  });
}
const isAuthName = (name) => AUTH_NAMES.has(name) || name.startsWith('routeGate:');

const appSrc = fs.readFileSync(path.join(root, 'src/app.ts'), 'utf8');
const lines = appSrc.split('\n');
const gateLine = lines.findIndex((l) => /^(\/\/\s*app\.use\(authenticateToken\);|app\.use\(studentAuthGate\()/.test(l));
if (gateLine < 0) throw new Error('neither the commented global gate nor the studentAuthGate mount found in src/app.ts');

const imports = {};
for (const m of appSrc.matchAll(/^import\s+(\w+)\s+from\s+'(\.\/routes\/[^']+)'/gm)) imports[m[1]] = m[2];
for (const m of appSrc.matchAll(/^import\s+\{([^}]+)\}\s+from\s+'(\.\/routes\/[^']+)'/gm)) {
  for (const name of m[1].split(',').map((s) => s.trim().split(/\s+as\s+/).pop())) imports[name] = `${m[2]}#${name}`;
}

function loadRouter(spec) {
  const [rel, named] = spec.split('#');
  const mod = require(path.join(root, 'src', rel));
  return named ? mod[named] : mod.default || mod;
}

function mwName(fn) {
  return fn && fn.name ? fn.name : '<anon>';
}

function joinPath(a, b) {
  return (a + '/' + b).replace(/\/+/g, '/').replace(/(.)\/$/, '$1');
}

function layerPath(layer) {
  if (layer.route) return layer.route.path;
  const src = layer.regexp && layer.regexp.source;
  if (!src || src === '^\\/?(?=\\/|$)') return '';
  return src.replace(/^\^/, '').replace(/\\\/\?\(\?=\\\/\|\$\)$/, '').replace(/\\\//g, '/').replace(/\(\?:\(\[\^\\\/\]\+\?\)\)/g, ':param');
}

// A handler that takes the student from the request body (`req.body.userId`, `req.body?.user_id`,
// `const { userId } = req.body`) serves per-student data wherever it is mounted.
const BODY_USER_ID = /req\.body\??\.(userId|user_id)\b|\{[^}]*\b(userId|user_id)\b[^}]*\}\s*=\s*req\.body\b/;
function readsBodyUserId(fn) {
  return typeof fn === 'function' && BODY_USER_ID.test(Function.prototype.toString.call(fn));
}

const rows = [];
function walk(router, prefix, inherited, mountLine) {
  const stack = (router && router.stack) || [];
  let routerLevel = [];
  for (const layer of stack) {
    if (layer.route) {
      for (const method of Object.keys(layer.route.methods)) {
        const handlers = layer.route.stack.filter((l) => !l.method || l.method === method).map((l) => mwName(l.handle));
        const auth = [...inherited, ...routerLevel, ...handlers.filter(isAuthName)];
        const last = layer.route.stack.filter((l) => !l.method || l.method === method).pop();
        rows.push({ method: method.toUpperCase(), path: joinPath(prefix, layer.route.path), auth: auth.join('+') || 'none', mountLine, handler: handlers[handlers.length - 1], bodyUserId: readsBodyUserId(last && last.handle) });
      }
    } else if (layer.handle && layer.handle.stack) {
      walk(layer.handle, joinPath(prefix, layerPath(layer)), [...inherited, ...routerLevel], mountLine);
    } else if (isAuthName(mwName(layer.handle))) {
      routerLevel = [...routerLevel, mwName(layer.handle)];
    }
  }
}

const skipped = [];
for (let i = gateLine + 1; i < lines.length; i++) {
  const line = lines[i];
  const use = line.match(/^app\.use\('([^']+)',\s*(.+)\);?\s*$/);
  const direct = line.match(/^app\.(get|post|put|patch|delete)\('([^']+)',\s*(.+)\);?\s*$/);
  if (use) {
    const args = use[2].replace(/\);?\s*$/, '').split(',').map((s) => s.trim());
    const routerVar = args[args.length - 1];
    const appLevel = args.slice(0, -1).filter((a) => AUTH_NAMES.has(a));
    if (!imports[routerVar]) { skipped.push(`${i + 1}: ${line.trim()}`); continue; }
    try {
      walk(loadRouter(imports[routerVar]), use[1], appLevel, i + 1);
    } catch (err) {
      skipped.push(`${i + 1}: ${line.trim()} (load failed: ${err.message.split('\n')[0]})`);
    }
  } else if (direct) {
    const args = direct[3].split(',').map((s) => s.trim());
    rows.push({ method: direct[1].toUpperCase(), path: direct[2], auth: args.filter((a) => AUTH_NAMES.has(a)).join('+') || 'none', mountLine: i + 1, handler: '<inline>' });
  }
}

// Categories for the per-tenant auth gate (vidyagram/plans/auth-gate-route-inventory.md):
//   own-auth   checks its own credential (Transcoder secret, Streamer token, sync secret, worker)
//   auth-flow  login / signup / OTP / refresh: must stay public
//   admin      requireAdmin, or an /api/admin* path
//   guarded    already runs authenticateToken: the gate adds nothing
//   route-gate behind the per-group route gate (ROUTE_GATE_<GROUP>): that gate owns it, the student gate must not
//   guest      optional auth by design: must stay public
//   student    no auth today, per-student data: the gate's target
//   body-student  no login required, outside the student areas, and the handler takes the student from the
//              body: per-student wherever it is mounted. Gate candidates; one may be in the gate table
//   chat       no auth today, Q-Hub chat: needs the app's headers checked first
//   content    no auth today, catalogue reads + content writes the admin makes: untouched in step 1
const STUDENT_AREAS = /^\/api\/(users|orders|package-order|user-test|user-test-dlq|user-stats|coins|user-coins|user-points|streaks?|typing-test|saved-questions|report-questions|course-progress|class-progress|test-results|score|rank-scores|slot-machine|home-stats|daily-stats|user-question-answers|room-test-leaderboard|views)(\/|$)/;
const AUTH_FLOW = /^\/api\/(users\/(login|mobile-login|register|batch-register|forgot-password|refresh-token|verify-login-otp|sendOtp|verifyOtp|checkMobileExist|checkEmailExist|linked-email|linked-mobile|live-activity|peers-near|login-peers)|admins\/(login|verify-login-otp)|v1\/auth|delete-account)(\/|$)/;
// Inside a student area but left open on purpose: the typing-test settings (no student in them), and the
// profile read the app calls without a token (quicktricks rolled a lock on it back, 2026-10-28), and the three
// /api/score routes behind the website's public exam score calculator.
const OPEN_ON_PURPOSE = /^(GET \/api\/typing-test\/config|GET \/api\/users\/:id|(POST|GET) \/api\/score\/.*)$/;
const OWN_AUTH_AREAS = /^\/api\/(sync|apx-ingest-jobs)(\/|$)/;

function category(r) {
  if (/requireTranscoderSecret|authenticateUserOrStreamer|apxIngestSecretGate/.test(r.auth) || OWN_AUTH_AREAS.test(r.path)) return 'own-auth';
  if (AUTH_FLOW.test(r.path)) return 'auth-flow';
  if (/requireAdmin|requireAuditAdmin/.test(r.auth) || /^\/api\/admins?(\/|$)/.test(r.path)) return 'admin';
  if (/(^|\+)(authenticateToken|requireAuth|requireSelfOrAdmin)(\+|$)/.test(r.auth)) return 'guarded';
  if (/routeGate:/.test(r.auth)) return 'route-gate';
  if (r.auth === 'none' && /^\/api\/v1(\/|$)/.test(r.path)) return 'chat';
  // Optional auth reads a token when one is sent and never asks for one, so in a student area the route is
  // as open as one with no auth.
  if (OPEN_ON_PURPOSE.test(`${r.method} ${r.path}`)) return r.auth === 'none' ? 'content' : 'guest';
  if ((r.auth === 'none' || r.auth === 'optionalAuthenticateToken') && STUDENT_AREAS.test(r.path)) return 'student';
  if (r.bodyUserId) return 'body-student';
  if (r.auth !== 'none') return 'guest';
  return 'content';
}

const tsv = ['category\tmethod\tpath\tauth\tapp_ts_line\thandler', ...rows.map((r) => [category(r), r.method, r.path, r.auth, r.mountLine, r.handler].join('\t'))].join('\n');
if (out) fs.writeFileSync(out, tsv + '\n');
else console.log(tsv);
const counts = {};
for (const r of rows) counts[category(r)] = (counts[category(r)] || 0) + 1;
console.error(`gate line ${gateLine + 1}; ${rows.length} routes after it`);

// Once src/middleware/studentAuthGate.ts exists: every `student` route must be in its table,
// and no other route may match a table entry (a sample URL per route, params filled in).
const gatePath = path.join(root, 'src/middleware/studentAuthGate.ts');
let gateProblems = 0;
if (fs.existsSync(gatePath)) {
  const { STUDENT_ROUTES } = require(gatePath);
  const { match } = require(require.resolve('path-to-regexp', { paths: [root] }));
  const gated = STUDENT_ROUTES.map((entry) => {
    const [method, pattern] = entry.split(' ');
    return { method, pattern, test: match(pattern) };
  });
  const sampleUrl = (p) => p.replace(/:[A-Za-z_]\w*/g, 'x1');
  const hit = (r) => gated.find((g) => g.method === r.method && g.test(sampleUrl(r.path)));
  for (const r of rows) {
    const g = hit(r);
    if (category(r) === 'student' && !g) { gateProblems++; console.error(`UNGATED student route: ${r.method} ${r.path}`); }
    // A `guarded` route already demands the same token, so the gate catching it only repeats the check.
    // The same holds for a requireAdmin route a student pattern happens to cover (/admin under /:id).
    if ((category(r) === 'guarded' || /requireAdmin|requireAuditAdmin/.test(r.auth)) && g) console.error(`note, double check: ${r.method} ${r.path} via ${g.pattern}`);
    // An entry that names this exact route is deliberate (the second batch gates student actions in content
    // and chat areas); a mistake is a route swept up by another route's pattern.
    else if (category(r) !== 'student' && category(r) !== 'body-student' && g && g.pattern !== r.path) { gateProblems++; console.error(`GATED by mistake (${category(r)}): ${r.method} ${r.path} via ${g.pattern}`); }
  }
  const bodyStudent = rows.filter((r) => category(r) === 'body-student');
  console.error(`student gate: ${STUDENT_ROUTES.length} entries, ${gateProblems} problems; body-student ${bodyStudent.filter(hit).length} gated of ${bodyStudent.length}`);
}
console.error(Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `  ${v}\t${k}`).join('\n'));
if (skipped.length) console.error('skipped mounts:\n  ' + skipped.join('\n  '));
process.exit(gateProblems ? 1 : 0);
