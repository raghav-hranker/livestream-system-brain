// Paste into DevTools Console on a playing quicktricksbysahilsir.com class page.
// Finds the website's hls.js instance (held in a React ref in thedhronas
// sharedComponents/others/hls-video-player/HlsVideoPlayer.tsx), then logs every FRAG_LOADED
// with the player's own timing stats, plus stalls from the <video> element.
//   console.table(__fragStats)   all segments so far
//   __hls                        the live hls.js instance (bandwidthEstimate, levels, currentLevel…)
// VOD buffers 300 s ahead, so after the first burst no new segments load: seek past the buffer
// to make more. A 'waiting' during a seek is a seek, not a network stall.
(() => {
  const v = document.querySelector('video');
  if (!v) return console.warn('no <video> on this page');
  const isHls = (c) => c && typeof c.on === 'function' && 'bandwidthEstimate' in c && Array.isArray(c.levels);
  const fiberKey = Object.keys(v).find((k) => k.startsWith('__reactFiber$'));
  let hls = null;
  for (let f = fiberKey && v[fiberKey], depth = 0; f && !hls && depth < 50; f = f.return, depth++) {
    for (let h = f.memoizedState, n = 0; h && typeof h === 'object' && 'next' in h && n < 100; h = h.next, n++) {
      if (isHls(h.memoizedState?.current)) { hls = h.memoizedState.current; break; }
    }
  }
  const ahead = () => { const b = v.buffered; return b.length ? +(b.end(b.length - 1) - v.currentTime).toFixed(1) : 0; };
  const rows = (window.__fragStats = []);

  if (hls) {
    window.__hls = hls;
    hls.on('hlsFragLoaded', (_, { frag }) => {
      if (frag.type !== 'main') return;
      const s = frag.stats; const l = s.loading;
      const ttfb = l.first - l.start; const dl = l.end - l.first; const total = l.end - l.start;
      const row = {
        sn: frag.sn, rung: `${hls.levels[frag.level]?.height}p`, kb: Math.round(s.total / 1024), durS: +frag.duration.toFixed(2),
        ttfbMs: Math.round(ttfb), dlMs: Math.round(dl), totalMs: Math.round(total),
        mbps: dl > 0 ? +((s.total * 8) / (dl * 1000)).toFixed(1) : null,
        ratio: +(total / (frag.duration * 1000)).toFixed(2), // ≥ 1.0 = arrived slower than it plays
        bwEstMbps: +(hls.bandwidthEstimate / 1e6).toFixed(1), bufferAheadS: ahead(),
      };
      rows.push(row); console.log('[frag]', row);
    });
    console.log(`hooked hls.js ${hls.constructor?.version ?? ''}: rungs ${hls.levels.map((x) => x.height + 'p').join(', ')}, playing ${hls.levels[hls.currentLevel]?.height}p`);
  } else {
    // Fallback: browser Resource Timing. Phase detail (TTFB, bytes) needs Timing-Allow-Origin on the CDN;
    // without it only total duration is real.
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        if (!/\.ts(\?|$)/.test(e.name)) continue;
        const row = { seg: e.name.split('?')[0].split('/').pop(), totalMs: Math.round(e.duration),
          ttfbMs: e.responseStart ? Math.round(e.responseStart - e.requestStart) : 'n/a (no TAO)',
          kb: e.transferSize ? Math.round(e.transferSize / 1024) : 'n/a', bufferAheadS: ahead() };
        rows.push(row); console.log('[seg]', row);
      }
    }).observe({ type: 'resource', buffered: true });
    console.warn('hls.js instance not found; using Resource Timing fallback');
  }

  let stallAt = 0;
  v.addEventListener('waiting', () => { stallAt = performance.now(); console.warn(`[stall] start at ${v.currentTime.toFixed(1)}s${v.seeking ? ' (seek)' : ''}`); });
  v.addEventListener('playing', () => { if (stallAt) { console.warn(`[stall] ${Math.round(performance.now() - stallAt)} ms`); stallAt = 0; } });
})();
