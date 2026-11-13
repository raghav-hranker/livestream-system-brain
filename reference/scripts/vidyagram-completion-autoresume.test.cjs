'use strict';
// node --test reference/scripts/vidyagram-completion-autoresume.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const {decide, FINGERPRINT, POLICY} = require('./vidyagram-completion-autoresume.cjs');
const {standbyDecision} = require('./vidyagram-completion-standby.cjs');

const min = 60000;
const now = new Date('2026-11-12T02:00:00.000Z');
const stoppedAt = new Date(+now - 25 * min);
const stop = (status, code, extra = {}) => ({stopped: true, status, stopCause: {code, http: null}, stoppedAt, ...extra});
const healthy = (run, over = {}) => ({run, cfg: {enabled: true, events: []}, standbyAcquire: 14, penalty: 6, sharedPause: false, now, ...over});
const fp = run => `${run.status}|${run.stopCause.code}|${run.stoppedAt.toISOString()}|6035|3939|1|0`;

test('safe stops resume once cooled off and healthy', () => {
  for (const run of [stop('experiment_throttled', 'admin_shared_pause'), stop('token_failures_stop', 'otp_send_rejected'),
    stop('token_failures_stop', 'TimeoutError'), stop('checkpoint_review', 'none'), stop('trial_controller_recovered', 'none')]) {
    assert.equal(decide(healthy(run)).act, true, run.status);
  }
});

test('unsafe stops always wait for a person', () => {
  for (const run of [stop('account_auth_failure_spike', 'otp_not_fresh'), stop('experiment_route_blocked', 'x'), stop('admin_session_review', 'admin_session_required'),
    stop('trial_appx_4xx', 'none'), stop('operator_stopped', 'none'), stop('experiment_throttled', 'source_rate_limited')]) {
    const d = decide(healthy(run));
    assert.equal(d.act, false);
    assert.match(d.reason, /^needs_review:/);
  }
  const fourxx = stop('token_failures_stop', 'otp_send_rejected', {stopCause: {code: 'otp_send_rejected', http: 429}});
  assert.match(decide(healthy(fourxx)).reason, /^needs_review:/);
});

test('running, finished, disarmed and canary review do nothing', () => {
  assert.equal(decide(healthy({stopped: false, status: 'running'})).reason, 'running');
  assert.equal(decide(healthy({stopped: false, otpRecovery: {phase: 'review', reason: 'canary_deadline'}})).reason, 'canary_review:canary_deadline');
  assert.equal(decide(healthy({stopped: true, status: 'capture_complete', finishedAt: now})).reason, 'run_finished');
  assert.equal(decide(healthy(stop('token_failures_stop', 'TimeoutError'), {cfg: {enabled: false}})).reason, 'disarmed');
  assert.equal(decide(healthy(stop('token_failures_stop', 'TimeoutError'), {cfg: null})).reason, 'disarmed');
});

test('cool-off is 20 min, 60 min after a quick stop', () => {
  const fresh = stop('token_failures_stop', 'otp_send_rejected', {stoppedAt: new Date(+now - 10 * min)});
  assert.equal(decide(healthy(fresh)).reason, 'cooling_off');
  const run = stop('token_failures_stop', 'otp_send_rejected');
  const quickEvents = [{at: new Date(+stoppedAt - 10 * min), outcome: 'opened', fingerprint: 'x'}];
  assert.equal(decide(healthy(run, {cfg: {enabled: true, events: quickEvents}})).reason, 'cooling_off_after_quick_stop');
  const later = healthy(run, {cfg: {enabled: true, events: quickEvents}, now: new Date(+stoppedAt + 61 * min)});
  assert.equal(decide(later).act, true);
  const slowEvents = [{at: new Date(+stoppedAt - 3 * 60 * min), outcome: 'opened', fingerprint: 'x'}];
  assert.equal(decide(healthy(run, {cfg: {enabled: true, events: slowEvents}})).act, true);
});

test('fast stops (timeouts, shared pause, guard blip) cool off 5 min, 20 after a quick stop', () => {
  for (const [status, code] of [['token_failures_stop', 'TimeoutError'], ['token_failures_stop', 'TypeError'], ['experiment_throttled', 'admin_shared_pause'], ['trial_controller_recovered', 'none']]) {
    assert.equal(decide(healthy(stop(status, code, {stoppedAt: new Date(+now - 3 * min)}))).reason, 'cooling_off', code);
    assert.equal(decide(healthy(stop(status, code, {stoppedAt: new Date(+now - 6 * min)}))).act, true, code);
    const quick = [{at: new Date(+now - 20 * min), outcome: 'opened', fingerprint: 'x'}];
    assert.equal(decide(healthy(stop(status, code, {stoppedAt: new Date(+now - 10 * min)}), {cfg: {enabled: true, events: quick}})).reason, 'cooling_off_after_quick_stop', code);
    assert.equal(decide(healthy(stop(status, code, {stoppedAt: new Date(+now - 21 * min)}), {cfg: {enabled: true, events: quick}})).act, true, code);
  }
  const slow = stop('token_failures_stop', 'otp_send_rejected', {stoppedAt: new Date(+now - 6 * min)});
  assert.equal(decide(healthy(slow)).reason, 'cooling_off');
});

test('at most 8 attempts in 24 h (voided not counted), never the same stop twice', () => {
  const run = stop('token_failures_stop', 'TimeoutError');
  const events = [9, 8, 7, 6, 5, 4, 3, 2].map(h => ({at: new Date(+now - h * 60 * min), outcome: 'opened', fingerprint: 'x'}));
  assert.equal(decide(healthy(run, {cfg: {enabled: true, events}})).reason, 'daily_limit');
  const old = [{at: new Date(+now - 25 * 60 * min), outcome: 'opened', fingerprint: 'x'}, ...events.slice(1)];
  assert.equal(decide(healthy(run, {cfg: {enabled: true, events: old}})).act, true);
  const voided = [{...events[0], fingerprint: 'voided|x'}, ...events.slice(1)];
  assert.equal(decide(healthy(run, {cfg: {enabled: true, events: voided}})).act, true);
  const same = [{at: new Date(+now - 5 * min), outcome: 'admin_check_failed:http', fingerprint: fp(run)}];
  assert.equal(decide(healthy(run, {cfg: {enabled: true, events: same}})).reason, 'already_attempted:admin_check_failed:http');
});

test('nightly stale-OTP spike waits until 05:00 IST, then resumes; other hours wait for a person', () => {
  // 04:02:57 IST = 22:32:57 UTC.
  const at = new Date('2026-11-11T22:32:57.630Z');
  const spike = (code, extra = {}) => stop('account_auth_failure_spike', code, {stoppedAt: at, ...extra});
  const atIst = (h, m) => new Date(Date.UTC(2026, 10, 12, h, m) - 330 * 60000); // 11-12 IST
  assert.equal(decide(healthy(spike('otp_not_fresh'), {now: new Date(+at + 30 * min)})).reason, 'nightly_otp_window');
  assert.equal(decide(healthy(spike('otp_not_fresh'), {now: atIst(4, 59)})).reason, 'nightly_otp_window');
  assert.equal(decide(healthy(spike('otp_not_fresh'), {now: atIst(5, 1)})).reason, 'nightly_otp_stop:account_auth_failure_spike:otp_not_fresh');
  assert.equal(decide(healthy(spike('otp_not_available'), {now: atIst(11, 10)})).act, true);
  // Outside the window, a 4xx, or another cause: a person decides.
  const noon = new Date('2026-11-12T06:30:00.000Z');
  assert.match(decide(healthy(spike('otp_not_fresh', {stoppedAt: noon}), {now: new Date(+noon + 3 * 60 * min)})).reason, /^needs_review:/);
  assert.match(decide(healthy(spike('otp_not_fresh', {stopCause: {code: 'otp_not_fresh', http: 403}}), {now: atIst(6, 0)})).reason, /^needs_review:/);
  assert.match(decide(healthy(spike('otp_verify_or_identity_rejected'), {now: atIst(6, 0)})).reason, /^needs_review:/);
});

test('gate penalty, standby roster and shared pause block a resume', () => {
  const run = stop('experiment_throttled', 'admin_shared_pause');
  assert.equal(decide(healthy(run, {penalty: 4})).reason, 'gate_penalty_4');
  assert.equal(decide(healthy(run, {penalty: undefined})).reason, 'gate_penalty_undefined');
  assert.equal(decide(healthy(run, {standbyAcquire: 9})).reason, 'standby_acquire_9');
  assert.equal(decide(healthy(run, {sharedPause: true})).reason, 'shared_pause');
  assert.equal(decide(healthy(run, {penalty: 8})).act, true);
});

test('fingerprint pattern accepts real previews and rejects shell text', () => {
  assert.match('token_failures_stop|otp_verify_or_identity_rejected|2026-11-11T14:13:03.442Z|6035|3939|1|0', FINGERPRINT);
  assert.match('experiment_throttled|admin_shared_pause|2026-11-10T11:58:08.563Z|3286|6696|4|0', FINGERPRINT);
  assert.doesNotMatch("token_failures_stop|x';rm -rf ~;'|2026-11-11T14:13:03.442Z|1|1|1|1", FINGERPRINT);
});

test('standby releases only on a reopen after it began (minus grace)', () => {
  const startedAt = new Date('2026-11-12T01:00:00.000Z'), t = new Date(+startedAt + 5 * min);
  const open = resumedAt => ({stopped: false, status: 'running', resumedAt, expiresAt: new Date('9999-12-31T00:00:00Z')});
  assert.deepEqual(standbyDecision({stopped: true, status: 'token_failures_stop'}, {startedAt, graceMs: 0, now: t}), {wait: true});
  assert.deepEqual(standbyDecision(open(new Date(+startedAt + min)), {startedAt, graceMs: 0, now: t}), {release: true});
  // Worker returned while the run stayed open: wait for the next reopen instead of spinning.
  assert.deepEqual(standbyDecision(open(new Date(+startedAt - 3 * min)), {startedAt, graceMs: 0, now: t}), {wait: true});
  // First loop after a manual commit-then-launch: a reopen up to 10 min old counts.
  assert.deepEqual(standbyDecision(open(new Date(+startedAt - 3 * min)), {startedAt, graceMs: 10 * min, now: t}), {release: true});
  assert.deepEqual(standbyDecision(open(undefined), {startedAt, graceMs: 10 * min, now: t}), {wait: true});
});

test('standby leaves for good on finish, operator stop or 36 h', () => {
  const startedAt = new Date('2026-11-12T01:00:00.000Z');
  assert.deepEqual(standbyDecision({stopped: true, finishedAt: startedAt}, {startedAt, graceMs: 0, now: startedAt}), {exit: 'run_finished'});
  assert.deepEqual(standbyDecision({stopped: true, status: 'operator_stopped'}, {startedAt, graceMs: 0, now: startedAt}), {exit: 'operator_stopped'});
  assert.deepEqual(standbyDecision(null, {startedAt, graceMs: 0, now: startedAt}), {exit: 'run_missing'});
  assert.deepEqual(standbyDecision({stopped: true, status: 'token_failures_stop'}, {startedAt, graceMs: 0, now: new Date(+startedAt + 36 * 3600000)}), {exit: 'standby_expired'});
});

test('an operator tick skips only the daily limit', () => {
  const run = stop('experiment_throttled', 'admin_shared_pause');
  const busy = healthy(run, {cfg: {enabled: true, events: [1, 2, 3, 4, 5, 6, 7, 8].map(h => ({at: new Date(+now - h * 3600000), outcome: 'opened', fingerprint: `x|${h}`}))}});
  assert.equal(decide(busy).reason, 'daily_limit');
  assert.equal(decide(busy, {...POLICY, maxPerDay: Infinity}).act, true);
  assert.match(decide({...busy, penalty: 4}, {...POLICY, maxPerDay: Infinity}).reason, /^gate_penalty_4/);
});
