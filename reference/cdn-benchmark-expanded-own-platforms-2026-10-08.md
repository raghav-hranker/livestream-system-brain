# Expanded recorded-video playback pilot — 8 October 2026

Four more video samples: two ParikshaPro lessons from Principal Batch 2025 and two Quicktricks lessons. **All 96 controlled segment requests returned HTTP 200.** In the interleaved four-video comparison, cached segment delivery was similar in absolute time: median 255–335 ms after connection setup. Quicktricks' longer segments gave more buffer headroom per request. The clearest configuration difference was ParikshaPro's `DYNAMIC` playlist responses versus Quicktricks' playlist cache HITs.

This extends the [earlier Vidyagram–Quicktricks benchmark](cdn-benchmark-vidyagram-vs-quicktricks-2026-10-08.md). It is a delivery measurement from Raghav's Mac/network in Mumbai, not a platform-wide buffering verdict or a controlled click-to-first-frame trial. No CDN settings, source media, or application records were changed by the benchmark scripts.

## Selected videos

| Platform | Sample | Class ID | Video CDN |
|---|---|---|---|
| ParikshaPro | Mental health, approximately 32:24; topic observed in the linked video, not a verified catalogue title | `115443` | `recordedvideos.hranker.com` |
| ParikshaPro | Lec 01 II Leave Rule Introduction and Right to Leave, approximately 65:29; Ansari Sir | `64800` | `recordedvideos.hranker.com` |
| Quicktricks | Class 20 \|\| Average Part -20 | `6a455930ebb42f585d9ad162` | `recordedvideosv2.hranker.org` |
| Quicktricks | Class 01 \|\| Time & Work Part-1 | `6a455930ebb42f585d9ad179` | `recordedvideosv2.hranker.org` |

ParikshaPro course `1405` was inspected through the existing signed-in browser tab. Both ParikshaPro videos visibly played. Leave Rule automatically fetched 360p, then 720p during browser observation; these requests are excluded from the 480p table. Browser capture was truncated, and a reload tool call stalled, so neither browser startup time nor stall count is reported. The sampled Leave Rule player was paused afterward.

The Quicktricks samples were existing recorded assets from the previous CDN pilot. Their metadata was read from production Mongo, and temporary URLs were generated with the existing Cloudflare folder signer and VM configuration. This measures the CDN delivery path; it excludes the playback API's authorization, mint time, and player startup. Signed URLs passed directly from SSH stdout to benchmark stdin and were omitted from saved artifacts.

## Interleaved comparison at 480p

Eight evenly distributed segment positions per video, fetched twice. The run finished at **18:52:42 IST**. All 64 segment responses were Cloudflare HITs from the BOM edge. ParikshaPro's sampled positions had been warmed by the earlier round; Quicktricks' samples were already cached when first requested. No cache purge or query cache busting was used.

| Sample | Sample payload bitrate | Implied data/hour | Typical segment duration | Delivery ms, median / p90 | Delivery ÷ playback duration, median / p90 | Successes |
|---|---:|---:|---:|---:|---:|---:|
| ParikshaPro mental health | 0.428 Mbps | 192 MB | 6.54 s | 315 / 370 | 0.048 / 0.057 | 16/16 |
| ParikshaPro Leave Rule | 0.562 Mbps | 253 MB | 6.01 s | 255 / 398 | 0.042 / 0.066 | 16/16 |
| Quicktricks Average Part 20 | 0.416 Mbps | 187 MB | 12.50 s | 335 / 638 | 0.027 / 0.051 | 16/16 |
| Quicktricks Time & Work Part 1 | 0.462 Mbps | 208 MB | 12.50 s | 332 / 483 | 0.028 / 0.073 | 16/16 |

Delivery = server wait plus content download, excluding connection setup. Ratios are recalculated from raw timings rather than the script's two-decimal display. The supply threshold is 1.0. The largest ratio including DNS/TCP/TLS was **0.281**, with none crossing 1.0. That shows adequate supply during these requests; it does not establish a measured absence of player stalls.

Bitrate = sum of downloaded bytes × 8 ÷ sum of sampled segment playback durations, including MPEG-TS overhead and audio. Data/hour extrapolates those eight unique positions; it is not the full video's measured size. These are different lessons and recordings, so bitrate differences do not isolate encoder efficiency.

## First ParikshaPro round and cache misses

The first round finished at **18:49:11 IST**, with 32/32 successful requests. Fifteen of sixteen first-fetch segments were MISS; their immediate repeats were all HIT. These headers establish actual misses, unlike the earlier popular Vidyagram/Quicktricks samples.

| Sample | First-fetch cache | First-fetch wait, median / p90 | Repeat wait, median / p90 | First-fetch delivery ratio, median / p90 |
|---|---|---:|---:|---:|
| Mental health | 8 MISS | 562 / 909 ms | 130 / 142 ms | 0.11 / 0.17 |
| Leave Rule | 7 MISS, 1 HIT | 597 / 731 ms | 131 / 157 ms | 0.13 / 0.17 |

Most miss waits were roughly half a second, compared with about 130 ms on repeat. Even misses remained well below the segment's playback duration on this network. This is evidence of a cache-miss penalty, not evidence of an origin outage or a need to replace the CDN.

## Playlist behavior

| Sample | Master cache / wait | 480p media cache / wait | Observed cache policy |
|---|---|---|---|
| ParikshaPro mental health | DYNAMIC / 219 ms | DYNAMIC / 187 ms | `public, max-age=30` |
| ParikshaPro Leave Rule | DYNAMIC / 240 ms | DYNAMIC / 244 ms | No Cache-Control header |
| Quicktricks Average Part 20 | HIT / 143 ms | HIT / 128 ms | `max-age=31536000` |
| Quicktricks Time & Work Part 1 | HIT / 95 ms | HIT / 61 ms | `max-age=31536000` |

These are the interleaved round's post-handshake wait times; fresh connection overhead still affects total time. Both platforms used Cloudflare and the BOM edge. The dynamic ParikshaPro playlists add repeat backend/origin work; investigating immutable recorded-VOD playlist caching is the clearest follow-up. Any change should distinguish finished VOD playlists from changing live playlists. No cache configuration was modified for this pilot.

The new Quicktricks samples used 0.416–0.462 Mbps, compared with 0.559 Mbps in the earlier Data Arrangement sample. This variation weakens the case for a catalogue-wide 15–20% bitrate reduction based on one class. Evaluate representative recordings and text readability before choosing encoding changes.

## Reproduction and evidence

- [First ParikshaPro round](cdn-bench-parikshapro-2026-10-08.json)
- [Interleaved four-video round](cdn-bench-expanded-own-platforms-2026-10-08.json)
- [Benchmark script](scripts/hls_segment_bench.cjs), now accepts `--targets-stdin` so temporary playback credentials stay off disk and the top-level benchmark command's arguments.

Each curl starts a fresh connection, and requests are interleaved across targets at each segment position. Timing may benefit from resolver caches and differs from the browser's reused HTTP/2 connections. JSON evidence contains timings, response headers, cache status, and segment positions; no cookies, API credentials, or signed playback URLs are saved. The 96 requests are controlled shell segment fetches; manifests and browser exploration are additional and are excluded from that count. No further Vidyagram requests were made in this extension.
