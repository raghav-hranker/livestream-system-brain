# Security preflight — quicktricks v2 (livestream box)

**Date:** 2026-07-27 · **Trigger:** "are the websockets secure? they have no JWT/auth guarding" —
asked while the remaining launch tail was Redis flip + acceptance.
**Scope audited:** `repos/livestream/backend` @ `launch/quicktricks-v2` (`a04747e`), its live deployment
on `livestream-testing-raghav` (`34.131.52.223`), plus the `ls` socket client and the token wiring
in `admin-dashboard` / `nodejs-server`.

The answer to the question asked is **no** — but the websocket gap is not the worst thing here.
The origin box serves the protected video **unauthenticated over cleartext HTTP to the open internet**,
which defeats the entire premise of the signed-playback work this launch is built on, and the RTMP
ingest accepts anyone's video for any class and passes the stream name into a shell.

Everything below is verified against code at HEAD and, where marked **[live]**, against the running
production box. Nothing was mutated during the audit.

---

## Exposure baseline (measured, not assumed)

GCP firewall rule `selecitonway` has **no target tags**, so it applies to *every* instance in the
network, and opens `0.0.0.0/0` to `tcp:1935,8937,80,8080,8081,8082,5912,5913,5915,5900,3000,8000,
8001,8002,15672,6379,5672,443`.

Reachability probed from the laptop **[live]**:

| Port | Host | Result |
|---|---|---|
| 8082 (HTTP + socket.io) | 34.131.52.223 | **OPEN to the internet** |
| 8937 (RTMP ingest) | 34.131.52.223 | **OPEN to the internet** |
| 6379 (Redis) | 34.131.52.223 | closed — daemon is localhost-bound |
| 15672 / 5672 | 34.131.52.223 | closed |
| 5100 (LMS) / 6379 | 34.126.210.209 (phonetics) | closed |

Redis being closed is luck, not policy: the firewall permits `6379` from anywhere on every box, so a
single `bind 0.0.0.0` (or a new box that ships with the default config) puts the stream state, chat,
sessions and blocked-stream ledger on the open internet. Narrow the rule regardless.

---

## S0-1 — Live HLS is served unauthenticated from the origin box **[live, verified]**

`backend/app.js:36` mounts `express.static(config.videoSaveBasePath)` at `config.localStreamRoute`
(`/live`, `config/config.js:9,25`) — the on-disk root `/home/ubuntu/shared/livestream-files`, shared by
**all** clientIds. No auth, no referer check, no token.

Verified from a laptop with no credentials, against the real test class:

```
GET http://34.131.52.223:8082/live/472/6a6738d2b604444bc220fe81/0/playlist.m3u8  → 200  (#EXTM3U …)
GET http://34.131.52.223:8082/live/472/6a6738d2b604444bc220fe81/0/segment_0.ts   → 200  (380,888 bytes)
```

The path is fully guessable — `clientId` and `classId` are exactly the two values that already appear
in the `ls` viewer URL, in `joinRoom` payloads, and in the OBS ingest URL. So:

- Every **live** class is watchable by anyone who has (or guesses) a classId, with no LMS entitlement,
  no Streamer/Auth token, no Bunny signature, and in **cleartext**.
- Recorded output stays on disk after the class ends, so it remains fetchable until the box's retention
  removes it.
- `nodejs-server`'s `/playback` mint, the Bunny security key, the recorded-zone token auth, the whole
  content-protection slice — all correct, and all bypassed here at the origin.

**Fix (small):** the static route is only needed in the parked disk-serving fallback
(`liveUploadEnabled === false`, ADR 0001). In upload mode the player never reads it. Gate the mount on
`!config.liveUploadEnabled`, and bind 8082 to `127.0.0.1` behind a proxy. Either alone closes it; do both.

---

## S0-2 — RTMP ingest has no authentication, and the stream name reaches a shell

`rtmpserver-2.js:92-106` configures node-media-server with `publish: { allow: ["*"] }`. That key is
**inert** — NMS reads `config.auth.publish` (`node_modules/node-media-server/src/node_rtmp_session.js:1123`),
and there is no `auth` block at all, so the signed-`sign` check never runs. There is no stream key
anywhere in the repo (`grep streamKey|stream_key` → 0 hits).

The ingest credential *is* the pair already published in URLs:
`rtmp://34.131.52.223:8937/<clientId>` + stream key `<classId>`.

`prePublish` (`rtmpserver-2.js:109-278`) checks only two things, both about *ending*, neither about identity:
`isStreamBlocked` and `checkIfStreamEnded`. A class that is not `ended`/`processing` — and a class that
doesn't exist at all — is **permitted**.

Consequences, in order of severity:

1. **Command injection → RCE.** `StreamPath` is attacker-controlled and is interpolated into a shell
   string, not an argv array:
   - `lib/streamLifecycle.js:306` builds `ffmpeg … -i "${config.rtmpUrl}${StreamPath}" … "${config.videoSaveBasePath}${StreamPath}/%v/playlist.m3u8"`, run with `exec()` at `lib/streamLifecycle.js:350`.
     A stream key containing `"` plus `` ` ``/`$( )`/`;` breaks out.
   - `lib/StreamMonitor.js:46` is worse — `exec(\`ffprobe … ${rtmpUrl}\`)` with **no quotes at all**, on a
     30s interval for every registered stream.
   The box holds the B2/Bunny live credentials, the GPU Redis credentials and a Mongo admin URI, so
   this is a full-system compromise, reachable with no credentials from the open internet.
2. **Stream hijack.** An outsider publishing to a not-yet-live class becomes that class: ffmpeg starts,
   `updateStreamStatus` reports `preparing`/`live` to the LMS, `streamUpdate` tells every viewer the class
   is live, and the attacker's video is recorded and transcoded as the class VOD. It also locks the real
   teacher out ("Already has a stream").
3. **Arbitrary file write** via `..` in the stream key — independent of the shell issue, through
   `-hls_segment_filename` and the `videoSaveBasePath${StreamPath}` output path.
4. **One-packet DoS.** `rtmpserver-2.js:118,129` are not wrapped in try/catch; `classClient.getClass`
   does `Class.findById(classId)`, which throws a Mongoose `CastError` for any non-ObjectId classId →
   unhandled rejection → process exit on Node ≥15. `rtmp://host:8937/x/y` kills the server and every
   live class on it.

**Fix:** validate `StreamPath` against `/^\/[A-Za-z0-9_-]+\/[a-f0-9]{24}$/` as the first line of
`prePublish`; require a per-class ingest token (or NMS `auth.publish` + secret); reject unknown classes;
convert both `exec()` sites to argv `spawn`; try/catch the two `prePublish` awaits.

---

## S0-3 — Live credentials committed to the repo

- `routes/stream.js:13-20` — a real AWS IAM access key + secret, hardcoded. The Lambda call that used it
  is commented out (`routes/stream.js:90`), but the client is constructed at module load and the key is
  in git history.
- `config/config.js:22` — `mongodb://admin:<password>@148.113.8.241:27017,…/livestream?…` as the `DB_URI`
  fallback, i.e. a replica-set admin credential in the repo.

**Fix:** rotate both, then remove from the working tree. History purge is a separate decision (the repo
has other consumers), but rotation is not optional and should happen before any further deploy.

---

## S1-1 — Websockets: the question as asked

**There is no authentication at the door.** No `io.use()` middleware exists anywhere. Every connection is
accepted; `verifyUserAndAddRole` (`db/utils.js:315-336`) runs *inside* the `connection` handler, reads
`socket.handshake.auth.token`, and on a missing token, an expired token, a wrong signature or any other
error, **falls through to `socket.role = 'user'`** and lets the socket stay. There is no metric, no client
error, no disconnect — a total auth failure is indistinguishable from a normal student.

The secret wiring does work today, though only by hand: **[live]** `JWT_SECRET_KEY` on the box and
`STREAMER_JWT_SECRET` on the LMS hash identically (`sha256 d2489d48…`), so a `role:'teacher'` Streamer
token really does yield `role='host'`. Note `JWT_SECRET_KEY` appears in exactly one line of source in all
five repos and is **not** in `validateBootConfig` — if it drifts or is unset on a new deployment, the
service boots happily and silently demotes every teacher to viewer.

### Per-event authorization matrix (what a *tokenless* socket can do today)

| Event | Guard present | What an anonymous socket achieves |
|---|---|---|
| `endStream` (`rtmpserver-2.js:950`) | **none** | Ends anyone's live class: blocks RTMP reconnects, kills ffmpeg, finalizes the VOD, writes `ended` to the LMS. Needs only `{classId, clientId}`. Task 16's guard only suppresses a *second* stop. |
| `stopRecording` (`:930`) | **none** | Same blocking/kill path. |
| `binarystream` (`:887`) | **none** | Spawns an ffmpeg process per `clientId/classId` pair and pipes attacker bytes into it — content injection plus an unbounded process/CPU sink. |
| `banUser` (`:820`) | **none** | Persists a `Ban` for any userId in any room. |
| `deleteMessage` (`:686`), `pinMessage` (`:837`), `unpinMessage` (`:870`) | **none** | Full chat moderation over any room. |
| `privateMessageHistory` (`:763`) | **none** | Reads **any user's** private messages — `userId` and `classId` are taken straight from the payload with no ownership check. |
| `messageHistory` (`:731`) | role-gated for the private half only | Full public chat history of any class. |
| `getMediaMessages` (`:778`) | **none** | Media list (PDF/image URLs) of any class. |
| `userMsg` (`:519`) | private-mode only | Posts to any room as any `userId`/`userName` in the payload — impersonation, including impersonating the teacher. |
| `privateMsg` (`:637`) | **none** | Sends DMs as anyone, to anyone. |
| `voteSubmit` (`:1030`) | dedupe by payload `userId` | Ballot stuffing — just vary `userId`. |
| `joinRoom` (`:408`) | **none** | See below. |
| `privateMode` (`:618`) | `role==='host' && socket.userId===roomId` | The only properly guarded event. |

### The roster capture (no token required)

`joinRoom` registers the socket under the **client-supplied** `userId`
(`rtmpserver-2.js:436` → `UserSessions.addSocket(userIdStr, socket.id)`), and the host fan-out targets
sockets registered under `userId === classId` (`:474-479`, and again in `handleUserLeave` `:1162-1168`).
So an anonymous client that joins with `userId = <classId>` is added to the host's socket set and receives
every subsequent `userListUpdate` — the full viewer roster. `RoomStats.addViewer`
(`src/utils/RoomStats.js:17-25`) persists `userName`, `phoneNumber`, `phone_number`, `mobile`, `email`, and
`joinRoom` serializes name + phone + email back out (`rtmpserver-2.js:462-470`). Today `ls` only sends
`userId`/`userName`, so what actually leaks now is the roster of ids and names; the PII fields are wired
end-to-end and leak the moment any client (or the planned student surface) populates them.

`joinRoom` also **overwrites** the token-verified `socket.userId` with the payload value (`:429`); the
convention violation is only `console.error`-ed (`:431-433`). The role-based gates still hold because
`socket.role` stays token-derived, but every identity-based behaviour downstream (rosters, DM routing,
vote dedupe, attribution) is built on a value the client chose.

### Token handling

- The socket token is read from the **URL query string** in `ls` (`lib/hooks/useSocket.ts:30`), placed
  there by `admin-dashboard/components/ClassesDashboard.tsx:143-149`. The host credential therefore lives
  in the address bar, browser history, and any screenshare of the teacher's tab — valid **12h**
  (`admin-dashboard/lib/jwt.ts:37`) with **no revocation path**.
- It crosses the wire in **cleartext** (`ws://34.131.52.223:8082`, `ls/config/BaseConstants.ts:20`) — any
  hostile network between teacher and box captures a 12h host credential.
- The token's `classId` claim is never compared to the room being joined. A teacher token for class A
  confers `role='host'` on class B (moderation, private-message history, private mode where
  `socket.userId` is client-set anyway).
- **No entitlement check exists on the socket at all.** Chat, polls, media lists and presence for a paid
  class are open to anyone; only the *video* is gated, and S0-1 above shows the video isn't either.

**Fix shape:** an `io.use()` handshake middleware that (a) requires a valid token, (b) pins `socket.userId`
/`socket.classId` from the verified claims and never lets `joinRoom` overwrite them, (c) rejects a room
that doesn't match the token's class, and (d) a small `requireHost`/`requireSelf` helper applied to the
destructive and history events above. That is one file plus call-site edits, and it is testable in the
existing Jest suite.

---

## S1-2 — The HTTP API has no authentication either

There is no auth middleware in the Express stack — `middleware/` doesn't exist, `express-jwt` is a
dependency that is never used, and `X-Transcoder-Secret` is only ever *sent outbound*.

| Route | File:line | Effect |
|---|---|---|
| `POST /api/v1/stream` | `routes/stream.js:22` | **Unauthenticated**; meant to be a localhost self-call at stream end (`lib/streamLifecycle.js:507`) but is on the public app. `req.body.path` is unnormalized and flows into `${videoSaveBasePath}/${uploadFolder}` (traversal) and into `runEcsTask` → a **billable GPU transcode job** with an attacker-chosen input path. |
| `POST /api/v1/room/:roomId/notes` | `routes/notes.js:51` | 100 MB multipart upload (`multer.any()`, memory storage) with `userId` self-asserted; `fileName`/`userId` are concatenated into the S3 key unsanitized (`lib/fileUpload.js:159-163`) → arbitrary key placement. |
| `PUT` / `DELETE /api/v1/notes/:noteId` | `routes/notes.js:177,222` | Ownership is checked against `req.body.userId` (`routes/notes.js:37-48`) — supply the victim's id and the check passes. |
| `GET /api/v1/user` | `routes/user.js:21` | Dumps **every ban record in the system**. |
| `DELETE /api/v1/user/:banId` | `routes/user.js:32` | Unbans anyone. |
| `GET /api/v1/message/:roomId` (+ `/media`), `GET /api/v1/poll/:roomId`, `POST /api/v1/message` | `routes/message.js:7,13,42`, `routes/polls.js:4` | Read any class's chat/media/polls; write chat directly to Mongo. |
| `GET /health`, `/metrics`, `/dashboard` | `app.js:54,72,78` | Public; `/metrics` enumerates live room ids. |

Also: CORS is `origin:'*'` **with `credentials:true`** (`app.js:24-31`) on Express and `origin:'*'` on
socket.io (`rtmpserver-2.js:50-56`), so all of the above is drive-by callable from any web page. No
`helmet`, no rate limiting anywhere (HTTP, socket, or RTMP). Body limits: 30 MB JSON, 100 MB per uploaded
file, 10 MB per socket frame (the `// 100MB` comment at `rtmpserver-2.js:57` is wrong).

---

## S2 — Non-security gaps worth closing before the next deploy

1. **A restart during a live class orphans it.** The only `SIGTERM` handler is in
   `observability/telemetry.js:26-28` and calls `process.exit(0)` as soon as the metrics SDK shuts down.
   In-memory `rtmpSessions` / `activeProcesses` / watchers die with it: no finalization, no VOD, no
   `ended` webhook, `rtmp:blocked` left behind. **This directly affects the pending `REDIS_HOST` flip** —
   deploy in a no-class window, or add a drain that finalizes active streams first.
2. **Telemetry ships to a third-party host.** `observability/telemetry.js:9` hardcodes
   `http://node-test.multistreaming.site:4318` and exports every 5s, with `room_id` as a metric label
   (`lib/metrics/opentelemetry-metrics.js:100,108`) — production class ids leaving to an unowned domain
   over plain HTTP, with no env gate. Point it somewhere owned or disable it for this deployment.
3. **No TLS anywhere in front of 8082** (`rtmpserver-2.js:43` is `http.createServer`, no `trust proxy`).
   Beyond the cleartext-token issue, this blocks any real `ls` deployment: an HTTPS-served `ls` cannot open
   `ws://` or `http://` to the box (mixed content). TLS + a hostname is a prerequisite for the viewer going
   live, not just a hardening nice-to-have. (Runbook line 307 notes this; its severity is higher than
   recorded there.)
4. **`ls` production config is still local-E2E** — `config/BaseConstants.ts` points at the raw box IP over
   http and `LMS_BASE_URL` at `http://localhost:5100`, uncommitted. Already on the cleanup ledger; it is
   coupled to (3).

---

## Suggested sequencing

Nothing here blocks the `REDIS_HOST` flip itself, but (1) and (2) below should not wait for the
acceptance tail to close — they are remotely reachable today.

1. **Now, no code:** narrow the `selecitonway` firewall rule (drop 6379/5672/15672 from `0.0.0.0/0`;
   restrict 8082 to the proxy/VPN once one exists). Rotate the AWS key and the Mongo password.
2. **One small commit, deploy with the Redis flip:** gate the `/live` static mount on
   `!liveUploadEnabled` (S0-1), validate `StreamPath` + try/catch in `prePublish`, and convert the two
   `exec()` sites to `spawn` (S0-2).
3. **A proper task (19):** socket handshake middleware + per-event authorization (S1-1). Sized for one
   sub-agent against the existing Jest suite.
4. **A proper task (20):** Express auth — localhost-bind or shared-secret `POST /api/v1/stream`, real
   identity on the notes/ban routes, helmet + rate limiting, narrowed CORS (S1-2).
5. **Before any `ls` deploy:** TLS/wss + hostname for 8082, then move the socket token out of the URL
   query string and shorten its lifetime.
