// HLS segment benchmark: compare two (or more) platforms' CDNs on the thing that decides buffering —
// how long one segment takes to arrive versus how long it plays.
//
//   node hls_segment_bench.cjs \
//     --target 'quicktricks=<master-or-media .m3u8 URL>' \
//     --target 'vidyagram=<master-or-media .m3u8 URL>' \
//     [--header 'vidyagram=Referer: https://vidyagram.online/'] \
//     [--rendition 480] [--segments 10] [--repeat 2] [--out bench.json]
//
// Paste the playlist URL from DevTools (right-click the .m3u8 → Copy URL). Signed URLs expire, so run
// soon after copying. If a CDN wants a Referer/Origin/Cookie, pass it with --header label=Header: value.
//
// For each target: master → rendition closest to --rendition (height, default 480) → media playlist,
// then --segments segments spread evenly across the video, each fetched --repeat times. Targets are
// interleaved per segment so a network wobble hits both alike. Fetch 1 of a deep segment is the
// first-fetch sample; fetch 2 is the repeat sample. Cache headers establish HIT/MISS.
// --targets-stdin reads [{label,url},...] from stdin so signed URLs stay off disk and top-level argv.
//
// Every fetch is a fresh curl (new DNS + TCP + TLS). DevTools' columns map as:
//   wait     = starttransfer − appconnect   ("Waiting for server response" on a reused connection)
//   download = total − starttransfer        ("Content download")
//   ratio    = (wait + download) ÷ segment duration — the stall line is 1.0; lower is more headroom.
const { execFileSync } = require('child_process');
const fs = require('fs');

const args = process.argv.slice(2);
const all = (name) => args.flatMap((a, i) => (a === name ? [args[i + 1]] : []));
const flag = (name, dflt) => { const i = args.indexOf(name); return i === -1 ? dflt : args[i + 1]; };
const splitEq = (s) => { const i = s.indexOf('='); return [s.slice(0, i), s.slice(i + 1)]; };

const stdinTargets = args.includes('--targets-stdin') ? JSON.parse(fs.readFileSync(0, 'utf8')) : [];
const targets = [...all('--target').map(splitEq).map(([label, url]) => ({ label, url })), ...stdinTargets];
for (const target of targets) {
  if (!target || typeof target.label !== 'string' || typeof target.url !== 'string') throw new Error('Invalid benchmark target');
  if (!['https:', 'http:'].includes(new URL(target.url).protocol)) throw new Error('Invalid target protocol');
}
const headers = {};
for (const [label, h] of all('--header').map(splitEq)) (headers[label] ||= []).push(h);
const RENDITION = Number(flag('--rendition', 480));
const SEGMENTS = Number(flag('--segments', 10));
const REPEAT = Number(flag('--repeat', 2));
const OUT = flag('--out');
if (targets.length < 1) { console.error('need at least one --target label=url'); process.exit(1); }

const FMT = '%{http_code} %{time_namelookup} %{time_connect} %{time_appconnect} %{time_starttransfer} %{time_total} %{size_download} %{remote_ip}';
// Keep response headers and signed playlist bodies in memory only.

function curl(url, label, { keepBody = false } = {}) {
  const hArgs = (headers[label] || []).flatMap((h) => ['-H', h]);
  const marker = '\n__HLS_BENCH_TIMING__';
  let raw;
  try {
    raw = execFileSync('curl', ['-sS', '-L', '--compressed', '--max-time', '30', '-o', keepBody ? '-' : '/dev/null',
      '-D', '-', '-w', marker + FMT, '-A', 'Mozilla/5.0 (Macintosh) hls-segment-bench', ...hArgs, url],
    { encoding: 'utf8', timeout: 35000, maxBuffer: 8 * 1024 * 1024 });
  } catch (error) {
    throw new Error(`${label}: curl failed (exit ${error.status ?? 'unknown'})`);
  }
  const split = raw.lastIndexOf(marker);
  const [code, dns, connect, tls, start, total, size, ip] = raw.slice(split + marker.length).trim().split(' ');
  const s = (x) => Math.round(Number(x) * 1000);
  let payload = raw.slice(0, split); let rawHdr = '';
  while (payload.startsWith('HTTP/')) {
    const end = /\r?\n\r?\n/.exec(payload);
    if (!end) break;
    rawHdr = payload.slice(0, end.index);
    payload = payload.slice(end.index + end[0].length);
  }
  const h = Object.fromEntries(rawHdr.split(/\r?\n/).slice(1).map((l) => { const i = l.indexOf(':'); return [l.slice(0, i).toLowerCase(), l.slice(i + 1).trim()]; }));
  const handshakeEnd = s(tls) || s(connect);
  return {
    status: Number(code), ip, bytes: Number(size),
    dnsMs: s(dns), connectMs: s(connect) - s(dns), tlsMs: s(tls) ? s(tls) - s(connect) : 0,
    waitMs: s(start) - handshakeEnd, downloadMs: s(total) - s(start), totalMs: s(total),
    cache: h['cf-cache-status'] || h['cdn-cache'] || h['x-cache'] || h['x-cache-status'] || h['x-proxy-cache'] || null,
    server: h.server || null, via: h.via || null, age: h.age || null,
    pop: h['cf-ray']?.split('-')[1] || h['cdn-requestcountrycode'] || h['x-amz-cf-pop'] || h['x-served-by'] || null,
    cfRay: h['cf-ray'] || null, cacheControl: h['cache-control'] || null,
    cacheStatus: h['cache-status'] || null, contentType: h['content-type'] || null,
    body: keepBody ? payload : undefined,
  };
}

const lines = (t) => t.split('\n').map((l) => l.trim()).filter(Boolean);
// Carry the parent's query token to children whose URI has none (Bunny-style directory tokens).
const resolve = (rel, base) => { const u = new URL(rel, base); if (!u.search) u.search = new URL(base).search; return u.toString(); };

function loadMedia(t) {
  const first = curl(t.url, t.label, { keepBody: true });
  if (first.status !== 200) throw new Error(`${t.label}: playlist ${first.status}`);
  t.playlists = [{ kind: first.body.includes('#EXT-X-STREAM-INF') ? 'master' : 'media', ...first }];
  delete t.playlists[0].body;
  let body = first.body; let mediaUrl = t.url; let rendition = null;
  if (body.includes('#EXT-X-STREAM-INF')) {
    const ls = lines(body); const variants = [];
    ls.forEach((l, i) => {
      if (!l.startsWith('#EXT-X-STREAM-INF')) return;
      const res = /RESOLUTION=\d+x(\d+)/.exec(l); const bw = /BANDWIDTH=(\d+)/.exec(l);
      variants.push({ height: res ? Number(res[1]) : null, bandwidth: bw ? Number(bw[1]) : null, uri: ls[i + 1] });
    });
    variants.sort((a, b) => Math.abs((a.height ?? 0) - RENDITION) - Math.abs((b.height ?? 0) - RENDITION));
    rendition = variants[0];
    mediaUrl = resolve(rendition.uri, t.url);
    const media = curl(mediaUrl, t.label, { keepBody: true });
    if (media.status !== 200) throw new Error(`${t.label}: media playlist ${media.status}`);
    t.playlists.push({ kind: 'media', ...media }); delete t.playlists.at(-1).body;
    body = media.body;
    t.variants = variants.map(({ height, bandwidth }) => ({ height, bandwidth }));
  }
  const segs = []; let dur = null;
  for (const l of lines(body)) {
    if (l.startsWith('#EXTINF:')) dur = parseFloat(l.slice(8));
    else if (!l.startsWith('#')) { segs.push({ url: resolve(l, mediaUrl), durS: dur }); dur = null; }
  }
  t.encrypted = /#EXT-X-KEY:METHOD=(?!NONE)/.test(body);
  t.rendition = rendition && { height: rendition.height, bandwidth: rendition.bandwidth };
  t.host = new URL(segs[0]?.url || mediaUrl).host;
  return segs;
}

const pct = (xs, p) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : null; };
const med = (xs) => pct(xs, 0.5);

const rows = [];
for (const t of targets) {
  t.segs = loadMedia(t);
  console.log(`${t.label}: host ${t.host}, ${t.segs.length} segments, rendition ${JSON.stringify(t.rendition)}, encrypted ${t.encrypted}`);
}
for (let k = 0; k < SEGMENTS; k++) {
  for (const t of targets) {
    const idx = Math.floor(((k + 0.5) / SEGMENTS) * t.segs.length);
    const seg = t.segs[idx];
    for (let r = 1; r <= REPEAT; r++) {
      const m = curl(seg.url, t.label);
      const ratio = seg.durS ? +((m.waitMs + m.downloadMs) / (seg.durS * 1000)).toFixed(2) : null;
      const mbps = m.downloadMs > 0 ? +((m.bytes * 8) / (m.downloadMs * 1000)).toFixed(1) : null;
      const row = { label: t.label, idx, fetch: r, durS: seg.durS, ...m, mbps, ratio };
      delete row.body; rows.push(row);
      console.log(`${t.label.padEnd(12)} seg ${String(idx).padStart(4)} #${r} ${m.status} ${String(m.bytes).padStart(8)}B  dns ${m.dnsMs} tcp ${m.connectMs} tls ${m.tlsMs}  wait ${String(m.waitMs).padStart(4)}  dl ${String(m.downloadMs).padStart(5)}  ${mbps ?? '-'}Mbps  ratio ${ratio ?? '-'}  ${m.cache ?? ''} ${m.pop ?? ''}`);
    }
  }
}

console.log('\nSUMMARY (median / p90)');
const summary = targets.map((t) => {
  const mine = rows.filter((r) => r.label === t.label && r.status === 200);
  const by = (f) => { const xs = mine.filter(f); return {
    n: xs.length,
    waitMs: [med(xs.map((r) => r.waitMs)), pct(xs.map((r) => r.waitMs), 0.9)],
    downloadMs: [med(xs.map((r) => r.downloadMs)), pct(xs.map((r) => r.downloadMs), 0.9)],
    mbps: med(xs.map((r) => r.mbps)), ratio: [med(xs.map((r) => r.ratio)), pct(xs.map((r) => r.ratio), 0.9)],
    kb: Math.round(med(xs.map((r) => r.bytes)) / 1024), segS: med(xs.map((r) => r.durS)),
  }; };
  const s = { label: t.label, host: t.host, rendition: t.rendition, encrypted: t.encrypted,
    playlists: t.playlists,
    handshakeMs: med(mine.map((r) => r.dnsMs + r.connectMs + r.tlsMs)), ip: mine[0]?.ip, server: mine[0]?.server,
    cacheMix: mine.reduce((a, r) => ({ ...a, [r.cache ?? 'none']: (a[r.cache ?? 'none'] || 0) + 1 }), {}),
    cold: by((r) => r.fetch === 1), warm: by((r) => r.fetch > 1), failures: rows.filter((r) => r.label === t.label && r.status !== 200).length };
  console.log(`${t.label}: ${t.host} (${s.server}, ${s.ip}) ${s.cold.kb} KB / ${s.cold.segS}s segments, handshake ${s.handshakeMs} ms, cache ${JSON.stringify(s.cacheMix)}`);
  for (const k of ['cold', 'warm']) {
    const x = s[k]; if (!x.n) continue;
    console.log(`  ${k}: wait ${x.waitMs.join('/')} ms  download ${x.downloadMs.join('/')} ms  ${x.mbps} Mbps  ratio ${x.ratio.join('/')}  (n=${x.n})`);
  }
  return s;
});
if (OUT) { fs.writeFileSync(OUT, JSON.stringify({ at: new Date().toISOString(), args: { RENDITION, SEGMENTS, REPEAT }, summary, rows }, null, 2)); console.log(`\nwrote ${OUT}`); }
