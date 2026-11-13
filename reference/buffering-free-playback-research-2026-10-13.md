# Buffering-free playback: what the big platforms do, and where Hranker/quicktricks stands (2026-10-13)

Read-only investigation. Three explorers ran in parallel (external sources, the two web players, the
encode/package/deliver chain); this file is the synthesis. Platform facts carry a `file:line` or a measurement
reference. External facts carry a URL. Anything neither measured nor sourced is marked *inferred*.

Related: `buffering-and-dns-handoff-2026-10-08.md`, `cdn-benchmark-*-2026-10-08.md`,
`client-playback-telemetry-guide.md`, `docs/plans/playback-cdn-pilot.md`.

## 1. The one equation

A stall happens when `download time of a segment > its play time`, and the forward buffer has already drained.
Download time = TTFB (distance + cache state, CDN-controlled) + bytes ÷ bandwidth (encode- and network-controlled).
Every technique below moves one of four things: fewer bytes per second of video, more seconds of buffer ahead,
lower TTFB per request, or faster recovery when a request fails. The big platforms do all four, and they measure
the result per network and city before and after each change.

## 2. What YouTube, Netflix and Apple actually do

| Lever | What they do | Source |
|---|---|---|
| Ladder floor | Apple: cellular playlists MUST carry a rung ≤192 kbps peak; cellular default SHOULD be ~730 kbps at 432p | https://developer.apple.com/documentation/http-live-streaming/hls-authoring-specification-for-apple-devices |
| Per-title encode | Netflix fits the ladder to content complexity; simple content (cartoons, and by extension slides + talking head) gets the same quality at far fewer bits | https://netflixtechblog.com/per-title-encode-optimization-7e99442b62a2 |
| Honest BANDWIDTH tags | VOD peak within 10% of `BANDWIDTH`; live peak under 125%. ABR decides from the tag, so a wrong tag picks a rung the link cannot sustain | Apple spec above |
| Keyframes | IDR every 2 s, every segment starts on an IDR, same GOP on every rung, `EXT-X-INDEPENDENT-SEGMENTS` | Apple spec above |
| Audio | HE-AAC only at ≤64 kbps; speech does not need 96k on every rung | Apple spec above |
| Segment length | Apple says 6 s target; academic tests show 2 s tracks bandwidth swings better and 10 s stalls more on sudden drops; keep the duration constant | https://arxiv.org/pdf/1606.00341, https://bitmovin.com/mpeg-dash-hls-segment-length |
| ABR | Netflix BBA (buffer-based) cut rebuffers 10–20% vs its own default on millions of users; throughput only matters at startup. hls.js and ExoPlayer are throughput EWMA + buffer guards: start low, climb slowly (0.7 factor), drop fast | https://web.stanford.edu/class/cs244/papers/sigcomm2014-video.pdf |
| Transport | QUIC/HTTP3 cut YouTube rebuffers in India by 22.1% desktop / 20.2% mobile (mean min RTT 188 ms, 8% TCP retransmits), the largest gain of any country measured | https://storage.googleapis.com/gweb-research2023-media/pubtools/4102.pdf |
| Edge cache | Netflix fills caches off-peak so peak requests are warm; token checks run at the edge before cache; sign a path prefix, not each segment | https://openconnect.netflix.com/Open-Connect-Overview.pdf, https://developers.cloudflare.com/waf/custom-rules/use-cases/configure-token-authentication/ |
| Startup | Preload the next item's first 5 s while idle (Media3 `DefaultPreloadManager`); pre-warm the connection; one player instance per page | https://developer.android.com/blog/posts/elevating-media-playback-introducing-preloading-with-media3-part-1 |
| Offline | YouTube Offline (India, 2014) and Smart Offline (2016, off-peak auto-download) exist because some links cannot be fixed by ABR | https://www.medianama.com/2014/12/223-youtube-offline-android-india/ |
| Measure | Rebuffer ratio, video start time, exits before start, rung distribution, per network type and city (Conviva set); CMCD joins player state to CDN logs | https://docs.conviva.ai/api/apis/conviva-vsi-api/metrics/ |

Not found publicly: Physics Wallah or Unacademy engineering write-ups, Netflix/YouTube numeric rebuffer targets.

## 3. Where this platform stands, lever by lever

### 3a. Bytes per second of video (encode)

| | Live (x264, CPU) | Recorded 1A (NVENC) |
|---|---|---|
| Rungs (video + audio) | 720p 1000k+96k, 480p 600k+96k, 360p 450k+96k, 240p 300k+96k | 720p 1200k+96k, 480p 700k+96k, 360p 400k+96k, 240p 250k+64k |
| Delivered floor | ~446 kbps (240p, incl. TS overhead) | ~325 kbps peak (240p) |
| GOP | `-g 48`, 1.6 s at 30 fps, `-sc_threshold 0`, `-tune zerolatency` (no B-frames) | `-g 90`, forced keyframe every 3 s |
| Segment | `-hls_time 4`, TS, measured 2.4–4.0 s, no `independent_segments` | code says 3 s with `independent_segments`; production measures **12.5 s** (see Gotchas) |
| Measured 480p payload | 756 kbps average per master playlist | 0.42–0.56 Mbps across 3 classes (cq 23 undershoots) |
| Audio | 96k AAC-LC on every rung, 22% of the 240p rung | 96k, 64k on 240p |
| Audio-only or 144p rung | none | none |

Sources: livestream `backend/lib/streamLifecycle.js:296-342`; video-transcoder `container/index.js:239-345`;
`cdn-benchmark-vidyagram-vs-quicktricks-2026-10-08.md`; livestream branch `live-encoder-bandwidth`,
`docs/plans/phase0-results.md`.

Against the big-platform rules: the floor is 2.3× Apple's cellular MUST (192 kbps). No rung a 2G/weak-3G student
can sustain exists, so ABR has nowhere to go but stall. Audio is over-provisioned for speech. The live GOP (1.6 s)
does not align with the 4 s segment, which costs bits and makes segment boundaries uneven. The unmerged
`live-encoder-bandwidth` ADR already measured capped-CRF + B-frames + 64k audio at −6% (720p) to −33% (240p).

### 3b. Seconds of buffer ahead (player)

| | ls (prod viewer, hls.js 1.6.13) | thedhronas (student site, hls.js 1.6.13) |
|---|---|---|
| Forward buffer | `maxBufferLength 30`, `maxMaxBufferLength 600` | 30, then **300 s** after first level loads, capped by `maxBufferSize` 100 MB |
| Start rung | auto from 500 kbps default estimate (`testBandwidth` probes a bottom-rung fragment) | **forced to the highest rung** for the first fragment (`MANIFEST_PARSED` sets `startLevel = top`) |
| Up/down factors | defaults 0.95 / 0.7 | 0.95 / 0.85, plus every 15 fragments inflates the estimate ×1.5 and forces a re-pick |
| On fragment error | hls.js default (6 retries, 1→8 s) | pins the level to `lastStableLevel` so it never drops, 20 retries |
| `capLevelToPlayerSize` | off | off |
| Fragment load timeout | 120 s (default) | 120 s |
| Quality menu | hardcoded 720/480/360, 240p never offered | from manifest |
| Resume (`videoPosition`) | not implemented, `startPosition -1` | not implemented |
| Prefetch / preconnect | none | none |

Sources: `ls/components/HLSVideoPlayer.tsx:155-189,377-395`; `thedhronas/sharedComponents/others/hls-video-player/HlsVideoPlayer.tsx:63-119,130-152,158-225`.

Against the rules: thedhronas does the opposite of "start low, climb slowly". It starts at 720p on every link and
refuses to drop on errors. ls starts sensibly but never pins a small element to a small rung and waits up to 120 s
on a stuck fragment before the emergency path fires.

### 3c. TTFB per request (delivery)

| Item | State | Evidence |
|---|---|---|
| Recorded zone cache | HIT 60–140 ms at BOM, playlists HIT too, token in path and stripped from the cache key | `playback-cdn-pilot.md`, `cloudflareFolderSigner.ts:26` |
| Live zone `.ts` | HIT ~60 ms since the 2026-10-07 rule | `livev2-cloudflare-not-caching` memory |
| Live zone `.m3u8` incl. `-vod.m3u8` replay playlists | **DYNAMIC, 285–520 ms**, every viewer hits R2 | same |
| Live `.m3u8` during a class | polled every ~4 s per viewer, every poll to R2 | inferred from the rule + `hls_list_size 0` |
| HTTP/3 | **off**: no `alt-svc` header on either host (probed 2026-10-13 from Mumbai, HTTP/2 403 via WAF) | this session |
| Cache MISS cost | 190–520 ms on Cloudflare; ParikshaPro first fetch 562–597 ms vs 130 ms repeat | `cdn-benchmark-expanded-own-platforms-2026-10-08.md` |
| Stall-line ratio, recorded 480p, Mumbai Mac | median 0.06, p90 0.26, max 0.64, none over 1.0 | same benchmark |
| Live replay segment in a student's DevTools | 600 KB: 0.96 s wait + 2.04 s download = 3.0 s for ~3.5 s of video, at the stall line (before the `.ts` rule) | `buffering-and-dns-handoff-2026-10-08.md` |

Against the rules: the token design is already correct (edge HMAC, path prefix, cache key ignores the token). The
gaps are the uncached live playlists and HTTP/3 being off, which the QUIC paper says is worth ~20% of rebuffers in
India on its own.

### 3d. Recovery when something fails (resilience)

| Failure | ls | thedhronas |
|---|---|---|
| 403 (token) | re-mint, but Cloudflare's path token changes the URL, so the whole player is destroyed and rebuilt; VOD restarts at 0; no cap on the loop | re-mint changes nothing for a path token, can loop |
| DNS / connect failure (status 0) | hls.js does not retry status 0 while online; red "Network error" overlay, no retry, no re-mint | **no fatal-error branch at all: black screen** (the 2026-10-08 symptom) |
| CDN fallback (`?cdn=bunny`) | backend honours it per request; no client sends it | same |
| Double mount | the socket's join-time `streamUpdate` triggers a second class fetch + second mint; new path token → `srcKey` changes → hls destroyed and rebuilt, in-flight segment aborted. Not React Strict Mode in prod. Chat fullscreen toggle also remounts | any `streamUpdate` unmounts the player behind a spinner, VOD restarts at 0 |

Sources: `ls/lib/hooks/usePlayback.ts:190-220`, `ls/components/HLSVideoPlayer.tsx:107-115,244-285`, livestream
`backend/rtmpserver-2.js:583-590`, `quicktricks-backend/src/services/cloudflareFolderSigner.ts:68-75`,
thedhronas page `index.tsx:168-203`.

### 3e. Measurement

Backend ingestion `POST /api/playback-telemetry` is live and enabled since 2026-10-12. Neither web player emits
anything. The mobile guides contain token handling only, no buffer/ABR/retry advice, and the iOS guide force-unwraps
a query-token URL that no longer exists under Cloudflare (`avplayer-hls-token-guide.md:70-91`). Nothing records
which CDN served a view. So today "students in tier-2/3 cities buffer" cannot be attributed to encode, CDN, DNS or
the player.

## 4. Recommendation, ranked by rebuffer reduction per unit of work

Expected effects are *inferred* from the sources in §2 unless a measurement is cited. Verify each with the
telemetry in step 0 before and after.

| # | Change | Repo | Why it ranks here | Cost |
|---|---|---|---|---|
| 0 | Ship the telemetry tracker in thedhronas and ls (guide §7a already defines it), 5% sampling, with `cdnHost`, rung, network type | ls, thedhronas | Nothing below can be judged without it. Big platforms tune on rebuffer ratio per network and city, never on a Mumbai Mac | small, contract exists |
| 1 | Turn on HTTP/3 for zone hranker.org (dashboard toggle) | Cloudflare | Largest measured India gain in the literature (~20% fewer rebuffers), zero code | minutes |
| 2 | Cache live-zone playlists: `-vod.m3u8` long TTL (purge after hls-vod-fix), live `.m3u8` 2 s edge TTL | Cloudflare | ~0.5 s off every replay start; live polling stops reaching R2 | minutes, already specified in the 2026-09-10 dashboard handoff |
| 3 | Stop the double mount: ignore a `streamUpdate` whose status equals the current one; key the player on class id + CDN, not the token path; swap tokens without destroy | ls, thedhronas | Every class open today pays startup twice and aborts a segment. Startup measured at 7.7 s page-load → first segment | small |
| 4 | thedhronas player: remove the forced top start rung and the no-drop-on-error pin; add a fatal-error branch with a visible message and a retry | thedhronas | It currently violates every ABR rule the big players follow, on the site most students use | small |
| 5 | Add a ≤192 kbps rung (144p or 240p at ~150k video + 32–48k HE-AAC) and drop audio to 64k on 240/360p | livestream, video-transcoder | Gives ABR somewhere to go on weak links; Apple's cellular MUST; the x264 cost is ~4% of a 720p encode | medium, plus the `live-encoder-bandwidth` ADR changes (−6% to −33% bits, already measured) |
| 6 | Align live GOP to the segment (`-g 120` at 30 fps for 4 s, or 2 s segments with `-g 60`), add `independent_segments`, fix the fallback master's under-declared BANDWIDTH | livestream | Even boundaries make ABR switches clean and the stall-line prediction honest | small |
| 7 | hls.js tuning in both players: `capLevelToPlayerSize: true`, `fragLoadPolicy.maxLoadTimeMs` ≈ 3× segment, `startFragPrefetch: true`, `<link rel=preconnect>` to the media host, `loadSource` on class open before play | ls, thedhronas | Cheap wins the research names explicitly | small |
| 8 | Client CDN fallback: on status-0 or 520–524, re-mint with `?cdn=bunny` and remember per session; never on 403/404. Requires the Bunny-over-R2 zone | ls, thedhronas, apps | Converts the DNS black screen into a working player; backend half is live | medium, the zone is unbuilt and Bunny↔R2 auth is unverified |
| 9 | Offline download of recorded classes in the apps (MP4s already exist on B2+Bunny) | apps | The proven Indian-market fix for links no ABR can save | app work, out of this repo |

Not recommended now: switching CDN (measured parity with Bunny at 55–140 ms), fMP4/CMAF (hard-coded `.ts`
regexes in watchers and cache rules, benefit unmeasured on this content), AV1/VP9 (software decode on cheap
Android, Netflix limits it to Save Data users), LL-HLS (1 s parts at 3× P95 RTT is already marginal at 188 ms
RTT, and nobody has asked for lower live latency).

## 5. Gotchas found on the way

- Recorded segments measure **12.5 s** on production but the 1A code writes 3 s. Either the deployed image differs
  or the APX-migrated classes were packaged elsewhere. A 12.5 s, ~1 MB first segment is a slow start on 3G. Check
  `EXT-X-TARGETDURATION` on a freshly transcoded class before touching the ladder.
- The external explorer estimated the 480p rung at 1.2 Mbps from the "600 KB per segment" note. Measured values are
  0.42–0.76 Mbps. Use the measured ones.
- `SYSTEM.md:11` says live encodes on GPU NVENC. The quicktricks live encoder is libx264 on CPU (`c4-standard-8`,
  ~1.8 cores per stream). NVENC is only on the `futurekul` branch.
- A new stream of an already-streamed class restarts at `segment_0` under a 1-year immutable edge cache. Still open.
- Live playlists grow unbounded (`hls_list_size 0`); a 3 h class is ~2,700 entries per variant, polled every 4 s
  per viewer and uncached (*inferred* size, not measured).
- `livestream/backend/routes/stream.js:16-17` hardcodes AWS keys. Unrelated to buffering, needs its own ticket.
