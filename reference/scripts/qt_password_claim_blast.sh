#!/usr/bin/env bash
# read-only: blast radius of closing the APX first-password claim on POST /api/users/login (fix 2, 10-28).
# Who logs in for the first time on an imported (AppX) account, and how many of them end up with
# password_setup_required:false (i.e. set their password through the /login claim branch)?
#
# Part 1 (Mongo, secondary): APX accounts (usersApxId set, or mapped in apxuseridmaps) whose FIRST-EVER login
#   session falls in the last DAYS days, per IST day of that session, split by the flag now and by the UA family
#   of that first session (Dart = phone app, Mozilla = website, Python 3.14 aiohttp = the takeover batch tool).
#   A flag-false account here lost the flag on or after that day through the claim branch (the only path that
#   clears it: verify-login-otp's pending-password branch has had no caller since e7ae52378, 09-02).
#   Caveat: an account whose first session was an OTP login and that claimed later is dated by the OTP day.
# Part 2 (pm2 out log, bounded): status counts per auth route over the last LOG_BYTES of the log. Only
#   method/path/status are kept on the box; bodies (which carry passwords) never leave it.
#
# usage: ./qt_password_claim_blast.sh       env: DAYS (default 30), LOG_BYTES (default 800000000), SKIP_LOG=1
set -euo pipefail

DAYS=${DAYS:-30}; LOG_BYTES=${LOG_BYTES:-800000000}; SKIP_LOG=${SKIP_LOG:-0}
BOX="ssh -i $HOME/.ssh/hranker-webserver2-2 -o ConnectTimeout=15 -o ServerAliveInterval=30 hranker@148.113.49.18"
APP=/var/www/backend.quicktricksbysahilsir.com/quicktricks-backend

echo "== part 1: first-ever logins on APX accounts, last $DAYS days"
$BOX "export PATH=/home/hranker/.nvm/versions/node/v22.22.2/bin:\$PATH; cd $APP && \
  DAYS=$DAYS NODE_PATH=$APP/node_modules DOTENV_CONFIG_PATH=.env.development node -r dotenv/config -" <<'JS'
const mongoose = require('mongoose');
const istDay = d => new Date(d.getTime() + 19800000).toISOString().slice(0, 10);
const family = ua => {
  ua = String(ua || '');
  if (/^Dart\//.test(ua)) return 'app';
  if (/^Mozilla\//.test(ua)) return 'web';
  if (/^Python\/3\.14 aiohttp/.test(ua)) return 'batch';
  if (/^(Python|python-requests|aiohttp|curl|Go-http-client|PostmanRuntime|Wget)/.test(ua)) return 'script';
  return 'other';
};
(async () => {
  await mongoose.connect(process.env.MONGO_URI, { readPreference: 'secondaryPreferred' });
  const db = mongoose.connection.db;
  const start = new Date(Date.now() - Number(process.env.DAYS) * 864e5);

  const firsts = await db.collection('userloginsessions').aggregate([
    { $match: { customer_id: 472, login_time: { $gte: start } } },
    { $sort: { login_time: 1 } },
    { $group: { _id: '$user_id', t: { $first: '$login_time' }, ua: { $first: '$device_info' } } },
  ], { allowDiskUse: true }).toArray();
  console.log(`accounts with a session in the window: ${firsts.length}`);

  const rows = new Map();
  const ids = firsts.map(f => f._id);
  for (let i = 0; i < ids.length; i += 5000) {
    const chunk = ids.slice(i, i + 5000);
    const earlier = new Set((await db.collection('userloginsessions').distinct('user_id',
      { user_id: { $in: chunk }, login_time: { $lt: start } })).map(String));
    const mapped = new Set((await db.collection('apxuseridmaps').distinct('userId', { userId: { $in: chunk } })).map(String));
    const users = await db.collection('users').find({ _id: { $in: chunk } },
      { projection: { usersApxId: 1, password_setup_required: 1 } }).toArray();
    for (const u of users) {
      const id = String(u._id);
      if (earlier.has(id)) continue;
      if (!u.usersApxId && !mapped.has(id)) continue;
      rows.set(id, { flag: u.password_setup_required === true });
    }
  }
  const byDay = {};
  const tot = { app: [0, 0], web: [0, 0], batch: [0, 0], script: [0, 0], other: [0, 0] };
  for (const f of firsts) {
    const r = rows.get(String(f._id));
    if (!r) continue;
    const d = istDay(f.t), fam = family(f.ua);
    byDay[d] ??= { app: [0, 0], web: [0, 0], batch: [0, 0], script: [0, 0], other: [0, 0] };
    byDay[d][fam][r.flag ? 1 : 0]++; tot[fam][r.flag ? 1 : 0]++;
  }
  console.log('cells = claimed(flag false now)/still-flagged, by UA of the first-ever session');
  console.log('IST day      app(Dart)    web(Mozilla)  batch(py3.14)  script      other');
  const cell = c => `${c[0]}/${c[1]}`.padEnd(13);
  for (const d of Object.keys(byDay).sort()) {
    const x = byDay[d];
    console.log(`${d}   ${cell(x.app)}${cell(x.web)}${cell(x.batch)}${cell(x.script)}${cell(x.other)}`);
  }
  console.log(`TOTAL        ${cell(tot.app)}${cell(tot.web)}${cell(tot.batch)}${cell(tot.script)}${cell(tot.other)}`);
  const real = tot.app[0] + tot.web[0] + tot.other[0];
  console.log(`real (app+web+other) claims: ${real} in ${process.env.DAYS} days ≈ ${(real / Number(process.env.DAYS)).toFixed(1)}/day`);
  console.log(`flagged now: ${await db.collection('users').countDocuments({ customer_id: 472, password_setup_required: true })}`);
  await mongoose.disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
JS

[ "$SKIP_LOG" = 1 ] && exit 0
echo; echo "== part 2: auth route status counts, last $LOG_BYTES bytes of the pm2 out log"
$BOX "tail -c $LOG_BYTES ~/.pm2/logs/quicktricks-backend-out.log | \
  grep -aoE '^(POST|GET) https?://[^ ]*/api/users/(login|mobile-login|change-password|forgot-password|verify-login-otp|sendOtp/)[^ ]* → [0-9]{3}' | \
  sed -E 's#^(POST|GET) https?://[^/]*(/api/users/[a-z-]+[A-Za-z]*)[^ ]* → ([0-9]{3})#\1 \2 \3#' | sort | uniq -c | sort -k2,3; \
  echo; echo 'chunk timestamps (first/last lines that carry one):'; \
  tail -c $LOG_BYTES ~/.pm2/logs/quicktricks-backend-out.log | grep -aoE '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:]{8}' | sed -n '1p;\$p'"
