# Vidyagram vs Quicktricks: recorded-video CDN benchmark — 8 October 2026

**Verdict: no consistent overall playback winner on this Mac/network. Quicktricks and Vidyagram are effectively tied on the headline stall-risk ratio.** Across both runs, median ratios were **0.060 vs 0.062**, and p90 was **0.257 vs 0.257**, respectively. No measured segment crossed 1.0, even including its fresh-connection handshake. Run 1 favoured Vidyagram’s first-fetch median; run 2 favoured Quicktricks. The difference between pooled medians (~2%) is too small and unstable to call a meaningful playback win.

**Vidyagram’s concrete advantages:** typical post-handshake server wait was **76 ms vs 134 ms** (58 ms / 43% lower), and the sampled lesson used **0.470 vs 0.559 Mbps** (16% less data; ours needs a 16% reduction to match, or is 19% heavier relative to theirs). These advantages do not establish fewer actual stalls or universally faster starts: this test did not instrument rebuffer events or repeat controlled click-to-first-frame trials. Treat CDN delivery as competitive; prioritise encoding and startup preparation over a CDN migration.

## Scope and measurement

One vantage point: Raghav’s Mac and current network. **Not tier-2/3 mobile networks.** Two different recorded lessons, both 480p: Vidyagram “Matter and Atom” (66:56), Quicktricks “Data Arrangement” (63:08). Different content, recording age and encoder settings confound bitrate comparisons. This is a class/CDN-path sample, not a platform-wide verdict.

Used the connected Chrome automation API, existing signed-in session and new tabs; no credentials entered. Claude in Chrome / `read_network_requests` were not exposed in this session, so the substitute was Chrome CDP network events plus the AppX iframe’s read-only resource timings. AppX’s nested capture did not return segment response headers; shell responses supply its CDN/cache evidence. Tabs created for this task were closed after capture.

Playback covered about a minute on each recording. Vidyagram initially restored near 09:00, then sought to 29:43; Quicktricks sought to 20:17 and 44:28. Vidyagram explicitly selected 480p before playback. Quicktricks initially fetched only 480p, then explicitly locked 480p; selecting quality refetched its media playlist. Do not treat those deliberate refetches as duplicate startup mints.

Each shell run fetches 12 evenly distributed segments twice per platform, interleaved by segment: **24 competitor segment requests per run**, with a fresh curl process/connection per fetch. Browser exploration generated approximately 38 additional competitor segment requests, including intermediate requests during a seek-bar drag; competitor tabs were then closed to stop further traffic. The shell runs stay below the requested ~50 fetch limit; browser exploration plus the first run exceeded that combined budget (~62). No further competitor browser playback was used.

“First” and “repeat” are the script’s `cold` and `warm` fields. **First does not mean origin-cold/cache MISS.** These were popular/cached objects. The second run repeats the same indices and therefore also reflects warming by the first run. No cache purge, unique-query cache busting or origin pressure was applied.

Formulas: wait = starttransfer − appconnect; download = total − starttransfer; ratio = (wait + download) / EXTINF duration. Ratio 1.0 is the supply stall line; lower provides more buffer headroom. DNS, TCP and TLS are incremental phases; handshake is their sum. Fresh connections include TCP slow-start and differ from a browser’s reused HTTP/2 connections. Curl DNS timing may benefit from the Mac/resolver cache, so it is not a forced cold resolver test.

The benchmark script was adjusted to keep headers and playlist bodies **in memory** rather than temporary files, because playlists can contain signed child URLs. Only safe metrics and redacted browser URLs are saved. Signed URLs, query tokens, auth headers and cookies are excluded from artifacts. No commits or infrastructure changes were made.

## Side-by-side measurements

Run 1 finished at **15:52:45 IST**; run 2 started at approximately **16:01 IST** and finished at **16:03:25 IST** (8 October). Starts were about ten minutes apart; output timestamps are completion times. Each cell below is **median / p90**, except Mbps, which is median. Percentiles use the script’s upper order-statistic convention; ratios here are recalculated from raw timings/durations before rounding.

| Run / fetch | Quicktricks wait ms | Vidyagram wait ms | Quicktricks download ms | Vidyagram download ms | Quicktricks Mbps | Vidyagram Mbps | Quicktricks ratio | Vidyagram ratio |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 / first (12 each) | 135 / 144 | 76 / 193 | 606 / 2453 | 427 / 1270 | 13.0 | 12.1 | 0.064 / 0.206 | 0.054 / 0.108 |
| 1 / repeat (12 each) | 130 / 185 | 75 / 121 | 488 / 1526 | 508 / 1003 | 12.7 | 12.2 | 0.049 / 0.127 | 0.050 / 0.086 |
| 2 / first (12 each) | 128 / 361 | 80 / 503 | 689 / 7131 | 1155 / 3101 | 8.2 | 7.8 | 0.060 / 0.585 | 0.108 / 0.387 |
| 2 / repeat (12 each) | 140 / 144 | 111 / 337 | 795 / 2308 | 750 / 3691 | 10.1 | 7.3 | 0.075 / 0.190 | 0.100 / 0.312 |

| Combined / content metric | Quicktricks | Vidyagram |
|---|---:|---:|
| Successful segment fetches | 48/48 | 48/48 |
| Headline ratio, median / p90 | **0.060 / 0.257** | **0.062 / 0.257** |
| Highest headline ratio | 0.638 | 0.633 |
| Fresh-connection total / segment duration, median / p90 | 0.080 / 0.275 | 0.075 / 0.335 |
| Highest ratio including handshake | 0.665 | 0.647 |
| Fetches crossing 1.0, with or without handshake | 0 | 0 |
| Median segment size | 1,044 KiB | 680 KiB |
| Median segment duration | 12.500 s | 12.501 s |
| Sample-weighted payload bitrate: sum(bytes) × 8 / sum(duration) | 0.559 Mbps | 0.470 Mbps |
| Implied data per hour, extrapolated from the 12 sampled segments | 252 MB | 212 MB |
| Median wait / download | 134 / 606 ms | 76 / 565 ms |
| Median transfer Mbps | 11.1 | 9.8 |
| Median incremental DNS / TCP / TLS | 3 / 76 / 99 ms | 2 / 75 / 97 ms |
| Median handshake in run 1 / run 2 | 174 / 184 ms | 166 / 185 ms |
| Pooled handshake median / p90 | 178 / 616 ms | 174 / 297 ms |
| Explicit segment cache HIT/MISS | 48 HIT, 0 MISS | Unknown: no HIT/MISS header in 48 responses |
| Positive Age on segment response | 14/48 | 47/48 |
| Segment edge | BOM throughout | No PoP header exposed |

The 48 fetches per platform repeat **12 unique segment positions**; they are not 48 independent content samples. An evenly spread sample does not measure the whole class’s exact bitrate. Median chunk size differs by 54%, but the more relevant sample-weighted bytes-per-playback-second gap is 19% relative to Vidyagram. Both classes’ ~12.5-second chunks differ from the 2.4–4-second live/replay chunks in the earlier handoff.

Throughput deteriorated during run 2 on both paths: download tails reached multiple seconds, despite our cache HITs. That variability is why a one-run winner would have misled. A ratio below 1.0 is evidence of adequate segment supply at that moment, **not a measured count of player stalls**. Both had more than 98% of the segment duration left at their typical server-wait phase; transfer speed and byte size dominate the slow samples.

Run 2 manifests all returned 200: Quicktricks master/media were HIT at BOM, 387/619 ms total (including fresh handshakes), with compressed payloads 178/926 bytes; Vidyagram’s rendition media playlist took 575 ms total, payload 107,118 bytes, positive Age 527,116 s and `cache-control: private,max-age=31536000`. Long signed segment URIs inflate the AppX playlist; no adaptive master was observed. These manifest fetches also used fresh connections and are not browser click-to-play measurements.

## Media paths and cache evidence

URLs below are intentionally redacted and are not usable playback links.

| Evidence | Quicktricks | Vidyagram |
|---|---|---|
| Video CDN hostname | `recordedvideosv2.hranker.org` | `transcoded-videos.classx.co.in` |
| CDN identity | `server: cloudflare` | `server: Google-Edge-Cache` |
| Master playlist | `https://recordedvideosv2.hranker.org/v/[redacted]/472/6a45595eebb42f585d9af008/hls/master.m3u8` | No adaptive master requested; API/player selects a rendition-specific media playlist |
| 480p media playlist | Same prefix + `480p.m3u8` | `https://transcoded-videos.classx.co.in/videos/armaths-data/4525317-1790927325/hls-34f060/480p/master-3963802.9099085135.m3u8?[redacted]` |
| Three observed sample segments | Same Quicktricks prefix + `480p_0.ts`, `480p_97.ts`, `480p_240.ts` | Same Vidyagram prefix + `master-3963802.90990851350.ts`, `master-3963802.909908513543.ts`, `master-3963802.9099085135149.ts`, each with query removed |
| Structure | Plain HLS master → media → MPEG-TS | Plain HLS media → MPEG-TS, custom AppX player; filename concatenates prefix and segment index |
| AES | No EXT-X-KEY in measured media playlist | No EXT-X-KEY in measured media playlist; no separate AES-key request seen in iframe resource list. Does not rule out custom player protection |
| Browser cache / edge sample | `cf-cache-status: HIT`; `cf-ray: a4746730fc473a31-BOM`; Mumbai | Browser segment headers unavailable; shell `Age` positive on every run-1 sample (24/24), around 525k–527k seconds; 23/24 in run 2 |
| Other requested headers | No `via`, `x-cache` or `cdn-cache`; `Age` absent on the browser example, present on some curl samples | No explicit `cf-cache-status`, `cf-ray`, `via`, `x-cache` or `cdn-cache` on sampled segment responses; positive `Age` on 47/48 shows cache residence but is not an explicit HIT/MISS classification |
| Edge location | BOM directly identified by Cloudflare header | No PoP code exposed; do not infer location from API domain or IP alone |
| Origin | R2 per repo topology context | Not established by these requests |

Vidyagram’s **API** is `armathsapi.akamai.net.in`, with `server: openresty/1.31.1.1` and `via: 1.1 google`. The API hostname does not prove Akamai serves the video. AppX player scripts were hosted on `appx-play.akamai.net.in`. Curl used the iframe player origin for Referer/Origin and succeeded without Cookie headers; those headers were not proven necessary. The nested browser capture did not expose its full outbound headers.

## Startup: measured sequence, limited comparability

| Startup observation | Quicktricks | Vidyagram |
|---|---|---|
| Playback APIs before segment request | One `/api/classes/:id/playback` GET plus its OPTIONS preflight | `fetchVideoDetailsById`, then parallel `watch_videov2` and `getVideoCompletion`; three corresponding OPTIONS requests |
| Other work before segment | Five non-playback API calls: brand settings, class metadata, realtime token, chat bans, notes; these overlap and are not all serial gates | Player iframe/scripts load after quality choice |
| Preparation timing | Mint request to first segment request: 3.314 s; page navigation to first segment request: 3.721 s | API preparation about 0.76 s after opening class; quality selection to first segment request: 2.862 s |
| First segment complete | 7.696 s after page navigation; first segment transfer/request lasted 3.975 s | 3.309 s after quality selection; first segment request lasted 0.447 s |
| Click-to-first-frame | Not instrumented; first segment prefetched before clicking Play | Not instrumented; initial playback restored around 09:00, after initial segment 0/1 fetches |

Manual time spent choosing quality is excluded from the AppX preparation figure. Adding its API preparation (~0.76 s) and post-choice request delay (2.862 s) suggests ~3.62 s to first segment request, but this is an estimate stitched across two UI actions, not a controlled stopwatch trial. Quicktricks’ original master request spent ~662 ms in DNS and ~201 ms in TCP/TLS; mint preflight took ~843 ms and GET a further ~1.278 s. There was only **one mint** in this student recording’s initial trace; the handoff’s double-mount finding belongs to a different viewer and is not reproduced here.

The initial first-segment completion favours Vidyagram, but Quicktricks prefetches before Play, the two players resume differently, and network throughput changed during the run. **A reliable faster-start winner requires repeated, controlled click-to-first-frame trials.** These observations identify startup work to profile, not a defensible global startup speedup.

## Changes on our side

1. **Audit and tune the 480p encoding ladder.** The first-run sampled stream used ~0.559 Mbps versus ~0.470 Mbps for Vidyagram (about 19% more). Try an approximately 15–20% bitrate reduction on representative talking-head/board classes, verifying small Hindi/English text remains readable. Compare bytes per second and tail segment sizes over several classes; the median chunk-size difference alone is misleading. Add a low starting rendition for constrained-network ABR where appropriate.
2. **Reduce preparation time before media.** Profile the playback mint and its preflight/connection contention, reuse connections, and preconnect the configured video host while entitlement is checked. Keep notes/chat work off the media critical path. Preserve auth gates. This trace already has one mint, so do not apply the other viewer’s duplicate-mount fix without reproducing it here.
3. **Measure real startup/rebuffering and keep reachability fallback separate.** Capture click→playing, stalled/waiting duration, selected bitrate, network type, city and CDN host. Validate the handoff’s Bunny-over-R2 fallback for DNS/connect/Cloudflare failures. All recorded-video samples here HIT: a broad cache-rule change or CDN migration is not justified by this test, and the separate `livev2` cache/manifest fixes need their own verification.

## Evidence files

- [Run 1](cdn-bench-vidyagram-vs-quicktricks-2026-10-08.json)
- [Run 2](cdn-bench-vidyagram-vs-quicktricks-2026-10-08-run2.json)
- [Redacted browser evidence](cdn-bench-browser-evidence-2026-10-08.json)
- [Benchmark script](scripts/hls_segment_bench.cjs)
- [Prior CDN/DNS context](buffering-and-dns-handoff-2026-10-08.md)
