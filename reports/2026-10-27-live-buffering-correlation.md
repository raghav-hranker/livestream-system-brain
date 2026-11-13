# Live buffering correlation — quicktricks, 2026-10-27 evening

Tenant quicktricks (472). Read-only investigation; nothing changed on Cloudflare, the encoder, the socket box or any deploy.

## Answer

The "buffering" bursts at 18:00, 18:03–18:07 and 18:09–18:12 IST line up minute for minute with **encoder → R2
segment uploads that hung for 20–124 s**. While a segment upload hangs, `backend/lib/watchers.js` (`waitForReferencedSegments`,
2 s cap at line 289, encoder still on `bfc1512`) publishes the playlist anyway. That playlist lists a segment R2
doesn't have yet, so every viewer on that rung gets a **404 at the Cloudflare edge** (hundreds per minute), runs out
of buffer and freezes. The cause is the one diagnosed on 10-20 ([[live-r2-upload-stalls-404]]), and its fix is still not deployed.

Ruled out for today: Cloudflare delivery (edge p99 < 1.4 s in every complaint minute, no 5xx), R2 reads (origin p99 < 1 s),
the teacher's uplink (arrival lag flat), the AWS scraper (idle after 16:41 IST), and 10-24's slow-fill pattern.

## Log proof: one segment, end to end (class A, rung 0, `segment_586`, 18:09–18:11 IST)

Encoder `~/.pm2/logs/quicktricks-livestream-out.log` (UTC; IST = +5:30), the segment file on disk, and Cloudflare per minute.

1. **ffmpeg finished the segment on time:** `segment_586.ts` was written at 12:39:04.8 (676,988 bytes). Neighbours were written every
   3.2–4.8 s as normal (585 at 12:39:00.0, 587 at 12:39:08.0).
2. **One upload call hung for 124 s:** the only log lines for that key are
   `12:41:09 [live-upload-timing] {"key":"472/6ae034d7…/0/segment_586.ts","bytes":676988,"ms":124324,…,"ok":true}` and
   `Upload completed`. Start = 12:41:09 − 124.3 s = 12:39:05, i.e. immediately. There was **no failed attempt**: today has 0
   `"ok":false` lines and 0 `Upload attempt N/3 failed` lines. So `uploadWithRetry` never retried; the whole 124 s was one call.
3. **Everything else uploaded normally at the same time:** during 12:39:06–12:41:08, 488 other uploads completed (median
   539 ms, p95 867 ms, 483 of them ≤ 2 s). On rung 0 itself, segments 587–617 each took 0.5–1.3 s, and the r0 playlist
   went up every ~4 s. Only 586 (and 594, 24 s) hung. So the R2 path was healthy; one request stalled.
4. **The playlist was published without it, every time:** from 12:39:08 to 12:39:56 the log shows
   `Waiting for 1 segment upload(s) before uploading playlist...` (2 when 594 also hung) before every playlist write. After 2 s each
   wait gave up (`watchers.js:289`), and `[live-upload-timing] … 0/playlist.m3u8` follows at 12:39:11, :15, :19 … The playlist
   keeps every segment (`hls_list_size 0`), so each of those playlists listed `segment_586.ts`.
5. **Viewers got 404s for exactly that file:** Cloudflare `.ts` requests for `6ae034d7…/0/segment_586` returned 404 to
   **673 requests at 18:09 and 333 at 18:10**, plus 23 at 18:11 IST. That is ≈ all of rung 0's segment 404s in those minutes (666 / 333 /
   23 for all `0/segment_5*`).
6. **Players stopped at that segment:** `segment_588` had **no requests at all until 18:11 IST**, after 586 landed (12:41:09 UTC =
   18:11:09 IST). Viewers sat retrying 586 for two minutes instead of moving on: the freeze. Chat: 3 complaints at 18:09, 13 at 18:10.

## Classes

| Class | Title / slot | Live (IST) | Audience (Cloudflare playlist req/min) |
|---|---|---|---|
| A `6ae034d7a72249344e5deb0d` | Day-11 Ratio & Proportion, NTPC 60 Days Revision | ~17:45 → after 18:30 | ~3,000 (≈225 watching on web) |
| B `6adea4893b633daddec7cbdf` | second class | 18:04 → after 18:30 | ~450 |
| C `6ae0338ea72249344e5b4149` | afternoon class | ~16:15 → 16:45 | ~500 |

## Timeline, 10-27 (IST)

Complaints = chat messages matching buff/ruk/atak… (`chat_buffering.cjs`). 404 = Cloudflare segment (`.ts`) 404s for
that class per minute (`cf_minute_probe.sh`, adaptive-sampled estimates). Stalled uploads = R2 PUTs in flight over 20 s
(start → end from `[live-upload-timing]`, end − ms = start; r = rung).

| Minute | A complaints | A seg 404 | B complaints | B seg 404 | Stalled uploads in flight |
|---|---|---|---|---|---|
| 17:50–17:51 | 0 | 0–3 | — | — | — |
| 17:52 | 0 | 59 | — | — | — |
| 17:53 | 0 | 72 | — | — | A r2 seg355 40.7 s (17:53:40–17:54:21); A r1/r3 playlists 40–60 s |
| 17:54 | 0 | 135 | — | — | A r3 seg362 32 s |
| 17:55–17:58 | 0 | 0–8 | — | — | — |
| 17:59 | 0 | **567** | — | — | A r2 seg434 40.5 s (17:58:57–17:59:37); A r0 seg446 55 s (17:59:45–18:00:40) |
| 18:00 | **3** | **349** | — | — | A r0 seg446 |
| 18:01 | 0 | 0 | — | — | — |
| 18:02 | 0 | **543** | — | — | A r1+r2 seg491 41 s (18:02:44–18:03:25) |
| 18:03 | **10** | **635** | — | — | A seg491; A r2 seg500 20 s |
| 18:04 | 1 | 355 | 0 | 36 | A r0 seg512 40 s; A r1 playlist 104 s (18:03:48–18:05:32) |
| 18:05 | 2 | 314 | 0 | 118 | A r0/r2 seg530 45 s; B r1 seg15 40 s; B r3 seg20 96 s (18:05:15–18:06:51) |
| 18:06 | 1 | 77 | 1 | 179 | B r3 seg28 62 s, r1 seg35 36 s; A r2 playlist 40 s |
| 18:07 | 1 | 0 | 2 | 2 | A r2 playlist 112 s (18:06:36–18:08:28) — playlist only |
| 18:08 | 0 | 0 | 0 | 7 | A r2 playlist (cont.) |
| 18:09 | 3 | **721** | 1 | 10 | **A r0 seg586 124 s (18:09:05–18:11:09)**; A r0 seg594 24 s; B r3 seg80 30 s |
| 18:10 | **13** | **353** | **5** | **189** | A seg586; B r1 seg91 82 s (18:09:58–18:11:20) |
| 18:11 | 1 | 27 | 4 | 28 | both end 18:11:09 / 18:11:20 |
| 18:12 | 0 | 3 | 1 | 0 | — |
| 18:13–18:20 | 0 | 0–8 | 0–1 | 0 | none |
| 18:21 | 2 | 371 | 0 | 156 | burst 12:51–12:55 UTC: 18 uploads > 20 s across both classes (20–75 s) |
| 18:22 | 4 | **1,232** | 2 | 38 | (same burst) |
| 18:23 | 1 | 151 | 0 | 195 | (same burst) |
| 18:24 | 0 | 149 | 0 | 34 | (same burst) |
| 18:25 | 2 | 1 | 0 | 0 | burst ends ~18:25 |
| 18:26–18:35 | 1 (18:33) | 0–18 | 0 | 0 | none over 20 s |

During all of 17:45–18:18, A's segment edge p95 was 399–451 ms, edge p99 656–1,355 ms and origin p99 572–1,032 ms. There were
no 5xx and no playlist 404s. 499s (players abandoning a download) rose with the 404 minutes: 48/54 at 17:59/18:00 and 36 at
18:04, against 0–6 at other times. B's edge p99 was 840–1,442 ms (one 3.3 s minute at 18:17, with no complaints).

## What moves with the complaints, and what doesn't

| Signal | Moves with complaints? | Evidence |
|---|---|---|
| R2 segment PUT stalls (encoder) | **Yes, both classes** | Every complaint burst starts during or within a minute of a ≥40 s segment stall on that class |
| Cloudflare segment 404s | **Yes** | 300–720/min in burst minutes, ~0 otherwise; B shows the same pattern at its own scale |
| Client aborts (499) | Weakly | Small rises in the 404 minutes |
| Cloudflare edge / origin latency | No | p99 < 1.4 s in every complaint minute (10-24's 7–14 s fills absent) |
| Playlist delivery | No | 0 playlist 404s; playlist p99 610–1,036 ms |
| Playlist-only upload stalls | No | A r2 playlist 112 s at 18:06–18:08 → 0 segment 404s, 1 complaint |
| Teacher uplink / encoder pace | No | A rung 3, segments 470–640: write-vs-PTS lag within ±0.26 s (`seg_arrival_lag.sh`) |
| AWS AS14618 scraper | No | Its last request today was at 16:41 IST; zero rows 17:45–18:30 |
| R2 state when probed | — | `live_r2_lag.cjs` at 18:17: every rung of A within 1 segment, age 2–3 s, nothing missing |

**Why rung matters:** a playlist-only stall leaves viewers on an older playlist, which still points at segments that exist,
so they keep playing for a while. A segment stall on r0 (the top rung most app viewers sit on) makes the next poll point at a
missing file. That is why 18:09–18:10 (r0 seg586, 124 s) was the worst burst.

## Earlier classes the same day (10-27)

All 10 classes on the encoder today, IST. Stalls are uploads over 5 s (start time, rung, duration). "404" = Cloudflare segment
404s for that class in the stall minute(s). Complaints are real ones, after dropping matcher false hits.

| Class (live) | Stalls | 404 | Complaints |
|---|---|---|---|
| `6adf5843` (08:00–09:17) | 2 segments, 5.7–6.7 s | — | none |
| `6adf7a9d` (08:03–09:08) | none | — | none |
| `6adf7abc` (09:18–10:42) | **r1 segment 40.6 s at 09:55:18**, r0 playlist 71 s | **1,149 at 09:55** | **20 at 09:55–09:57** (16 in 09:56: "buffering", "ruk gaya", "sar automatically video kyon ruk jaate hain") |
| `6ae01265` (11:08–12:42) | 9 playlists 5–17 s at 11:56, 2 segments 6 s at 12:03 | 6 | none |
| `6ae012a2` (12:14–13:13) | r3 segment 13.5 s at 12:47:15 | 22 at 12:47 | 4 at 12:47 (+2 "no buffering") |
| `6ae031df` (14:02–15:21) | none | — | none |
| `6ae0321a` (15:01–16:24) | **burst 15:49–15:52**: r0 segments 30–60 s ×4, playlists 33–60 s | **127–300/min, 15:49–15:52** | **none** in 429 messages |
| `6ae0338e` (16:16–16:50) | burst 16:32–16:45, up to 61 s | 143–306/min | none in 199 messages |

What this adds:
- **The morning repeats the evening:** `6adf7abc`'s one 40 s segment stall at 09:55 drew 1,149 404s and the day's sharpest chat burst.
- **Short stalls are absorbed:** stalls of about 5–7 s (`6adf5843`, `6ae01265` 12:03) produced no 404 burst and no complaints. Players sit about three segments (~12 s) behind live, so
  a stall has to outlast that before anyone runs dry. A 13.5 s stall on the lowest rung (`6ae012a2`) gave a small blip: 22 404s, a few comments.
- **Playlist-only stalls don't hurt:** `6ae01265` 11:56 had nine playlist stalls of up to 17 s, 6 404s, and no complaints.
- **404s don't always draw complaints:** `6ae0321a` (15:49–15:52) and `6ae0338e` (16:32–16:45) both had real 404 bursts but no
  buffering messages. Both had about half or less of the evening class's audience, and quieter chats. Complaints are a lower bound on impact, not a
  measure of it. Every complaint burst today, though, has a 404 burst under it.

## Comparison days

| Day / class | Worst upload | Segment 404s | Complaints |
|---|---|---|---|
| 10-27 C `6ae0338e` 16:30–16:45 | 61 s (stalls at 16:32–16:45) | 306 / 143 / 211 at 16:32 / 16:33 / 16:37 | 0 in 199 messages (audience ~1/6 of A; quieter chat) |
| 10-26 `6adea466` 17:01–18:30 (same slot, **control**) | 4.4 s | 115 in the whole hour, max 38/min | **1 in 592 messages** ("network", 17:07) |
| 10-26 `6ade1b64` morning | 33 s at 12:08 IST | **415 at 12:08** | **1 at 12:08** ("buffering"), the only one in 670 messages |
| 10-26 `6ade1ae0` morning | 30 s; many 5–30 s | bursts of 300–850/min (09:23, 09:42, 09:47, 10:04, 10:13) | 09:30 (2), **09:42–43 (5)**, 09:47 (1), 10:23 (1); none at 10:04 / 10:13 |
| 10-25 (both classes) | 3.1 s | — | — |

Complaint counts are after dropping false matches from `chat_buffering.cjs` (it also catches "change", "upload", "manage" and
"download"). The 10-26 chat backs the 10-27 finding. The same-slot control, with no stalls, had essentially no complaints.
The single 12:08 complaint in `6ade1b64` landed in the one minute of its 415 404s. `6ade1ae0`'s biggest complaint burst
(09:42–43) followed its 634-404 minute. Not every 404 burst draws a complaint (10:04 and 10:13), but no complaint burst
came without one. Dose-response holds: no stall means no 404 burst, and every stall over about 20 s produces a burst. The stalls are not tied to 18:00.
They happen at random times on some days (10-26 morning, 10-27 afternoon and evening) and not at all on others (10-25, 10-26
evening). The complaints cluster around 18:00 because that is when the big class is live.

## Why the uploads stall (open)

- Each stall is **one** `uploadFileToS3` call (`@aws-sdk/lib-storage` `Upload`, stream body). The outer `uploadWithRetry`
  never fired, because no attempt failed today. Durations still come in steps of about 20 s (20.1, 20.4, 40.3, 40.5, 59.2, 61.0, 81.7,
  96, 103.7, 111.9, 124.3 s), so something *inside* that one call waits ~20 s per step: SDK-internal retries, or the socket.
  Not proven; the uploader logs nothing per attempt. `backend/lib/fileUpload.js` on the encoder (`bfc1512`) builds the
  `NodeHttpHandler` with only `https.Agent({ family: 4, keepAlive: true })` and no `requestTimeout`/`connectionTimeout`, so
  nothing in our code cuts a slow call short.
- Stalls hit both classes and several rungs in the same seconds (18:05–18:06, 18:09–18:11), so the cause is shared (the
  uploader's socket pool or the encoder→R2 path), not one stream.
- **Socket capture, 18:45–19:17 IST (no stall caught).** `ss -tinp` streamed once a second over ssh, read-only, saved on the Mac,
  not the box. The pool held 8–13 connections, 29 in all, mostly to 172.64.66.1 and 172.64.190.1. There were **zero TCP
  retransmits**, and every PUT got its reply (337 B) within about 1 s, including one on a connection idle for 295 s. The pool keeps
  reusing connections idle up to ~400 s. Cloudflare logged no 404 burst in that window, so no stall happened while we were watching,
  and this capture can't yet tell "packets lost" from "R2 not answering". The ssh link dropped at 19:17. The VM then stopped
  at 23:00 IST on its schedule (`livestream-cpu-schedule`, runs 07:00–23:00 IST). Next chance: a capture across a
  big class, or log `$metadata.attempts` per upload.

## Not captured

- **Viewer count / join rate per minute:** not read (same box). Cloudflare playlist requests per minute stand in as the
  audience measure.
- `live_viewer_sim.sh` / `live_cdn_fill_probe.sh` / `seg_freeze_silence.sh`: skipped. By the time of the probe the complaint window had
  passed, and the per-minute Cloudflare data covers delivery in those minutes. The teacher's input was already clean by arrival lag.

## History: not new

Segment uploads over 20 s per day, from the whole encoder log (starts 2026-09-23):

| Day | Segments | Stuck > 20 s | Longest |
|---|---|---|---|
| 09-23 → 09-27 | 20–27 k/day | 0 | 3–15 s |
| **09-28** | 23,860 | **23** | 132 s |
| 09-30 | 27,100 | 1 | **400 s** |
| **10-05** | 27,080 | **14** | **708 s** |
| 10-14 | 25,488 | 2 | 398 s |
| 10-15 → 10-18 | 8–44 k/day (volume roughly doubles from 10-15) | 0 | 5–14 s |
| 10-19 | 35,548 | 15 | 56 s |
| **10-20** | 41,460 | **141** | 138 s |
| 10-21 | 42,232 | 11 | 43 s |
| 10-23 | 42,684 | 3 | 102 s |
| 10-24 / 10-26 | 45 k / 38 k | 1 / 3 | 21 s / 33 s |
| **10-27** | 37,301 | **50** | 124 s |
| other days | — | 0 | ≤ 11 s |

So it has come and gone since at least late September. Since 10-19 it shows up most days. Daily segment volume nearly doubled from
10-15 (more classes at the same time), so there are more uploads to get stuck; that's a correlation, not a proven cause. It was diagnosed on 10-20
([[live-r2-upload-stalls-404]]), and the fix was designed then but never deployed.

Outside us: R2 has had public incidents with intermittently failing uploads (e.g.
[Trigger.dev](https://status.trigger.dev/incident/532422), [fal.ai](https://status.fal.ai/en-us/cm8jbogwd006mngx4s1mqf7sv)).
No public report matches this exact 20-second pattern. The standard advice for intermittent object-store stalls is client
timeouts plus retries, and our uploader has neither.

**Timeout trap for the fix:** in `@smithy/node-http-handler` 4.x (4.9.10 is installed), `requestTimeout` only **logs a
warning** unless `throwOnRequestTimeout: true` is set. One report says values ≥ 6000 ms never fire
([smithy-typescript#1443](https://github.com/smithy-lang/smithy-typescript/issues/1443); another project moved to
`socketTimeout` after an upgrade, see the [@atproto/aws changelog](https://cdn.jsdelivr.net/npm/@atproto/aws@0.3.8/CHANGELOG.md)). Enforce the deadline
with our own `AbortController` per attempt, plus `socketTimeout` and `connectionTimeout`, and prove in a test that a stalled PUT is
actually cut off.

## Other encoder VMs (checked 10-27)

| VM (zone) | Tenant | Uploads to | Stuck uploads |
|---|---|---|---|
| `livestream-testing-raghav` (asia-south2-c) | quicktricks 472 | R2 account `1ff6f2…`, bucket `livestream-hranker-v2` | as above; **69** over 20 s on 10-27 by 19:15 IST |
| same VM, `livestream-topper` app | toppers 695 | — | no upload timing in its log; not measurable |
| `livestream-cpu-new` (asia-south2-b) | SelectionWay 561 | **R2 account `025b7c…`** (different account), bucket `livestream-selectionway` | yes: e.g. 09-24 121, 09-29 48 (one piece 244 behind), 10-20 17, 10-26 9, **10-27 51** |
| `livestream-cpu` (asia-south2-b) | SelectionWay 561 | same as above | yes, smaller: e.g. 09-22 8 (99 behind), 10-24 15, 10-26 7; 10-27 0 |
| `vidyagram-livestream` | Vidyagram 781 | — | VM stopped; not checked |
| `livestream-testing-raghav-clone` | ? | ? | not in `reference/hosts.md`; not touched |

SelectionWay's log has no timestamps or durations. "Stuck" there means a segment finished uploading **5 or more segments after a later
one on the same rung**, i.e. it was stuck for at least five segment lengths. Dates come from the class id's creation time, so they're approximate
(a class can be created before the day it runs). Both SelectionWay VMs run livestream `3e1123c` (2026-02-27) with the same deprecated
`@aws-sdk/node-http-handler` and no timeouts.

What it means: the stalls are **not one VM's problem**. They happen on three VMs in two Google zones, uploading to two
different R2 accounts. What these have in common is Google's Delhi region → Cloudflare R2, plus our same upload code with no time
limit. Bad days overlap sometimes (10-20, 10-27) but not always (SelectionWay's worst, 09-24, was clean for quicktricks). Without timestamps on
SelectionWay we can't match minutes. The fix applies to every encoder: they all share `fileUpload.js` / `watchers.js` lineage.

## What to check / do next

1. **Fix (decision for the user; livestream repo, needs an encoder deploy between classes):** apply the 10-20 plan. In
   `watchers.js`, never list a segment whose upload is still in flight (drop the 2 s cap; trim or wait). In `fileUpload.js`, set a
   request timeout of about 10 s with retry so a hung PUT is abandoned and retried quickly instead of hanging for 2 minutes.
2. Log per-attempt detail in the uploader (socket reuse, attempt count, error code) to find the ~20 s step.
3. Re-run `cf_minute_probe.sh <classId>` after any big-class complaint. Segment 404s per minute are a reliable "our fault" signal.
4. Player side (still worth it): a deeper live buffer rides out short stalls ([[buffering-free-playback-research]]).
