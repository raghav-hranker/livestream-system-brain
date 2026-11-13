#!/usr/bin/env node
// Read-only, from the Mac. Proves a new Bunny pull zone over R2 can serve signed HLS before any routing
// points students at it. Signs locally with the zone's key, the same way playback does, so it needs no
// prod API and no JWT. Prints no tokens.
//
//   BUNNY_ROUTED_RECORDED_CDN_BASE=https://<zone>.b-cdn.net \
//   BUNNY_ROUTED_RECORDED_SECURITY_KEY=<zone token key> \
//   node reference/scripts/bunny_r2_zone_probe.cjs <classId> <classId> ...
//
// Pass at least one class from before 2026-09-10 and one after, since only R2 has the later ones. A
// class whose key is not 472/<id>/hls/master.m3u8 goes in as --key <hlsAsset.key> instead.
// For the live zone set PROBE_ZONE=live and BUNNY_ROUTED_LIVE_*: class ids then mean ended replays,
// at 472/<id>/playlist-mpl-vod.m3u8.
// FAIL means do not route to this zone. WARN means it works but needs tuning. Exit 0 only with no FAIL.
const crypto = require('crypto');

const TTL_SECONDS = 21600; // what routed links get in playbackController
const SITE_ORIGIN = 'https://quicktricksbysahilsir.com';

const base64Url = (b) => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** Mirrors signAssetUrl in quicktricks-backend src/services/bunnyAssetSigner.ts (directory scope, no IP). */
const signUrl = (cdnBase, securityKey, key, expires) => {
  const path = `/${key.replace(/^\/+/, '')}`;
  const tokenPath = path.slice(0, path.lastIndexOf('/') + 1);
  const digest = crypto.createHmac('sha256', securityKey).update(`${tokenPath}${expires}token_path=${tokenPath}`).digest();
  const url = new URL(path, `${cdnBase}/`);
  url.searchParams.set('token', `HS256-${base64Url(digest)}`);
  url.searchParams.set('token_path', tokenPath);
  url.searchParams.set('expires', String(expires));
  return url;
};

const get = async (url, headers = {}) => {
  const started = performance.now();
  try {
    const res = await fetch(url, { headers, redirect: 'follow' });
    const body = Buffer.from(await res.arrayBuffer());
    return {
      status: res.status,
      ms: Math.round(performance.now() - started),
      body,
      cache: res.headers.get('cdn-cache'),
      server: res.headers.get('server'),
      cors: res.headers.get('access-control-allow-origin'),
      contentType: res.headers.get('content-type'),
    };
  } catch (error) {
    return { status: 0, ms: Math.round(performance.now() - started), body: Buffer.alloc(0), error: String(error.cause?.code || error.message) };
  }
};

const uris = (playlist) => playlist.toString().split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
// The token rides the query string, which relative resolution drops. Players carry it across, so do we.
const child = (parent, rel) => {
  const url = new URL(rel, parent);
  url.search = parent.search;
  return url;
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const probeKey = async ({ cdnBase, securityKey, key, label, otherKey, nowUnix, pauseMs = 3000 }) => {
  const results = [];
  const record = (level, check, detail) => results.push({ level, check, detail });
  const blocked = (s) => s === 401 || s === 403;

  const signed = signUrl(cdnBase, securityKey, key, nowUnix + TTL_SECONDS);
  const master = await get(signed);
  if (master.status !== 200) {
    const why = master.status === 404 ? 'not at the origin: check the bucket and this hlsAsset.key'
      : blocked(master.status) ? 'refused: wrong key for this zone, or origin auth to R2 failed'
        : master.status >= 500 ? 'origin error: check the S3 origin URL and credentials'
          : master.error || 'unexpected';
    // R2 answers in S3 XML with a <Code>, so a refusal from the origin can be told from one by Bunny.
    const origin = /<Code>([^<]+)<\/Code>/.exec(master.body.toString());
    const reason = /<Message>([^<]+)<\/Message>/.exec(master.body.toString());
    // Tested against R2 on 2026-11-03: only a request with no login at all gets exactly this answer.
    const noLogin = origin?.[1] === 'InvalidArgument' && reason?.[1] === 'Authorization';
    const from = noLogin ? 'R2 got no login: turn on S3 authentication on the zone and save'
      : origin ? `R2 said ${origin[1]}${reason ? `: ${reason[1]}` : ''}` : `not from R2: ${master.server}, ${master.contentType}, ${master.body.length} bytes`;
    record('FAIL', 'signed master', `${master.status}, ${why} [${from}]`);
    return { label, results };
  }
  record('ok', 'signed master', `200 in ${master.ms} ms, edge ${master.server}`);

  const rungs = uris(master.body);
  if (rungs.length === 0) record('FAIL', 'master content', 'no renditions: the body is not an HLS master');
  const firstRung = child(signed, rungs[0] ?? '');
  const lastRung = child(signed, rungs[rungs.length - 1] ?? '');
  const rung = await get(firstRung);
  if (rung.status !== 200) {
    record('FAIL', 'rung playlist', `${rung.status} on ${firstRung.pathname}`);
    return { label, results };
  }
  const allRungs = await Promise.all(rungs.map((r) => get(child(signed, r))));
  const badRungs = allRungs.filter((r) => r.status !== 200).length;
  record(badRungs ? 'FAIL' : 'ok', 'all rungs', `${rungs.length - badRungs} of ${rungs.length} playlists 200`);

  const segments = uris(rung.body);
  if (segments.length === 0) {
    record('FAIL', 'rung content', 'no segments in the playlist');
    return { label, results };
  }
  const firstSegUrl = child(firstRung, segments[0]);
  const lastSegUrl = child(firstRung, segments[segments.length - 1]);
  const firstSeg = await get(firstSegUrl);
  const lastSeg = await get(lastSegUrl);
  for (const [name, seg] of [['first segment', firstSeg], ['last segment', lastSeg]]) {
    record(seg.status === 200 && seg.body.length > 0 ? 'ok' : 'FAIL', name, `${seg.status}, ${seg.body.length} bytes in ${seg.ms} ms`);
  }

  // Players resume a dropped segment with a Range request.
  const ranged = await get(firstSegUrl, { Range: 'bytes=0-1023' });
  record(ranged.status === 206 ? 'ok' : 'FAIL', 'range request', `${ranged.status}, expected 206`);

  // The zone must refuse what the token model promises to refuse.
  const unsigned = await get(`${cdnBase}/${key.replace(/^\/+/, '')}`);
  record(blocked(unsigned.status) ? 'ok' : 'FAIL', 'unsigned refused', `${unsigned.status}${unsigned.status === 200 ? ': zone is public, turn token auth on' : ''}`);
  const expired = await get(signUrl(cdnBase, securityKey, key, nowUnix - 60));
  record(blocked(expired.status) ? 'ok' : 'FAIL', 'expired refused', String(expired.status));
  if (otherKey) {
    const foreign = new URL(`/${otherKey.replace(/^\/+/, '')}`, `${cdnBase}/`);
    foreign.search = signed.search;
    const crossed = await get(foreign);
    record(blocked(crossed.status) ? 'ok' : 'FAIL', 'other class refused', `${crossed.status} using this class's token`);
  }

  // The website plays through hls.js, which needs CORS. The app does not, so this is invisible on a phone.
  const corsPlaylist = await get(signed, { Origin: SITE_ORIGIN });
  const corsSegment = await get(firstSegUrl, { Origin: SITE_ORIGIN, Range: 'bytes=0-1023' });
  for (const [name, res] of [['CORS on playlist', corsPlaylist], ['CORS on segment', corsSegment]]) {
    record(res.cors ? 'ok' : 'FAIL', name, res.cors ? `allow-origin ${res.cors}` : 'header missing: the website will not play');
  }

  // Recordings carry max-age=2 on playlists from their live days. Past that, an untuned zone goes back to R2.
  // A second token stands in for another student: if the cache splits by token, nobody shares a HIT.
  await sleep(pauseMs);
  const other = signUrl(cdnBase, securityKey, key, nowUnix + TTL_SECONDS + 60);
  const otherRung = child(other, rungs[0]);
  const [warmMaster, warmRung, warmSeg] = await Promise.all([get(other), get(otherRung), get(child(otherRung, segments[0]))]);
  for (const [name, res] of [['warm master', warmMaster], ['warm rung', warmRung], ['warm segment', warmSeg]]) {
    record(res.cache === 'HIT' ? 'ok' : 'WARN', name, `cdn-cache ${res.cache}, ${res.ms} ms`);
  }
  if (lastRung.href === firstRung.href) record('WARN', 'rung count', 'only one rung in the master');
  return { label, results };
};

const parseTargets = (argv, keyFor) => {
  const targets = [];
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--key') {
      i += 1;
      targets.push({ label: argv[i], key: argv[i] });
    } else if (/^[0-9a-f]{24}$/.test(argv[i])) {
      targets.push({ label: argv[i], key: keyFor(argv[i]) });
    } else {
      throw new Error(`Not a class id: ${argv[i]}`);
    }
  }
  return targets;
};

const main = async () => {
  const live = process.env.PROBE_ZONE === 'live';
  const zone = live ? 'LIVE' : 'RECORDED';
  const cdnBase = (process.env[`BUNNY_ROUTED_${zone}_CDN_BASE`] || '').replace(/\/+$/, '');
  const securityKey = process.env[`BUNNY_ROUTED_${zone}_SECURITY_KEY`] || '';
  const keyFor = (id) => (live ? `472/${id}/playlist-mpl-vod.m3u8` : `472/${id}/hls/master.m3u8`);
  const targets = parseTargets(process.argv.slice(2), keyFor);
  if (!cdnBase || !securityKey || targets.length === 0) {
    console.error(`Set BUNNY_ROUTED_${zone}_CDN_BASE and BUNNY_ROUTED_${zone}_SECURITY_KEY, and pass class ids.`);
    process.exit(2);
  }
  const nowUnix = Math.floor(Date.now() / 1000);
  const tally = { FAIL: 0, WARN: 0 };
  for (const [i, target] of targets.entries()) {
    const otherKey = targets[(i + 1) % targets.length].key;
    const { label, results } = await probeKey({
      cdnBase, securityKey, key: target.key, label: target.label, nowUnix,
      otherKey: otherKey === target.key ? undefined : otherKey,
    });
    console.log(`\n${label}`);
    for (const { level, check, detail } of results) {
      if (level !== 'ok') tally[level] += 1;
      console.log(`  ${level.padEnd(4)} ${check}: ${detail}`);
    }
  }
  console.log(`\n${tally.FAIL ? 'FAIL: do not route to this zone' : 'PASS: zone serves signed HLS'} (${tally.FAIL} FAIL, ${tally.WARN} WARN)`);
  process.exit(tally.FAIL ? 1 : 0);
};

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(2);
  });
}

module.exports = { signUrl, probeKey };
