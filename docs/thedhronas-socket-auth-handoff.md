# thedhronas — fix the live-class socket connection (student website)

**Repo:** `GontinaUdayKumar/thedhronas`, branch `quicktricksbysahilsir-new` (quicktricks tenant)
**File to change:** `src/lib/hooks/useSocket.ts` (+ small touches in `sharedComponents/others/chat/Chat.tsx`)
**Reference implementation (correct code):** the `ls` repo — the teacher/admin live-class UI: <https://github.com/raghav-hranker/ls/tree/launch/quicktricks-v2> (branch `launch/quicktricks-v2`). It already does everything described below.

---

## Why this is needed

The livestream socket server now uses **short-lived signed tickets ("realtime tokens")** minted by the LMS. Every client must fetch a ticket before connecting and present it in the socket handshake. The teacher UI (`ls`) already does this; **the student website does not** — it connects with no credential and a made-up local user id.

Because of that, three things are broken or at risk on the student site:

1. **Private message history is invisible** (the bug reported). The server only returns a student's DM history to a *verified* identity. An unauthenticated socket is denied with `authzError: {code:"NOT_HOST", event:"privateMessageHistory", message:"This action requires a verified identity."}` — so `privateMessageHistoryResponse` never arrives. Fixing auth fixes this automatically; no server change is needed.
2. **Chat bans can be evaded.** A banned student's mute is carried by the ticket; a connection without a ticket has no policy attached.
3. **Hard deadline:** the server will soon be switched to *reject* all un-ticketed connections (`REALTIME_AUTH_REQUIRED=true`). When that happens, the student site's chat and room join **stop working entirely** until this change ships. This fix is the blocker for that switch.

---

## The contract

**1. Mint a ticket (before every socket connection attempt):**

```
GET {LMS_BASE_URL}/api/classes/{classId}/realtime-token
Authorization: Bearer <the student's normal login access token>

200 → { "token": "<JWT>", "expiresIn": 600 }
401 → login session invalid/expired → send the user to re-login
403 → logged in, but not enrolled in this class → show "not enrolled"
```

- `classId` is the same id the site already uses as `uniqueId`/`roomId`.
- The ticket lives 10 minutes and only gates the **handshake** — an established connection is never dropped by ticket expiry. Never reuse a ticket across connection attempts; mint fresh each time (including every reconnect).

**2. Present it in the handshake:**

```ts
io(socketUrl, {
  path: '/ws/socket.io/',
  transports: ['websocket'],
  // called by socket.io on EVERY connection attempt → always a fresh ticket
  auth: (cb) => mintTicket(classId, accessToken).then(t => cb({ token: t.token })),
  reconnection: false, // let your own retry logic own reconnection (see ls)
});
```

**3. Handle handshake rejection** via `connect_error`. `err.data.code` is one of:

| Code | Meaning | Action |
|---|---|---|
| `AUTH_REQUIRED` | no ticket presented | mint and retry |
| `AUTH_EXPIRED` | ticket expired before connecting | mint fresh, retry once |
| `AUTH_INVALID` | bad/foreign ticket | mint fresh, retry once; then surface an error |

**4. Use the ticket's identity, not a local one.** Decode the ticket JWT (no verification needed client-side) and use its `userId` claim in `joinRoom`, `messageHistory`, and `privateMessageHistory` payloads. Remove `generateUserId()` — the random `user-…` localStorage id must go. The server binds the connection to the ticket's identity; a payload `userId` that disagrees with it is rejected (`IDENTITY_MISMATCH`).

**5. (Recommended) Handle the moderation events** so mutes apply live: listen for `chatModerationUpdate` (payload carries `canSend`) and for `userMsgError`/`authzError` with `code:"CHAT_MUTED"` — disable the composer with a "you can't send messages" notice when `canSend` is false.

---

## Where to copy from (ls repo — the working implementation)

Repo/branch: <https://github.com/raghav-hranker/ls/tree/launch/quicktricks-v2>

| Concern | ls file |
|---|---|
| Mint API client (fetch + error classification) | [`lib/api/realtimeToken.ts`](https://github.com/raghav-hranker/ls/blob/launch/quicktricks-v2/lib/api/realtimeToken.ts) |
| Connect/retry state machine: mint-before-connect, fresh ticket per attempt, `AUTH_*` re-mint budget, backoff | [`lib/room/connectionMachine.ts`](https://github.com/raghav-hranker/ls/blob/launch/quicktricks-v2/lib/room/connectionMachine.ts) |
| Join/bootstrap order + blocking-error mapping | [`lib/room/socketAuth.ts`](https://github.com/raghav-hranker/ls/blob/launch/quicktricks-v2/lib/room/socketAuth.ts) |
| How it's wired into a React hook | [`lib/hooks/useSocket.ts`](https://github.com/raghav-hranker/ls/blob/launch/quicktricks-v2/lib/hooks/useSocket.ts) |
| Muted-composer state handling | [`lib/room/chatPolicy.ts`](https://github.com/raghav-hranker/ls/blob/launch/quicktricks-v2/lib/room/chatPolicy.ts) |

The simplest safe path is to port `realtimeToken.ts` + `connectionMachine.ts` nearly verbatim and rewrite the site's `useSocket.ts` around them, keeping the site's existing event listeners.

---

## Acceptance checklist

- [ ] Socket connects with a freshly minted ticket on every attempt (visible in DevTools → WS handshake / Network `realtime-token` calls).
- [ ] `joinRoom` / history requests use the logged-in student's real `user_id` (from the ticket), never a random `user-…` id.
- [ ] **Private message history loads** for a logged-in student (this is the visible bug being fixed).
- [ ] A logged-out or un-enrolled user gets a clear error state, not a silent dead chat.
- [ ] Reconnect after a network drop works (fresh mint, rejoins the room).
- [ ] A muted student's composer locks (and unlocks on unmute) without a page reload.
- [ ] No behavior change for guests on free/public flows you intend to keep — flag any such flow to us **before** shipping, since the server-side auth switch will affect it.

**Test hint:** everything is verifiable today against production — the server currently accepts both old and new connections, and a correct ticketed connection immediately gets working DM history.

---

## Endpoint map — what replaces the removed calls (2026-09-05)

Two calls the website still makes are gone on purpose and 404 on both domains: `POST /api/v1/user`
(legacy ban lookup) and `GET /api/v1/room/{id}` (Room-era room object; the livestream backend now reads
everything from the LMS `Class`). Their data is served by the surfaces below. LMS =
`https://quicktricks.multistreaming.site`, socket = `https://quicktricksocket.multistreaming.site`.

| # | Need (old field) | Call | Notes |
|---|---|---|---|
| 1 | class state (`status`, `isPrivate`, `hostId`) | `GET {LMS}/api/classes/{classId}` — no token | read `data.streamStatus` (`preparing`/`live`/`reconnecting`/`processing`/`ended`) and `data.isPrivate`; **`hostId` is the `classId` itself** (DM `recipientUserId = classId`) |
| 2 | video URL (`streamPath`/`vodPath`) | `GET {LMS}/api/classes/{classId}/playback` + Bearer login token | `data.url` (signed HLS, same for live + VOD), `data.expiresAt`; 404 nothing yet, 425 processing, 403 not enrolled; re-mint on CDN 403 |
| 3 | ban check (`isBannedFromApplication`, `classIdsBanned`) | `GET` or `POST {LMS}/api/users/me/chat-bans` + Bearer login token | same body as the old `/api/v1/user`; user = the token's user, body ignored. Deployed 2026-09-05 |
| 4 | socket ticket (new) | `GET {LMS}/api/classes/{classId}/realtime-token` + Bearer login token | `{ token, expiresIn }`; mint fresh before **every** connect attempt |
| 5 | chat (`messages`, `pinnedMessage`) | socket.io to `{socket}`, path `/ws/socket.io/`, `auth: { token }` | after `joinRoom`: emit `pinMessage {roomId}`, `messageHistory {classId}`, `privateMessageHistory {classId,userId}`; listen `streamUpdate`, `privateModeUpdate`, `chatModerationUpdate` |

Unchanged and still working (probed 2026-09-06): `GET {socket}/api/v1/message/{classId}` → `{ messages }`;
`GET {socket}/api/v1/poll/{classId}` → `{ active, past }`, but **404 when the class has no polls** — treat as
empty, not as an error; `GET {socket}/api/v1/room/{classId}/notes?userId=…` — **400 without the `userId` query**.

thedhronas call sites to repoint: ban check in `pages/user/video-notes-chat/.../index.tsx` (~L308) and
`utils/CommonAPIService.ts` (~L3851); room fetch in `pages/user/video-chat/.../index.tsx` (~L140) and
`pages/user/video-notes-chat/.../index.tsx` (~L208). Full socket detail: `reference/mobile-socket-guide.md`
(written for mobile; the contract is identical for the website).
