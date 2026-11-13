'use strict';
// node --test vidyagram-completion-rate-trial.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const {brakeReason} = require('./vidyagram-completion-rate-trial.cjs');

const base = {otp_send: 150, otp_verify: 170, completion_read: 56};
const ok = (endpoint, latencyMs) => ({endpoint, httpStatus: 200, latencyMs});
const clean = [...Array(10)].flatMap(() => [ok('otp_send', 145), ok('otp_verify', 168), ok('completion_read', 55)]);

test('clean window does not brake', () => assert.equal(brakeReason(clean, base), null));

test('one timeout does not brake', () =>
  assert.equal(brakeReason([...clean, {endpoint: 'otp_verify', httpStatus: null, error: 'TimeoutError'}], base), null));

test('one 5xx does not brake', () => assert.equal(brakeReason([...clean, {endpoint: 'completion_read', httpStatus: 502}], base), null));

test('two errors in the window brake', () =>
  assert.equal(brakeReason([...clean, {endpoint: 'otp_send', error: 'TimeoutError'}, {endpoint: 'completion_read', httpStatus: 500}], base),
    'errors:2:otp_send:TimeoutError,completion_read:500'));

test('a single 429 brakes at once', () => {
  assert.equal(brakeReason([...clean, {endpoint: 'completion_read', httpStatus: 429}], base), 'error:completion_read:429');
  assert.equal(brakeReason([...clean, {endpoint: 'otp_send', httpStatus: 200, apiStatus: 429}], base), 'error:otp_send:429');
});

test('latency rise still brakes', () => {
  const slow = [...Array(8)].map(() => ok('completion_read', 122));
  assert.equal(brakeReason(slow, base), 'latency:completion_read:122>56');
});

test('307 admin redirects are not errors', () =>
  assert.equal(brakeReason([...clean, {endpoint: 'admin_user', httpStatus: 307}, {endpoint: 'admin_user', httpStatus: 307}], base), null));

const {trialEnd, inNightWindow} = require('./vidyagram-completion-rate-trial.cjs');
const ist = (day, h, m) => new Date(Date.UTC(2026, 10, day, h, m) - 330 * 60000);

test('trial ends at the next 03:30 IST', () => {
  assert.equal(trialEnd(ist(12, 16, 40)).toISOString(), '2026-11-12T22:00:00.000Z');
  assert.equal(trialEnd(ist(13, 5, 30)).toISOString(), '2026-11-13T22:00:00.000Z');
  assert.equal(trialEnd(ist(13, 3, 29)).toISOString(), '2026-11-12T22:00:00.000Z');
});

test('no start between 03:30 and 05:30 IST', () => {
  assert.equal(inNightWindow(ist(13, 3, 29)), false);
  assert.equal(inNightWindow(ist(13, 3, 30)), true);
  assert.equal(inNightWindow(ist(13, 5, 29)), true);
  assert.equal(inNightWindow(ist(13, 5, 30)), false);
  assert.equal(inNightWindow(ist(12, 16, 40)), false);
});
