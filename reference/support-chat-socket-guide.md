# Support chat socket — frontend handoff

> **Status: LIVE on production since 2026-09-14 14:08 UTC** (backend release `8da46bf3c`). `/support` is
> accepting connections now. The old support events on `/` still work for a transition period (see §6).
>
> Applies to the student app, the student website and the admin dashboard. Channel messages are **not**
> changing. Only support chat moves.

---

## 0. What changes, in one paragraph

Today support chat and channel messages share one socket connection. A support auth failure (for
example, an expired login token) makes the server disconnect that socket, which also kills channel
messages. From now on, support chat gets **its own connection** on the Socket.IO namespace `/support`.
Channel messages stay exactly where they are. The two connections are fully independent: one can fail,
reconnect or be closed without touching the other.

---

## 1. Endpoints

| What | Value |
|---|---|
| Server | Same host as the LMS API, **without** `/api`: `https://backend.quicktricksbysahilsir.com` |
| Namespace | **`/support`** (the channel socket stays on `/`) |
| socket.io path | default `/socket.io/` (unchanged) |
| Transports | `websocket` first, `polling` fallback |
| Auth | login JWT in `auth.token` at connect time (preferred). Native clients may instead send the header `Authorization: Bearer <token>`. No `userId` param |
| REST base | `https://backend.quicktricksbysahilsir.com/api/support-chat` (unchanged) |

---

## 2. Connecting

```js
import { io } from 'socket.io-client';

const supportSocket = io('https://backend.quicktricksbysahilsir.com/support', {
  auth: { token: accessToken },          // user or admin login JWT, with or without "Bearer "
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionDelay: 2000,
});
```

Flutter (`socket_io_client`):

```dart
final supportSocket = IO.io(
  'https://backend.quicktricksbysahilsir.com/support',
  IO.OptionBuilder()
      .setTransports(['websocket', 'polling'])
      .setAuth({'token': accessToken})
      .enableReconnection()
      .enableForceNew()   // REQUIRED: otherwise it may be multiplexed onto the channel socket's connection
      .build(),
);
```

Rules:

- **Keep this a separate socket object** from the channel socket. Never emit `support_*` events on the
  channel socket, and never emit channel events (`join_channel`, `send_message`, …) on this one.
- Open it only when the user is on a support screen, or keep it open app-wide if you show an unread
  badge. Either is fine. Close it on logout.
- The token is checked **once, at the handshake**. You do not need to send it with each event.

### Auth failures

If the token is missing, invalid, expired or the session was logged out, the connection is refused with
a `connect_error`. The channel socket is **not** affected.

```js
supportSocket.on('connect_error', (err) => {
  // err.message === 'Unauthorized'
  // → refresh the login token, set supportSocket.auth = { token: newToken }, then supportSocket.connect()
});
```

Do not retry in a tight loop with the same token: refresh it first, or stop and show "log in again".

---

## 3. Joining

The server puts a **user** into their own conversation room automatically on connect. You do not need to
emit anything to start receiving messages. You'll get:

| Event (server → client) | Payload |
|---|---|
| `support_joined` | `{ userId }` for a user · `{ admin: true, userId: string \| null }` for an admin |

**Admins only:** you're automatically in the "all conversations" inbox room. To also get typing/read
events for the conversation you have open, emit this whenever the selected user changes (and again after
every reconnect):

```js
supportSocket.emit('support_join', { userId: selectedUserId });
```

---

## 4. Events

### Client → server

| Event | Payload | Who | Notes |
|---|---|---|---|
| `support_message_send` | `{ message, type?, fileUrl?, userId? }` | both | `type` ∈ `text` \| `image` \| `file` (default `text`). `message` must be non-empty. `userId` is **required for admins** (the conversation to reply into) and **ignored for users**. |
| `support_typing_start` | `{ userId? }` | both | admin must pass `userId` |
| `support_typing_stop` | `{ userId? }` | both | admin must pass `userId` |
| `support_mark_read` | `{ userId? }` | both | marks the other side's messages as read; admin must pass `userId` |
| `support_join` | `{ userId }` | admin | follow a conversation (see §3) |

### Server → client

| Event | Payload | Meaning |
|---|---|---|
| `support_message` | `SupportMessage` (below) | A new message in a conversation you can see, **including your own** (from socket *or* REST). Dedupe by `id`. |
| `support_message_sent` | `SupportMessage` | Ack to the sender only, for the message it just sent over the socket. Use it to replace the optimistic bubble. |
| `support_typing_start` / `support_typing_stop` | `{ userId, senderType: 'user' \| 'admin' }` | Other side is typing. Also clear the indicator yourself after ~5 s in case the stop event never arrives. |
| `support_read` | `{ userId, readerType: 'user' \| 'admin' }` | The `readerType` side read the conversation. Update ticks / refetch unread counts. |
| `support_error` | `{ msg }` | A single action failed (e.g. empty message). **The connection stays open.** Show the error, don't reconnect. |

### `SupportMessage`

```ts
{
  id: string;
  conversationId: string;
  userId: string;                 // the student the conversation belongs to
  senderId: string;
  senderType: 'user' | 'admin';
  message: string;
  type: 'text' | 'image' | 'file';
  fileUrl: string | null;
  readByUserAt: string | null;    // ISO date
  readByAdminAt: string | null;   // ISO date
  createdAt: string;              // ISO date
  updatedAt: string;
}
```

---

## 5. REST (unchanged, for history and fallbacks)

All take `Authorization: Bearer <token>`. Responses are `{ state, msg, data }`.

| Method + path | Who | Use |
|---|---|---|
| `GET /api/support-chat/messages?limit=50&before=<ISO date>` | user | load history; page backwards with `before` = oldest `createdAt` you have |
| `POST /api/support-chat/messages` `{ message, type?, fileUrl? }` | user | send without a socket; the message is still pushed to everyone via `support_message` |
| `PATCH /api/support-chat/read` | user | mark read |
| `GET /api/support-chat/admin/conversations?page=1&limit=25&search=` | admin | inbox list |
| `GET /api/support-chat/admin/messages?userId=…&limit=&before=` | admin | one thread |
| `POST /api/support-chat/admin/messages` `{ userId, message, type?, fileUrl? }` | admin | reply |
| `PATCH /api/support-chat/admin/conversations/:userId/read` | admin | mark read |

**On (re)connect, refetch the history over REST.** The socket only delivers what happens while you're
connected, so anything sent during a disconnect has to come from REST.

---

## 6. Migration checklist

- [ ] Create a **second** socket to `…/support` with `auth: { token }` (Flutter: `enableForceNew()`).
- [ ] Move every `support_*` `emit` and `on` from the channel socket to the support socket.
- [ ] Users: stop emitting `support_join` on connect (harmless if you still do, just unnecessary).
- [ ] Admins: emit `support_join { userId }` on connect **and** whenever the open conversation changes.
- [ ] Handle `connect_error` → refresh the token → reconnect (§2).
- [ ] Refetch history over REST on every `connect`.
- [ ] Dedupe `support_message` by `id`.
- [ ] Remove the `token` from the channel socket if it was only there for support.
- [ ] Test: log in, then expire or log out the session elsewhere. Channel messages must keep arriving while
      support shows "log in again".

The old support events on the default namespace keep working for a transition period so older app builds
don't break. They will be removed once the new build is released, and we'll tell you the date.
