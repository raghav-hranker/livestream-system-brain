# Live-class socket — mobile client handoff

> Companion to the *Client Integration Guide* (`INTEGRATION-GUIDE.md`, same folder). Read that first for
> login, token refresh and `/playback`. This guide covers the **chat/presence socket** for a live class:
> how to mint the ticket, open the connection, join the room, and which events flow in each direction.
> Verified against the production server code on branch `launch/quicktricks-v2` on 2026-09-03.
>
> Reference implementation (the web class screen, correct and in production):
> <https://github.com/raghav-hranker/ls/tree/launch/quicktricks-v2> — see "Where to copy from" at the end.

---

## 0. The endpoints

| What | Value |
|---|---|
| LMS API (mint) | `https://backend.quicktricksbysahilsir.com` |
| Socket server | `https://socket.quicktricksbysahilsir.com` (wss through Cloudflare) |
| socket.io **path** | `/ws/socket.io/` — **not** the default `/socket.io/`; the default 404s |
| Namespace | default `/` only |
| Transports | server accepts polling + websocket; use `websocket` only |
| Ping | server defaults: interval 25 s, timeout 20 s. A backgrounded app **will** be disconnected; reconnect on foreground |
| Max frame | 1 MB. Chat never gets near it. Exceeding it closes the socket silently (you see `disconnect`, not an error) |

The socket carries **chat, presence and live-state signals only**. Video never travels over it. When the
socket says the class is live, you play it exactly as the integration guide describes: `GET /playback`.

---

## 1. Why the ticket exists (read this once)

The socket server cannot verify your login token — the LMS login secret is never copied onto the
streaming box. So, exactly like `/playback`, the LMS checks the user once and hands back a short-lived
**realtime ticket** that the socket server can verify on its own. The ticket carries the user's identity,
their role (`host` or `viewer`), display name and current chat-mute state. The server binds the whole
connection to it: **you never send a user id of your own choosing.**

Today the server runs in a transition mode: it still accepts connections *without* a ticket, but such a
connection is anonymous — it cannot load its private-message history (denied with `NOT_HOST`), and mutes
cannot be applied to it. The switch to **reject** un-ticketed connections (`REALTIME_AUTH_REQUIRED=true`)
is planned and this handoff is a prerequisite for it. **Build the ticketed flow from day one.**

---

## 2. Mint a ticket — before every connection attempt

```
GET {LMS}/api/classes/{classId}/realtime-token
Authorization: Bearer <login token>

200 → { "token": "<JWT>", "expiresIn": 600 }      (Cache-Control: no-store)
401 → login token invalid/expired → run the refresh-token ladder from the integration guide
403 → logged in but not entitled to this class → show "not enrolled" / purchase UI; do NOT retry
5xx / no response → transient → retry with backoff (see §5)
```

Rules:

- `classId` is the same id you use for `/playback`. On the socket it is called `roomId`. Same value.
- The ticket lives **10 minutes** and only gates the **handshake**. An open socket is never dropped
  because its ticket expired.
- **Never reuse a ticket.** Mint a fresh one for every connection attempt, including every reconnect.
  Reusing one just produces `AUTH_EXPIRED` round-trips.
- 401 and 403 are **terminal** for that attempt: surface them, never loop.

### Decode the ticket for identity (no verification needed)

The ticket is a plain HS256 JWT. Base64url-decode the payload and read:

```json
{ "userId": "6501ab…", "classId": "456", "role": "viewer", "name": "Asha",
  "chat": { "canSend": true, "reasons": [], "v": 0 },
  "iss": "lms", "aud": "livestream-socket", "iat": …, "exp": … }
```

- `userId` — the id you put in every payload that has a `userId` field. Any other value is rejected
  with `IDENTITY_MISMATCH`.
- `name` — the display name the server will broadcast for your messages. Payload `userName` is ignored.
- `role` — `viewer` for every student; `host` only for the teacher's Streamer token. A mobile student
  app is always a viewer. Treat anything that is not the literal `host` as `viewer`.
- `chat` — the mute state at mint time. Missing or malformed ⇒ treat as `canSend: true`. It is the
  *baseline*; live updates (§7) override it.

---

## 3. Open the connection

Web reference (socket.io-client JS):

```js
io("https://socket.quicktricksbysahilsir.com", {
  path: "/ws/socket.io/",
  transports: ["websocket"],
  auth: (cb) => mintTicket(classId, loginToken).then(t => cb({ token: t.token })),
  reconnection: false,   // own the retry loop yourself (§5)
});
```

The credential is read from **`handshake.auth.token` only** — not query string, not headers, not cookies.

### Native clients

The JS `auth` *callback* form is what makes "fresh ticket per attempt" automatic. Native socket.io
clients only take a **static** auth map, so the built-in auto-reconnect would resend the stale ticket.
The rule for every native platform is the same:

1. **Disable auto-reconnect** (`reconnection: false`).
2. On every connect and every reconnect: **mint → set the auth map → connect**.
3. Own the retry/backoff loop yourself (§5). This is also what the web client does.

Sketches (check the exact API against the client version you pin):

**Android / Kotlin — `io.socket:socket.io-client` (2.x)**
```kotlin
val opts = IO.Options().apply {
    path = "/ws/socket.io/"
    transports = arrayOf("websocket")
    reconnection = false
}
suspend fun connectOnce() {
    val ticket = mintTicket(classId, loginToken)           // §2, handle 401/403 here
    opts.auth = mapOf("token" to ticket.token)              // fresh map every attempt
    socket = IO.socket("https://socket.quicktricksbysahilsir.com", opts)
    socket.on(Socket.EVENT_CONNECT_ERROR) { args -> /* §4 */ }
    socket.connect()
}
```

**iOS / Swift — `Socket.IO-Client-Swift` (16.x)**
```swift
let manager = SocketManager(socketURL: URL(string: "https://socket.quicktricksbysahilsir.com")!,
                            config: [.path("/ws/socket.io/"), .forceWebsockets(true), .reconnects(false)])
let socket = manager.defaultSocket
func connectOnce() async throws {
    let ticket = try await mintTicket(classId: classId, loginToken: loginToken)
    socket.connect(withPayload: ["token": ticket.token])   // the auth payload for this attempt
}
```

**Flutter — `socket_io_client` (2.x)**
```dart
final socket = io.io('https://socket.quicktricksbysahilsir.com',
  io.OptionBuilder().setPath('/ws/socket.io/').setTransports(['websocket'])
    .disableReconnection().disableAutoConnect().build());
Future<void> connectOnce() async {
  final ticket = await mintTicket(classId, loginToken);
  socket.auth = {'token': ticket.token};                    // set before each connect()
  socket.connect();
}
```

**React Native** — the JS snippet above works unchanged (the `auth` callback form is available).

---

## 4. Handshake rejection → `connect_error`

When the server rejects the ticket, `connect_error` fires with `data.code`. **Read `data.code`, not the
message string.**

| `data.code` | Meaning | Action |
|---|---|---|
| `AUTH_REQUIRED` | no ticket presented | mint and retry |
| `AUTH_EXPIRED` | ticket expired before the handshake | mint fresh, retry **once** |
| `AUTH_INVALID` | bad signature / wrong audience / malformed | mint fresh, retry **once**; then show an error |

The retry budget for `AUTH_*` is **one re-mint per failed connection cycle**, reset after a successful
connect. Once spent, show a blocking "could not authenticate" screen; never spin.

Today (transition mode) these rejections do not happen — a bad ticket falls through to an anonymous
connection and you get `authState { authenticated: false, reason }` instead (§6). Handle both.

---

## 5. Reconnect and backoff

- **Transient failures** (mint 5xx, network, socket `disconnect`): retry with full-jitter exponential
  backoff: `delay = random() * min(15 s, 500 ms * 2^attempt)`. This is the only protection the LMS has
  against a thundering herd when the socket box restarts, so do not use a fixed short interval.
- **Terminal failures** (mint 401/403, spent `AUTH_*` budget, `joinRoomError`): stop, surface.
- **Every attempt mints fresh** (§2). Never cache the ticket across attempts.
- **App lifecycle:** on background the ping timeout closes the socket within ~45 s. On foreground, run
  the normal connect path (mint → connect → join → bootstrap). Do not try to keep the socket alive in
  the background.
- After a reconnect, **redo the whole join sequence** (§6) — room membership does not survive a new
  connection.

---

## 6. Join the room and bootstrap

Emit in this order on the same connection. The server rejects any room-bound event sent before a
successful join with `NOT_JOINED` and never retries it, so a history request sent early is simply lost.

```js
socket.emit("joinRoom",              { roomId: classId, userId: ticket.userId, userName: ticket.name });
socket.emit("pinMessage",            { roomId: classId });                        // read current pin (no messageId = read)
socket.emit("getMediaMessages",      { classId });                                 // shared PDFs
socket.emit("messageHistory",        { classId });                                 // last 100 public messages
socket.emit("privateMessageHistory", { classId, userId: ticket.userId });          // last 100 of my DMs
```

**There is no join acknowledgement.** A successful join is silent except for what arrives on its own:

| Arrives on join (to you only) | Payload | Note |
|---|---|---|
| `privateModeUpdate` | `{ isPrivate: bool }` | always sent; this is the late-join bootstrap |
| `streamUpdate` | bare string, one of `preparing`, `live`, `reconnecting`, `processing`, `ended` | **only sent if a status exists** — default your UI to "not live" |
| `chatModerationUpdate` | see §7 | only sent if your mute state changed since the ticket was minted |
| `authState` | `{ authenticated, role }` or `{ authenticated:false, reason }` | sent on *connect*, before join |

Join failures arrive on `joinRoomError` (and mirrored on `authzError`):

| `code` | Meaning |
|---|---|
| *(none)* `{ message: "Missing required parameters" }` | `roomId`, `userId` or `userName` missing |
| `HOST_CLASS_MISMATCH` | the ticket's `classId` is not this room. Terminal |
| `IDENTITY_RESERVED` | anonymous socket tried to join as `userId === classId` (the host's reserved id) |

`leaveRoom` takes no payload and sends nothing back. Just disconnect when the user leaves the screen.

---

## 7. Sending chat

All sends share the same gate order: joined → room matches → `userId` matches ticket → rate limit →
not muted. Rate limit is a token bucket per socket per event: **burst 20, then 5 per second**.

**Public message** — `userMsg`:
```json
{ "roomId": "<classId>", "roomName": "<classId>",
  "data": { "type": "text", "message": "hello", "userId": "<ticket.userId>",
            "userName": "<ticket.name>", "timestamp": 1725312000000 } }
```
`type` ∈ `text` | `image` | `pdf` | `poll`. Server overwrites `id`/`_id` (uuid), `userId`, `userName`
and `timestamp`; you cannot forge any of them. Text is broadcast first and persisted after.

**Private message to the teacher** — `privateMsg`. The host's id **is the classId**:
```json
{ "roomId": "<classId>", "roomName": "<classId>", "recipientUserId": "<classId>",
  "data": { "type": "text", "message": "hi", "userId": "<ticket.userId>" } }
```

**Vote** — `voteSubmit`: `{ roomId, pollId, optionId, userId, userName }` → `voteSuccess` to you,
`pollUpdate` to the room.

**Report a user** — `reportUser`: `{ roomId, reportedUserId, reportedUserName }` → `reportUserSuccess
{ reportedUserId, reportId }`. After that you stop receiving that user's messages.

### Send denials

Every denial is emitted on the event's own error channel (`userMsgError`, `privateMsgError`,
`voteError`, `reportUserError`…) **and** on the universal `authzError` channel, same payload:

```json
{ "code": "CHAT_MUTED", "event": "userMsg",
  "message": "You can't send messages in this class right now.", "reasons": ["class"] }
```

| `code` | Meaning | Client action |
|---|---|---|
| `NOT_JOINED` | sent before join | re-run §6 |
| `ROOM_MISMATCH` | `roomId` ≠ joined room | bug — fix payload |
| `IDENTITY_MISMATCH` / `NO_IDENTITY` | payload `userId` ≠ ticket `userId` | bug — use the ticket's id |
| `RATE_LIMITED` | bucket exhausted | back off, keep the draft |
| `CHAT_MUTED` | muted; `reasons` ⊆ `["platform","class"]` | lock the composer (see below) |
| `PRIVATE_MODE` (on `userMsgError` only, no `authzError`) | host turned private mode on; public sends are blocked | show "private mode: message the teacher instead". `privateMsg` still works |
| `INVALID_PAYLOAD` | payload not an object / missing `data` | bug |
| `NOT_HOST` | host-only event | never call host events from the student app |

### Mute state (composer lock)

Three inputs, in increasing authority:

1. The ticket's `chat.canSend` at mint time (baseline).
2. `chatModerationUpdate` pushed to *you* while connected — always the latest truth for this connection:
   ```json
   { "canSend": false, "reasons": ["class"], "version": 1725312000000, "scope": "class", "action": "activated" }
   ```
   Apply only if `version` is higher than the one you hold (they can arrive out of order). `reasons` is a
   *set of scopes* — a lifted class mute on a platform-banned user still yields `canSend: false`.
3. A `CHAT_MUTED` denial on any send — proof you are muted right now; latch the composer closed for the
   rest of this connection.

A reconnect mints a fresh ticket, which resets 2 and 3 to the new baseline. That is the unmute path.
The server never disconnects you on mute.

**Pre-join ban check (optional, legacy shape).** If you want the old `POST /api/v1/user` answer before
opening the socket, call `GET {LMS}/api/users/me/chat-bans` with your login token (POST is accepted too;
any body is ignored). Response: `{ "success": true, "isBannedFromApplication": false, "classIdsBanned": [] }`.
The user is always the token's user. This is only as fresh as your last fetch — the ticket claim and
`chatModerationUpdate` above remain the truth once connected.

---

## 8. Receiving

| Event | Payload | Notes |
|---|---|---|
| `userMsgBroadcast` | `{ id, _id, type, message, userId, userName, timestamp }` | room-wide public message. `type:"image"` adds `roomId`, `fileName`. `type:"poll"` puts the poll object in `message` |
| `privateMsgBroadcast` | `{ id, _id, message, type, userId, recipientUserId, roomId, timestamp, isPrivate:true, isPrivateMessage:true }` | sent to both sides of a DM |
| `messageHistoryResponse` | **bare array** of `{ id, _id, roomId, userId, userName, message, type, timestamp, fileName, isPrivate, recipientUserId, poll? }`, ascending | last 100 public messages. Every field is a **string** except `timestamp` (int) and `isPrivate` (bool) |
| `privateMessageHistoryResponse` | bare array, same item shape, `isPrivate:true` | last 100 of your DMs. **Denied (`NOT_HOST`) on an un-ticketed connection** |
| `getMediaMessagesResponse` | `{ classId, totalCount, mediaMessages:[{ id, message:<url>, userId, userName, timestamp, type:"pdf", fileName, roomId }] }` | PDFs only, newest first. Also broadcast room-wide when someone shares a PDF |
| `messagePinned` | full message object + `isPinned:true` | to you on the read call, room-wide on a host pin |
| `messageUnpinned` / `messageDeleted` | `{ messageId }` | remove from the list |
| `privateModeUpdate` | `{ isPrivate }` | on join and on every host toggle |
| `streamUpdate` | bare string `preparing` \| `live` \| `reconnecting` \| `processing` \| `ended` | on join (if known) and on every transition. `live` ⇒ call `/playback`; `ended` ⇒ leave the live player, recording arrives via `/playback` later (404/425 until then) |
| `streamEndOfBroadcast` | bare string `"1"` | host ended the class |
| `streamKeepAlive` | `{ streamPath, uptime:"<minutes as string>" }` | informational, every 5 min of uptime |
| `chatModerationUpdate` | §7 | to you only |
| `pollUpdate` | `{ "<optionId>": "<count as string>", …, totalVotes: <int> }` | after every vote |
| `pollEnded` | `{ pollId, results }` | when a poll's duration elapses |
| `userBanned` / `userUnbanned` | `{ userId }` | about *other* people; not your own capability |
| `authState` | `{ authenticated:true, role }` / `{ authenticated:false, reason }` | on connect. `authenticated:false` only happens in today's transition mode; for a student app treat it as "reconnect with a fresh ticket" |
| `authzError` | `{ code, event, message, reasons? }` | mirror of every denial. Log all of them |

Things a viewer **never** receives: `userListUpdate` (roster and viewer count are host-only), a join ack,
a typing indicator (none exists), a video URL (use `/playback`).

Host-only events (`privateMode`, `banUser`, `unbanUser`, `deleteMessage`, pin/unpin write, `endStream`,
`stopRecording`, `binarystream`, `updateUrl`, `streamComplete`) are out of scope for the student app and
answer `NOT_HOST` if called.

---

## 9. Acceptance checklist

- [ ] Every connection attempt is preceded by a fresh `GET …/realtime-token` (visible in a proxy such as
      Charles/Proxyman); no ticket is ever reused.
- [ ] Handshake presents the ticket as `auth.token`; path is `/ws/socket.io/`; transport is websocket.
- [ ] `joinRoom` and every payload `userId` use the ticket's `userId`; `userName` uses the ticket's `name`.
- [ ] Bootstrap order is join → pin → media → history → private history, all after `connect`.
- [ ] **Private message history loads** for a logged-in student (this is the visible difference between a
      ticketed and an un-ticketed connection today).
- [ ] Mint 401 triggers the refresh-token ladder; mint 403 shows a not-entitled state; neither loops.
- [ ] `connect_error` with `AUTH_*` re-mints once, then shows an error.
- [ ] Background → foreground reconnects with a fresh mint and rejoins; messages sent by others while
      backgrounded appear via the history reload.
- [ ] A muted student's composer locks on `chatModerationUpdate` / `CHAT_MUTED` and unlocks after a
      reconnect once unmuted, with no app restart.
- [ ] Private mode on: public send shows the private-mode notice; DM to the teacher still works.
- [ ] `streamUpdate: "live"` starts playback through `/playback`; `ended` tears the live player down.
- [ ] Retry loop uses jittered exponential backoff (cap 15 s), never a fixed 1-second retry.

**Test hint:** everything is verifiable against production today — the server accepts both ticketed and
legacy connections, and a correct ticketed connection immediately gets working DM history. The test
account in the Postman collection is entitled to every class.

---

## Where to copy from (web client, `ls` repo, branch `launch/quicktricks-v2`)

| Concern | File |
|---|---|
| Mint client + status → reason mapping | [`lib/api/realtimeToken.ts`](https://github.com/raghav-hranker/ls/blob/launch/quicktricks-v2/lib/api/realtimeToken.ts) |
| Ticket decode → `userId` / `name` / `role` / chat policy | [`lib/room/ticket.ts`](https://github.com/raghav-hranker/ls/blob/launch/quicktricks-v2/lib/room/ticket.ts) |
| Connect / retry state machine (mint-before-connect, `AUTH_*` budget, jittered backoff) | [`lib/room/connectionMachine.ts`](https://github.com/raghav-hranker/ls/blob/launch/quicktricks-v2/lib/room/connectionMachine.ts) |
| Join + bootstrap order, join-error mapping | [`lib/room/socketAuth.ts`](https://github.com/raghav-hranker/ls/blob/launch/quicktricks-v2/lib/room/socketAuth.ts) |
| Mute state: ticket baseline vs live update vs denial latch | [`lib/room/chatPolicy.ts`](https://github.com/raghav-hranker/ls/blob/launch/quicktricks-v2/lib/room/chatPolicy.ts) |
| How it is wired into the UI | [`lib/hooks/useSocket.ts`](https://github.com/raghav-hranker/ls/blob/launch/quicktricks-v2/lib/hooks/useSocket.ts) |

The state machine and the ticket/chat-policy modules are pure TypeScript with no React; they port
directly to Kotlin/Swift/Dart and their unit tests (`lib/room/__tests__/`) spell out every expected
transition.
