'use strict';
// Vidyagram completion fleet: switch the shared AppX gate org:2177599:all between the lock gate and reservation mode.
// Run on migrator from ~/vidyagram-completion-azure-20261103 (vidyagramdb only):
//   runtime/node/bin/node gate-mode.cjs status    read-only: mode, in-flight leases, running workers by gateClient
//   runtime/node/bin/node gate-mode.cjs reserve   **writes the gate**: dispatchMode 'reserve'. Refuses unless no worker is
//                                                 running (fresh heartbeat) and no request is in flight, i.e. between runs or
//                                                 during a stop, after the new request client is staged on every host.
//   runtime/node/bin/node gate-mode.cjs lock      **writes the gate**: back to the lock gate. Safe at any time: a reserving
//                                                 worker falls back to the lock gate on its next request.
// After the reopen, `status` must show every running worker with gateClient reserve-v1; if any shows 'lock', run `lock`.
const fs = require('node:fs');
const os = require('node:os');

const GATE = 'org:2177599:all';
const FRESH_MS = 120000;
const log = (event, extra = {}) => console.log(JSON.stringify({at: new Date().toISOString(), event, ...extra}));

async function main() {
  if (os.hostname() !== 'migrator') throw Error('wrong_host');
  const mode = process.argv[2];
  if (!['status', 'reserve', 'lock'].includes(mode)) throw Error('invalid_mode');
  const dep = name => require(require.resolve(name, {paths: [process.cwd() + '/runtime']}));
  const uri = dep('dotenv').parse(fs.readFileSync('.env.development')).MONGO_URI;
  if (!/^mongodb(?:\+srv)?:\/\/[^/]+\/vidyagramdb(?:\?|$)/.test(uri || '')) throw Error('wrong_tenant');
  const client = new (dep('mongodb').MongoClient)(uri, {minPoolSize: 0, maxPoolSize: 2, serverSelectionTimeoutMS: 15000, readPreference: 'primary'});
  try {
    const db = client.db('vidyagramdb');
    const gates = db.collection('apx_vg_request_limits'), workers = db.collection('apx_vg_completion_workers');
    const now = new Date();
    const gate = await gates.findOne({_id: GATE}, {projection: {dispatchMode: 1, maxConcurrent: 1, dispatchGapMs: 1, penalty: 1, dispatchPenaltyBaseline: 1,
      inflight: 1, lastStartAt: 1, reserveSwitchedAt: 1, vgDispatchTrial: 1}});
    const live = (gate?.inflight || []).filter(x => +new Date(x.until) > +now);
    const running = await workers.aggregate([{$match: {state: 'running', heartbeatAt: {$gte: new Date(+now - FRESH_MS)}}},
      {$group: {_id: {run: '$runId', gateClient: {$ifNull: ['$gateClient', 'lock']}}, n: {$sum: 1}}}]).toArray();
    const view = {mode: gate?.dispatchMode ?? 'lock', maxConcurrent: gate?.maxConcurrent, dispatchGapMs: gate?.dispatchGapMs, penalty: gate?.penalty,
      inflight: live.length, lastStartAt: gate?.lastStartAt, reserveSwitchedAt: gate?.reserveSwitchedAt,
      runningWorkers: running.map(x => ({run: x._id.run, gateClient: x._id.gateClient, n: x.n}))};
    if (mode === 'status') return log('status', view);
    if (mode === 'lock') {
      await gates.updateOne({_id: GATE}, {$unset: {dispatchMode: ''}, $set: {lockSwitchedAt: now}});
      return log('lock', {before: view.mode});
    }
    if (gate?.maxConcurrent !== 2 || gate.dispatchPenaltyBaseline !== 4 || !gate.dispatchGapMs) throw Error('gate_not_two_slot_spaced');
    if (running.length) throw Error('workers_running');
    if (live.length) throw Error('requests_in_flight');
    // Clean start: drop reservation state left from an earlier switch.
    const r = await gates.updateOne({_id: GATE, dispatchMode: {$ne: 'reserve'}},
      {$set: {dispatchMode: 'reserve', reserveSwitchedAt: now}, $unset: {inflight: '', lastStartAt: '', reserveRoutes: '', reserveAdminAt: '', routeReadyAt: '', adminReadyAt: ''}});
    log('reserve', {switched: r.modifiedCount === 1, gate: {dispatchGapMs: gate.dispatchGapMs, penalty: gate.penalty}});
  } finally {
    await client.close();
  }
}

if (require.main === module) main().catch(error => {
  log('failed', {reason: /^[a-z_]+$/.test(error.message) ? error.message : error.name});
  process.exitCode = 1;
});
