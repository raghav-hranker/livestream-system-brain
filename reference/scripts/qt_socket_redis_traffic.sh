#!/usr/bin/env bash
# Read-only: who is moving bytes through the shared Redis Cloud (redis-19504) right now.
# Samples CLIENT LIST + INFO commandstats/stats twice, SECS apart, and prints deltas:
# per-client output (tot-net-out, Redis >= 7.4), per-command calls/usec, total in/out.
#   bash reference/scripts/qt_socket_redis_traffic.sh [SECS]
set -euo pipefail
SECS="${1:-20}"
ssh -i ~/.ssh/hranker-webserver2-2 -o ConnectTimeout=10 hranker@148.113.49.18 \
  "export PATH=/home/hranker/.nvm/versions/node/v22.22.2/bin:\$PATH
   cd /var/www/socket.quicktricksbysahilsir.com/livestream/backend
   SECS=$SECS node - <<'JS'
const fs = require('fs');
const env = Object.fromEntries(fs.readFileSync('.env', 'utf8').split('\n')
  .filter(l => /^REDIS_/.test(l)).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^['\"]|['\"]$/g, '')]));
const { createClient } = require('redis');
const c = createClient({ username: env.REDIS_USERNAME, password: env.REDIS_PASSWORD,
  socket: { host: env.REDIS_HOST, port: Number(env.REDIS_PORT), connectTimeout: 10000, reconnectStrategy: false } });
const kv = (txt) => Object.fromEntries(txt.split('\r\n').filter(l => l.includes(':') && !l.startsWith('#')).map(l => [l.slice(0, l.indexOf(':')), l.slice(l.indexOf(':') + 1)]));
const clients = async () => (await c.sendCommand(['CLIENT', 'LIST'])).trim().split('\n')
  .map(l => Object.fromEntries(l.split(' ').map(p => [p.slice(0, p.indexOf('=')), p.slice(p.indexOf('=') + 1)])));
const cmdstats = async () => { const o = {}; for (const [k, v] of Object.entries(kv(await c.info('commandstats')))) { const m = /calls=(\d+),usec=(\d+)/.exec(v); if (m) o[k.replace('cmdstat_', '')] = { calls: +m[1], usec: +m[2] }; } return o; };
const sample = async () => ({ t: Date.now(), stats: kv(await c.info('stats')), cl: await clients(), cs: await cmdstats() });
(async () => {
  await c.connect();
  const a = await sample();
  console.log('client fields:', Object.keys(a.cl[0] || {}).join(','));
  await new Promise(r => setTimeout(r, Number(process.env.SECS) * 1000));
  const b = await sample();
  const dt = (b.t - a.t) / 1000;
  const d = (k) => (Number(b.stats[k]) - Number(a.stats[k])) / dt / 1024;
  console.log('\n== totals over', dt.toFixed(1), 's: in', d('total_net_input_bytes').toFixed(0), 'KB/s, out', d('total_net_output_bytes').toFixed(0), 'KB/s, cmds', ((Number(b.stats.total_commands_processed) - Number(a.stats.total_commands_processed)) / dt).toFixed(0), '/s');
  console.log('\n== commands by calls/s (top 15)');
  console.table(Object.entries(b.cs).map(([k, v]) => { const p = a.cs[k] || { calls: 0, usec: 0 }; return { cmd: k, 'calls/s': +((v.calls - p.calls) / dt).toFixed(1), 'usec/call': v.calls - p.calls ? Math.round((v.usec - p.usec) / (v.calls - p.calls)) : 0 }; }).filter(r => r['calls/s'] > 0).sort((x, y) => y['calls/s'] - x['calls/s']).slice(0, 15));
  const prev = Object.fromEntries(a.cl.map(x => [x.id, x]));
  const rows = b.cl.map(x => { const p = prev[x.id]; const out = x['tot-net-out'] !== undefined && p ? (Number(x['tot-net-out']) - Number(p['tot-net-out'])) / dt / 1024 : null; const inn = x['tot-net-in'] !== undefined && p ? (Number(x['tot-net-in']) - Number(p['tot-net-in'])) / dt / 1024 : null;
    return { ip: (x.addr || '').split(':')[0], name: x.name || '', age: +x.age, idle: +x.idle, sub: +(x.sub || 0) + +(x.psub || 0), cmd: x.cmd, 'outKB/s': out === null ? 'n/a' : +out.toFixed(1), 'inKB/s': inn === null ? 'n/a' : +inn.toFixed(1), 'totOutMB': x['tot-net-out'] ? +(Number(x['tot-net-out']) / 1048576).toFixed(0) : 'n/a' }; });
  console.log('\n== clients by output (all', rows.length, ')');
  console.table(rows.sort((x, y) => (typeof y['outKB/s'] === 'number' ? y['outKB/s'] : -1) - (typeof x['outKB/s'] === 'number' ? x['outKB/s'] : -1) || y.totOutMB - x.totOutMB));
  await c.quit();
})().catch(e => { console.error('probe failed:', e.message); process.exit(1); });
JS"
