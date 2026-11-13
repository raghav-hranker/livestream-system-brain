# Client-side video playback telemetry — frontend implementation guide

Prepared 9 October 2026. Scope: browser HLS playback, starting with the student website.

## 1. Objective and integration point

Measure startup, interruptions during playback, failures, and segment delivery performance for actual viewers. Telemetry must observe the player without changing playback behavior.

The existing student player is `thedhronas/sharedComponents/others/hls-video-player/HlsVideoPlayer.tsx`. It already uses HLS.js and observes fragment loading, quality switches and video `waiting` events. Its spinner state is not a sufficient telemetry state machine. Check the installed HLS.js version/types when implementing; the package currently declares `^1.6.13`, which does not identify the exact resolved version.

Implement three small modules in the frontend repo:

- `playbackTelemetryTracker.ts`: session identity, state transitions, durations and summaries.
- `playbackTelemetryTransport.ts`: bounded queue, batching, acknowledgements and retries.
- `usePlaybackTelemetry.ts`: video/HLS listener registration and cleanup.

The owner of the class page must start the viewing attempt before requesting the playback URL. Starting inside the player after receiving `srcUrl` misses authorization delays and failures. Pass the tracker/session into the player when it mounts.

The backend contract is now fixed in section 7a. It is live and enabled on production since 2026-10-12.

## 2. Session identity and clocks

- One `sessionId` per logical viewing attempt, generated using `crypto.randomUUID()` or the project's supported equivalent.
- Use the authoritative class/customer identifiers from the page. Confirm the `roomId` to `classId` mapping rather than assuming they are interchangeable.
- A different class or a fresh viewing attempt creates a new session. Token refresh, CDN fallback and HLS reinitialization within an attempt retain the session.
- A rerender, tab hide/show or seek must not create a new session.
- Keep ownership outside the HLS initialization effect. Avoid phantom sessions and duplicate listeners in React Strict Mode. Initialization alone is not a playback request.
- Use `performance.now()` for durations and session-relative `elapsedMs`. Use `Date.now()` for `startedAtUnixMs` and optional wall-clock timestamps. Do not subtract timestamps from different clock domains.
- Give every emitted event a unique `eventId` and increasing session `sequence`. Preserve both across retries.

Session context:

```ts
type SessionContext = {
  schemaVersion: 1;
  sessionId: string;
  customerId: string;
  classId: string;
  startedAtUnixMs: number;
  playerVersion: string;       // application release/commit identifier
  playbackEngine: 'hlsjs' | 'native';
  hlsVersion?: string;
  playbackKind: 'live' | 'vod' | 'unknown';
  samplingRate: number;       // e.g. 0.05 for a 5% session pilot
};
```

Playback kind should be updated from the actual playlist when available. Feature-detect optional browser/device/network metadata; unknown must stay unknown. Do not request GPS or claim that the browser reliably exposes a city, ISP or network type.

## 3. Track playback with explicit states

Maintain `idle`, `starting`, `playing`, `buffering`, `paused`, `seeking`, `failed`, `ended`. Track document visibility separately. Every transition settles the elapsed time in the previous state.

| Input | Required behavior |
|---|---|
| Play intent / autoplay attempt | Emit `playback_requested` and enter `starting` before the mint/network work begins. Do not reset on repeated clicks. |
| First `playing` | Emit `playback_started` with `startupMs`; enter `playing`. This is playback-start time, not an exact first-painted-frame measurement. |
| `waiting` before first playback | Remain in startup; do not count a rebuffer. |
| `waiting` after playback | If playback is desired, `!video.paused`, `!video.seeking`, `!video.ended`, and no seek recovery is pending, enter `buffering` once. Emit `buffering_started`. |
| `playing` while buffering | Close the interval, emit `buffering_ended` with `endReason: 'resumed'`, then enter `playing`. |
| `pause` | Close any buffering interval with `endReason: 'paused'`; enter `paused`. Paused time is excluded. |
| `seeking` | Close any buffering interval with `endReason: 'seek'`; enter `seeking`. |
| `seeked` | Keep seek recovery pending until playback resumes. Do not count the post-seek wait as an ordinary rebuffer. If paused, remain paused. |
| `playing` after seek | Clear seek recovery and enter `playing`. Optionally emit a separate seek-recovery duration. |
| Native error / HLS error | Emit a sanitized error. Only enter `failed` when playback is actually abandoned/terminal; a recoverable engine error is not necessarily a failed viewing session. |
| Video ends / route leaves / class changes | Close open intervals, emit final summary and `session_ended`, then detach listeners. |

Use `playing`, not `canplay`, to end a buffering interval: being able to play is different from actually resuming. Duplicate `waiting` events must not start overlapping intervals. A network `stalled` event or an HLS buffer-stall warning may add diagnostic information but must not independently increment the buffering count.

Autoplay rejection must be classified separately. A policy-blocked attempt should emit `autoplay_blocked`, stop startup accounting, and wait for a fresh user play intent. Do not count the time until the user eventually clicks as network startup latency. Keep an attempt identifier if multiple startup attempts exist within one session.

For v1, make the main QoE totals **foreground only**. On hide, settle foreground timers and flush, retaining the logical player state. On show, inspect `paused`, `ended`, `seeking` and `readyState` to reconcile events missed while suspended. Resume accounting from that point; tag any stall observed on return as such. Never charge the entire background interval as visible buffering. Hiding the tab is not session end.

Summaries must include `playedMs`, `rebufferMs`, `rebufferCount`, `hasStarted`, current state, foreground/background status and `droppedTelemetryEvents`. Include the elapsed portion of an open interval in a snapshot without closing/recounting that interval.

```text
foreground buffering ratio = rebufferMs / (playedMs + rebufferMs)
```

Return `null` when the denominator is zero. Exclude startup, paused, seek recovery and background time. Playing time is wall-clock time in the playing state, not `currentTime` movement, which jumps on seeks and changes with playback speed. Session summaries are cumulative snapshots; the backend must use the latest sequence, not sum them.

## 4. Capture buffer and rendition context

At buffering start/end and in periodic summaries, capture current playback position, playback rate, `readyState`, buffer ahead, CDN hostname, quality mode and active rendition when available.

```ts
function bufferAheadSeconds(video: HTMLVideoElement): number {
  const t = video.currentTime;
  const ranges = video.buffered;
  for (let i = 0; i < ranges.length; i++) {
    if (ranges.start(i) <= t && t < ranges.end(i)) {
      return Math.max(0, ranges.end(i) - t);
    }
  }
  return 0;
}
```

Use the range containing the playhead, not the last range: buffered media can contain gaps. Low buffer strengthens the delivery diagnosis; it is not a mandatory filter for recording every `waiting` interruption.

Listen to `Hls.Events.LEVEL_SWITCHED` and record level, height and declared bitrate if available. Record whether quality selection is automatic or manual. In native playback, unavailable rendition details must be `null`, not guessed.

## 5. Record request delivery timings

Observe the existing HLS instance; do not install a new loader or alter request behavior for telemetry. Register listeners before loading the source so initial requests are captured.

For completed fragments, use `Hls.Events.FRAG_LOADED` and the installed version's `frag.stats` (or event stats where provided). For the standard full-fragment path:

```ts
const { start, first, end } = frag.stats.loading;
const requestToFirstByteMs = first - start;
const transferMs = end - first;
const loadMs = end - start;
const bytes = frag.stats.loaded;
const mediaDurationSec = frag.duration;
```

Only emit valid finite timestamps in order, positive media durations and sensible byte counts. Unavailable fields are `null`, not zero. Label this `timingSource: 'hls-loader'`: loader request-to-first-byte includes setup/waiting overhead and is not interchangeable with Resource Timing network TTFB. Retry semantics vary by loader/version; do not claim these fields isolate every individual retry attempt. Keep aborted/failed loads separate from completed-load distributions, and record failures via `Hls.Events.ERROR` and emergency-abort events where supported.

Also capture master/variant playlist timing through `MANIFEST_LOADED` and `LEVEL_LOADED` stats where available. Keep separate groups for manifests, video, audio and initialization fragments. Avoid double-counting low-latency HLS parts and their enclosing fragments; v1 can limit segment reporting to full fragments and mark part timings unsupported.

For every request record, keep a sanitized media identifier (e.g. sequence number plus rendition), hostname, duration, byte count, retry count where available, and timing source. Never include the full URL. A redirect's final host may be unknown; do not fabricate it.

Interpretation:

- `loadMs / (mediaDurationSec * 1000)` indicates download time relative to media duration at 1x playback; it does not prove a stall by itself.
- Existing buffer, playback rate, parallel audio/video loading and ABR influence whether slow delivery interrupts playback.
- High request-to-first-byte suggests investigating network distance, server/edge response and origin/cache behavior.
- Long transfer time suggests investigating throughput, congestion and rendition size. It cannot prove that the viewer's connection alone is responsible.

For v1, aggregate completed requests into 20-second windows, grouped by hostname, resource type and timing source. Include count, bytes, duration totals, max, and a fixed latency histogram. Suggested buckets in milliseconds: `0–50`, `50–100`, `100–250`, `250–500`, `500–1000`, `1000–2000`, `2000–5000`, `5000+`. Include the bucket definition/version; aggregated buckets support approximate percentiles. Never average per-window p95 values to calculate a global p95.

Keep a bounded ring of the last 10 detailed requests and a maximum of 5 details during a buffering interval. Attach these to the stall diagnostic, keyed by a request ID, to correlate delivery with the interruption. These samples are diagnostics, not an unbiased population for CDN percentiles. Emit the request-window aggregates as immutable events once; retries retain their IDs.



Use feature-detected `PerformanceObserver` resource entries to collect:

```text
network TTFB = responseStart - requestStart
transfer    = responseEnd - responseStart
DNS         = domainLookupEnd - domainLookupStart
connection  = connectEnd - connectStart
```

The CDN must return `Timing-Allow-Origin` for the website origin to expose restricted cross-origin values. This is distinct from normal CORS and Server Timing. Same-origin requests do not need this header. Do not interpret restricted zero-valued fields as instant network responses. Reused connections can legitimately have no new DNS/connection work. Correlate entries with locally observed requests and label ambiguous or missing matches; do not ingest unrelated page resources.

Cache HIT/MISS and edge location are optional. Read only provider headers that are exposed to the existing request path (cross-origin header access can require `Access-Control-Expose-Headers`). Do not infer CDN cache status from browser `transferSize`, and do not make duplicate segment requests just to inspect headers. TTFB measures the user's delivery path, not isolated processing time inside the CDN. Server Timing is not required for v1.

## 6. Error records

Record native `video.error.code`, or HLS `type`, `details`, `fatal`, numeric HTTP status when available, resource type, hostname and playback position. Separate mint failures, manifest failures, segment failures, decoding problems and autoplay policy blocks.

No HTTP status means the cause is unknown; browser telemetry alone cannot reliably distinguish DNS, TLS, connection failure and CORS. A 403 is not automatically an expired token. Preserve the existing recovery behavior and observe the eventual outcome.

Use allowlisted structured fields. HLS errors, response objects, console messages and stacks can contain signed URLs; never serialize them wholesale. Repeated identical recoverable errors may be aggregated by type/status/host with occurrence counts.

## 7. Proposed batch contract and transport

```json
{
  "schemaVersion": 1,
  "sessionId": "uuid",
  "customerId": "customer-id",
  "classId": "class-id",
  "startedAtUnixMs": 1791500000000,
  "playerVersion": "release-id",
  "playbackEngine": "hlsjs",
  "playbackKind": "vod",
  "samplingRate": 0.05,
  "events": [
    {
      "eventId": "uuid",
      "sequence": 1,
      "elapsedMs": 1250,
      "type": "playback_started",
      "data": { "attemptId": "uuid", "startupMs": 1250 }
    },
    {
      "eventId": "uuid",
      "sequence": 2,
      "elapsedMs": 20000,
      "type": "session_summary",
      "data": {
        "hasStarted": true,
        "playedMs": 18250,
        "rebufferMs": 500,
        "rebufferCount": 1,
        "state": "playing",
        "visibility": "visible",
        "droppedTelemetryEvents": 0
      }
    }
  ]
}
```

Proposed endpoint: `POST /api/playback-telemetry`. Agree on all-or-nothing validation and a response containing `acceptedEventIds`. Backend deduplication key: `(sessionId, eventId)`. Backend derives trusted viewer/tenant identity from authentication; client fields are context, not authorization.

### 7a. Backend contract (live on production since 2026-10-12)

Authentication is the student `Authorization: Bearer <Auth token>`. Admin and Streamer tokens get 403 in v1. `classId` is the Mongo Class `_id` (24 hex), not the website `roomId`. `customerId` must be `472`. A `sessionId` is bound to the first viewer and class that send it. Reusing it for another viewer or class is rejected.

Every string field is pattern-bounded (`[A-Za-z0-9_.:-]`, max 64; hostnames lowercase). A field holding a URL, path, query string or token fails validation. One bad field rejects the whole batch.

| `type` | `data` fields |
|---|---|
| `playback_requested` | `attemptId`, `trigger` (`user`/`autoplay`) |
| `playback_started` | `attemptId`, `startupMs` |
| `autoplay_blocked` | `attemptId` |
| `buffering_started` | `snapshot`, `hidden` |
| `buffering_ended` | `durationMs`, `endReason` (`resumed`/`paused`/`seek`/`ended`/`session_end`/`failed`), `snapshot`, `hidden`, `requestSamples` (max 5) |
| `seek_recovered` | `durationMs` |
| `quality_switched` | `level` {`index`,`height`,`bitrateBps`}, `qualityMode` (`auto`/`manual`) |
| `playback_error` | `stage` (`mint`/`manifest`/`segment`/`decode`/`media`/`autoplay`/`other`), `fatal`, `terminal`, `nativeCode`, `hlsType`, `hlsDetails`, `httpStatus`, `resourceType`, `host`, `positionSec`, `occurrences`, `recentRequests` (max 10) |
| `request_window` | `windowStartElapsedMs`, `windowMs` (≤120000), `histogramVersion: 1`, `groups` (max 16) of {`host`, `resourceType`, `timingSource`, `count`, `failedCount`, `bytes`, `loadMsTotal`, `loadMsMax`, `ttfbMsTotal`, `transferMsTotal`, `histogram` (8 counts, buckets as in section 5)} |
| `session_summary` | `hasStarted`, `playedMs`, `rebufferMs`, `rebufferCount`, `seekRecoveryMs`, `state`, `visibility`, `droppedTelemetryEvents` |
| `session_ended` | `reason` (`ended`/`navigated`/`class_changed`/`failed`/`unknown`) |

`snapshot` holds `positionSec`, `playbackRate`, `readyState`, `bufferAheadSec`, `cdnHost`, `qualityMode` and `level`, each nullable. A request sample holds `requestId`, `host`, `resourceType` (`manifest`/`variant`/`video`/`audio`/`init`/`other`), `mediaId`, `timingSource` (`hls-loader`/`resource-timing`), `outcome` (`completed`/`failed`/`aborted`), and nullable `loadMs`, `ttfbMs`, `transferMs`, `bytes`, `mediaDurationSec`, `retries`, `httpStatus`. Send `null` for an unknown metric, never `0`. Events also accept an optional `wallClockUnixMs`. `requestSamples` and `recentRequests` are required arrays, so send `[]` when there are none. The backend implementation doc is `docs/playback-telemetry.md` in quicktricks-backend.

| Status | `code` | Client action |
|---|---|---|
| 200 `{ "acceptedEventIds": [...] }` | | Remove only those IDs |
| 400 | `malformed_json`, `invalid_batch`, `unsupported_schema_version`, `unknown_class` | Drop the batch, count as dropped |
| 401 | | Normal app auth handling |
| 403 | `student_token_required`, `customer_mismatch`, `session_conflict` | Drop; for `session_conflict` start a new session |
| 404 | `telemetry_disabled` | Stop sending for this session |
| 413 | `body_too_large`, `too_many_events` | Split or trim, do not resend as-is |
| 429 | | Retry after `Retry-After` seconds |
| 503 | `storage_unavailable` | Retry the same IDs with backoff |

Error bodies look like `{ "state": 400, "msg": "...", "data": null, "code": "invalid_batch" }`. Validation errors list only field paths, never the submitted values.

Client rules:

1. Queue events in memory. Emit a cumulative summary and flush every 20 seconds while active; flush early at 20 queued events, on terminal failure or on session end.
2. Cap individual batches at 20 events and 32 KiB of UTF-8 JSON. Split by bytes as well as count. Trim diagnostic samples if necessary; reject oversized individual records locally and increment the drop count.
3. Keep at most 100 pending events / 128 KiB total, including in-flight data. At capacity drop oldest low-priority diagnostics first, retaining critical transitions and the latest summary as far as the cap permits. Report any loss.
4. Allow one normal request in flight. Send a snapshot of event IDs; new events remain in the queue. Remove only IDs acknowledged by the server. Never clear the entire queue after a response.
5. Retry network failures, 429 and transient 5xx with bounded exponential backoff and jitter. Respect `Retry-After`. Suggested maximum: 3 retries per batch. Do not retry invalid payloads indefinitely. Handle authentication through the normal application mechanism without an independent refresh loop.
6. On `visibilitychange` to hidden, settle timers and attempt a small flush. Use `fetch` with `keepalive: true` if custom Authorization headers are required. `sendBeacon` is an alternative with compatible cookie authentication; it cannot add custom headers or provide server acknowledgement.
7. Keep exit payloads small. Beacon/keepalive requests have browser quotas shared with other outstanding requests; 32 KiB is a conservative per-batch choice, not a delivery guarantee. An accepted beacon means queued by the browser, not stored by the server.
8. A best-effort hidden/pagehide flush may resend in-flight event IDs; backend deduplication makes this safe. Preserve IDs when delivery is uncertain. Normal in-flight rules still apply outside lifecycle flushes.
9. Use `pagehide` as a supplemental lifecycle signal, including back/forward-cache handling. Do not depend on `unload` or infer abandonment from every hidden tab. Periodic summaries are essential because a process kill may deliver no final event.
10. Do not persist telemetry or credentials in browser storage for v1. Expose bounded debug counters locally behind a development flag, using sanitized payloads only.

Native HLS must still record video events, session state and summaries. Mark segment metrics unavailable where the native engine does not expose them. Do not switch playback engines solely to obtain analytics.

## 8. Playback safety and rollout

- No change to ABR, startup rendition, buffer configuration, signing hooks, recovery or CDN selection.
- Do not block playback on API calls, authentication for telemetry or payload construction.
- Keep tracker state outside frequent React renders; use refs/a dedicated object and update on transitions.
- Clean up video/HLS listeners, intervals and performance observers on actual detach. Reattach to a new HLS instance without resetting the logical session.
- Sanitize hostname/media identifiers at collection time. Never send URL tokens, auth headers, raw error objects, email, phone or GPS. Auth headers may be used for delivery but must not appear in the analytics body or debug logs.
- Add a feature flag and sample once per session. Suggested pilot: 5% of viewing attempts. Record the sampling rate and keep it stable through the session. Evaluate telemetry volume and playback overhead before expanding.
- Report missing fields explicitly. Unsupported browser APIs or a telemetry endpoint outage must leave video playback functional.

## 9. Acceptance checks before handing over

| Scenario | Expected result |
|---|---|
| Normal playback | One startup result, no false rebuffer, consistent playing time. |
| Slow startup / mint failure | Startup includes pre-player work; failure before playback is captured. |
| Bandwidth throttling mid-playback | Interruption recorded once; duration ends on `playing`; nearby request context attached. |
| User pause for 30 seconds | Paused time adds no rebuffer time. |
| Seek into unbuffered media | Seek recovery is separate from rebuffering. |
| Pause/seek/exit during a stall | Existing interval closes with the correct reason and no fabricated recovery. |
| Repeated `waiting` and duplicate HLS warnings | One interval/count, no double reporting. |
| Autoplay denied then manual Play | Policy block separate; startup restarts at manual intent. |
| Hide/show tab; browser suspends it | Flush without ending session; hidden time excluded; state reconciled on return. |
| Refresh stamp / recreate HLS / switch CDN | Session retained; request hostname tracked; listeners not duplicated. |
| React Strict Mode and rerenders | No phantom viewing attempts or duplicate events. |
| Offline / endpoint 500 / 429 | Playback unaffected; bounded queue/retries; same event IDs on retry. |
| Response arrives while new events are queued | Only acknowledged events removed. |
| Native Safari path | Core metrics work; unavailable segment details reported as missing. |
| Restricted Resource Timing | No fake zero-latency measurements. |
| Navigate away during an in-flight batch | Best-effort flush, backend deduplication; no assumption of guaranteed delivery. |

Deliver the tracker/hook/transport, the agreed schema, sanitized example batches from normal playback and a real induced stall, and the results of these checks. Include focused automated coverage for state transitions, interval accounting, queue acknowledgements and retry/deduplication behavior. Verify actual media events in a browser under throttling and test telemetry enabled versus disabled for duplicate requests, memory growth and noticeable playback overhead.

## 10. Official references

- [HLS.js LoadStats](https://hlsjs.video-dev.org/api-docs/hls.js.loadstats) and [events](https://hlsjs.video-dev.org/api-docs/hls.js.events).
- [Browser waiting event](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/waiting_event), [playing event](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/playing_event) and [buffered ranges](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/buffered).
- [Resource Timing](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceResourceTiming).
- [sendBeacon and lifecycle delivery](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/sendBeacon) and [fetch keepalive](https://developer.mozilla.org/en-US/docs/Web/API/Request/keepalive).
- [Mux HLS.js monitoring](https://www.mux.com/docs/guides/monitor-hls-js), an example of an established player analytics integration.
