'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { planMaster, parseArgs, selectTargets, commitOne, rollbackEntries, sha256 } = require('./vidyagram-apx-menu-master.cjs');

const entry = (bw, res, name, uri) => `#EXT-X-STREAM-INF:BANDWIDTH=${bw},RESOLUTION=${res}${name ? `,NAME="${name}"` : ''}\n${uri}`;
const master = (...e) => `#EXTM3U\n#EXT-X-VERSION:3\n${e.join('\n')}\n`;

// What apx-ingest-container/mirror-master.js publishes.
const MIRROR = master(
  entry(200, '256x144', '144p', '240p.m3u8'), entry(200, '426x240', '240p', '240p.m3u8'),
  entry(500, '638x360', '360p', '360p.m3u8'), entry(900, '854x480', '480p', '480p.m3u8'),
  entry(900, '1280x720', '720p', '480p.m3u8'),
);

test('a mirror master is already AppX menu, with or without 1080p', () => {
  assert.equal(planMaster(MIRROR).status, 'ok');
  const wave2 = `${MIRROR}${entry(2000, '1920x1080', '1080p', '1080p.m3u8')}\n`;
  assert.equal(planMaster(wave2).status, 'ok');
});

test('an honest probed master gains the aliases and keeps each file bandwidth', () => {
  const plan = planMaster(master(entry(210, '256x144', null, '240p.m3u8'), entry(910, '854x480', null, '480p.m3u8')));
  assert.equal(plan.status, 'change');
  assert.deepEqual(plan.labels, ['144p->240p.m3u8', '240p->240p.m3u8', '480p->480p.m3u8', '720p->480p.m3u8']);
  assert.equal(plan.after, master(
    entry(210, '256x144', '144p', '240p.m3u8'), entry(210, '426x240', '240p', '240p.m3u8'),
    entry(910, '854x480', '480p', '480p.m3u8'), entry(910, '1280x720', '720p', '480p.m3u8'),
  ));
  assert.equal(planMaster(plan.after).status, 'ok', 'a rewritten master is stable');
});

test('never advertises a file the video does not have', () => {
  const only480 = planMaster(master(entry(900, '854x480', null, '480p.m3u8')));
  assert.deepEqual(only480.labels, ['480p->480p.m3u8', '720p->480p.m3u8']);
  const only240 = planMaster(master(entry(200, '256x144', null, '240p.m3u8')));
  assert.deepEqual(only240.labels, ['144p->240p.m3u8', '240p->240p.m3u8']);
  const mid = planMaster(master(entry(500, '638x360', null, '360p.m3u8')));
  assert.deepEqual(mid.labels, ['360p->360p.m3u8']);
});

test('an unfamiliar master is left alone', () => {
  for (const text of [
    master(entry(900, '854x480', '480p', '720p.m3u8')),
    master(entry(900, '854x480', null, 'https://cdn.example/480p.m3u8')),
    master(entry(0, '854x480', null, '480p.m3u8')),
    master('#EXT-X-STREAM-INF:BANDWIDTH=900,RESOLUTION=854x480,CODECS="avc1"\n480p.m3u8'),
    master('#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="a",NAME="x"', entry(900, '854x480', null, '480p.m3u8')),
    '#EXTM3U\n#EXTINF:6,\nseg.ts\n',
    'not a playlist',
    '',
  ]) assert.equal(planMaster(text).status, 'unknown', text);
});

test('targets exclude admin uploads and non-mirror keys', () => {
  const id = 'a'.repeat(24);
  const { targets, skipped } = selectTargets([
    { _id: id, apxAssetKey: 'vid:x', hlsAsset: { key: `781/${id}/hls/master.m3u8` } },
    { _id: 'b'.repeat(24), hlsAsset: { key: `781/${'b'.repeat(24)}/hls/master.m3u8` } },
    { _id: 'c'.repeat(24), apxAssetKey: 'vid:y' },
    { _id: 'd'.repeat(24), apxAssetKey: 'vid:z', hlsAsset: { key: `781/${'d'.repeat(24)}/playlist-mpl-vod.m3u8` } },
    { _id: 'e'.repeat(24), apxAssetKey: 'vid:q', hlsAsset: { key: `472/${'e'.repeat(24)}/hls/master.m3u8` } },
    { _id: 'f'.repeat(24), apxAssetKey: 'vid:r', hlsAsset: { key: `781/${id}/hls/master.m3u8` } },
  ]);
  assert.deepEqual(targets, [{ classId: id, key: `781/${id}/hls/master.m3u8` }]);
  assert.equal(skipped.noApxAsset, 1);
  assert.equal(skipped.noHls, 1);
  assert.equal(skipped.otherKeyForm.length, 3);
});

test('commit needs an explicit scope', () => {
  assert.throws(() => parseArgs(['--commit']), /--limit N or --all/);
  assert.equal(parseArgs(['--commit', '--all']).all, true);
  assert.equal(parseArgs(['--commit', '--limit', '5']).limit, 5);
  assert.equal(parseArgs([]).commit, false);
});

function fakeStore(initial) {
  const objects = new Map(Object.entries(initial));
  const puts = [];
  return {
    objects, puts,
    async get(key) { return { text: objects.get(key), etag: sha256(objects.get(key)), contentType: 'application/vnd.apple.mpegurl' }; },
    async etag(key) { return sha256(objects.get(key)); },
    async put(key, text) { puts.push(key); objects.set(key, text); },
  };
}

const HONEST = master(entry(910, '854x480', null, '480p.m3u8'));

test('commit writes the ledger first, then rollback restores exact bytes', async () => {
  const store = fakeStore({ k: HONEST });
  const ledger = [];
  assert.equal(await commitOne(store, 'k', 'c', (row) => { assert.equal(store.puts.length, 0); ledger.push(row); }), 'changed');
  assert.equal(planMaster(store.objects.get('k')).status, 'ok');
  assert.equal(ledger[0].before, HONEST);
  assert.equal(await commitOne(store, 'k', 'c', () => assert.fail('no second ledger row')), 'ok', 'rerun is a no-op');
  assert.deepEqual(await rollbackEntries(store, ledger, false), { restored: 0, wouldRestore: 1, drifted: [] });
  assert.equal(store.objects.get('k'), ledger[0].after, 'dry rollback writes nothing');
  assert.deepEqual(await rollbackEntries(store, ledger, true), { restored: 1, wouldRestore: 0, drifted: [] });
  assert.equal(store.objects.get('k'), HONEST);
});

test('commit leaves ok and unknown masters unwritten', async () => {
  const store = fakeStore({ a: MIRROR, b: 'junk' });
  assert.equal(await commitOne(store, 'a', 'c', () => assert.fail()), 'ok');
  assert.equal(await commitOne(store, 'b', 'c', () => assert.fail()), 'unknown');
  assert.deepEqual(store.puts, []);
});

test('commit refuses a master that moved between read and write', async () => {
  const store = fakeStore({ k: HONEST });
  store.etag = async () => 'someone-else';
  await assert.rejects(commitOne(store, 'k', 'c', () => {}), /changed while planning/);
  assert.deepEqual(store.puts, []);
});

test('rollback does not overwrite a master edited after the run', async () => {
  const store = fakeStore({ k: HONEST });
  const ledger = [];
  await commitOne(store, 'k', 'c', (row) => ledger.push(row));
  store.objects.set('k', MIRROR);
  assert.deepEqual(await rollbackEntries(store, ledger, true), { restored: 0, wouldRestore: 0, drifted: ['k'] });
  assert.equal(store.objects.get('k'), MIRROR);
});
