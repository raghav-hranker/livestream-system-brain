// Vidyagram completion fleet: change the learned penalty on the shared AppX gate org:2177599:all.
// Effective dispatch spacing = dispatchGapMs * max(1, penalty / 4). A 429 doubles the penalty again (max 8) on its own.
// READ-ONLY unless --commit. Run on migrator from ~/vidyagram-completion-azure-20261103:
//   runtime/node/bin/node - <from> <to> [--commit] < vidyagram-completion-gate-penalty.cjs
// Rollback: same with <to> <from> --commit.
'use strict';
const fs = require('node:fs');
const dep = name => require(require.resolve(name, {paths: [process.cwd() + '/runtime']}));
const uri = dep('dotenv').parse(fs.readFileSync('.env.development')).MONGO_URI;
if (!/^mongodb(?:\+srv)?:\/\/[^/]+\/vidyagramdb(?:\?|$)/.test(uri || '')) { console.error('wrong_tenant'); process.exit(2); }
const [from, to] = process.argv.slice(2, 4).map(Number);
const commit = process.argv.includes('--commit');
const RUN = 'vg-completion-20261109-next10000', GATE = 'org:2177599:all';
if (![4, 6, 8].includes(from) || ![4, 6, 8].includes(to) || from === to) { console.error('usage: <from> <to> [--commit], each 4|6|8'); process.exit(2); }
const {MongoClient} = dep('mongodb');
const client = new MongoClient(uri, {minPoolSize: 0, maxPoolSize: 2, readPreference: 'primary', serverSelectionTimeoutMS: 15000});
(async () => {
  try {
    const db = client.db('vidyagramdb');
    const gates = db.collection('apx_vg_request_limits'), metrics = db.collection('apx_vg_request_metrics');
    const gate = await gates.findOne({_id: GATE});
    const run = await db.collection('apx_vg_completion_pilots').findOne({_id: RUN}, {projection: {stopped: 1, status: 1, otpSent: 1}});
    const hourAgo = new Date(Date.now() - 3600000);
    const otpLastHour = await metrics.countDocuments({runId: RUN, endpoint: 'otp_send', httpStatus: 200, at: {$gte: hourAgo}});
    const requestsLastHour = await metrics.countDocuments({runId: RUN, at: {$gte: hourAgo}});
    const throttled = await metrics.countDocuments({at: {$gte: hourAgo}, $or: [{httpStatus: 429}, {apiStatus: 429}]});
    const spacing = g => g?.dispatchGapMs * Math.max(1, (g?.penalty || 1) / 4);
    console.log(JSON.stringify({event: 'gate', penalty: gate?.penalty, dispatchGapMs: gate?.dispatchGapMs, maxConcurrent: gate?.maxConcurrent,
      spacingMs: spacing(gate), cooldownUntil: gate?.cooldownUntil, last429At: gate?.last429At, trial: gate?.vgDispatchTrial,
      run: run && {stopped: run.stopped, status: run.status, otpSent: run.otpSent}, otpLastHour, requestsLastHour, http429LastHour: throttled}));
    if (!commit) { console.log(JSON.stringify({event: 'preview', from, to, spacingAfterMs: gate?.dispatchGapMs * Math.max(1, to / 4)})); return; }
    const scope = {_id: GATE, penalty: from, maxConcurrent: 2, dispatchPenaltyBaseline: 4, blocked: {$ne: true}, rateLimitedHold: {$ne: true},
      cooldownUntil: {$lte: new Date()}, dispatchGapMs: {$gte: 250}};
    const r = await gates.updateOne(scope, {$set: {penalty: to, penaltyChangedAt: new Date(), penaltyChangedFrom: from}});
    if (r.modifiedCount !== 1) throw Error('gate_not_in_expected_state');
    const after = await gates.findOne({_id: GATE});
    console.log(JSON.stringify({event: 'changed', from, to, spacingMs: spacing(after)}));
  } finally { await client.close(); }
})().catch(e => { console.log(JSON.stringify({event: 'failed', reason: /^[a-z_]+$/.test(e.message) ? e.message : e.name})); process.exitCode = 1; });
