# Tier-2/3 playback: what is in your control, what to copy, optimal H.264 + CDN (2026-10-13)

Builds on `buffering-free-playback-research-2026-10-13.md` (stall equation + ranked fixes),
`encode-ladder-and-cdn-plan-2026-10-13.md` (93-encode sweep on a real smartboard class) and
`cdn-actions-cloudflare-2026-10-13.md` (probed Cloudflare checklist). This file adds: the control
split, platform case studies with primary sources, and the tier-2/3 product defaults. External claims
carry URLs; platform claims carry the earlier reports' measurements; the rest is marked *inferred*.

## 1. How much is in your control

A stall = segment download time > segment play time, buffer empty. Download time = TTFB + bytes/bandwidth.

| Layer | You control | You do not control | Your lever's size |
|---|---|---|---|
| Encode (bytes/sec) | Fully: ladder, CRF, audio, GOP | Source camera noise | Sweep: −50% bits at equal VMAF (VOD) |
| Player (buffer, ABR) | Fully: start rung, caps, retry | Device RAM/CPU, browser | thedhronas forced-720p start is yours to remove |
| CDN (TTFB) | Mostly: cache rules, HTTP/3, tiered cache | ISP peering, PoP health | Playlist 285–520 ms → ~60 ms HIT; HTTP/3 toggle |
| Last mile | Nothing | Jio/Airtel cell load, 1–8 Mbps effective 4G, jitter | Design target, not a fix: assume 400 kbps dips |
| Device | Nothing | ₹10k Android, 1–2 GB RAM, storage | Audio+slides floor; H.264 HW decode everywhere |

Honest split (*inferred* from the stall equation + Opensignal tier-2/3 4G data): on a good 4G link,
~80% of stalls today are yours (forced top start, no low rung, uncached live playlists, double mount).
On a congested cell at 300–500 kbps, no encode fixes physics — only the ≤192 kbps floor, audio-only
mode and offline downloads keep the class going. That is why YouTube built Offline/Go for India
instead of only tuning ABR.

India baseline sources: Opensignal India reports (4G download low-teens to ~20 Mbps, Video Experience
Fair/Good outside metros) https://www.opensignal.com/reports/2024/06/india-mobile-network-experience-report ;
TRAI MySpeed circle data https://www.trai.gov.in/ ; Ookla medians are 5G/urban-skewed, do not design to them.

## 2. Case studies you can copy (primary sources only)

### Netflix — per-title / per-shot encoding + data transparency
- Fixed ladder → per-title convex-hull ladder (2015), then per-shot Dynamic Optimizer (2018):
  simple content gets equal quality at far fewer bits (~20% average saving reported; static lectures
  are the extreme simple case). https://netflixtechblog.com/per-title-encode-optimization-7e99442b62a2
  https://netflixtechblog.com/dynamic-optimizer-a-perceptual-video-encoding-optimization-framework-e56f1f7f2f6b
- Your copy: capped-CRF per rung (done in the sweep — it *is* per-title without the hull machinery),
  VMAF + text-legibility gate. https://github.com/Netflix/vmaf
- Transparency gold standard: Low ≈0.3 GB/hr, Save Data ≈6 hrs/GB, published in help.
  https://help.netflix.com/en/node/87 — copy as MB/hr labels (§5).
- Smart Downloads: delete watched, download next, Wi-Fi only. https://help.netflix.com/en/node/122916
  — copy as download-next-class.

### YouTube — India-first product, QUIC transport
- YouTube Go (2016, field research in 15 Indian cities, 2G phones in Nagpur): preview before you pay,
  choose resolution *and see data cost* before play/save, offline-first. No effect numbers published —
  copy the patterns, not claimed %. https://youtube.googleblog.com/2016/09/youtube-go-youtube-reimagined-for-next.html
- Smart Offline (2016): schedule downloads into discounted night-data windows (Airtel/Telenor).
  https://googleindia.blogspot.com/2016/06/youtube-offline-just-got-smarter-make.html — copy as
  "Download tonight 12–5 am".
- QUIC: Google SIGCOMM'17 reports YouTube rebuffer gains from 0-RTT + no TCP head-of-line blocking on
  lossy paths; earlier synthesis measured ~20% fewer rebuffers in India (largest country gain).
  https://dl.acm.org/doi/10.1145/3098822.3098842 — copy = turn HTTP/3 on (yours is off, probed).
- Do NOT copy YouTube bitrates: officially published numbers are ingest (720p 5 Mbps) and live-ingest
  (2 s keyframes, CBR, 128k stereo AAC), not serving. https://support.google.com/youtube/answer/1722171
  https://support.google.com/youtube/answer/2853702

### Apple HLS spec — the normative floor (MUST/SHOULD)
https://developer.apple.com/documentation/http-live-streaming/hls-authoring-specification-for-apple-devices
- Cellular playlists MUST carry a variant with peak BANDWIDTH ≤192 kbps (§9.21); cellular default
  SHOULD be ~730 kbps at 432p (§1.32b); IDR every 2 s SHOULD (§1.13); segments SHOULD be 6 s;
  HE-AAC SHOULD NOT exceed 64 kbps (§2.4); honest BANDWIDTH (VOD peak within ~10–200% rules §1.26–30).
- Your status: floor today ~446 kbps live / ~325 kbps recorded — 2.3× the MUST. Proposed 240p rung
  (~195 kbps delivered incl. TS) closes it; below that, audio-only, not 144p (sweep: 144p VMAF 2–8, text gone).

### Google Build for Billions + Media3 — implementation kit
- "Over half of users will experience your app over 2G" → offline-first, queue requests, let users
  force lower bitrate on cellular. https://developer.android.com/docs/quality-guidelines/build-for-billions/connectivity
  https://developer.android.com/docs/quality-guidelines/build-for-billions/data-cost
- Media3 PreloadManager (ranked per-item preload), DownloadManager/DownloadIndex (resumable HLS
  downloads), DefaultTrackSelector caps. https://developer.android.com/media/media3/exoplayer/preloading-media/preloadmanager/concepts
  https://developer.android.com/media/media3/exoplayer/downloading-media
- Netflix BBA / buffer-based ABR cut rebuffers 10–20% vs throughput-only (cited in prior report) —
  hls.js equivalent: start low, climb slowly (0.7 up-factor), drop fast; never pin on error.

### Not found (primary) — do not cite
Hotstar/JioHotstar and JioCinema publish concurrency records (IPL scale via multi-CDN + edge caching),
not QoE/rebuffer data; Physics Wallah, Unacademy, BYJU'S publish no public low-bandwidth engineering
write-ups. Their in-app data-saver/download features should be benchmarked by installing the apps.
Mux/Bitmovin/AWS QVBR confirm the capped-quality direction (QVBR = managed capped-CRF):
https://www.mux.com/blog/per-title-encoding https://bitmovin.com/blog/per-title-encoding/
https://docs.aws.amazon.com/mediaconvert/latest/ug/what-is.html

## 3. Optimal H.264 config (stay on H.264 — HEVC decode/licensing on cheap Android is the compat risk)

From the 93-encode sweep on `Mains_4_1080P_HD_.mp4` (smartboard, densest + median minutes, VMAF vs 720p CRF10):

| Rung | Setting (VOD, x264) | Expected delivered | Today |
|---|---|---|---|
| 720p | CRF 29, preset slow, maxrate 1000k/buf 2000k, 64k mono | ~730/630 kbps | ~1,390 |
| 480p | CRF 28, slow, 650k/1300k, 48k mono | ~450/375 kbps | ~860 |
| 360p | CRF 27, slow, 400k/800k, 48k mono | ~335/280 kbps | ~540 |
| 240p | CRF 27, slow, 250k/500k, 32k mono | ~195/165 kbps | ~340 |

Rules that produced it:
- Capped CRF is the whole win: ABR baseline burns its full target on a static board; CRF 27–29 halves
  bits at equal VMAF and fixes the worst-frame slide-flip blocking (1st percentile within 2–3 of mean vs 10–17).
- GOP: `-g 120 -keyint_min 120 -sc_threshold 0 -force_key_frames expr:gte(t,n_forced*4) -flags +cgop`,
  High profile, `hls_time 4`, `independent_segments`. Live: ship the frozen `live-encoder-bandwidth`
  ADR (CRF 25/25/25/24 + B-frames, −6% to −33%) + 48k mono audio ≤480p; do not re-derive.
- Audio: source is dual-mono; 48k mono AAC-LC ≈43 kbps vs 83 kbps for today's 96k stereo. Speech-transparent (*inferred*).
- preset slow over medium saves 2.4–3.3% (VOD yes, live no); 24 fps saves only 4% — keep 30; aq-mode 3/psy tweaks are a wash.
- Tag BANDWIDTH = maxrate+audio, AVERAGE-BANDWIDTH = measured (Apple honesty rule — ABR decides from the tag).
- Peers sampled 2026-10-08 at 480p delivered: Vidyagram 0.47, ParikshaPro 0.43–0.56, Quicktricks 0.42–0.56 Mbps.
  Proposed 480p (~0.38–0.45) matches/beats all at equal resolution. YouTube serving ladder unsampled (bot-walled).
- Caveats: NVENC CQ ≠ x264 CRF (expect +10–20% bits, re-run winners on the GPU box); production recorded
  segments measure 12.5 s vs 3 s in code — fix/explain before ladder work; this checkout shows live as
  NVENC `p4` (`streamLifecycle.js:355`) while the earlier report measured prod as CPU x264 — verify on the box.

## 4. CDN actions (Cloudflare + R2, ranked; full detail in cdn-actions file)

| # | Action | Effect | Cost |
|---|---|---|---|
| 1 | Cache live `.m3u8` (respect-origin, R2 `max-age=2`) + `-vod.m3u8` 1 y + 404 TTL ≤1 s | Playlist 285–520 ms → ~60 ms; 2,000 viewers ≈1 origin fetch/2 s/PoP | $0, 15 min |
| 2 | Smart Tiered Cache on | Indian PoPs fill from one upper tier near R2; fewer 190–520 ms misses | $0, 1 click |
| 3 | HTTP/3 + 0-RTT on (probed off: no `alt-svc`) | Loss recovery on Jio/Airtel 4G; India is QUIC's biggest measured win | $0, 2 clicks |
| 4 | Compression rule for `application/vnd.apple.mpegurl` only | Long-class playlists (tens of KB) currently uncompressed | $0, 10 min |
| 5 | Ignore query string in cache key / CMCD as headers | Prevents telemetry params fragmenting cache into all-MISS | $0 |
| 6 | Prewarm tomorrow's classes' first segments (Indian box or Worker cron $5/mo) | First viewer gets HIT + warm upper tier | small |
| — | Skip: Cache Reserve (no-op on R2 custom domains), Prefetch URLs (Enterprise, excludes HLS), Argo (origin already on CF network), Worker-in-front-of-R2 (~$95/mo at 3 live h/day, adds a hop) | — | — |
| — | Fallback: Bunny on non-Cloudflare hostname, client switches on status-0/520–524 only (never 403/404). Only Bunny survives a Cloudflare IP block; Partial CNAME/SaaS still serve CF IPs | Backend honours `?cdn=bunny`; client never sends it today | medium |

Netflix Open Connect lesson at your scale = items 1+2+6: fill ahead, serve from inside/near the ISP,
steer only on failure. Multi-CDN steering buys availability, not a published India rebuffer % — do not
buy it for QoE. Measure via player telemetry (`cf-ray` PoP + `cf-cache-status`); Logpush is Enterprise-only.

## 5. Tier-2/3 product defaults (ship together, day 1)

- Data Saver ON by default on cellular: caps ABR at 360p, start-low (`startLevel: 0`, up-factor 0.7,
  drop fast, no pin-on-error), `capLevelToPlayerSize: true`, no autoplay/preview bytes on mobile data.
- Audio + slides mode: separate audio rendition (32–48k mono ≈22–45 MB/hr) + timed slide images;
  auto-suggest after 2 rebuffers. For live, keep audio alive when video dies — a hearable class beats a frozen 720p frame.
- MB/hr labels on every quality option ("360p · ~180 MB/hour · 95 MB for this class") + preview strip
  before Play/Download (YouTube Go) + in-app data meter (Netflix table method).
- Offline: whole-class resumable download (Media3 DownloadManager on Android), Wi-Fi/night-window
  scheduling ("Download tonight"), download-next-class + delete-watched (Netflix Smart Downloads),
  storage use shown. Web: audio/slides via Service Worker; full video Android-first.
- Resume everywhere: position every 5 s local+server; "Resume at 23:41" one tap; missed live → recording at same point.
- Prefetch only ranked + only on Wi-Fi/night: next class's first 60 s; never on prepaid mobile data without opt-in.
- Fix the known player bugs first (prior report): thedhronas forced-720p start + no fatal-error branch
  (black screen), socket-nudge double mount destroying the player on re-mint (key on class+CDN, not token path).
- Telemetry before tuning: rebuffer ratio, startup time, rung distribution, exits-before-start — per
  network type, ASN and city (Conviva set). Backend endpoint live since 2026-10-12; neither web player sends yet.

## 6. Sequence

0 telemetry → 1 CDN items 1–3 (dashboard, same day) → 2 double-mount + thedhronas ABR/fatal fixes →
3 VOD ladder (after 12.5 s segment mystery + NVENC validation) + live ADR → 4 Data Saver + MB/hr +
audio-slides → 5 offline/night downloads in apps → 6 Bunny client fallback. Not now: HEVC/AV1
(compat/decode), fMP4/CMAF (hard-coded `.ts` assumptions, unmeasured gain), LL-HLS (188 ms RTT makes
1 s parts marginal; nobody asked for lower latency), CDN switch (measured parity 55–140 ms).
