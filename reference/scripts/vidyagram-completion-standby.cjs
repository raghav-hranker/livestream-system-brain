'use strict';
// Vidyagram completion fleet: hold one worker slot between stops of the cohort in VG_COMPLETION_RUN (a vg-completion-*-next10000 run).
// Deployed on every fleet host as <stage>/standby.cjs; the launcher runs, per role:
//   g=600000; while node standby.cjs <role> $g; do node vidyagram-completion-pilot.cjs worker <role>; g=0; sleep 5; done
// Exit 0 = the run was (re)opened after this standby began (minus graceMs): start the pilot worker.
// Exit non-zero = leave the loop for good: run finished, operator_stopped (the kill switch), 36 h with no reopen.
// Heartbeats apx_vg_completion_workers {_id: RUN:standby:<host>:<role>, state: 'standby'}; the auto-resume watchdog counts them.
// Needs VG_APP_ROOT, VG_ENV_PATH, VG_COMPLETION_RUN (same env as the pilot worker).
const fs = require('node:fs');
const os = require('node:os');
const {setTimeout: wait} = require('node:timers/promises');

const RUN = process.env.VG_COMPLETION_RUN || '';
const POLL_MS = Number(process.env.VG_STANDBY_POLL_MS || 15000);
const MAX_MS = Number(process.env.VG_STANDBY_MAX_MS || 36 * 3600000);

// Pure: what a standby does with the run doc it just read.
function standbyDecision(run, {startedAt, graceMs, now, maxMs = MAX_MS}) {
  if (!run) return {exit: 'run_missing'};
  if (run.finishedAt) return {exit: 'run_finished'};
  if (run.status === 'operator_stopped') return {exit: 'operator_stopped'};
  const open = run.stopped !== true && !(run.expiresAt <= now);
  if (open && run.resumedAt instanceof Date && +run.resumedAt >= +startedAt - graceMs) return {release: true};
  if (+now - +startedAt >= maxMs) return {exit: 'standby_expired'};
  return {wait: true};
}

async function main() {
  const [role, graceArg] = process.argv.slice(2);
  const graceMs = Number(graceArg || 0);
  if (!['acquire', 'read'].includes(role) || !Number.isFinite(graceMs) || graceMs < 0 || !/^vg-completion-\d{8}-next10000$/.test(RUN)) throw Error('wrong_standby_scope');
  const dep = name => require(require.resolve(name, {paths: [process.env.VG_APP_ROOT]}));
  const uri = dep('dotenv').parse(fs.readFileSync(process.env.VG_ENV_PATH)).MONGO_URI;
  if (!/^mongodb(?:\+srv)?:\/\/[^/]+\/vidyagramdb(?:\?|$)/.test(uri || '')) throw Error('wrong_tenant');
  const client = new (dep('mongodb').MongoClient)(uri, {minPoolSize: 0, maxPoolSize: 2, serverSelectionTimeoutMS: 8000, readPreference: 'primary'});
  const host = os.hostname(), id = `${RUN}:standby:${host}:${role}`, startedAt = new Date();
  const log = (event, extra = {}) => console.log(JSON.stringify({at: new Date().toISOString(), event, role, ...extra}));
  try {
    const db = client.db('vidyagramdb');
    const workers = db.collection('apx_vg_completion_workers');
    log('standby', {graceMs});
    for (;;) {
      try {
        const run = await db.collection('apx_vg_completion_pilots').findOne({_id: RUN}, {projection: {stopped: 1, status: 1, resumedAt: 1, finishedAt: 1, expiresAt: 1}});
        const d = standbyDecision(run, {startedAt, graceMs, now: new Date()});
        if (d.exit) {
          await workers.updateOne({_id: id}, {$set: {runId: RUN, host, role, state: 'standby_exited', reason: d.exit, heartbeatAt: new Date()}}, {upsert: true});
          log('standby_exit', {reason: d.exit});
          process.exitCode = 3;
          return;
        }
        if (d.release) {
          await workers.updateOne({_id: id}, {$set: {runId: RUN, host, role, state: 'released', heartbeatAt: new Date()}}, {upsert: true});
          log('standby_released', {resumedAt: run.resumedAt});
          return;
        }
        await workers.updateOne({_id: id}, {$set: {runId: RUN, host, role, state: 'standby', since: startedAt, heartbeatAt: new Date()}}, {upsert: true});
      } catch (error) {
        log('standby_retry', {type: error.name});
      }
      await wait(POLL_MS + Math.floor(Math.random() * 5000));
    }
  } finally {
    await client.close();
  }
}

module.exports = {standbyDecision};
if (require.main === module) main().catch(error => {
  console.log(JSON.stringify({event: 'standby_exit', reason: /^[a-z_]+$/.test(error.message) ? error.message : error.name}));
  process.exitCode = 2;
});
