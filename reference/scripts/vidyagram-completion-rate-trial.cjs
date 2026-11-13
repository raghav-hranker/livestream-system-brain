'use strict';
// Vidyagram completion fleet: stepped rate trial on the shared AppX gate org:2177599:all, with an automatic brake.
// **Writes the gate** (penalty / dispatchGapMs) while it runs. Run on migrator from ~/vidyagram-completion-azure-20261103:
//   VG_COMPLETION_RUN=vg-completion-20261112-next10000 nohup runtime/node/bin/node rate-trial.cjs run [--until <ISO>] >> rate-trial.log &
//   ... rate-trial.cjs run --only p4 [--until <ISO>]   (one step only, held until --until)
//   ... rate-trial.cjs status   (read-only: gate + last 3 min)
// Steps (spacing = dispatchGapMs * max(1, penalty/4)): today 400 ms x 6/4 = 600 ms ->
//   p4: penalty 4, 400 ms (1.5x)  -> gap300: penalty 4, gap 300 ms (2x, = two mini fleets at 600 ms each).
//   lg20: 400 ms gate (as p4) + learner gap 20 s instead of 30 (run doc learnerGapOverrideMs, read by pilot workers every loop).
//   --only takes one step or a comma list, e.g. --only p4,lg20.
// Each step holds HOLD_MS; the last clean step stays on until --until (default and latest 03:30 IST, the start of AppX's nightly
// stale-OTP window), then back to 600 ms. No start between 03:30 and 05:30 IST.
// Brake (checked every 20 s, last 3 min of this run's requests): any 429, or 2+ 5xx / transport errors / timeouts, or the median
// latency of otp_send, otp_verify or completion_read above max(1.5 x baseline, baseline + 60 ms), or the run stops, or the
// gate is changed by anyone else -> gate back to dispatchGapMs 400 and penalty max(6, current), then exit.
// Restoring dispatchGapMs 400 also lets the cohort guard close after a stop (it restores only a 400 ms gate).
const fs = require('node:fs');
const os = require('node:os');
const {setTimeout: wait} = require('node:timers/promises');

const RUN = process.env.VG_COMPLETION_RUN || '';
const MARKERS = {'vg-completion-20261112-next10000': 'fleet800-cohort-20261112', 'vg-completion-20261113-next10000': 'fleet800-cohort-20261113'};
const GATE = 'org:2177599:all';
const SAFE = {penalty: 6, gap: 400};
const STEPS = [{name: 'p4', penalty: 4, gap: 400}, {name: 'gap300', penalty: 4, gap: 300}, {name: 'lg20', penalty: 4, gap: 400, learnerGapMs: 20000}];
const HOLD_MS = Number(process.env.VG_TRIAL_HOLD_MS || 30 * 60000);
const WINDOW_MS = 3 * 60000, TICK_MS = 20000;
const WATCH = ['otp_send', 'otp_verify', 'completion_read'];
// 03:30–05:30 IST = 22:00–24:00 UTC: AppX's nightly stale-OTP stop (~04:00 IST) and the 05:00 IST auto-resume.
const inNightWindow = d => new Date(d).getUTCHours() >= 22;
const trialEnd = d => { // next 22:00 UTC (03:30 IST)
  const e = new Date(d); e.setUTCHours(22, 0, 0, 0); if (e <= new Date(d)) e.setUTCDate(e.getUTCDate() + 1); return e;
};
const median = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
let onSignal = () => Promise.resolve();
const log = (event, extra = {}) => console.log(JSON.stringify({at: new Date().toISOString(), event, ...extra}));

// Pure: brake reason for one window of request metrics, or null.
// A lone timeout or 5xx also happens at 600 ms, so it takes two in the window; a 429 brakes at once.
const ERRORS_TO_BRAKE = 2;
function brakeReason(rows, baseline) {
  const limited = rows.find(r => r.httpStatus === 429 || r.apiStatus === 429);
  if (limited) return `error:${limited.endpoint}:429`;
  const bad = rows.filter(r => r.httpStatus >= 500 || r.error);
  if (bad.length >= ERRORS_TO_BRAKE) return `errors:${bad.length}:${bad.map(r => `${r.endpoint}:${r.httpStatus ?? r.error}`).join(',')}`;
  for (const ep of WATCH) {
    const lat = rows.filter(r => r.endpoint === ep && r.httpStatus === 200).map(r => r.latencyMs);
    const base = baseline[ep];
    if (lat.length >= 8 && base && median(lat) > Math.max(1.5 * base, base + 60)) return `latency:${ep}:${median(lat)}>${base}`;
  }
  return null;
}

async function main() {
  if (os.hostname() !== 'migrator') throw Error('wrong_host');
  const marker = MARKERS[RUN];
  if (!marker) throw Error('unknown_cohort');
  const mode = process.argv[2];
  if (!['run', 'status'].includes(mode)) throw Error('invalid_mode');
  const dep = name => require(require.resolve(name, {paths: [process.cwd() + '/runtime']}));
  const uri = dep('dotenv').parse(fs.readFileSync('.env.development')).MONGO_URI;
  if (!/^mongodb(?:\+srv)?:\/\/[^/]+\/vidyagramdb(?:\?|$)/.test(uri || '')) throw Error('wrong_tenant');
  const client = new (dep('mongodb').MongoClient)(uri, {minPoolSize: 0, maxPoolSize: 2, serverSelectionTimeoutMS: 15000, readPreference: 'primary'});
  const db = client.db('vidyagramdb');
  const gates = db.collection('apx_vg_request_limits'), metrics = db.collection('apx_vg_request_metrics'), runs = db.collection('apx_vg_completion_pilots');
  const recent = (ms, extra = {}) => metrics.find({runId: RUN, at: {$gte: new Date(Date.now() - ms)}, ...extra},
    {projection: {_id: 0, endpoint: 1, httpStatus: 1, apiStatus: 1, latencyMs: 1, error: 1, at: 1}}).toArray();
  const pace = rows => ({requests: rows.length, otp: rows.filter(r => r.endpoint === 'otp_send' && r.httpStatus === 200).length,
    med: Object.fromEntries(WATCH.concat('admin_user').map(ep => [ep, median(rows.filter(r => r.endpoint === ep && r.httpStatus === 200).map(r => r.latencyMs))]))});
  const setGate = async (from, to) => (await gates.updateOne({_id: GATE, vgDispatchTrial: marker, penalty: from.penalty, dispatchGapMs: from.gap,
    blocked: {$ne: true}, rateLimitedHold: {$ne: true}}, {$set: {penalty: to.penalty, dispatchGapMs: to.gap, rateTrialStep: to.name ?? 'safe', rateTrialAt: new Date()}})).modifiedCount === 1;
  // Learner gap: set on the run doc with the step, always removed on restore (only the copy this trial set).
  const setLearnerGap = async ms => (await runs.updateOne({_id: RUN, stopped: false},
    {$set: {learnerGapOverrideMs: ms, learnerGapTrial: marker, learnerGapTrialAt: new Date()}})).modifiedCount === 1;
  const clearLearnerGap = () => runs.updateOne({_id: RUN, learnerGapTrial: marker}, {$unset: {learnerGapOverrideMs: '', learnerGapTrial: ''}});
  let current = SAFE;
  // Back to safe: gap 400 (whatever penalty), penalty never below 6. Only while the gate is still this cohort's.
  // If the run stopped and the guard already closed the gate (3750 ms, marker removed), it leaves the trial's penalty 4 behind,
  // and the watchdog refuses to resume below 6: lift it back to 6 (only while rateTrialStep still names a trial step).
  const restore = async reason => {
    const g = await gates.findOne({_id: GATE});
    await clearLearnerGap().catch(() => {});
    const mark = {rateTrialStep: 'braked', rateTrialAt: new Date(), rateTrialBrake: reason};
    if (g?.vgDispatchTrial === marker) {
      await gates.updateOne({_id: GATE, vgDispatchTrial: marker}, {$set: {dispatchGapMs: SAFE.gap, penalty: Math.max(SAFE.penalty, g.penalty || 0), ...mark}});
    } else if (g && g.vgDispatchTrial === undefined && g.penalty < SAFE.penalty && STEPS.some(st => st.name === g.rateTrialStep)) {
      await gates.updateOne({_id: GATE, vgDispatchTrial: {$exists: false}, penalty: g.penalty, rateTrialStep: g.rateTrialStep}, {$set: {penalty: SAFE.penalty, ...mark}});
    }
    const after = await gates.findOne({_id: GATE}, {projection: {penalty: 1, dispatchGapMs: 1, vgDispatchTrial: 1}});
    log('restored', {reason, gate: after});
  };
  onSignal = () => current !== SAFE ? restore('signal') : Promise.resolve();
  try {
    if (mode === 'status') {
      const g = await gates.findOne({_id: GATE}, {projection: {penalty: 1, dispatchGapMs: 1, vgDispatchTrial: 1, rateTrialStep: 1, rateTrialBrake: 1}});
      const lg = await runs.findOne({_id: RUN}, {projection: {learnerGapOverrideMs: 1, learnerGapTrial: 1, currentLearnerGapMs: 1}});
      log('status', {gate: g, learnerGap: lg, last3min: pace(await recent(WINDOW_MS))});
      return;
    }
    const onlyArg = process.argv.indexOf('--only');
    const only = onlyArg > 0 ? String(process.argv[onlyArg + 1] || '').split(',') : null;
    const steps = only ? only.map(n => STEPS.find(s => s.name === n)) : STEPS.filter(s => !s.learnerGapMs);
    if (!steps.length || steps.some(s => !s)) throw Error('unknown_step');
    const untilArg = process.argv.indexOf('--until');
    if (inNightWindow(new Date())) throw Error('nightly_otp_window');
    const until = new Date(Math.min(+trialEnd(new Date()), untilArg > 0 ? +new Date(process.argv[untilArg + 1]) : Infinity));
    if (!(until > new Date(Date.now() + HOLD_MS))) throw Error('too_late_for_a_step');
    const run = await runs.findOne({_id: RUN}, {projection: {stopped: 1, otpRecovery: 1}});
    if (run?.stopped !== false || run.otpRecovery) throw Error('run_not_running');
    const base = await recent(30 * 60000, {httpStatus: 200});
    const baseline = Object.fromEntries(WATCH.map(ep => [ep, median(base.filter(r => r.endpoint === ep).map(r => r.latencyMs))]));
    if (WATCH.some(ep => !baseline[ep])) throw Error('no_baseline');
    const before = await recent(WINDOW_MS);
    if (brakeReason(before, baseline)) throw Error('not_clean_before_start');
    log('start', {steps: steps.map(s => s.name), until, baseline, holdMs: HOLD_MS, before: pace(before)});
    let step = 0, stepAt = 0, lastMinuteLog = 0;
    for (;;) {
      const now = Date.now();
      const r = await runs.findOne({_id: RUN}, {projection: {stopped: 1}});
      if (r?.stopped !== false) return await restore('run_stopped');
      const g = await gates.findOne({_id: GATE}, {projection: {penalty: 1, dispatchGapMs: 1, vgDispatchTrial: 1}});
      if (g?.vgDispatchTrial !== marker || g.penalty !== current.penalty || g.dispatchGapMs !== current.gap) return await restore(`gate_changed:${g?.penalty}/${g?.dispatchGapMs}`);
      if (current !== SAFE) {
        const rows = await recent(WINDOW_MS, {at: {$gte: new Date(Math.max(now - WINDOW_MS, stepAt))}});
        const reason = brakeReason(rows, baseline);
        if (reason) return await restore(reason);
      }
      if (now >= +until) return await restore('trial_end');
      if (step < steps.length && (current === SAFE || now - stepAt >= HOLD_MS)) {
        const next = steps[step];
        if (!await setGate(current, next)) return await restore('step_write_failed');
        if (next.learnerGapMs ? !await setLearnerGap(next.learnerGapMs) : (await clearLearnerGap(), false)) return await restore('learner_gap_write_failed');
        log('step', {step: next.name, spacingMs: next.gap * Math.max(1, next.penalty / 4), learnerGapMs: next.learnerGapMs ?? null});
        current = next; step++; stepAt = now;
      }
      if (now - lastMinuteLog >= 60000) { lastMinuteLog = now; log('tick', {step: current.name ?? 'safe', last3min: pace(await recent(WINDOW_MS))}); }
      await wait(TICK_MS);
    }
  } catch (error) {
    if (mode === 'run' && current !== SAFE) await restore(`trial_error:${error.name}`).catch(() => {});
    throw error;
  } finally {
    await client.close();
  }
}

module.exports = {brakeReason, trialEnd, inNightWindow};
if (require.main === module) {
  for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => { log('signal', {sig}); onSignal().finally(() => process.exit(1)); setTimeout(() => process.exit(1), 15000); });
  main().catch(error => { log('failed', {reason: /^[a-z_]+$/.test(error.message) ? error.message : error.name}); process.exitCode = 1; });
}
