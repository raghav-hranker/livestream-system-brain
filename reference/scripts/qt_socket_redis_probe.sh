#!/usr/bin/env bash
# Read-only probe of the quicktricks-socket Redis (Redis Cloud redis-19504).
# Runs on the prod box with the socket app's own .env + redis module; issues
# only read commands (PING, INFO, SLOWLOG GET, LATENCY LATEST, CLIENT LIST,
# SCARD, HLEN, MEMORY USAGE, SCAN). Prints no secrets.
#   bash reference/scripts/qt_socket_redis_probe.sh [classId]
set -euo pipefail
CLASS="${1:-6ace40f7abbe7476bf69c7a2}"
ssh -i ~/.ssh/hranker-webserver2-2 -o ConnectTimeout=10 hranker@148.113.49.18 \
  "export PATH=/home/hranker/.nvm/versions/node/v22.22.2/bin:\$PATH
   cd /var/www/socket.quicktricksbysahilsir.com/livestream/backend
   CLASS=$CLASS node - <<'JS'
const fs = require('fs');
const env = Object.fromEntries(fs.readFileSync('.env', 'utf8').split('\n')
  .filter(l => /^REDIS_/.test(l)).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^['\"]|['\"]$/g, '')]));
const { createClient } = require('redis');
const c = createClient({ username: env.REDIS_USERNAME, password: env.REDIS_PASSWORD,
  socket: { host: env.REDIS_HOST, port: Number(env.REDIS_PORT), connectTimeout: 10000, reconnectStrategy: false } });
const pick = (txt, re) => txt.split('\r\n').filter(l => re.test(l)).join('\n');
(async () => {
  await c.connect();
  let t = Date.now(); await c.ping(); console.log('PING ms', Date.now() - t);
  const info = await c.info();
  console.log('\n== INFO'); console.log(pick(info, /^(redis_version|uptime_in_seconds|run_id|connected_clients|maxclients|blocked_clients|pubsub_clients|used_memory_human|maxmemory_human|maxmemory_policy|instantaneous_ops_per_sec|instantaneous_input_kbps|instantaneous_output_kbps|total_net_input_bytes|total_net_output_bytes|rejected_connections|evicted_keys|total_commands_processed|pubsub_channels|pubsub_patterns|db\d+)[:=]/));
  console.log('\n== SLOWLOG (newest 25; IST time, micros, cmd)');
  try { for (const e of (await c.sendCommand(['SLOWLOG', 'GET', '25']))) console.log(new Date(e[1] * 1000).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }), e[2], String(e[3].slice(0, 3)).slice(0, 120)); } catch (e) { console.log('slowlog n/a:', e.message); }
  console.log('\n== LATENCY LATEST');
  try { console.log(JSON.stringify(await c.sendCommand(['LATENCY', 'LATEST']))); } catch (e) { console.log('n/a:', e.message); }
  console.log('\n== CLIENT LIST (by source ip; omem = pending output bytes)');
  try {
    const rows = (await c.sendCommand(['CLIENT', 'LIST'])).trim().split('\n').map(l => Object.fromEntries(l.split(' ').map(kv => kv.split('='))));
    const by = {}; for (const r of rows) { const ip = (r.addr || '').split(':')[0]; const b = by[ip] ||= { n: 0, sub: 0, omem: 0, qbuf: 0 }; b.n++; b.sub += Number(r.sub || 0) + Number(r.psub || 0) ? 1 : 0; b.omem += Number(r.omem || 0); b.qbuf += Number(r.qbuf || 0); }
    console.table(by);
  } catch (e) { console.log('n/a:', e.message); }
  const C = process.env.CLASS;
  console.log('\n== class', C);
  console.log('host:sessions SCARD', await c.sCard('host:sessions:' + C));
  console.log('currentViewers HLEN', await c.hLen('room:' + C + ':currentViewers'));
  try { console.log('currentViewers bytes', await c.sendCommand(['MEMORY', 'USAGE', 'room:' + C + ':currentViewers'])); } catch (e) { console.log('memory usage n/a:', e.message); }
  console.log('\n== biggest host:sessions / currentViewers keys (SCAN)');
  const hs = [], cv = [];
  for await (const k of c.scanIterator({ MATCH: 'host:sessions:*', COUNT: 1000 })) hs.push([k, await c.sCard(k)]);
  for await (const k of c.scanIterator({ MATCH: 'room:*:currentViewers', COUNT: 1000 })) cv.push([k, await c.hLen(k)]);
  console.log('host:sessions keys', hs.length, 'top', JSON.stringify(hs.sort((a, b) => b[1] - a[1]).slice(0, 8)));
  console.log('currentViewers keys', cv.length, 'total entries', cv.reduce((s, x) => s + x[1], 0), 'top', JSON.stringify(cv.sort((a, b) => b[1] - a[1]).slice(0, 8)));
  await c.quit();
})().catch(e => { console.error('probe failed:', e.message); process.exit(1); });
JS"
