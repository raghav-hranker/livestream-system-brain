'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { planMenu, applyClass, applyMany, allFolders, rollbackMenu, parseArgs } = require('./vidyagram-apx-menu-split-urls.cjs');

const ID = 'a'.repeat(24);
const DIR = `781/${ID}/hls`;
const inf = (bw, res, name) => `#EXT-X-STREAM-INF:BANDWIDTH=${bw},RESOLUTION=${res},NAME="${name}"`;
const NO_1080 = [
  '#EXTM3U', '#EXT-X-VERSION:3',
  inf(100, '256x144', '144p'), '240p.m3u8',
  inf(100, '426x240', '240p'), '240p.m3u8',
  inf(200, '638x360', '360p'), '360p.m3u8',
  inf(300, '854x480', '480p'), '480p.m3u8',
  inf(300, '1280x720', '720p'), '480p.m3u8', '',
].join('\n');
const WITH_1080 = `${NO_1080}${inf(900, '1920x1080', '1080p')}\n1080p.m3u8\n`;
const rung = (r) => `#EXTM3U\n#EXTINF:10.000000,\n${r}_0.ts\n#EXT-X-ENDLIST\n`;

function fakeStore(master = WITH_1080, extra = {}) {
  const objects = new Map(Object.entries({ [`${DIR}/master.m3u8`]: master, [`${DIR}/240p.m3u8`]: rung('240p'), [`${DIR}/480p.m3u8`]: rung('480p'), ...extra }));
  const puts = [];
  return {
    objects, puts,
    async get(key) {
      if (!objects.has(key)) throw Object.assign(new Error('missing'), { name: 'NoSuchKey' });
      return { text: objects.get(key), etag: `"${objects.get(key).length}"`, contentType: 'application/vnd.apple.mpegurl', cacheControl: 'max-age=1' };
    },
    async etag(key) { return (await this.get(key)).etag; },
    async put(key, text) { puts.push(key); objects.set(key, text); },
  };
}

const uris = (text) => text.split('\n').filter((l) => l && !l.startsWith('#'));

test('with 1080p: AppX menu, no 144p, every label its own address, rung bandwidths kept', () => {
  const plan = planMenu(WITH_1080);
  assert.strictEqual(plan.status, 'change');
  assert.deepStrictEqual(plan.labels, ['240p', '360p', '480p', '720p', '1080p']);
  assert.deepStrictEqual(uris(plan.after), ['240p.m3u8', '360p.m3u8', '480p.m3u8', '720p.m3u8', '1080p.m3u8']);
  assert.deepStrictEqual(plan.copies, ['720p.m3u8']);
  assert.ok(plan.after.includes(`${inf(300, '1280x720', '720p')}\n720p.m3u8`));
  assert.ok(plan.after.includes(`${inf(100, '426x240', '240p')}\n240p.m3u8`));
});

test('without 1080p: AppX menu keeps 144p on its own address', () => {
  const plan = planMenu(NO_1080);
  assert.deepStrictEqual(plan.labels, ['144p', '240p', '360p', '480p', '720p']);
  assert.deepStrictEqual(uris(plan.after), ['144p.m3u8', '240p.m3u8', '360p.m3u8', '480p.m3u8', '720p.m3u8']);
  assert.deepStrictEqual(plan.copies, ['144p.m3u8', '720p.m3u8']);
});

test('the already-split test class moves to the AppX menu and keeps bandwidths', () => {
  const split = WITH_1080.replace(`${inf(100, '256x144', '144p')}\n240p.m3u8`, `${inf(100, '256x144', '144p')}\n144p.m3u8`)
    .replace(`${inf(300, '1280x720', '720p')}\n480p.m3u8`, `${inf(300, '1280x720', '720p')}\n720p.m3u8`);
  assert.strictEqual(planMenu(split).after, planMenu(WITH_1080).after);
});

test('a finished master is done and an unfamiliar one is left alone', () => {
  assert.strictEqual(planMenu(planMenu(WITH_1080).after).status, 'done');
  assert.strictEqual(planMenu(planMenu(NO_1080).after).status, 'done');
  assert.strictEqual(planMenu(WITH_1080.replace('1080p.m3u8', '900p.m3u8')).status, 'unknown');
  assert.strictEqual(planMenu(`${WITH_1080}#EXT-X-I-FRAME-STREAM-INF:x\n`).status, 'unknown');
});

test('dry run writes nothing and keeps no ledger', async () => {
  const store = fakeStore();
  const rows = [];
  assert.strictEqual((await applyClass(store, ID, { commit: false, appendLedger: (x) => rows.push(x) })).status, 'change');
  assert.deepStrictEqual(store.puts, []);
  assert.deepStrictEqual(rows, []);
});

test('commit writes ledger first, copies next, master last, with exact copies', async () => {
  const store = fakeStore(NO_1080);
  const order = [];
  const put = store.put.bind(store);
  store.put = async (k, t) => { order.push(k); await put(k, t); };
  const r = await applyClass(store, ID, { commit: true, appendLedger: (x) => order.push(`ledger:${x.before === NO_1080}`) });
  assert.strictEqual(r.status, 'changed');
  assert.deepStrictEqual(order, ['ledger:true', `${DIR}/144p.m3u8`, `${DIR}/720p.m3u8`, `${DIR}/master.m3u8`]);
  assert.strictEqual(store.objects.get(`${DIR}/720p.m3u8`), rung('480p'));
  assert.strictEqual(store.objects.get(`${DIR}/144p.m3u8`), rung('240p'));
});

test('a re-run changes nothing', async () => {
  const store = fakeStore();
  await applyClass(store, ID, { commit: true, appendLedger() {} });
  store.puts.length = 0;
  assert.strictEqual((await applyClass(store, ID, { commit: true, appendLedger() {} })).status, 'done');
  assert.deepStrictEqual(store.puts, []);
});

test('refuses a different file already at the copy address, before any write', async () => {
  const store = fakeStore(WITH_1080, { [`${DIR}/720p.m3u8`]: rung('720p') });
  await assert.rejects(applyClass(store, ID, { commit: true, appendLedger() { throw new Error('ledger written'); } }), /exists with other content/);
  assert.deepStrictEqual(store.puts, []);
});

test('refuses a rung whose segments are not relative', async () => {
  const store = fakeStore(WITH_1080, { [`${DIR}/480p.m3u8`]: '#EXTM3U\n../other/480p_0.ts\n' });
  await assert.rejects(applyClass(store, ID, { commit: false, appendLedger() {} }), /non-relative/);
});

test('a master changed while planning is not overwritten', async () => {
  const store = fakeStore();
  const etag = store.etag.bind(store);
  store.etag = async () => `changed${await etag(`${DIR}/master.m3u8`)}`;
  await assert.rejects(applyClass(store, ID, { commit: true, appendLedger() {} }), /changed while planning/);
  assert.strictEqual(store.objects.get(`${DIR}/master.m3u8`), WITH_1080);
});

test('rollback restores the master, keeps later edits, and dry run writes nothing', async () => {
  const store = fakeStore();
  const rows = [];
  await applyClass(store, ID, { commit: true, appendLedger: (x) => rows.push(x) });
  store.puts.length = 0;
  assert.deepStrictEqual(await rollbackMenu(store, rows, false), { restored: 0, wouldRestore: 1, drifted: [] });
  assert.deepStrictEqual(store.puts, []);
  assert.strictEqual((await rollbackMenu(store, rows, true)).restored, 1);
  assert.strictEqual(store.objects.get(`${DIR}/master.m3u8`), WITH_1080);
  store.objects.set(`${DIR}/master.m3u8`, 'edited');
  assert.deepStrictEqual((await rollbackMenu(store, rows, true)).drifted, [`${DIR}/master.m3u8`]);
});

test('bulk dry run records failures and carries on; a commit run stops after maxErrors', async () => {
  const b = 'b'.repeat(24);
  const store = fakeStore();
  const rows = [];
  const dry = await applyMany(store, [{ classId: b }, { classId: ID }], { commit: false, appendLedger() {}, onRow: (r) => rows.push(r), concurrency: 1 });
  assert.deepStrictEqual(dry.tally, { error: 1, change: 1 });
  assert.deepStrictEqual(store.puts, []);
  const many = Array.from({ length: 20 }, () => ({ classId: b }));
  const stopped = await applyMany(store, many, { commit: true, appendLedger() {}, onRow() {}, maxErrors: 2 });
  assert.strictEqual(stopped.stoppedEarly, true);
  assert.ok(stopped.tally.error < 20);
});

test('bulk --limit stops after N masters', async () => {
  const store = fakeStore();
  const r = await applyMany(store, [{ classId: ID }, { classId: ID }], { commit: true, limit: 1, appendLedger() {}, onRow() {}, concurrency: 1 });
  assert.strictEqual(r.tally.changed, 1);
});

test('shared folders are included once and odd keys are not', () => {
  const b = 'b'.repeat(24);
  const key = (id) => `781/${id}/hls/master.m3u8`;
  assert.deepStrictEqual(
    allFolders([{ classId: ID }], [{ key: key(b) }, { key: key(b) }, { key: key(ID) }, { key: `472/${b}/hls/master.m3u8` }, { key: 'x' }]),
    [{ classId: ID }, { classId: b }],
  );
});

test('arguments need an explicit scope', () => {
  assert.throws(() => parseArgs(['--commit']), /--class/);
  assert.throws(() => parseArgs(['--class', 'all', '--commit']), /24-hex/);
  assert.throws(() => parseArgs(['--class', ID, '--all']), /cannot be combined/);
  assert.strictEqual(parseArgs(['--class', ID]).commit, false);
  assert.strictEqual(parseArgs(['--all']).all, true);
});
