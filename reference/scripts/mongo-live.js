// Live view of what one Mongo member is doing: load summary, busiest collections and the
// slowest queries running right now. Redraws every EVERY seconds. Read-only. Ctrl-C to stop.
//
//   mongosh --quiet "<uri with directConnection=true>" --eval 'var EVERY=5, N=10, MIN_SECS=0' --file mongo-live.js
//
// EVERY = refresh seconds (5), N = how many running queries to list (10),
// MIN_SECS = hide queries running for less than this (0 = show everything active).
const every = (typeof EVERY !== 'undefined' ? EVERY : 5) * 1000;
const n = typeof N !== 'undefined' ? N : 10;
const minSecs = typeof MIN_SECS !== 'undefined' ? MIN_SECS : 0;

const admin = db.getSiblingDB('admin');
const SECRET = /("(mobile|email|password|token|phone|fcmToken|device_token|token_id|session_id|otp)"\s*:\s*)"[^"]*"/gi;
const redact = (s) => s.replace(SECRET, '$1"<redacted>"');
const num = (v) => (v && typeof v.toNumber === 'function' ? v.toNumber() : Number(v || 0));

function snap() {
  return {
    t: Date.now(),
    s: admin.runCommand({ serverStatus: 1, tcmalloc: 0 }),
    top: admin.runCommand({ top: 1 }).totals,
    primary: db.hello().isWritablePrimary,
  };
}

let prev = snap();
while (true) {
  sleep(every);
  const cur = snap();
  const dt = (cur.t - prev.t) / 1000;
  const s = cur.s;
  const p = prev.s;
  const rate = (a, b) => Math.round((num(a) - num(b)) / dt);
  const oc = (k) => rate(s.opcounters[k], p.opcounters[k]);
  const lat = (k) => {
    const d = num(s.opLatencies[k].ops) - num(p.opLatencies[k].ops);
    return d ? ((num(s.opLatencies[k].latency) - num(p.opLatencies[k].latency)) / d / 1000).toFixed(1) : '0';
  };
  const qe = s.metrics.queryExecutor;
  const pqe = p.metrics.queryExecutor;
  const cache = s.wiredTiger.cache;
  const q = s.globalLock.currentQueue;

  const out = [];
  out.push(`${new Date().toTimeString().slice(0, 8)}  ${s.host}  ${cur.primary ? 'PRIMARY' : 'SECONDARY'}  (refresh ${every / 1000}s, Ctrl-C to stop)`);
  out.push(`ops/s     query ${oc('query')}  getmore ${oc('getmore')}  command ${oc('command')}  insert ${oc('insert')}  update ${oc('update')}  delete ${oc('delete')}`);
  out.push(`latency   reads ${lat('reads')} ms  writes ${lat('writes')} ms  commands ${lat('commands')} ms`);
  out.push(`scanned/s docs ${rate(qe.scannedObjects, pqe.scannedObjects).toLocaleString()}  keys ${rate(qe.scanned, pqe.scanned).toLocaleString()}`);
  out.push(`conns ${s.connections.current} (active ${s.connections.active})  queued r/w ${q.readers}/${q.writers}  cache ${(100 * num(cache['bytes currently in the cache']) / num(cache['maximum bytes configured'])).toFixed(1)}%`);

  out.push('');
  out.push('== busiest collections this interval (summed op time, can exceed wall time):');
  Object.keys(cur.top)
    .filter((k) => k !== 'note' && prev.top[k] && !/^(local|admin|config)\./.test(k))
    .map((k) => ({
      ns: k,
      ms: (num(cur.top[k].total.time) - num(prev.top[k].total.time)) / 1000,
      ops: num(cur.top[k].total.count) - num(prev.top[k].total.count),
    }))
    .filter((r) => r.ops > 0)
    .sort((a, b) => b.ms - a.ms)
    .slice(0, 5)
    .forEach((r) => out.push(`  ${r.ms.toFixed(0).padStart(10)} ms  ${String(r.ops).padStart(6)} ops  ${r.ns}`));

  const ops = admin
    .aggregate([
      { $currentOp: { allUsers: true, idleConnections: false } },
      { $match: { active: true, op: { $ne: 'none' }, ns: { $not: /^(local|admin|config)\./ } } },
    ])
    .toArray()
    .filter((o) => !(o.command && (o.command.hello || o.command.isMaster || o.command.ismaster)))
    .filter((o) => num(o.microsecs_running) >= minSecs * 1e6)
    .sort((a, b) => num(b.microsecs_running) - num(a.microsecs_running));

  out.push('');
  out.push(`== slowest running queries now: ${ops.length} active, showing ${Math.min(n, ops.length)}`);
  ops.slice(0, n).forEach((o) => {
    const { lsid, $clusterTime, $db, $readPreference, signature, ...cmd } = o.command || {};
    out.push(
      `  ${(num(o.microsecs_running) / 1e6).toFixed(1).padStart(6)}s  ${o.op} ${o.ns}  ${o.planSummary || ''}  docs ${num(o.docsExamined)}  ${(o.client || '').split(':')[0]}`
    );
    out.push(`          ${redact(JSON.stringify(cmd)).slice(0, 220)}`);
  });

  print('\x1b[2J\x1b[H' + out.join('\n'));
  prev = cur;
}
