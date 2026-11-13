#!/usr/bin/env bash
# read-only: quicktricks logins made by scripts, not the app or a browser, from `userloginsessions.device_info`
# (the login request's User-Agent). The 10-26/27/28 account-takeover batches log in as `Python/3.14 aiohttp/3.10.5`;
# the AWS scraper's own logins are `Python/3.12 aiohttp/…` and `python-requests/…`.
# Prints every matching login in the last HOURS, a per-run summary (bursts split on a 30 min gap), then with
# FOLLOW=1 keeps polling and prints new ones live until Ctrl-C (or MAX_MINUTES).
#
# usage: ./qt_script_logins.sh            env: UA (regex, default the script tools below), HOURS (default 24),
#        FOLLOW=1, POLL (seconds, default 10), MAX_MINUTES (follow cap, default 120), QUIET=1 (summary only)
# e.g.   UA='^Python/3\.14 aiohttp' FOLLOW=1 ./qt_script_logins.sh
set -euo pipefail

UA=${UA:-'^(Python|python-requests|aiohttp|curl|Go-http-client|PostmanRuntime|Wget)'}
HOURS=${HOURS:-24}; FOLLOW=${FOLLOW:-0}; POLL=${POLL:-10}; MAX_MINUTES=${MAX_MINUTES:-120}; QUIET=${QUIET:-0}
BOX="ssh -i $HOME/.ssh/hranker-webserver2-2 -o ConnectTimeout=15 -o ServerAliveInterval=30 hranker@148.113.49.18"
APP=/var/www/backend.quicktricksbysahilsir.com/quicktricks-backend

# the node script goes over ssh stdin (`node -`), so nothing is left on the box
$BOX "export PATH=/home/hranker/.nvm/versions/node/v22.22.2/bin:\$PATH; cd $APP && \
  UA='$UA' HOURS=$HOURS FOLLOW=$FOLLOW POLL=$POLL MAX_MINUTES=$MAX_MINUTES QUIET=$QUIET \
  NODE_PATH=$APP/node_modules DOTENV_CONFIG_PATH=.env.development node -r dotenv/config -" <<'JS'
const mongoose = require('mongoose');
const rx = new RegExp(process.env.UA);
const ist = d => new Date(d.getTime() + 19800000).toISOString().slice(5, 19).replace('T', ' ');
const mask = m => m ? String(m).replace(/^(.*)(\d{3})$/, (_, a, b) => '*'.repeat(Math.max(0, a.length - 2)) + a.slice(-2) + b) : '-';
process.stdout.on('error', () => process.exit(0)); // ssh gone → stop polling

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { readPreference: 'secondaryPreferred' });
  const db = mongoose.connection.db, c = db.collection('userloginsessions');
  const mobiles = new Map();
  const fetch = async since => {
    const rows = await c.find({ login_time: { $gt: since }, device_info: { $regex: rx } },
      { projection: { login_time: 1, user_id: 1, device_info: 1 } }).sort({ login_time: 1 }).toArray();
    const missing = [...new Set(rows.map(r => String(r.user_id)))].filter(u => !mobiles.has(u) && mongoose.Types.ObjectId.isValid(u));
    if (missing.length) for (const u of await db.collection('users').find({ _id: { $in: missing.map(u => new mongoose.Types.ObjectId(u)) } },
      { projection: { mobile: 1 } }).toArray()) mobiles.set(String(u._id), mask(u.mobile));
    return rows;
  };
  const line = r => `${ist(r.login_time)}  ${r.user_id}  ${(mobiles.get(String(r.user_id)) || '-').padEnd(10)}  ${String(r.device_info).slice(0, 60)}`;

  const rows = await fetch(new Date(Date.now() - Number(process.env.HOURS) * 36e5));
  if (process.env.QUIET !== '1') { console.log('IST time        account                   mobile      device'); rows.forEach(r => console.log(line(r))); }
  const runs = []; let cur;
  for (const r of rows) { if (!cur || r.login_time - cur.last > 30 * 60e3) runs.push(cur = { first: r.login_time, n: 0, u: new Set(), ua: new Set() }); cur.last = r.login_time; cur.n++; cur.u.add(String(r.user_id)); cur.ua.add(String(r.device_info).slice(0, 30)); }
  console.log(`\n== runs in the last ${process.env.HOURS}h (split on 30 min quiet)`);
  if (!runs.length) console.log('none');
  for (const x of runs) console.log(`${ist(x.first)} → ${ist(x.last).slice(6)}  logins=${x.n}  accounts=${x.u.size}  ${[...x.ua].join(', ')}`);

  if (process.env.FOLLOW === '1') {
    let since = rows.length ? rows.at(-1).login_time : new Date(), quiet = 0;
    const end = Date.now() + Number(process.env.MAX_MINUTES) * 60e3, poll = Number(process.env.POLL) * 1000;
    console.log(`\n== following (every ${process.env.POLL}s, Ctrl-C to stop)`);
    while (Date.now() < end) {
      await new Promise(r => setTimeout(r, poll));
      const fresh = await fetch(since);
      if (fresh.length) { fresh.forEach(r => console.log(line(r))); since = fresh.at(-1).login_time; quiet = 0; }
      else if ((quiet += poll) >= 60e3) { console.log(`${ist(new Date())}  (no new script logins)`); quiet = 0; }
    }
  }
  await mongoose.disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
JS
