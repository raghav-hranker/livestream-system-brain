'use strict';
const fs = require('node:fs');
const os = require('node:os');
const assert = require('node:assert/strict');

const RUN = 'vg-completion-20261104-overnight6000';
const PREFIX = RUN + ':auto-20261105-';
const BATCH50 = RUN + ':pace50-20261105';
const ANCHOR = RUN + ':pace100-20261105';
const EXPIRED_BATCH = PREFIX + '5972';
const EXPIRED_AT = new Date('2026-11-05T12:32:15.533Z');
const RECOVERY = RUN + ':cutoff-recovery-20261105';
const FINAL_BATCH = RUN + ':cutoff-queue-20261105';
const HOSTS = {
  migrator: ['20.193.151.140', 7500],
  migrator2: ['20.193.132.31', 15000],
  migrator3: ['20.193.139.89', 15000],
  migrator4: ['20.193.253.251', 15000],
};
const LAYOUTS = {
  split: { migrator: 'both', migrator2: 'read', migrator3: 'both', migrator4: 'acquire' },
  mixed: { migrator: 'both', migrator2: 'read', migrator3: 'both', migrator4: 'both' },
  combined: { migrator: 'both', migrator2: 'both', migrator3: 'both', migrator4: 'both' },
};
const complete = ['captured', 'mapping_exception'];
const pending = ['token_ready', 'read_retry', 'reading', 'acquiring', 'waiting_session'];
const host = os.hostname();
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const log = value => console.log(JSON.stringify(value));
const command = process.argv[2];
const layout = process.argv[3];
const route = HOSTS[host];
assert.ok(route, 'wrong_host');
Object.assign(process.env, {
  VG_COMPLETION_RUN: RUN, VG_EGRESS_ID: route[0], VG_REQUEST_GAP_MS: String(route[1]),
  VG_ADMIN_GAP_MS: '2000', VG_LEARNER_GAP_MS: '30000',
});
const pilot = require('./vidyagram-completion-pilot.cjs');

async function main() {
  const env = require('./runtime/node_modules/dotenv').parse(fs.readFileSync('.env.development'));
  assert.match(env.MONGO_URI || '', /^mongodb(?:\+srv)?:\/\/[^/]+\/vidyagramdb(?:\?|$)/, 'wrong_tenant');
  const { MongoClient, ObjectId } = require('./runtime/node_modules/mongodb');
  const client = new MongoClient(env.MONGO_URI, { minPoolSize: 0, maxPoolSize: 2, serverSelectionTimeoutMS: 10000 });
  try {
    await client.connect();
    const db = client.db('vidyagramdb');
    const runs = db.collection(pilot.COL.runs), jobs = db.collection(pilot.COL.jobs);
    const workers = db.collection(pilot.COL.workers);
    const batches = db.collection('apx_vg_completion_batches');
    const metrics = db.collection('apx_vg_request_metrics');
    const rates = db.collection('apx_vg_request_limits');
    const readRun = () => runs.findOne({ _id: RUN });
    const queue = { runId: RUN, state: 'queued', otpAttemptedAt: { $exists: false } };

    async function checkRate() {
      const shared = await rates.findOne({ _id: 'org:2177599:all' });
      const routeIds = Object.values(HOSTS).map(([ip]) => 'ip:' + ip);
      const limitRows = await rates.find({ _id: { $in: [...routeIds, 'org:2177599:slot:0', 'org:2177599:admin'] } }).toArray();
      assert.ok(shared?.maxConcurrent === 1 && shared.dispatchGapMs === 3750 &&
        shared.dispatchPenaltyBaseline === 4 && shared.penalty >= 4, 'rate_configuration_changed');
      for (const [ip, base] of Object.values(HOSTS)) {
        const row = limitRows.find(limit => limit._id === 'ip:' + ip);
        assert.ok(base * (row?.penalty || 1) >= 15000, 'route_gap_too_short');
      }
      assert.ok([shared, ...limitRows].every(r => !r.blocked && !r.rateLimitedHold &&
        !(r.cooldownUntil > new Date())), 'rate_hold_or_cooldown');
      assert.ok(!await db.collection('distributedlocks').findOne({ key: 'apx-rate-limit-pause', expiresAt: { $gt: new Date() } }),
        'shared_cooldown_active');
    }

    if (command === 'status') {
      const run = await readRun();
      const batch = await batches.findOne({ _id: run.nextBatchId });
      const anchor = await batches.findOne({ _id: ANCHOR }, { projection: { expiresAt: 1 } });
      const states = batch?.trialJobIds ? await jobs.aggregate([
        { $match: { runId: RUN, _id: { $in: batch.trialJobIds } } },
        { $group: { _id: '$state', n: { $sum: 1 } } },
      ]).toArray() : [];
      const rows = await metrics.aggregate([
        { $match: { runId: RUN, at: { $gte: new Date(Math.max(+batch?.startedAt || 0, Date.now() - 900000)) } } },
        { $group: { _id: { host: '$workerHost', endpoint: '$endpoint', http: '$httpStatus', api: '$apiStatus', error: '$error' }, n: { $sum: 1 } } },
      ]).toArray();
      log({ at: new Date(), batch: run.nextBatchId, status: run.status, stopped: run.stopped,
        startedAt: batch?.startedAt, expiresAt: run.expiresAt,
        finalCutoff: [RECOVERY, FINAL_BATCH].includes(run.nextBatchId) ? batch?.expiresAt : anchor?.expiresAt,
        states, eligibleQueued: await jobs.countDocuments(queue),
        fullyCaptured: await jobs.countDocuments({ runId: RUN, state: { $in: complete } }),
        readLast15m: await jobs.countDocuments({ runId: RUN, capturedAt: { $gte: new Date(Math.max(+batch?.startedAt || 0, Date.now() - 900000)) } }),
        active: await workers.find({ runId: RUN, state: 'running', heartbeatAt: { $gte: new Date(Date.now() - 600000) } },
          { projection: { _id: 0, host: 1, role: 1, heartbeatAt: 1 } }).toArray(),
        rows });
      return;
    }

    if (command === 'recover-cutoff' || command === 'finish-queue') {
      assert.equal(host, 'migrator', 'wrong_controller_host');
      const recovery = command === 'recover-cutoff';
      const run = await readRun();
      const previous = await batches.findOne({ _id: recovery ? EXPIRED_BATCH : RECOVERY });
      const now = new Date();
      const cutoff = recovery ? new Date(+now + 75 * 60000) : previous?.expiresAt;
      assert.ok(previous && run.nextBatchId === previous._id && !run.stopped &&
        +run.expiresAt === +previous.expiresAt, 'resume_scope_changed');
      if (recovery) {
        assert.ok(+run.expiresAt === +EXPIRED_AT && run.expiresAt < now &&
          run.status === 'running' && !run.finishedAt, 'previous_run_not_expired');
        assert.equal(await metrics.countDocuments({ runId: RUN, at: { $gte: previous.startedAt },
          $or: [{ httpStatus: { $in: [403, 429] } }, { apiStatus: { $in: [403, 429] } }] }), 0, 'recent_access_or_rate_error');
      } else {
        assert.ok(cutoff > new Date(+now + 120000) && run.status === 'read_recovery_complete' &&
          run.finishedAt && run.readOnlyRecovery, 'recovery_not_complete');
        assert.equal(await jobs.countDocuments({ runId: RUN, _id: { $in: previous.trialJobIds },
          state: { $in: complete } }), 4, 'recovery_reads_incomplete');
      }
      assert.equal(await workers.countDocuments({ runId: RUN, state: 'running' }), 0, 'workers_still_draining');
      assert.equal(await jobs.countDocuments({ runId: RUN, state: { $in: pending } }), 0, 'pending_work');
      assert.equal(await jobs.countDocuments(queue), 88, 'untouched_queue_changed');
      assert.equal(await jobs.countDocuments({ runId: RUN, state: 'queued' }), 88, 'unexpected_claimable_job');
      await checkRate();
      const selector = recovery ? { runId: RUN, _id: { $in: previous.trialJobIds }, state: 'read_failed',
        lastError: 'pilot_stopped', tokenSavedAt: { $type: 'date' }, recoveryReadAttempts: { $exists: false } } : queue;
      const selected = await jobs.find(selector, { projection: { apxUserId: 1, tokenSavedAt: 1 } }).toArray();
      assert.equal(selected.length, recovery ? 4 : 88, 'resume_count_changed');
      if (recovery) {
        for (const job of selected) {
          assert.ok(await db.collection('apxtestusertokens').findOne({ orgId: '2177599', apxUserId: job.apxUserId,
            mintedAt: { $gte: job.tokenSavedAt }, token: { $type: 'string', $ne: '' } }, { projection: { _id: 1 } }),
          'saved_token_missing');
        }
      }
      const id = recovery ? RECOVERY : FINAL_BATCH;
      const role = recovery ? 'read' : 'both';
      log({ event: 'cutoff_resume_preview', role, learners: selected.length, cutoff });
      if (!process.argv.includes('--commit')) return;
      const session = client.startSession();
      try {
        await session.withTransaction(async () => {
          assert.ok(cutoff > new Date(Date.now() + 120000), 'cutoff_or_insufficient_time');
          const changed = await runs.updateOne({ _id: RUN, nextBatchId: run.nextBatchId, status: run.status,
            stopped: false, expiresAt: run.expiresAt, tokenFailures: run.tokenFailures, otpReservations: run.otpReservations },
          { $set: { nextBatchId: id, expiresAt: cutoff, acquireCeiling: 6000, readOnlyRecovery: recovery,
            status: recovery ? 'recovering_saved_tokens' : 'running', plannedAcquisitionWorkers: recovery ? 0 : 4,
            plannedReaders: 4 }, $unset: { finishedAt: '' } }, { session });
          assert.equal(changed.modifiedCount, 1, 'activation_raced');
          if (recovery) {
            const resumed = await jobs.updateMany({ ...selector, _id: { $in: selected.map(job => job._id) } },
              { $set: { state: 'read_retry', leaseUntil: new Date(0), recoveryId: id, updatedAt: now },
                $inc: { recoveryReadAttempts: 1 } }, { session });
            assert.equal(resumed.modifiedCount, 4, 'recovery_jobs_changed');
          }
          await batches.insertOne({ _id: id, runId: RUN, previousId: previous._id, state: 'running', startedAt: now,
            expiresAt: cutoff, trialJobIds: selected.map(job => job._id), role }, { session });
        }, { writeConcern: { w: 'majority' } });
      } finally { await session.endSession(); }
      log({ event: 'cutoff_resume_committed', role, learners: selected.length, cutoff });
      return;
    }

    if (command === 'advance') {
      assert.equal(host, 'migrator', 'wrong_controller_host');
      assert.ok(Object.hasOwn(LAYOUTS, layout), 'unknown_layout');
      const run = await readRun();
      const anchor = await batches.findOne({ _id: ANCHOR }, { projection: { expiresAt: 1 } });
      assert.ok(anchor?.expiresAt > new Date(Date.now() + 120000), 'cutoff_or_insufficient_time');
      assert.ok(run.stopped && !run.finishedAt && run.status === 'checkpoint_review' &&
        (run.nextBatchId === ANCHOR || run.nextBatchId?.startsWith(PREFIX)), 'unqualified_checkpoint');
      assert.equal(+run.expiresAt, +anchor.expiresAt, 'cutoff_changed');
      assert.equal(run.throttleIsolation, true, 'throttle_isolation_required');
      const previous = await batches.findOne({ _id: run.nextBatchId });
      assert.ok(previous?.trialJobIds?.length > 0, 'previous_scope_missing');
      if (run.nextBatchId === ANCHOR) assert.equal(previous.runStatus, 'checkpoint_review', 'anchor_still_draining');
      const freshWorkers = { runId: RUN, state: 'running', heartbeatAt: { $gte: previous.startedAt } };
      assert.equal(await workers.countDocuments(freshWorkers), 0, 'workers_still_draining');
      const previousScope = { runId: RUN, _id: { $in: previous.trialJobIds } };
      const setAsideTimeout = process.argv.includes('--set-aside-otp-timeout');
      const expectedFailures = setAsideTimeout ? 1 : 0;
      if (setAsideTimeout) {
        assert.ok(previous._id === PREFIX + '5822' && layout === 'combined' && previous.trialJobIds.length === 100,
          'timeout_exception_scope_changed');
        assert.equal(await jobs.countDocuments({ ...previousScope, state: 'token_failed', lastError: 'TimeoutError',
          lastHttp: null, otpAttemptedAt: { $gte: previous.startedAt }, otpSentAt: { $exists: false },
          tokenSavedAt: { $exists: false }, verificationResult: { $exists: false } }), 1, 'otp_timeout_job_changed');
        assert.equal(await metrics.countDocuments({ runId: RUN, at: { $gte: previous.startedAt }, endpoint: 'otp_send',
          httpStatus: null, apiStatus: null, error: 'TimeoutError' }), 1, 'otp_timeout_evidence_changed');
      }
      assert.equal(await jobs.countDocuments({ ...previousScope, state: { $in: complete } }),
        previous.trialJobIds.length - expectedFailures, 'previous_batch_incomplete');
      assert.equal(run.authDeferred, previous.beforeRun.authDeferred, 'otp_freshness_or_auth_failure');
      assert.equal(run.tokenFailures, previous.beforeRun.tokenFailures + expectedFailures, 'token_failure');
      assert.ok(!(run.isolated429Events || []).some(event => new Date(event.at) >= previous.startedAt), 'route_throttled');
      assert.equal(await metrics.countDocuments({ runId: RUN, at: { $gte: previous.startedAt },
        $or: [{ httpStatus: { $in: [403, 429] } }, { apiStatus: { $in: [403, 429] } }] }), 0, 'recent_access_or_rate_error');
      await checkRate();
      assert.equal(await jobs.countDocuments({ runId: RUN, state: { $in: pending } }), 0, 'pending_work');
      const selected = await jobs.find(queue, { projection: { priority: 1 } }).sort({ priority: 1 })
        .limit(setAsideTimeout ? 50 : 100).toArray();
      if (!selected.length) { log({ event: 'eligible_queue_empty' }); return; }
      const ceiling = selected.at(-1).priority + 1;
      assert.ok(ceiling > run.acquireCeiling && ceiling <= 6000, 'scope_ceiling_invalid');
      const claimable = { runId: RUN, state: { $in: ['queued', 'waiting_session'] }, priority: { $lt: ceiling } };
      const ids = selected.map(job => job._id);
      assert.equal(await jobs.countDocuments({ ...claimable, _id: { $nin: ids } }), 0, 'unexpected_claimable_job');
      const id = PREFIX + ceiling;
      const startedAt = new Date();
      log({ event: 'advance_preview', layout, learners: ids.length, setAside: expectedFailures, cutoff: anchor.expiresAt });
      if (!process.argv.includes('--commit')) return;
      const session = client.startSession();
      try {
        await session.withTransaction(async () => {
          assert.ok(anchor.expiresAt > new Date(Date.now() + 120000), 'cutoff_or_insufficient_time');
          const changed = await runs.updateOne({
            _id: RUN, nextBatchId: run.nextBatchId, stopped: true, status: 'checkpoint_review',
            expiresAt: anchor.expiresAt, otpReservations: run.otpReservations, tokenFailures: run.tokenFailures,
            authDeferred: run.authDeferred,
          }, { $set: { nextBatchId: id, acquireCeiling: ceiling, stopped: false, status: 'running', readOnlyRecovery: false,
            plannedAcquisitionWorkers: Object.values(LAYOUTS[layout]).filter(role => role !== 'read').length,
            plannedReaders: Object.values(LAYOUTS[layout]).filter(role => role !== 'acquire').length } }, { session });
          assert.equal(changed.modifiedCount, 1, 'activation_raced');
          await batches.insertOne({ _id: id, runId: RUN, state: 'running', startedAt, expiresAt: anchor.expiresAt,
            previousId: run.nextBatchId, trialJobIds: ids, layout, roles: LAYOUTS[layout],
            beforeRun: { authDeferred: run.authDeferred, tokenFailures: run.tokenFailures } }, { session });
          await batches.updateOne({ _id: run.nextBatchId }, { $set: { state: 'finished', runStatus: 'checkpoint_review',
            finishedAt: startedAt, ...(setAsideTimeout ? { setAsideOtpSendTimeouts: 1 } : {}) } }, { session });
        }, { writeConcern: { w: 'majority' } });
      } finally { await session.endSession(); }
      log({ event: 'advance_committed', batch: id, layout, learners: ids.length, cutoff: anchor.expiresAt });
      return;
    }

    if (command === 'cutoff-worker') {
      const waitUntil = Date.now() + 85 * 60000;
      log({ event: 'cutoff_worker_waiting', host });
      while (Date.now() < waitUntil) {
        const run = await readRun();
        if ([RECOVERY, FINAL_BATCH].includes(run.nextBatchId)) {
          if (run.stopped || run.expiresAt <= new Date() || (run.finishedAt && run.nextBatchId === FINAL_BATCH)) break;
          if (!run.finishedAt) {
            const batch = await batches.findOne({ _id: run.nextBatchId });
            const role = run.nextBatchId === RECOVERY ? 'read' : 'both';
            assert.ok(batch && +batch.expiresAt === +run.expiresAt && batch.role === role &&
              run.readOnlyRecovery === (role === 'read'), 'resume_worker_scope_changed');
            if (!batch.startedHosts?.includes(host)) {
              await checkRate();
              const claimed = await batches.updateOne({ _id: batch._id, state: 'running', startedHosts: { $ne: host } },
                { $addToSet: { startedHosts: host } });
              if (claimed.modifiedCount) await pilot.worker(client, db, role, ObjectId);
            }
          }
        }
        await wait(2000);
      }
      return;
    }
    assert.equal(command, 'worker', 'unknown_command');
    const parent = await batches.findOne({ _id: BATCH50 }, { projection: { expiresAt: 1 } });
    assert.ok(parent?.expiresAt, 'existing_window_missing');
    const maxWait = +parent.expiresAt + 241 * 60000;
    log({ event: 'autonomous_worker_waiting', host });
    while (Date.now() < maxWait) {
      const [run, anchor] = await Promise.all([readRun(), batches.findOne({ _id: ANCHOR }, { projection: { expiresAt: 1 } })]);
      if (anchor?.expiresAt <= new Date() || run.finishedAt || (run.stopped && run.status !== 'checkpoint_review')) break;
      if (run.nextBatchId?.startsWith(PREFIX) && !run.stopped && run.expiresAt > new Date()) {
        const batch = await batches.findOne({ _id: run.nextBatchId });
        assert.ok(anchor && +run.expiresAt === +anchor.expiresAt && +batch?.expiresAt === +anchor.expiresAt, 'cutoff_changed');
        const role = LAYOUTS[batch.layout]?.[host];
        assert.ok(role && batch.roles[host] === role, 'role_mismatch');
        if (!batch.startedHosts?.includes(host)) {
          await checkRate();
          const claimed = await batches.updateOne({ _id: batch._id, state: 'running', startedHosts: { $ne: host } },
            { $addToSet: { startedHosts: host } });
          if (claimed.modifiedCount) {
            log({ event: 'autonomous_worker_started', batch: batch._id, host, role });
            await pilot.worker(client, db, role, ObjectId);
          }
        }
      }
      await wait(3000);
    }
  } finally { await client.close(); }
}
main().catch(error => {
  log({ event: 'autonomous_error', error: /^[a-z_]+$/.test(error.message) ? error.message : error.name });
  process.exitCode = 1;
});
