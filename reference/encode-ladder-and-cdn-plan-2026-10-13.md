# H.264 ladder for lecture video and the CDN action list (2026-10-13)

Follow-up to `buffering-free-playback-research-2026-10-13.md`. Two questions: the most quality per bit we can
ship in H.264, and what else the CDN can do. Everything measured is cited; the rest is marked *inferred*.

Artifacts: `encode-sweep-2026-10-13/` (rerunnable `sweep.py` + `finish_w2.py`, `results.csv`, full `report.md`,
frame crops `eye_*.png`), `cdn-actions-cloudflare-2026-10-13.md` (ranked, costed, with Cloudflare doc URLs).

## 1. The experiment

Source: `Mains_4_1080P_HD_.mp4`, a Hranker smartboard class (1080p30 H.264 High, 1.9 Mbps, 87 min; typed question
slides on a dark board, yellow handwriting, teacher in front, static between pen strokes). Two 60 s windows: W1 the
densest minute (66:00, top-5 source bitrate), W2 a median minute (60:00). Reference = the window scaled to 720p at
CRF 10. Every encode is scored with VMAF v0.6.1 upscaled to 720p against that reference (assumes a phone-class
display). Baseline C = the production recorded recipe (ABR target 1200/700/400/250k, preset fast, 3 s keyframes),
with x264 standing in for NVENC. Proposed P = capped CRF, High profile, closed 4 s GOP, preset slow, maxrate 1.3x
the old target. 93 encodes, one x264 at a time on an M-series laptop.

## 2. Results (kbps = video only; VMAF mean, W1 / W2)

| rung | baseline C | P crf25 | P crf27 | P crf29 | P crf31 |
|---|---|---|---|---|---|
| 720p | 1211 / 1198 kbps, VMAF 96.6 / 96.8 | 1037 / 867, 96.5 | 797 / 673, 95.4 | 621 / 522, 94.0 | 491 / 402, 92.1 / 92.4 |
| 480p | 706 / 708, 89.0 / 89.4 | 528 / 430, 88.2 | 418 / 342, 86.7 / 86.9 | 335 / 274, 84.7 / 85.2 | 272 / 223, 82.3 / 82.9 |
| 360p | 406 / 405, 77.3 / 78.7 | 332 / 268, 77.1 | 268 / 216, 75.3 / 76.0 | 218 / 176, 73.0 | 178 / 145, 70.2 |
| 240p | 254 / 255, 53.9 / 55.2 | 185 / 150, 52.6 | 150 / 122, 50.4 / 51.2 | 122 / 100, 47.7 | 100 / 82, 44.6 |

What the numbers mean, and what limits them:
- **Capped CRF is the whole win.** The ABR baseline spends its full target on a board that does not move. At equal
  VMAF, CRF 27 to 29 halves the bits at 720p and 480p. The limiter is the content's own entropy, so a class with a
  noisy webcam picture-in-picture will land higher (the live-encoder phase 0 sweep on such a class saved only 6 to 9%
  at 720p/480p for exactly that reason). CRF makes the bitrate per-class automatically, which is what Netflix's
  per-title encoding does by hand.
- **The 1st-percentile frame is the bigger gain.** C's worst frames score 10 to 17 points below its mean (the ABR
  starves slide changes); P's worst frames sit 2 to 3 points below. Fewer visible "blocky slide flips".
- **Resolution, not bitrate, caps 360p and 240p.** 360p never passes VMAF 80 even at CRF 23 (78.5); 240p tops out at
  54. More bits buy nothing there. These rungs exist so the player has somewhere to go, and the frame crops show the
  text is still readable at 240p CRF 27 (150 kbps), slightly soft.
- **144p is not a rung.** VMAF 2 to 8: the text is gone. If a sub-150 kbps tier is ever wanted, it should be
  audio-only, not 144p.
- **preset slow vs medium** saves 2.4 to 3.3% for 1.2 to 1.4x the time. Worth it offline, not for live.
  **veryslow** saves a further 7 to 8% for 3x the time. Fine for a GPU-less VOD farm, otherwise skip.
- **24 fps saves only 4%** at CRF (static content already costs nothing between frames) and adds judder. Keep 30.
- **aq-mode 3 / psy-rd 0.6** is a wash: it moves along the same curve (360 kbps at VMAF 84.9 vs CRF 28.5 would do the
  same). Leave x264 defaults.
- **Audio.** The source track is dual-mono (side channel 45 dB below mid). AAC-LC 48k mono measures 43 kbps,
  32k mono 29 kbps, against 83 kbps for today's 96k stereo. Speech at 48k mono is transparent for this use
  (*inferred*; no objective metric was run). HE-AAC is unavailable on the Linux boxes (no libfdk_aac).

Eyeball check (`eye_*.png`, same crop at 1280x720): 480p CRF 29 at 335 kbps is indistinguishable from the 706 kbps
baseline; 720p CRF 31 is crisp; 360p CRF 27 fully readable; 240p CRF 27 readable with soft strokes.

## 3. Recommended recorded (VOD) ladder

x264 numbers. NVENC at the same CQ is less efficient, so expect 10 to 20% more bits on the GPU box (*inferred*);
re-run `sweep.py`'s winning points there before shipping. Per-variant audio is possible because each HLS variant
muxes its own audio stream.

| rung | crf | preset | maxrate / bufsize | audio | expected video (W1 / W2) | expected delivered incl. 7% TS | today |
|---|---|---|---|---|---|---|---|
| 720p | 29 | slow | 1000k / 2000k | 64k mono | 621 / 522 | ~730 / ~630 | ~1,390 |
| 480p | 28 | slow | 650k / 1300k | 48k mono | ~375 / ~305 | ~450 / ~375 | ~860 |
| 360p | 27 | slow | 400k / 800k | 48k mono | 268 / 216 | ~335 / ~280 | ~540 |
| 240p | 27 | slow | 250k / 500k | 32k mono | 150 / 122 | ~195 / ~165 | ~340 |

GOP: `-g 120 -keyint_min 120 -sc_threshold 0 -force_key_frames expr:gte(t,n_forced*4) -flags +cgop`, `-profile:v high`,
`hls_time 4`, `independent_segments`. The 240p rung lands on Apple's ≤192 kbps cellular requirement, so no 144p tier
is needed. CRF 29 rather than 31 at 720p and 28 rather than 29 at 480p is deliberate: the sweep's cheapest gate
passer sat at the sweep's edge, VMAF under-weights thin-text softening, and the 10% kept buys margin for
webcam-heavy classes. Tag `BANDWIDTH` = maxrate + audio and `AVERAGE-BANDWIDTH` = measured, per the Apple spec,
so ABR picks honestly.

Against peers (measured 2026-10-08, 480p delivered): Vidyagram 0.47 Mbps, ParikshaPro 0.43 to 0.56, Quicktricks
0.42 to 0.56. The proposed 480p lands at ~0.40 to 0.45 Mbps on the hardest minute and ~0.38 on a typical one, so it
matches or beats every sampled peer at the same resolution. YouTube's served ladder could not be sampled: yt-dlp was
rate-limited and the browser hit Google's bot-check page from this IP. The capture scripts are in
`encode-sweep-2026-10-13/competitor-tools/` for a rerun from another network.

## 4. Live ladder

Do not re-derive: the livestream branch `live-encoder-bandwidth` already ran this experiment on a webcam-heavy live
class and froze CRF 25/25/25/24 with B-frames, High profile, closed 4 s GOP, no zerolatency (savings 6 / 9 / 21 /
33% per rung, VMAF at or above current on both worst-case windows). Ship that ADR. Two additions from this sweep:
audio to 48k mono on 480p and below (today 96k on every rung, 22% of the 240p rung), and the phase 0 note that
480p CRF 26 (−18%) is the next tightening candidate after a soak. CPU on the box was the open item there.

## 5. CDN actions, ranked (full detail with URLs in `cdn-actions-cloudflare-2026-10-13.md`)

| # | action | effect | plan / cost |
|---|---|---|---|
| 1 | Live-zone cache rule: live `.m3u8` edge TTL respect-origin (R2 sends `max-age=2`), finished `-vod.m3u8` 1 y override, 404 TTL ≤1 s on the live host | Playlist fetches 285–520 ms → ~60 ms; 2,000 viewers become ~1 origin fetch per 2 s per PoP; replay start −0.3 to −0.45 s | any plan, $0, 15 min |
| 2 | Smart Tiered Cache on | Indian PoPs fill from one upper tier near the bucket; fewer 190–520 ms R2 misses | any plan, $0, 1 click |
| 3 | HTTP/3 + 0-RTT on (both off today, confirmed by missing `alt-svc`) | Loss recovery and setup on lossy 4G; Cloudflare's own data is modest (TTFB 176 vs 201 ms, no throughput gain), YouTube's India data is the upper bound | any plan, $0, 2 clicks |
| 4 | Compression rule for `application/vnd.apple.mpegurl` and `application/x-mpegURL` only | Playlists are not in Cloudflare's default compressed types; long-class VOD playlists are tens of KB | $0, 10 min |
| 5 | Before CMCD/telemetry query params ship: ignore query string in the cache key, or send CMCD as headers | Prevents every request becoming a MISS | $0 |
| 6 | Prewarm tomorrow's scheduled classes' first segments through the zone | Warms the upper tier (and the PoP the fetch runs in) | Workers Paid $5/mo or a curl from an Indian box |
| 7 | Keep the WAF HMAC rule; do not move auth into a Worker | A Worker adds a hop on every HIT and costs ~$95/mo at 3 live h/day for no startup gain | — |
| 8 | Skip Cache Reserve (does not apply to R2-backed hosts), Prefetch URLs (Enterprise, HLS types excluded), Argo (origin already on Cloudflare's network, gain unverified) | — | — |
| 9 | DNS-block fallback stays Bunny on a non-Cloudflare hostname. A Partial/CNAME setup needs Business and serves the same IPs; so does Cloudflare for SaaS | Only Bunny survives an IP-level block | — |

Measurement caveat: per-PoP cache logs (Logpush) are Enterprise only. On Pro, carry `cf-ray` and `cf-cache-status`
from the player into the playback telemetry endpoint instead.

## 6. Open before shipping the ladder

- Why production recorded segments measure 12.5 s when the 1A code writes 3 s (deployed image vs repo, or
  APX-era packaging). A 12.5 s, ~1 MB first segment is a slow start on 3G regardless of bitrate.
- Validate the four winning points on the GPU box with NVENC (`-rc vbr -cq <crf> -maxrate ...`), same windows,
  same VMAF script; NVENC `-cq` does not map 1:1 to x264 CRF.
- Eyeball a webcam-PiP class at the proposed 480p setting; the phase 0 result says such classes compress worse.
