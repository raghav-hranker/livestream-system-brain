# Socket authentication + per-event authorization: prove who is on the wire, then gate what they can do

**Type**: AFK
**Repo**: livestream (phase A) · nodejs-server + ls (phase B)
**Status**: Phase A EXECUTED 2026-08-04 — livestream `3f1425a` on `launch/quicktricks-v2`, suite 191→237
(unit + real-handler-path wiring tests). Deploy user-gated; box env already holds `JWT_SECRET_KEY`
(verified 2026-07-27) so the new boot gate is satisfied. One deviation: the `pinMessage` READ path
(no `messageId`) stays joined-room-bound instead of host-only — late-joining viewers fetch the current
pin through it; pin/unpin WRITES are host-only. Phase B not started.
**Blocked by**: nothing — phase A is livestream-only and ships independently
**Governing docs**: [security preflight](../security-preflight-quicktricks-v2.md) (§S1-1 is the finding this closes) · [GLOSSARY token taxonomy](../../../GLOSSARY.md) · `repos/nodejs-server/CONTEXT.md`

> **Branch guard:** verify `git branch --show-current` matches `ACTIVE_BRANCH` in
> `system-brain/repos.manifest` before reading or changing anything. Ignore `.claude/worktrees/*`.

## Background

The socket layer has **no authentication at the door and no authorization on any event**. There is no
`io.use()` middleware anywhere; `verifyUserAndAddRole` (`backend/db/utils.js:315-336`) runs *inside* the
`connection` handler, and on a missing token, an expired token, a forged signature or any other error it
falls through to `socket.role = 'user'` and keeps the connection. Nothing is emitted to the client and
nothing is metered, so a total auth failure is indistinguishable from a normal student session.

Two structural problems follow from that, and every concrete bug below is one of the two:

**1. Identity is client-supplied.** The handshake sets `socket.userId` from verified claims
(`db/utils.js:323`), and then `joinRoom` **overwrites it** with the payload value
(`rtmpserver-2.js:429`); the convention violation is only `console.error`-ed (`:431-433`). Every handler
after that reads its `roomId`/`userId`/`classId` **from the event payload**, not from the socket. So the
server never actually knows who it is talking to.

**2. Capability is not checked.** Only one handler in the file checks anything (`privateMode`,
`rtmpserver-2.js:620`). Everything else — including the handlers that end a live class, spawn ffmpeg, ban
users and read private messages — runs for whoever emits it.

What that yields today, for a socket with **no token at all**:

| Event | file:line | What an unauthenticated socket achieves |
|---|---|---|
| `endStream` | `:950` | Ends anyone's live class — blocks RTMP reconnect, kills ffmpeg, finalizes the VOD, writes `ended` to the LMS. Needs only `{classId, clientId}`. Task 16's guard only suppresses a *second* stop. |
| `stopRecording` | `:930` | Same block + kill path. |
| `binarystream` | `:887` | Spawns an ffmpeg process per `clientId/classId` and pipes attacker bytes in — content injection plus an unbounded process sink. |
| `banUser` | `:820` | Persists a `Ban` for any userId in any room. |
| `deleteMessage` / `pinMessage` / `unpinMessage` | `:686` / `:837` / `:870` | Full chat moderation on any room. |
| `privateMessageHistory` | `:763` | Reads **any user's** private messages — `userId` + `classId` straight from the payload, no ownership check. |
| `messageHistory` | `:731` | Any class's public chat history (the private half is role-gated). |
| `getMediaMessages` | `:778` | Any class's media list (PDF/image URLs). |
| `userMsg` | `:519` | Posts to any room as any `userId`/`userName` — including impersonating the teacher. |
| `privateMsg` | `:637` | DMs as anyone, to anyone. |
| `voteSubmit` | `:1030` | Ballot stuffing (dedupe keys on the payload `userId`). |
| `joinRoom` | `:408` | **Roster capture** — see below. |

**The roster capture.** `joinRoom` registers the socket under the client-supplied userId
(`:436` → `UserSessions.addSocket`), and the host fan-out targets sockets registered under
`userId === classId` (`:474-479`, again in `handleUserLeave` `:1162-1168`). A client that joins with
`userId = <classId>` therefore lands in the host's socket set and receives every `userListUpdate`.
`RoomStats.addViewer` (`src/utils/RoomStats.js:17-25`) persists `userName`, `phoneNumber`,
`phone_number`, `mobile`, `email`, and `joinRoom` serializes name + phone + email back out
(`:462-470`). Today `ls` sends only id + name, so what leaks now is the roster of ids and names — the PII
fields are wired end to end and leak the moment any client populates them.

**Cross-class host escalation.** The Streamer token carries a `classId` claim, and nodejs-server enforces
it on `/playback` (`src/controllers/playbackController.ts:90-95`: "this streamer token is not authorized
for this class"). livestream reads only `decoded.role` and `decoded.userId` — **the claim is never
compared to the room** — so one class's teacher token is a host credential on every class.

**The secret wiring is real but unguarded.** Verified 2026-07-27: the box's `JWT_SECRET_KEY` and the LMS's
`STREAMER_JWT_SECRET` hash identically, so `role:'teacher'` really does yield host today. But
`JWT_SECRET_KEY` appears in exactly one line of source across all five repos and is **not** in
`config/validateBootConfig.js`, so on drift or a fresh deployment the service boots happily and silently
demotes every teacher to viewer.

## The trust model to adopt

The code today has two principals, `host` and `user`, where `user` means "everyone else, including
anonymous". Replace that with three, and derive all three from the socket — never from a payload:

| Principal | Proven by | May do |
|---|---|---|
| **host** | a Streamer token whose `classId` claim **equals the joined room** | stream control, moderation, private mode, host reads (full history incl. private) |
| **viewer** | (phase B) a Realtime token minted by the LMS after its own entitlement check | join, read public history + media, post chat, vote, own DMs |
| **anonymous** | nothing — no token or an unverifiable one | phase A: join + public chat only. phase B: rejected at the handshake |

And one rule that removes most of the matrix above on its own:

> **`roomId`, `classId` and `userId` are read from the socket, never from the event payload.**
> A payload that disagrees with the socket is a denial, not an override.

## Phase A — livestream only, ships now

No cross-repo dependency, no LMS change, no `ls` change required. Follows the house pattern
(tasks 11/16/17): pure logic in `lib/`, unit-tested with mocked boundaries, thin call-site edits in
`rtmpserver-2.js`.

### A1. Handshake middleware — `lib/socketIdentity.js`, wired with `io.use()`

Replace the in-connection `verifyUserAndAddRole` call (`rtmpserver-2.js:406`) with an `io.use()`
middleware that runs **before** the connection handler and produces one frozen object:

```
socket.principal = { kind: 'host'|'anonymous', userId, classId, customerId }   // never reassigned
```

- Valid Streamer token (`role: 'teacher'`, verified against `JWT_SECRET_KEY`) → `kind:'host'`, with
  `classId`/`userId`/`customerId` taken **from the claims**.
- No token, or a token that does not verify → `kind:'anonymous'`, `userId: null`.
- **Do not reject an unverifiable token at the handshake in phase A.** A student's LMS Auth token is
  signed with the LMS's `JWT_SECRET`, which this box deliberately does not hold (nodejs-server
  `src/services/userAuthService.ts:13-19` keeps the two secrets separate precisely so a compromise of a
  streaming box cannot forge logins — and this box is the one with the RTMP/exec exposure). Rejecting
  would break every non-teacher client. Phase B fixes this properly; phase A makes the downgrade
  **harmless** by gating capability, and **visible** by:
  - emitting `authState { authenticated: false, reason }` to the socket, so a teacher whose token drifted
    sees a real error instead of a silently read-only UI, and
  - logging + metering the failure reason (`invalid_signature` / `expired` / `absent`), so an auth
    regression shows up instead of hiding.
- Add `JWT_SECRET_KEY` to `config/validateBootConfig.js` so a deployment missing it refuses to boot
  rather than demoting every teacher.

### A2. Bind the host to its class

At `joinRoom`, a `host` principal whose `principal.classId !== roomId` is **denied** (`joinRoomError`,
no join). This is the same check nodejs-server already applies on `/playback`; livestream must not be a
weaker gate on the same credential.

### A3. Identity becomes read-only

`joinRoom` no longer writes `socket.userId`. It resolves once:

- `host` → `principal.userId` (which is the classId by the admin-app convention).
- `anonymous` → the payload id is accepted **as a display/presence handle only** and is rejected if it
  equals the room (`userId === roomId` from a non-host is a denial, not a warning).

`socket.roomId` is set on join and every later handler uses it; a payload `roomId`/`classId` that differs
is denied rather than honoured.

### A4. Host fan-out moves off the user keyspace

The roster leak exists because the host's socket set is keyed by a value a client can claim. Register
verified host sockets under a **separate** key — `host:sessions:<classId>`, written only from a socket
whose `principal.kind === 'host'` — and fan `userListUpdate` out to that set (`:474-479` and
`handleUserLeave` `:1162-1168`). No client-supplied id can subscribe to it afterwards.

### A5. Per-event gates — `lib/socketAuthz.js`

Two helpers (`requireHost(socket)`, `requireSelf(socket, claimedUserId)`), each returning a denial reason
rather than throwing, applied as the first line of each handler:

| Rule | Events |
|---|---|
| **host only** | `endStream`, `stopRecording`, `binarystream`, `banUser`, `deleteMessage`, `pinMessage`, `unpinMessage`, `privateMode`, `streamComplete`, `updateUrl` |
| **identity-bound** (payload id must equal socket identity; ignore payload otherwise) | `privateMsg` (sender), `voteSubmit` (voter), `leaveRoom` |
| **room-bound** (use `socket.roomId`, ignore payload) | `userMsg`, `messageHistory`, `getMediaMessages` |
| **denied for anonymous in phase A** | `privateMessageHistory` — reading someone's DM history needs proven identity, which only phase B provides. Host keeps its access; DM *sending* stays available (bound to socket identity), so only the history read regresses. |

Every denial emits a typed error to the caller and increments a counter — silent no-ops are how the
current bug survived.

### A6. Flood limits

A per-socket token bucket on `userMsg` / `privateMsg` / `voteSubmit` / `getMediaMessages`, and drop
`maxHttpBufferSize` from `1e7` (`rtmpserver-2.js:57` — its `// 100MB` comment is wrong; it is 10 MB) to
the smallest size the `binarystream` webcam chunk path actually needs. `binarystream` is host-only after
A5, so the large frame budget no longer has to be open to everyone.

## Phase B — the Realtime token (cross-repo; gates any student rollout)

Phase A leaves one hole open by construction: **livestream cannot tell a real viewer from an anonymous
one**, because entitlement lives in the LMS and the LMS login secret must not be copied onto this box.
Solve it the same way playback was solved — the LMS decides, and hands out a short-lived scoped credential.

**New contract — Realtime token (mint):** `GET /api/classes/{classId}/realtime-token`

- nodejs-server, behind the existing `authenticateUserOrStreamer` middleware
  (`src/middleware/authMiddleware.ts:109`), which already accepts either an Auth access token or a
  Streamer token **and** checks login-session revocation — something livestream can never do locally.
- Runs the **same** `authorizeClassAccess({ userId, isAdmin, classId, accessKind: 'play' })`
  (`src/services/classAccessAuthz.ts:65`) that `/playback` runs, so chat entitlement and video
  entitlement cannot drift apart.
- Returns a short-lived HS256 JWT (TTL ~10 min) with claims `{ classId, userId, role: 'host'|'viewer',
  name?, jti }`, signed with a **new** shared secret `REALTIME_TOKEN_SECRET` — distinct from both
  `JWT_SECRET` and `STREAMER_JWT_SECRET`, so livestream verifies realtime access without holding any
  credential that can forge a login or a playback mint.

**livestream:** verify the ticket in the A1 middleware; `classId` claim must equal the joined room;
`role` claim selects host vs viewer. Then flip the default to **reject unauthenticated handshakes**,
behind an env flag (`REALTIME_AUTH_REQUIRED`) so the flip is staged rather than a cliff.

**ls:** fetch the ticket immediately before `io(...)` (it already holds the LMS token and already calls
`/playback` with it), pass it as `auth.token`, and on a `connect_error` carrying an `AUTH_*` reason,
re-mint once and retry. Note the TTL only affects **connect**: an established socket is not re-checked,
so a 10-minute ticket does not mean a 10-minute class.

Once phase B lands, `privateMessageHistory` is restored for viewers (proven identity), the socket stops
depending on the 12h URL-borne Streamer token, and anonymous sockets disappear entirely.

## Explicitly out of scope

- Moving the **Streamer token out of the URL query string** (`admin-dashboard/components/ClassesDashboard.tsx:143-149`
  → `ls/lib/hooks/useSocket.ts:30`). It stays a 12h URL-borne credential with no revocation; phase B
  demotes it from "the socket credential" to "the thing you mint a 10-minute ticket with", which is the
  cheap 80%. A one-time handoff code is a later task.
- TLS/wss on 8082 — tracked separately in the preflight (§S2-3); until it lands the ticket still crosses
  the wire in cleartext, which is an argument for the short TTL, not against the design.
- The Express API (preflight §S1-2) and the RTMP/origin findings (§S0-1, §S0-2) — separate tasks.

## Acceptance criteria — phase A

- [x] `io.use()` middleware sets a frozen `socket.principal`; no handler reads `socket.role`/`socket.userId` from a payload afterwards
- [x] A Streamer token for class A cannot host class B (join denied)
- [x] A token that fails verification does not silently become a viewer: `authState` is emitted, the reason is logged and metered, and no host capability is granted
- [x] `JWT_SECRET_KEY` is in `validateBootConfig` (boot fails without it) with a test alongside `tests/validateBootConfig.test.js`
- [x] An anonymous socket emitting `endStream` / `stopRecording` / `binarystream` / `banUser` / `deleteMessage` / `pinMessage` / `unpinMessage` / `updateUrl` / `streamComplete` gets a typed denial and **nothing runs** — verified against the real handler path, not just the helper
- [x] Joining with `userId === roomId` from a non-host is denied; `userListUpdate` reaches only sockets in `host:sessions:<classId>`
- [x] `privateMsg` sends as the socket's identity regardless of payload; `voteSubmit` dedupes on socket identity; `privateMessageHistory` is denied for anonymous and unchanged for host
- [x] `userMsg`, `messageHistory`, `getMediaMessages` operate on `socket.roomId`, ignoring payload room/class ids
- [x] Existing behaviour preserved for the real teacher flow: OBS start → live → Stop → `ended` + VOD, private-mode toggle, chat, pins, polls (tasks 11/14/15/16/17 semantics all intact)
- [x] Jest suite green (`cd backend && npx jest tests/`, 191/191 at `a04747e`) with new `tests/socketIdentity.test.js` + `tests/socketAuthz.test.js` following the `privateMode.test.js` mocking pattern
- [x] No new LMS round trip on any hot path (identity is claims-only; the LMS is not consulted per event)

## Acceptance criteria — phase B

- [ ] `GET /api/classes/{classId}/realtime-token` reuses `authenticateUserOrStreamer` + `authorizeClassAccess(accessKind:'play')`; a non-entitled user gets 403, a Streamer token for another class gets 403
- [ ] `REALTIME_TOKEN_SECRET` is distinct from `JWT_SECRET` and `STREAMER_JWT_SECRET` in both repos' env validation
- [ ] livestream rejects handshakes without a valid ticket when `REALTIME_AUTH_REQUIRED=true`, and the flag defaults off until `ls` ships the mint call
- [ ] `ls` mints before connecting and re-mints once on an `AUTH_*` `connect_error`
- [ ] An established socket survives ticket expiry (no mid-class disconnect)
- [ ] GLOSSARY gains **Realtime token** as a cross-repo term next to Playback URL token; SYSTEM.md gains the contract row

## User stories covered

- A student copies the classId out of their own class link and opens a socket to a class they never
  bought: they cannot read its chat history, cannot see who is in the room, and cannot post.
- Someone who finds a teacher's 12h link cannot use it to moderate, or to end the stream on, any class
  other than the one it was minted for.
- A bored viewer emitting `endStream` at a live class gets a denial instead of ending it.
- A teacher whose `JWT_SECRET_KEY` drifted after a redeploy sees an explicit "not authenticated as host"
  instead of a UI whose buttons quietly do nothing.
