// What one collection costs right now, per reachable rs0 member, without running any query against it.
// Samples currentOp SAMPLES times (default 6) every 5 s and summarises the slow-query lines still in the member's
// in-memory log. Prints shapes and timings only, never query values.
// Run on webserver2-2 from a backend checkout: DB=vidyagramdb COL=userquestionanswers node - < script
// ENV_FILE (default .env.development) is read relative to the working directory.
const { createRequire } = require('module');
const fs = require('fs');
const path = require('path');
const r = createRequire(`${process.cwd()}/package.json`);
const { MongoClient } = r('mongoose').mongo;

const { DB, COL } = process.env;
const SAMPLES = Number(process.env.SAMPLES || 6);
const env = fs.readFileSync(path.resolve(process.cwd(), process.env.ENV_FILE || '.env.development'), 'utf8');
const uri = (env.match(/^MONGO_URI=(.*)$/m) || [])[1].trim().replace(/^['"]|['"]$/g, '');
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

const parts = uri.match(/^(mongodb:\/\/(?:[^@/]+@)?)([^/]+)(\/[^?]*)?(\?.*)?$/);
const directUri = (host) => {
  const query = new URLSearchParams((parts[4] || '').slice(1));
  ['replicaSet', 'readPreference', 'readConcernLevel', 'w'].forEach((k) => query.delete(k));
  query.set('directConnection', 'true');
  query.set('readPreference', 'secondaryPreferred');
  return `${parts[1]}${host}/admin?${query}`;
};

const percentile = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];

const inspect = async (host) => {
  const client = new MongoClient(directUri(host), { serverSelectionTimeoutMS: 8000 });
  await client.connect();
  const admin = client.db('admin');
  const ns = `${DB}.${COL}`;
  const samples = [];
  for (let i = 0; i < SAMPLES; i += 1) {
    const { inprog } = await admin.command({ currentOp: 1, active: true, ns });
    samples.push(inprog.map((op) => ({ secs: op.secs_running || 0, plan: op.planSummary || '?' })));
    if (i < SAMPLES - 1) await sleep(5000);
  }
  const running = samples.map((s) => s.length);
  const longest = Math.max(0, ...samples.flat().map((o) => o.secs));
  const plans = {};
  samples.flat().forEach((o) => { plans[o.plan] = (plans[o.plan] || 0) + 1; });
  console.log(`${host} running on ${ns} per sample ${running.join(' ')}, longest ${longest} s, plans ${JSON.stringify(plans)}`);

  const status = await admin.command({ serverStatus: 1 });
  const cache = status.wiredTiger.cache;
  console.log(`${host} conns ${status.connections.current}, active ${status.globalLock.activeClients.total}, queued ${status.globalLock.currentQueue.total}, cache ${(cache['bytes currently in the cache'] / 2 ** 30).toFixed(1)}/${(cache['maximum bytes configured'] / 2 ** 30).toFixed(1)} GB`);

  const { log } = await admin.command({ getLog: 'global' });
  const slow = log.map((line) => { try { return JSON.parse(line); } catch { return null; } })
    .filter((e) => e?.msg === 'Slow query' && e.attr?.ns === ns);
  const byPlan = {};
  slow.forEach((e) => { (byPlan[e.attr.planSummary || '?'] ||= []).push(e.attr); });
  Object.entries(byPlan).forEach(([plan, rows]) => {
    const ms = rows.map((a) => a.durationMillis).sort((a, b) => a - b);
    const docs = rows.map((a) => a.docsExamined || 0).sort((a, b) => a - b);
    console.log(`${host} slow ${plan}: ${rows.length} lines, ms p50 ${percentile(ms, 0.5)} max ${ms[ms.length - 1]}, docs examined p50 ${percentile(docs, 0.5)}`);
  });
  const stamps = log.map((line) => { try { return JSON.parse(line).t?.$date; } catch { return null; } }).filter(Boolean);
  console.log(`${host} log window ${stamps[0]} to ${stamps[stamps.length - 1]}, ${slow.length} slow lines on this collection of ${log.length}`);
  await client.close();
};

(async () => {
  for (const host of parts[2].split(',')) {
    await inspect(host).catch((error) => console.log(`${host} unavailable: ${error.message}`));
  }
})();
