# H.264 ladder comparison for lecture content (2026-10-13)

## Status: the sampled half is blocked; only the documented half is filled in

**The sampled part (YouTube, 10 channels) has no data.** From this machine's IP, every YouTube player request got
`HTTP Error 429: Too Many Requests`, then `Sign in to confirm you're not a bot` (in `pw.err` and `mit.err`).
This happened with the default client, `default,web_safari` and `android_vr`. Vimeo also refused:
`Failed to fetch macos OAuth token: HTTP Error 401` (in `vimeo.err`). I made no further attempts, to stay inside the
request budget and avoid pushing the IP block further.

None of the numbers below were sampled. **No sampled number has been invented.** The sections that need sampled
data are empty templates. They fill in automatically once the capture runs (see "How to finish").

Requests used: about 25 in total (10 search pages, 4 YouTube watch attempts, 1 Twitch, 1 Vimeo, 3 curl, 6 web fetches).

### Chosen sample set (from `ytsearch5`, IDs captured; durations from the search listing)
| key | channel (as listed) | video id | duration s | note |
|---|---|---|---|---|
| pw | Physics Wallah - Alakh Pandey | eQhOAHMankc | 6677 | Kinematics 01, NEET crash course |
| unacademy | Unacademy IAS: English | 7Gi1N0tCUgQ | 5119 | Geography NCERT for UPSC |
| adda247 | Adda247 Banking Exams | rnKf1ZWgqV8 | 5426 | Reasoning demo class |
| testbook | SSC Testbook | GCwyy3fQTms | 3090 | Static GK |
| vedantu | Vedantu Maharashtra 9 & 10 | ab1S8q1iYvI | 2606 | Heredity and Evolution L1 |
| byjus | BYJU'S IAS | QaByisLKQY0 | 2360 | the main BYJU'S channel had only <5-min results |
| khan | Khan Academy | _-vZ_g7K6P0 | 1685 | "DNA", **28 min, below the 30-min bar**; no Khan result in the top 5 was longer |
| nptel | nptelhrd | TcmGYe39XG0 | 3656 | Intro to Quantum Physics |
| mit_ocw | MIT OpenCourseWare | WRibE2nt8wM | 3436 | Individual Decision-Making L1 |
| rakesh_yadav_maths | Rakesh Yadav | 3nGE-MTivr0 | 3411 | Hindi SSC maths, Percentage #1 (whiteboard) |

Caveat for when the data arrives: YouTube re-encodes every upload itself. Its rungs show what **YouTube's encoder**
treats as acceptable for this content (it uses per-title / content-adaptive rates), not what PW, Unacademy and the
others encode on their own apps.

## 1. Per-platform rung tables

### Sampled: YouTube (10 channels) — NOT CAPTURED (blocked)
`tools/tables.py` writes these tables from the `<key>.json` files, with columns
h | w | fps | vcodec (avc1.4D401E etc.) | format id | protocol | tbr | vbr | filesize/approx | bpp.

### Documented: Apple HLS Authoring Specification (H.264 table) — source captured in `docs/apple.json`
URL: https://developer.apple.com/documentation/http-live-streaming/hls-authoring-specification-for-apple-devices

| 16:9 resolution | H.264 avg kbps | frame rate (spec) | bpp (fps assumed 30*) |
|---|---|---|---|
| 416x234 | 145 | ≤30 | 0.0497 |
| 640x360 | 365 | ≤30 | 0.0528 |
| 768x432 | 730 | ≤30 | 0.0733 |
| 768x432 | 1100 | ≤30 | 0.1105 |
| 960x540 | 2000 | same as source | 0.1286* |
| 1280x720 | 3000 | same as source | 0.1085* |
| 1280x720 | 4500 | same as source | 0.1628* |
| 1920x1080 | 6000 | same as source | 0.0965* |
| 1920x1080 | 7800 | same as source | 0.1254* |

\* Rows marked "same as source" use an assumed 30 fps. The spec also says (§1.32) the default variant SHOULD be
the 2000 kbit/s one.

### Documented: YouTube recommended **upload** bitrates (this is the upload target, not what YouTube serves)
URL: https://support.google.com/youtube/answer/1722171

| res | SDR 24–30 fps | SDR 48–60 fps | bpp at 30 fps (dims assumed 16:9†) |
|---|---|---|---|
| 360p | 1 Mbps | 1.5 Mbps | 0.1447 (640x360) |
| 480p | 2.5 Mbps | 4 Mbps | 0.2033 (854x480) |
| 720p | 5 Mbps | 7.5 Mbps | 0.1808 |
| 1080p | 8 Mbps | 12 Mbps | 0.1286 |

† The page names only the rung; the pixel dimensions are my assumption.

### Documented: Vimeo compression guidelines (upload guidance; Vimeo's served ladder was NOT captured)
URL: https://help.vimeo.com/hc/en-us/articles/12426043233169-Video-and-audio-compression-guidelines
SD 2–5 Mbps · 720p 5–10 Mbps · 1080p 10–20 Mbps. Audio: AAC-LC, 320 kb/s CBR, 48 kHz. Vimeo states it converts
everything to progressive and resamples audio to 48 kHz. These are upload targets too. Sampling Vimeo's observed
ladder failed with a 401.

### Documented (partial): Netflix fixed ladder (pre-2015), from the per-title blog
URL: https://netflixtechblog.com/per-title-encode-optimization-7e99442b62a2. It returned 403 to both curl and the
fetch tool, and the archive.org fetch looped on redirects. The rows below come only from secondary coverage:
- https://www.redsharknews.com/technology/item/3118-netflix-lowers-resolution-to-improve-quality: 320x240 = 235 kbps, 480p (SD) = 1750 kbps, 1080p top = 5800 kbps
- https://streaminglearningcenter.com/articles/how-netflix-pioneered-per-title-video-encoding-optimization.html: the table exists only as an image (not captured); 5800 top rung confirmed
- search summary of the same coverage: 1920x1080 at 4300 kbps mentioned as a fixed-ladder rung

| res | kbps | bpp (24 fps assumed) |
|---|---|---|
| 320x240 | 235 | 0.1275 |
| 480p (SD; width not stated) | 1750 | — |
| 1920x1080 | 4300 | 0.0864 |
| 1920x1080 | 5800 | 0.1165 |

The intermediate rungs (about 375–3000 kbps) were **not captured**. Fill them from the original post's table.

### Documented: Twitch transcode ladder — NOT CAPTURED
help.twitch.tv renders client-side only, and the fetch got an error page. No official table turned up in search,
only forum anecdotes (720p60 about 3000, 720p about 2000), which **I have left out as unverified**. A live
sample failed because `twitch.tv/monstercat` was not live.

## 2. Cross-platform summary (240p / 360p / 480p / 720p)

| rung | sampled YouTube min / median kbps | sampled bpp min / median | Apple HLS (doc) | YouTube upload rec (doc) |
|---|---|---|---|---|
| 240p | not captured | not captured | 145 @416x234 (0.050) | — |
| 360p | not captured | not captured | 365 (0.053) | 1000 (0.145) |
| 480p | not captured | not captured | 730 / 1100 @432p (0.073 / 0.110) | 2500 (0.203) |
| 720p | not captured | not captured | 3000 / 4500 (0.109 / 0.163*) | 5000 (0.181) |

## 3. Audio bitrates
- Sampled: not captured.
- Apple spec: stereo AAC "32 to 160" kbit/s; SHOULD NOT use HE-AAC above 64 kbit/s (§2.4).
- YouTube upload rec: mono 128, stereo 384, 5.1 512 kbps (upload).
- Vimeo upload rec: AAC-LC 320 kb/s CBR, 48 kHz.

## 4. Segment duration and container
- Sampled 360p/480p HLS media playlists: not captured.
- Apple spec: target duration SHOULD be 6 s (§7.5), segments nominally 6 s (§7.6), never more than 0.5 s over
  target (§7.7), and each segment starts with an IDR (§7.4).

## 5. Raw JSON
No `<key>.json` was saved because every capture returned 0 bytes; empty files were removed. The error logs are kept
(`pw.err`, `mit.err`, `vimeo.err`, `twitch.err`), and the Apple spec source is in `docs/apple.json`.

## How to finish
1. Wait for the 429 block to clear (hours), or give yt-dlp a cookies file (`--cookies <file>`). The cookies are
   the user's decision. I did not read browser cookies.
2. `sh tools/sample.sh` (or `sh tools/sample.sh --cookies cookies.txt`). This makes 10 `-j` captures 20 s apart plus
   at most 20 playlist-text curls, with no media downloads.
3. `python3 -I tools/tables.py *.json` prints sections 1–4 (per-video rung tables, summary with min/median kbps
   and bpp, audio, TARGETDURATION/EXTINF/segment count/TS vs fMP4). Paste the output over the "not captured" cells.
