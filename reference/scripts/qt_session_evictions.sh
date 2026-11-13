#!/usr/bin/env bash
# read-only: who ended quicktricks student login sessions in the last HOURS (default 48).
# A session that ends (login_status false) is matched to the same user's next login of the same device_type
# whose login_time is within 5 s of the end (checkLoginLimit evicts the same-type slot, MaxLoginsLimit=2).
# Each end is classed by the UA family of the evicted session and of the evicting login:
#   app (okhttp/Dart/Flutter/CFNetwork), browser (Mozilla/), script (Python/aiohttp/requests/curl/…), none.
# "no new login" = ended by something else (self-delete, an admin/script reset, a bulk updateMany).
# Then: users kicked >= 3 times, and how many of those kicks came from a script login.
# Mobiles are masked; nothing is written. The node script goes over ssh stdin.
#
# usage: ./qt_session_evictions.sh        env: HOURS (default 48), TOP (default 15)
set -euo pipefail

HOURS=${HOURS:-48}; TOP=${TOP:-15}
BOX="ssh -i $HOME/.ssh/hranker-webserver2-2 -o ConnectTimeout=15 hranker@148.113.49.18"
APP=/var/www/backend.quicktricksbysahilsir.com/quicktricks-backend

$BOX "export PATH=/home/hranker/.nvm/versions/node/v22.22.2/bin:\$PATH; cd $APP && \
  HOURS=$HOURS TOP=$TOP NODE_PATH=$APP/node_modules DOTENV_CONFIG_PATH=.env.development node -r dotenv/config -" <<'JS'
const mongoose = require('mongoose');
const fam = ua => !ua ? 'none'
  : /okhttp|dart\/|flutter|cfnetwork|reactnative|react-native/i.test(ua) ? 'app'
  : /mozilla\//i.test(ua) ? 'browser'
  : /python|aiohttp|requests|curl|go-http|postman|wget|httpx|node-fetch|axios/i.test(ua) ? 'script' : 'other';
const ist = d => new Date(d.getTime() + 19800000).toISOString().slice(5, 16).replace('T', ' ');
const hourIst = d => new Date(d.getTime() + 19800000).toISOString().slice(5, 13).replace('T', ' ');
const mask = m => m ? String(m).replace(/^(.*)(\d{3})$/, (_, a, b) => '*'.repeat(Math.max(0, a.length - 2)) + a.slice(-2) + b) : '-';

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { readPreference: 'secondaryPreferred' });
  const c = mongoose.connection.db.collection('userloginsessions');
  const since = new Date(Date.now() - Number(process.env.HOURS) * 36e5);
  const proj = { projection: { session_id: 0 } };

  const ended = await c.find({ customer_id: 472, login_status: false, updatedAt: { $gte: since } }, proj).toArray();
  const userIds = [...new Set(ended.map(s => String(s.user_id)))];
  const logins = await c.find({ user_id: { $in: ended.map(s => s.user_id) }, login_time: { $gte: new Date(since - 864e5) } }, proj).toArray();
  const byUser = new Map();
  for (const l of logins) (byUser.get(String(l.user_id)) || byUser.set(String(l.user_id), []).get(String(l.user_id))).push(l);

  const pair = new Map(), perUser = new Map(), byHour = new Map();
  for (const s of ended) {
    const end = s.updatedAt.getTime();
    const next = (byUser.get(String(s.user_id)) || []).find(l =>
      l.device_type === s.device_type && String(l._id) !== String(s._id) && Math.abs(l.login_time.getTime() - end) <= 5000);
    const k = `${s.device_type.padEnd(6)} ${fam(s.device_info).padEnd(7)} <- ${next ? fam(next.device_info) : 'no new login'}`;
    pair.set(k, (pair.get(k) || 0) + 1);
    const u = perUser.get(String(s.user_id)) || { n: 0, script: 0, none: 0 };
    u.n++; if (next && fam(next.device_info) === 'script') u.script++; if (!next) u.none++;
    perUser.set(String(s.user_id), u);
    if (next && fam(next.device_info) === 'script') byHour.set(hourIst(s.updatedAt), (byHour.get(hourIst(s.updatedAt)) || 0) + 1);
  }

  const total = await c.countDocuments({ customer_id: 472, login_time: { $gte: since } });
  console.log(`### last ${process.env.HOURS} h: ${total} logins, ${ended.length} sessions ended, ${userIds.length} users`);
  console.log('ended session (type, UA family) <- what ended it');
  for (const [k, n] of [...pair].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(6)}  ${k}`);

  console.log('\n### kicks by a script login, per IST hour');
  for (const [h, n] of [...byHour].sort()) console.log(`  ${h}h  ${n}`);

  const heavy = [...perUser].filter(([, u]) => u.n >= 3).sort((a, b) => b[1].n - a[1].n);
  console.log(`\n### users ended >= 3 times: ${heavy.length} (of whom ${heavy.filter(([, u]) => u.script).length} had a script-login kick)`);
  const users = await mongoose.connection.db.collection('users').find(
    { _id: { $in: heavy.slice(0, Number(process.env.TOP)).map(([id]) => new mongoose.Types.ObjectId(id)) } },
    { projection: { mobile: 1 } }).toArray();
  const mob = new Map(users.map(u => [String(u._id), u.mobile]));
  for (const [id, u] of heavy.slice(0, Number(process.env.TOP))) {
    const rows = (byUser.get(id) || []).filter(l => l.login_time >= since).sort((a, b) => a.login_time - b.login_time);
    console.log(`  ${mask(mob.get(id))} ${id} ended=${u.n} byScript=${u.script} noNewLogin=${u.none} logins: ` +
      rows.map(l => `${ist(l.login_time)} ${l.device_type[0]}/${fam(l.device_info)}`).join(', '));
  }
  await mongoose.disconnect();
})().catch(e => { console.error(e); process.exit(1); });
JS
