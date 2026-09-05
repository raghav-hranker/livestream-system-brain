# Socket authentication + per-event authorization: prove who is on the wire, then gate what they can do

**Type**: AFK
**Repo**: livestream (phase A) · nodejs-server + ls (phase B)
**Status**: Phase A EXECUTED 2026-08-04 — livestream `3f1425a` on `launch/quicktricks-v2`, suite 191→237
(unit + real-handler-path wiring tests). One deviation: the `pinMessage` READ path
(no `messageId`) stays joined-room-bound instead of host-only — late-joining viewers fetch the current
pin through it; pin/unpin WRITES are host-only. Phase B: **spec finalized 2026-08-05, not implemented**
— A+B deploy together in one window (B5).
**2026-08-05 — REMEDIATION EXECUTED, deploy still user-gated.** R1–R5 all landed and are merged into
`launch/quicktricks-v2`: livestream `8c215ea` (merge of `sandcastle/task-19`; suite 237→**288**) and
ls `75f261e` (suite **72** green, `tsc --noEmit` clean). Nothing is pushed. Phase A is now considered
deployable pending the two-box sequencing below. Original hold context: an external review of phase A
surfaced deploy-blocking findings, verified against the code (see
[Phase A remediation](#phase-a-remediation-2026-08-05--pre-deploy) below). Also learned: livestream runs as **two instances**
(OBS/ingest box + socket-domain box, same code, shared Redis) — deploys, the `JWT_SECRET_KEY` boot gate,
and live verification apply to BOTH boxes; only one box's env was ever verified (2026-07-27).
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

## Phase A remediation (2026-08-05) — pre-deploy

An external agent review of `3f1425a` produced 12 findings; each was verified against the code
(`rtmpserver-2.js`, `lib/socketAuthz.js`, `lib/socketIdentity.js`, `ls/lib/hooks/useSocket.ts`).
Triage below. **R1–R4 block the deploy**; R5 riders are folded in because they're cheap; the backlog
items move to phase B or the ledger.

### Blocking — livestream

- [x] **R1 — payload armor.** Every handler destructures its payload in the signature
  (`async ({ roomId, data }) =>`), so an event emitted with no/null/scalar payload throws **before any
  authz gate runs**; the backend has **no** `unhandledRejection`/`uncaughtException` handler, so on
  Node ≥15 one emit from an anonymous socket kills the process (and SIGTERM orphans live streams —
  phase A turned the `endStream` hole into a crash-the-box hole). Fix: validate payloads before
  destructuring (small `lib/` helper), typed `INVALID_PAYLOAD` denial, plus a process-level rejection
  safety net. Tests: missing/null/scalar/malformed payload matrix through the real handler path.
- [x] **R2 — `userMsg` identity binding.** The handler spreads `...data` unchanged and broadcasts
  `data.userId` (`rtmpserver-2.js:607-645`); a joined viewer can post as the teacher. This was a **spec
  gap**: the A5 table listed `userMsg` as room-bound only, though the background table named teacher
  impersonation as a target bug. Fix: `requireSelf`-resolve the sender, overwrite stored + broadcast
  `userId`/`userName` from the socket, deny conflicting payload identity. Amend the A5 table:
  `userMsg` is room-bound **and identity-bound**.

### Blocking — ls (same branch, cross-repo slice)

- [x] **R3 — bootstrap event order.** `useSocket.ts` emits `pinMessage` (:106) and `getMediaMessages`
  (:112) in the mount effect, before `joinRoom` (:168) fires from the connected effect — post-deploy
  both get `NOT_JOINED` and the client never retries, so the pin/media bootstrap breaks for every
  user (defeating the spec's own late-joiner accommodation). Fix: join first (ack or reorder), then
  request pin/media/histories.
- [x] **R4 — surface auth failures.** `ls` has no listener for `authState` / `authzError` /
  `joinRoomError` (its `error` handler is empty) — the phase A "teacher sees an explicit failure" goal
  terminates at the server. Fix: handle these events; a denied teacher join must show a blocking error,
  not a half-working screen.

### Riders (fold into the same commits)

- [x] **R5a** — `leaveRoom` clears `socket.roomId`/`userId`/`presenceUserId` + deregisters the Redis
  socket; subsequent room-bound events get `NOT_JOINED`. (Not a phase A security hole — joining is
  free — but becomes one in phase B.)
- [x] **R5b** — repeat `joinRoom`: same-room idempotent; different-room joins leave + clean the
  previous room first.
- [x] **R5c** — stop error-logging `invalid_signature` in phase A: `ls` sends the URL token for
  everyone, so every legitimate student (Auth token, unverifiable here by design) currently logs an
  error and pollutes the failure metric. Downgrade to info + separate metric until phase B.
- [x] **R5d** — host principal requires non-empty `userId` + `classId` claims; pin
  `jwt.verify(..., { algorithms: ['HS256'] })`. (Low: a claims-light teacher token is already denied
  at join by A2, and forging requires the secret.)
- [x] **R5e** — rate limiter buckets become `Map<socketId, Map<event, bucket>>` so `drop()` is O(1)
  per disconnect instead of a full-map scan.

### Deferred (not phase A blockers)

- **Join/read rate limits + connection/IP limiting** — hardening, phase B era.
- **Roster fan-out rebuilds the full viewer hash per join/leave** — pre-existing, not a phase A
  regression; fix with deltas + `HLEN` during phase B / scale work.
- **Stale Redis socket IDs after crash** — pre-existing; the clean fix (host fan-out via an internal
  socket.io room so the adapter owns membership lifecycle) belongs to phase B.
- Review's remaining asks (reconnect-storm/load tests, leaked watcher timers in the suite) → cleanup
  ledger.

Second-opinion review of the executed remediation (2026-08-05, this repo's session) confirmed R1–R5
correct and re-ran both suites; a counter-review's NO-GO probes were each verified and none reopen
R1–R4. Additions to this ledger from that pass:

- **R5b gap — same-room rejoin under a DIFFERENT userId** hits neither the idempotence guard nor the
  different-room cleanup: the old identity's Redis socket entry + roster slot leak (disconnect cleans
  only the current `socket.userId`), viewer count inflates. Ghost-minting is equivalent to free
  anonymous joins in phase A, so not a blocker — but it becomes an integrity hole the moment phase B
  makes identity cost something. Adjacent: concurrent different-room joins and a disconnect racing
  mid-`leaveRoom` can double-run/interleave cleanup (roster + metrics skew only).
- **ls chat identity is timing-coupled** — `Chat.tsx:105` stamps `data.userId` from its OWN
  `useLocalStorage('userId')` instance, while the join identity is the token-derived id; they agree
  only because the page effect writes localStorage before Chat mounts behind the loading screens.
  R2 turned any drift from mislabeling into IDENTITY_MISMATCH → message silently dropped (console-only
  warn). Fix (cheap, do with phase B or sooner): `useSocket` returns the userId it joined with; Chat
  takes it as a prop.
  **Follow-up (2026-09-05):** the Chat fix landed with B3, but the **poll launch emit** in the page
  (`handleLaunchPoll`) was missed — it still stamped `data.userId` from the Streamer token's
  `clientId.customer_id`, while the host principal is the `userId` claim (= classId). Every poll since
  the R2 deploy was denied IDENTITY_MISMATCH and dropped; invisible because the page toasted only
  PRIVATE_MODE and the Polls sidebar rendered optimistically. Fixed in ls `13da9d0` (poll emit uses
  `chatUserId`; every non-CHAT_MUTED `userMsgError` now toasts). Rule: **any `userMsg`/`privateMsg`
  emit must stamp the ticket identity from `useSocket`, never the URL param or a token sub-claim.**
- **Cheap hardenings, optional pre-deploy:** `.catch` inside `guardPayload` routing handler rejections
  to `deny()` (today they land in the process net, caller gets no error); `endStream` requires
  `clientId` (a host emitting `{}` reaches cleanup with `/undefined/<classId>` instead of a typed
  denial — host-only, own class, robustness not security).
- Students still emit `privateMessageHistory` at bootstrap and are always denied (accepted phase A
  regression) — expect `socket_authz_denied_privateMessageHistory` to grow with every student join;
  it is not an attack signature.

### Deploy sequencing (supersedes the single-box instructions above)

Livestream runs as **two instances of the same code** — an OBS/RTMP ingest+transcode box and a
socket-domain box, shared Redis. Only after R1–R4: deploy `812cd84` + `3f1425a` + remediation to
**both** boxes (verify `JWT_SECRET_KEY` on the second box first — boot now fails without it) and ship
the ls change. Live-verify across the real two-box path: host controls from the socket box reach the
ingest box's ffmpeg; anonymous `endStream` denied; malformed-payload emit does **not** kill the
process; pin/media bootstrap works; **a chat send broadcasts as BOTH teacher and student** (the R2
identity check depends on ls's timing-coupled localStorage identity — see the ledger above); `/live`
404s on both boxes. Then: probe the second box's exposure
(preflight only audited 34.131.52.223) and split the untagged `selecitonway` firewall rule per-instance
(RTMP closed on the socket box, 8082 narrowed on the ingest box).

## Phase B — the Realtime token (cross-repo; gates any student rollout)

*Spec finalized 2026-08-05 after design review (agent handoff `/tmp/handoff-socket-auth-phase-b-pointers.md`
triaged; all open decisions resolved with user). Supersedes the sketch that previously lived here.*

Phase A leaves one hole open by construction: **livestream cannot tell a real viewer from an anonymous
one**, because entitlement lives in the LMS and the LMS login secret must not be copied onto this box.
Solve it the same way playback was solved — the LMS decides, and hands out a short-lived scoped credential.

**The pattern in one line:** signature checks are portable, context isn't — so the *long* credential
(Auth/Streamer token) is verified once per connection at the LMS, next to the data that can veto it
(sessions, orders, class state), and the edge only ever verifies a short-lived ticket that carries its
context as claims.

### B1. New contract — Realtime token (mint): `GET /api/classes/{classId}/realtime-token`

nodejs-server, behind the existing `authenticateUserOrStreamer` middleware
(`src/middleware/authMiddleware.ts:109`) — accepts either an Auth access token or a Streamer token and
checks login-session revocation, something livestream can never do locally. Then runs the **same**
`authorizeClassAccess({ userId, isAdmin, classId, accessKind: 'play' })`
(`src/services/classAccessAuthz.ts:65`) that `/playback` runs.

**Policy layering (decided):** the shared seam (`authenticateUserOrStreamer` + `authorizeClassAccess`)
is where entitlement rules live — a rule added there gates playback AND room entry together, so chat and
video entitlement cannot drift. Socket-only rules live in this endpoint. `accessKind` is the escape
hatch if the two must ever intentionally differ.

**Host issuance (decided):** only a valid **class-scoped Streamer token** mints `role:'host'`. Every
Auth access token mints `viewer` — **including admins**, whose `authorizeClassAccess` entitlement bypass
must not leak into socket host capability.

**Ticket:** HS256 JWT, TTL **10 min**, signed with a **new** `REALTIME_TOKEN_SECRET` (distinct from
`JWT_SECRET` and `STREAMER_JWT_SECRET`; in both repos' env validation / boot gates). Claims:

- `userId`, `classId` (strings, required, non-empty)
- `role: 'host' | 'viewer'` (required)
- `name` — display name from the **LMS user record** (host: teacher name from the Streamer token's
  `className`-adjacent claims or LMS lookup) — becomes the spoof-proof chat display name
- `jti`, `iss`, `aud`, `iat`, `exp` — `jti` is **audit/correlation only** (no replay store; documented)

Response `Cache-Control: no-store`; the ticket never appears in URLs or logs. **No secret rotation
machinery now (decided)** — single secret, no `kid` ring; rotation = coordinated env change.

**Mint-path latency (required work, not optional):** the mint is once-per-connection, never per event —
but with **no class-size limits (decided)**, the remint herd after a socket-box restart is unbounded, so:
run the course-placement and order reads **concurrently** once the class is known (preserving the exact
shared entitlement rule); verify/add compound indexes for `Order { userId, orderStatus }` and
`CourseClass { class, isActive, status }`; instrument total mint latency + session/class/course/order
sub-spans.

### B2. livestream — verify the ticket, one code path

- A1 middleware verifies **Realtime tickets** with `REALTIME_TOKEN_SECRET`: `algorithms:['HS256']`,
  required-claim validation (non-empty `userId`/`classId`, known `role`, `iss`/`aud`), small documented
  clock skew. `classId` claim must equal the joined room; `role` selects host vs viewer.
- **Dual verification during migration:** accept Realtime tickets AND legacy Streamer tokens while
  `REALTIME_AUTH_REQUIRED=false`, so the two boxes + ls need not deploy atomically. Legacy acceptance is
  removed after live verification (B5 step 7).
- `REALTIME_AUTH_REQUIRED=true` ⇒ reject handshakes without a valid ticket **before** `connection`
  handlers install, via structured `connect_error` with `error.data.code` ∈
  `{ AUTH_REQUIRED, AUTH_EXPIRED, AUTH_INVALID }` (join-time class mismatch stays a join denial). The
  client never parses message strings. **The flag is effectively the secured/unsecure customer axis**
  (per-deployment env, like the Transcoder secret): quicktricks runs ON from day one (ls is not in prod —
  no migration population); unsecure deployments stay off with phase A semantics.
- Once required: the anonymous-downgrade path dies, and the **R5c logging downgrade is deleted** — with
  every socket presenting a verifiable ticket, `invalid_signature` is unambiguous and alarming again.
- `privateMessageHistory` is **restored for viewers** (identity now proven); denial matrix updated.
- `STREAMER_JWT_SECRET`/`JWT_SECRET_KEY` comes OFF both boxes after legacy acceptance is removed —
  box compromise stops being a host-forgery event.
- **Ledger folds (this phase, before the flip):** same-room rejoin under a different userId must clean
  up the previous identity (ghost-minting becomes an integrity hole once identity costs something);
  `guardPayload` gains a `.catch` routing handler rejections to `deny()`; `endStream` requires
  `clientId`; hot-path `console.log` stripping in `userMsg`/`joinRoom` (latency rider).

### B3. ls — mint before connect; useSocket becomes a connection state machine

**Rewrite decided, contract frozen:** `useSocket` keeps its exact signature and return shape
(`socket, streamUpdate, messageHistory, authError, …` — page.tsx/Chat barely change), but its internals
become a pure connection state machine in `lib/room/` (same pattern as `socketAuth.ts`: pure module,
vitest-covered; the hook is a thin React adapter). Rationale: phase B's mint/retry/backoff state cannot
be safely layered onto the current effect soup (`forceNew:true`, three uncoordinated
`useLocalStorage('userId')` reads, join/leave emitted from effect dep changes, empty error handlers).

Machine requirements:

- Mint immediately before connecting, via socket.io's **`auth` callback form** — a fresh ticket per
  connection attempt, so the minute-40 network blip reconnects cleanly without the `connect_error`
  round-trip.
- **One in-flight mint** per socket; concurrent failures share it. `AbortController` so
  navigation/unmount cannot complete a stale mint.
- On `AUTH_*` `connect_error`: re-mint once and retry; the "once" budget is per failed connection cycle
  and **resets after a successful connect**. **No retry loop on mint 401/403** — 401 surfaces as session
  recovery, 403 as "not entitled"; network/5xx gets bounded retry.
- **Jitter + backoff** on reconnect so a socket-box restart does not stampede the LMS (this is the
  no-class-size-limit protection).
- Ticket expiry never disconnects an established socket; a later reconnect just mints fresh.
- **Identity comes off the ticket** — the machine holds `userId`/`name` from the minted ticket's claims
  and passes them down; Chat takes identity as a prop. This deletes the three-way
  `useLocalStorage('userId')` coupling (the phase A ledger's chat-identity finding) at the root.
- `authError` surface extends to the new `connect_error` codes (blocking screen, same as R4's).

**External hop (user-owned, outside the brain's five repos):** the student LMS frontend must construct
the ls class link with the student's Auth token attached (same convention as admin-dashboard's teacher
handoff). Without it students arrive credential-less and the flip locks them out. Token-in-URL remains a
known wart for BOTH paths — deferred to the one-time-handoff-code task, unchanged.

### B4. brain

- GLOSSARY: **Realtime token** entry beside Playback URL token (mint contract, TTL semantics, the
  demotion of the Streamer token from socket credential to mint input).
- SYSTEM.md: contract row `Realtime token (mint)` — `GET /api/classes/{classId}/realtime-token`,
  writer —, reader ls; plus the arcs update (socket handshake now shows the ticket exchange).

### B5. Rollout order (A and B deploy in ONE window — decided)

Phase A (`8c215ea`/`75f261e`) and phase B ship together; the sequencing below subsumes the phase A
two-box instructions above, which still govern the phase A verification items.

1. Generate `REALTIME_TOKEN_SECRET`; provision on nodejs-server + **both** livestream boxes.
2. Deploy nodejs-server mint endpoint (inert until called).
3. Deploy livestream (phase A + B) to both boxes: dual verification, `REALTIME_AUTH_REQUIRED=false`.
4. Deploy ls (phase A + B): mints and sends Realtime tickets.
5. Live-verify the full matrix (phase A items + mint/handshake path + chat as teacher AND student).
6. Flip `REALTIME_AUTH_REQUIRED=true` on both boxes in one coordinated window.
7. Remove legacy Streamer-token handshake acceptance; drop `JWT_SECRET_KEY` from both boxes' env.

Prerequisite for step 6: the student LMS frontend link change (user-owned) is live.

Once phase B lands: anonymous sockets disappear, students have proven identity, the socket no longer
depends on the 12h URL-borne Streamer token, and a leaked teacher link must pass a live LMS check on
every connect.

### B5 execution record — steps 1–5 DONE 2026-08-06; 6–7 pending the student-link change

Topology correction disclosed by the user at deploy time: the quicktricks deployment is a **single
livestream box**, not the two-box split (that split is the *other tenant's* prod on the same machine —
`~/livestream` / pm2 `livestream-topper`, hands off). Deployed surfaces:

| Where | What | Evidence |
|---|---|---|
| `phonetics` box (34.126.210.209), pm2 `quicktricks-lms`, `~/quicktricks-lms` | nodejs-server `8600a2f1` via `~/deploy-quicktricks-lms.sh` | boot gate passed; unauth mint → 401; Streamer-token mint → 200 + `Cache-Control: no-store` + exact charter claims (600s, `jti`, `iss`/`aud` pins) |
| `livestream-testing-raghav` box (34.131.52.223), pm2 `quicktricks-livestream`, `~/quicktricks-livestream` | livestream `ae0f02c`, `REALTIME_AUTH_REQUIRED=false` | boot green with new secret; `/live` still 404; socket path `/ws/socket.io/` on :8082 |
| Vercel | ls `5c2fab7` (autodeploy on push) | teacher flow browser-verified by user (mints firing, no-token regression correct) |

Secret provisioning: `REALTIME_TOKEN_SECRET` lives in the phonetics box's persisted
`~/.quicktricks-lms-secrets` (survives the deploy script's env rebuild), the livestream box's
`backend/.env`, and locally at brain `.secrets-realtime-token` (mode 600) — same value, never printed.

Step-5 verify matrix closed 2026-08-06, all green: host ticket handshake → `authState {role:host}`;
synthetic student Auth token vs paid class → 403 "not enrolled", vs free class → 200 `role:viewer`
(name falls back to `'Viewer'` — the test DB has no student user records; the probe flipped one class
`isFree` and reverted it); viewer ticket handshake → `authState {role:viewer}`; anonymous connect
accepted (dual-accept, flag off); garbage ticket degrades to `{authenticated:false, reason:malformed}`.
Known cosmetic: the LMS test instance strips `REDIS_*` by design (localhost ECONNREFUSED spam), and
the livestream boot logs a self-resolving "Socket already opened" PubSub reconnection race.

### The student class link — contract for the LMS frontend teams (website + app)

The gate on step 6, settled with the user 2026-08-06. The student LMS frontends (user-owned, NOT one
of the brain's five repos) open the ls player page with the student's login JWT on the URL:

```
https://<ls-host>/<clientId>/<classId>/?token=<student's current Auth access token>
```

- **Built at click time, never stored.** The teacher's link can live in `class_link` because the
  Streamer token is class-scoped; a student JWT is per-user/per-session, so the frontend appends the
  freshest JWT it holds when the student clicks (a stale one 401s the mints → session-recovery screen).
- **`<clientId>` must match the teacher's** (the customer id, not the student's id) — a Streamer token
  overrides it from claims, a student JWT carries no such claim, so the path value is used as-is and a
  mismatch addresses a different room.
- **One token, three roles for it:** the JWT on the page URL is only ever a *mint input*. ls exchanges
  it at `/playback` (signed CDN URL — Bunny token baked in server-side) and `/realtime-token` (10-min
  socket ticket). The JWT never appears on a video URL; the Bunny token never appears on the page URL.
- **App caveat:** appending the token is sufficient only if the app opens ls (webview/browser). A
  native player+chat would have to call the two mint endpoints itself and present the ticket at the
  socket handshake — confirm which pattern the app uses BEFORE the flip, because after it a ticketless
  socket is rejected (`connect_error` `AUTH_REQUIRED`).

Flip-day checklist (steps 6–7, after a real student click-through succeeds): set
`REALTIME_AUTH_REQUIRED=true` in the livestream box's `backend/.env`, restart pm2
`quicktricks-livestream`, re-probe (ticketless → `connect_error AUTH_REQUIRED`; ticketed → joins;
`/live` → 404), then delete the legacy Streamer-token handshake acceptance and drop `JWT_SECRET_KEY`
from the box env. Firewall tail (per-box narrowing) follows per "Deploy sequencing" above.

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

### nodejs-server (mint) — DONE 2026-08-05, merged `8600a2f1` (leg `c6f6315` + review fix `3527470`), suite 509→536

- [x] `GET /api/classes/{classId}/realtime-token` reuses `authenticateUserOrStreamer` +
      `authorizeClassAccess(accessKind:'play')` — the shared seam, never duplicated order logic
- [x] 401: absent/invalid/expired Auth token; revoked login session. 403: non-entitled viewer;
      Streamer token for another class. Success: free class, entitled paid class, correct-class Streamer
- [x] Only a class-scoped Streamer token mints `role:'host'`; an **admin Auth token mints `viewer`**
- [x] Exact claims asserted (`userId`, `classId`, `role`, `name`, `jti`, `iss`, `aud`, `exp` ≈ 10 min),
      HS256 only, `Cache-Control: no-store`, no ticket/secret in logs
- [x] `REALTIME_TOKEN_SECRET` distinct from `JWT_SECRET` and `STREAMER_JWT_SECRET`; in env validation
- [x] Course-placement + order reads run concurrently; compound indexes verified/added for
      `Order { userId, orderStatus }` and `CourseClass { class, isActive, status }`; mint latency +
      sub-spans instrumented

### livestream (verify) — DONE 2026-08-05, merged `ae0f02c` (leg `535ecd6`), suite 288→326; review clean (no defects). Notes: success meters ride `incrementErrors` (cosmetic); `REALTIME_TOKEN_SECRET` is now a boot requirement on EVERY livestream deploy incl. flag-off boxes

- [x] Dual verifier: legacy Streamer token AND Realtime ticket both accepted while
      `REALTIME_AUTH_REQUIRED=false`; flag on ⇒ missing/invalid/expired ticket fails **before**
      `connection` handlers install, with `connect_error` `data.code` ∈
      `{AUTH_REQUIRED, AUTH_EXPIRED, AUTH_INVALID}`
- [x] Ticket validation: HS256 pinned, `iss`/`aud`/claim-shape checked, `classId` must equal the joined
      room, `role` selects capability; expired/malformed/wrong-audience each get the right code
- [x] An established socket survives ticket expiry (no mid-class disconnect); no event handler performs
      an LMS call (hot path stays local)
- [x] `privateMessageHistory` restored for viewers; R5c logging downgrade deleted once the flag is on
- [x] Ledger folds landed: same-room/different-userId rejoin cleans up the previous identity;
      `guardPayload` catches handler rejections into `deny()`; `endStream` requires `clientId`;
      `userMsg`/`joinRoom` hot-path `console.log`s stripped
- [x] Two-box topology verified: host controls from the socket box reach the ingest box's ffmpeg with
      auth on

### ls (connection state machine) — DONE 2026-08-06, merged `5c2fab7` (leg `800dce8`), suite 72→112 + tsc clean; review clean (notes: LiveCamera second-socket double-mint = cleanup candidate; pre-identity send window returns empty userId ~1s)

- [x] `useSocket` return contract unchanged (page.tsx/Chat diffs minimal); internals are a pure machine
      in `lib/room/`, vitest-covered
- [x] Mint via `auth` callback form — fresh ticket per connection attempt; mint success before first
      connect; reconnect after ticket expiry works without user-visible error
- [x] One in-flight mint shared by concurrent attempts; AbortController cancels on unmount/navigation
- [x] One re-mint per failed connection cycle on `AUTH_*` codes, budget resets after success; **no
      retry loop on 401/403** (401 → session recovery surface, 403 → not-entitled surface); bounded
      retry with jitter/backoff on network/5xx (stampede protection — no class-size limits exist)
- [x] Chat identity comes from the ticket claims as a prop — the `useLocalStorage('userId')`
      three-instance coupling is deleted
- [x] `authError` blocking screen covers the new `connect_error` codes

### brain

- [x] GLOSSARY gains **Realtime token** next to Playback URL token; SYSTEM.md gains the contract row +
      arc update (2026-08-06)
- [x] Rollout executed in the B5 order; step 6 (flag flip) blocked on the user-owned student-frontend
      link change

## User stories covered

- A student copies the classId out of their own class link and opens a socket to a class they never
  bought: they cannot read its chat history, cannot see who is in the room, and cannot post.
- Someone who finds a teacher's 12h link cannot use it to moderate, or to end the stream on, any class
  other than the one it was minted for.
- A bored viewer emitting `endStream` at a live class gets a denial instead of ending it.
- A teacher whose `JWT_SECRET_KEY` drifted after a redeploy sees an explicit "not authenticated as host"
  instead of a UI whose buttons quietly do nothing.
