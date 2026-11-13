'use strict';
// Vidyagram completion fleet: auto-resume vg-completion-20261109-next10000 after a known-safe stop.
// Deployed on migrator as ~/vidyagram-completion-azure-20261103/fleet800-cohort-20261109/autoresume.cjs; run from the parent dir:
//   runtime/node/bin/node fleet800-cohort-20261109/autoresume.cjs status | tick [--dry-run] | arm | disarm
// Cron (every 5 min): flock -n .../autoresume.lock node .../autoresume.cjs tick >> .../autoresume.log
// A tick does the manual "Next resume" runbook: resume-next.cjs preview -> resume-admin-check.cjs (no OTP) ->
// nohup flock guard.lock "resume-next.cjs commit <fp> && exec controller-retain-penalty.cjs guard". Standby workers
// (vidyagram-completion-standby.cjs) wake on the reopen; the guard's 12-learner canary gates OTPs as before.
// Every check in resume-next.cjs and the guard still applies (any AppX 4xx since the trial start blocks a resume).
// Policy, all stored in apx_vg_completion_autoresume {_id: RUN}:
//   enabled must be true (arm/disarm); safe stops only (SAFE below); 20 min after the stop (60 min if the run stopped
//   within 30 min of the last auto-resume); at most 8 attempts in 24 h, voided ones not counted (4 until 11-13);
//   gate penalty >= 6; >= 10 acquire workers on standby.
//   FAST stops (no AppX slow-down signal: transport timeouts, the backend's shared pause, a guard Mongo blip) wait 5 min
//   (20 min after a quick stop) instead of 20 (60) — 11-13, user: "I need to hurry up".
//   Also the nightly stale-OTP stop (account_auth_failure_spike / otp_not_fresh|otp_not_available, no HTTP, stopped
//   03:45-04:30 IST): resumes no earlier than 05:00 IST. The same spike at any other hour waits for a person.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {execFile, spawn} = require('node:child_process');
const {setTimeout: wait} = require('node:timers/promises');

// VG_COMPLETION_RUN picks the cohort (default 20261109); KIT is that cohort's folder on migrator.
const KITS = {'vg-completion-20261109-next10000': 'fleet800-cohort-20261109', 'vg-completion-20261112-next10000': 'fleet800-cohort-20261112', 'vg-completion-20261113-next10000': 'fleet800-cohort-20261113'};
const RUN = process.env.VG_COMPLETION_RUN || 'vg-completion-20261109-next10000', GATE = 'org:2177599:all', KIT = KITS[RUN];
const POLICY = {
  coolOffMs: 20 * 60000, quickStopMs: 30 * 60000, quickStopCoolOffMs: 60 * 60000,
  fastCoolOffMs: 5 * 60000, fastQuickCoolOffMs: 20 * 60000,
  maxPerDay: 8, minPenalty: 6, minStandbyAcquire: 10, standbyFreshMs: 2 * 60000,
  // AppX stops issuing fresh OTPs around 04:00 IST (stops 11-05 04:08, 11-09 04:02, 11-12 04:02 IST).
  // A stale-OTP spike that stops inside this IST window waits until nightlyResumeIst, then resumes through the canary.
  nightlyWindowIst: [3 * 60 + 45, 4 * 60 + 30], nightlyResumeIst: 5 * 60,
};
// status -> stopCause codes that may auto-resume (null = any code without an AppX 4xx).
// trial_controller_recovered: the guard hit Mongo errors and stopped the run to be safe (11-12 18:22 IST); not an AppX signal.
const SAFE = {experiment_throttled: ['admin_shared_pause'], token_failures_stop: null, checkpoint_review: null, trial_controller_recovered: null};
// Stops that carry no AppX slow-down signal: short cool-off.
const FAST = {token_failures_stop: ['TimeoutError', 'TypeError'], experiment_throttled: ['admin_shared_pause'], trial_controller_recovered: null};
const isFast = (status, code) => status in FAST && (FAST[status] === null || FAST[status].includes(code));
const STALE_OTP = ['otp_not_fresh', 'otp_not_available'];
const istMinutes = date => (date.getUTCHours() * 60 + date.getUTCMinutes() + 330) % 1440;
// The nightly stale-OTP stop: account_auth_failure_spike from stale OTPs (no HTTP status) inside the IST window.
const nightlyStaleOtp = (run, policy) => run.status === 'account_auth_failure_spike' && STALE_OTP.includes(run.stopCause?.code)
  && run.stopCause?.http == null && run.stoppedAt instanceof Date
  && istMinutes(run.stoppedAt) >= policy.nightlyWindowIst[0] && istMinutes(run.stoppedAt) <= policy.nightlyWindowIst[1];

// Pure: should this tick resume the run?
function decide({run, cfg, standbyAcquire, penalty, sharedPause, now}, policy = POLICY) {
  if (!run) return {act: false, reason: 'run_missing'};
  if (run.finishedAt) return {act: false, reason: 'run_finished'};
  if (!run.stopped) return {act: false, reason: run.otpRecovery?.phase === 'review' ? `canary_review:${run.otpRecovery.reason}` : 'running'};
  if (cfg?.enabled !== true) return {act: false, reason: 'disarmed'};
  const code = run.stopCause?.code ?? 'none', http = run.stopCause?.http;
  const nightly = nightlyStaleOtp(run, policy);
  if (!nightly && (!(run.status in SAFE) || (SAFE[run.status] && !SAFE[run.status].includes(code)) || (http >= 400 && http < 500)))
    return {act: false, reason: `needs_review:${run.status}:${code}`};
  if (!(run.stoppedAt instanceof Date)) return {act: false, reason: 'no_stopped_at'};
  const events = (cfg.events || []).filter(e => e.at instanceof Date);
  const last = events.at(-1);
  if (last && last.fingerprint?.startsWith(`${run.status}|${code}|${run.stoppedAt.toISOString()}|`)) return {act: false, reason: `already_attempted:${last.outcome}`};
  const quick = last && last.outcome === 'opened' && +run.stoppedAt - +last.at < policy.quickStopMs;
  const fast = isFast(run.status, code) && !(http >= 400);
  const coolOff = fast ? (quick ? policy.fastQuickCoolOffMs : policy.fastCoolOffMs) : (quick ? policy.quickStopCoolOffMs : policy.coolOffMs);
  if (+now - +run.stoppedAt < coolOff) return {act: false, reason: quick ? 'cooling_off_after_quick_stop' : 'cooling_off'};
  if (nightly && +now - +run.stoppedAt < (policy.nightlyResumeIst - istMinutes(run.stoppedAt)) * 60000) return {act: false, reason: 'nightly_otp_window'};
  if (events.filter(e => +now - +e.at < 86400000 && !e.fingerprint?.startsWith('voided|')).length >= policy.maxPerDay) return {act: false, reason: 'daily_limit'};
  if (!(penalty >= policy.minPenalty)) return {act: false, reason: `gate_penalty_${penalty}`};
  if (standbyAcquire < policy.minStandbyAcquire) return {act: false, reason: `standby_acquire_${standbyAcquire}`};
  if (sharedPause) return {act: false, reason: 'shared_pause'};
  return {act: true, reason: `${nightly ? 'nightly_otp_stop' : 'safe_stop'}:${run.status}:${code}`};
}

const FINGERPRINT = /^[a-z_]+\|[a-zA-Z0-9_]+\|\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z\|\d+\|\d+\|\d+\|\d+$/;
const log = (event, extra = {}) => console.log(JSON.stringify({at: new Date().toISOString(), event, ...extra}));
const lastJson = out => { const line = String(out).trim().split('\n').reverse().find(l => l.startsWith('{')); try { return line ? JSON.parse(line) : null; } catch { return null; } };
const run = (file, args, opts) => new Promise(resolve => execFile(file, args, {maxBuffer: 1 << 20, ...opts}, (error, stdout) => resolve({code: error ? (error.code ?? 1) : 0, json: lastJson(stdout)})));

async function main() {
  if (os.hostname() !== 'migrator') throw Error('wrong_host');
  if (!KIT) throw Error('unknown_cohort');
  const mode = process.argv[2] || 'status', dry = process.argv.includes('--dry-run');
  if (!['status', 'tick', 'arm', 'disarm'].includes(mode)) throw Error('invalid_mode');
  const root = process.cwd(), node = process.execPath;
  const dep = name => require(require.resolve(name, {paths: [root + '/runtime']}));
  const uri = dep('dotenv').parse(fs.readFileSync('.env.development')).MONGO_URI;
  if (!/^mongodb(?:\+srv)?:\/\/[^/]+\/vidyagramdb(?:\?|$)/.test(uri || '')) throw Error('wrong_tenant');
  const client = new (dep('mongodb').MongoClient)(uri, {minPoolSize: 0, maxPoolSize: 2, serverSelectionTimeoutMS: 15000, readPreference: 'primary'});
  try {
    const db = client.db('vidyagramdb');
    const cfgs = db.collection('apx_vg_completion_autoresume'), runs = db.collection('apx_vg_completion_pilots');
    if (mode === 'arm' || mode === 'disarm') {
      await cfgs.updateOne({_id: RUN}, {$set: {enabled: mode === 'arm', [`${mode}edAt`]: new Date()}, $setOnInsert: {events: []}}, {upsert: true});
      log(mode === 'arm' ? 'armed' : 'disarmed');
      return;
    }
    const now = new Date();
    const [runDoc, cfg, standbyAcquire, standbyAll, gate, pause] = await Promise.all([
      runs.findOne({_id: RUN}, {projection: {stopped: 1, status: 1, stopCause: 1, stoppedAt: 1, finishedAt: 1, otpRecovery: 1, resumedAt: 1}}),
      cfgs.findOne({_id: RUN}),
      db.collection('apx_vg_completion_workers').countDocuments({runId: RUN, role: 'acquire', state: 'standby', heartbeatAt: {$gte: new Date(+now - POLICY.standbyFreshMs)}}),
      db.collection('apx_vg_completion_workers').countDocuments({runId: RUN, state: 'standby', heartbeatAt: {$gte: new Date(+now - POLICY.standbyFreshMs)}}),
      db.collection('apx_vg_request_limits').findOne({_id: GATE}, {projection: {penalty: 1, dispatchGapMs: 1}}),
      db.collection('distributedlocks').findOne({key: 'apx-rate-limit-pause', expiresAt: {$gt: now}}, {projection: {_id: 1}}),
    ]);
    // --operator: a person approved this resume; skip only the 4-a-day limit (every other check still applies, and the attempt is recorded).
    const operator = process.argv.includes('--operator');
    const d = decide({run: runDoc, cfg, standbyAcquire, penalty: gate?.penalty, sharedPause: !!pause, now}, operator ? {...POLICY, maxPerDay: Infinity} : POLICY);
    const view = {enabled: cfg?.enabled === true, status: runDoc?.status, stopped: runDoc?.stopped, cause: runDoc?.stopCause?.code, stoppedAt: runDoc?.stoppedAt,
      standbyAcquire, standbyAll, penalty: gate?.penalty, ...d};
    if (mode === 'status') { log('status', {...view, events: (cfg?.events || []).slice(-6)}); return; }
    if (!d.act) {
      if (dry || cfg?.lastReason !== d.reason) log('hold', view);
      if (!dry && cfg) await cfgs.updateOne({_id: RUN}, {$set: {lastReason: d.reason, lastTickAt: now}});
      return;
    }
    const preview = await run(node, [`${KIT}/resume-next.cjs`, 'preview'], {cwd: root, timeout: 60000});
    if (preview.json?.event !== 'preview' || !FINGERPRINT.test(preview.json.fingerprint || '')) {
      const reason = `preview_failed:${preview.json?.reason ?? preview.code}`;
      if (dry || cfg?.lastReason !== reason) log('hold', {...view, act: false, reason});
      if (!dry) await cfgs.updateOne({_id: RUN}, {$set: {lastReason: reason, lastTickAt: now}});
      return;
    }
    const fingerprint = preview.json.fingerprint;
    if (dry) { log('would_resume', {...view, fingerprint, remainingQueued: preview.json.remainingQueued}); return; }
    // Count the attempt before any AppX request, so a crash still uses up one of the day's attempts.
    const event = {at: now, fingerprint, status: runDoc.status, cause: runDoc.stopCause?.code ?? 'none', outcome: 'started'};
    const counted = await cfgs.updateOne({_id: RUN, enabled: true}, {$push: {events: {$each: [event], $slice: -50}}, $set: {lastReason: 'attempt', lastTickAt: now}});
    if (counted.modifiedCount !== 1) { log('hold', {...view, act: false, reason: 'disarmed'}); return; }
    const outcome = async o => { await cfgs.updateOne({_id: RUN, 'events.at': now}, {$set: {'events.$.outcome': o, lastReason: `attempt:${o}`}}); log('attempt', {fingerprint, outcome: o}); };
    log('attempt_start', {fingerprint, remainingQueued: preview.json.remainingQueued, standbyAcquire, standbyAll, penalty: gate?.penalty});
    const env = {...process.env, VG_APP_ROOT: `${root}/runtime`, VG_ENV_PATH: `${root}/.env.development`, VG_COMPLETION_RUN: RUN, VG_EGRESS_ID: '20.193.151.140',
      VG_PILOT_PATH: KIT === 'fleet800-cohort-20261109' ? `${root}/fleet800-cohort-20261109-wait/vidyagram-completion-pilot.cjs` : `${root}/${KIT}/vidyagram-completion-pilot.cjs`,
      VG_LEARNER_GAP_MS: '30000', VG_ADMIN_GAP_MS: '1000', VG_REQUEST_GAP_MS: '1500', VG_REQUEST_JITTER_MS: '250'};
    const admin = await run(node, ['resume-admin-check.cjs'], {cwd: root, env, timeout: 7 * 60000});
    if (admin.json?.event !== 'admin_lookup_passed') return await outcome(`admin_check_failed:${admin.json?.code ?? admin.json?.type ?? admin.code}`);
    const guardFree = await run('flock', ['-n', `${KIT}/guard.lock`, 'true'], {cwd: root, timeout: 10000});
    if (guardFree.code !== 0) return await outcome('guard_lock_held');
    const q = s => `'${s}'`;
    // The 20261109 kit's guard is controller-retain-penalty.cjs (its controller.cjs is an older one); later kits use controller.cjs.
    const controller = KIT === 'fleet800-cohort-20261109' ? 'controller-retain-penalty.cjs' : 'controller.cjs';
    const script = `${q(node)} ${KIT}/resume-next.cjs commit ${q(fingerprint)} && exec ${q(node)} ${KIT}/${controller} guard`;
    const out = fs.openSync(path.join(root, KIT, 'autoresume-controller.log'), 'a', 0o600);
    spawn('nohup', ['flock', '-n', `${KIT}/guard.lock`, 'sh', '-c', script], {cwd: root, detached: true, stdio: ['ignore', out, out]}).unref();
    for (let i = 0; i < 12; i++) {
      await wait(5000);
      const r = await runs.findOne({_id: RUN}, {projection: {stopped: 1, resumedAt: 1}});
      if (r?.stopped === false && +r.resumedAt >= +now) return await outcome('opened');
    }
    return await outcome('commit_not_seen');
  } finally {
    await client.close();
  }
}

module.exports = {decide, POLICY, SAFE, FAST, FINGERPRINT};
if (require.main === module) main().catch(error => {
  log('failed', {reason: /^[a-z_]+$/.test(error.message) ? error.message : error.name});
  process.exitCode = 1;
});
