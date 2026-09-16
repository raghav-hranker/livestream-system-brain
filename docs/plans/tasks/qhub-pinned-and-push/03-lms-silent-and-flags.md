# `silent` flag + persisted delivery facts

**Type:** AFK
**Status:** done — quicktricks-backend `96bbd3d9a` on `feat/qhub-pinned-push` (not pushed)
**PRD:** [P-3, P-4 and the contract table](../../prd-qhub-pinned-and-push.md)

## Repo

`quicktricks-backend`: `src/controllers/chat/messageController.ts` (`sendMessage`,
`formatMessageResponse`), `src/models/Message.ts` (or wherever the chat message schema lives),
`src/routes/v1/chatMessageRoutes.ts` needs no change.

## Today

`sendMessage` pushes on **every** message: `notifyChannelSubscribers` at the end of the handler, or —
when the message is an announcement — a `Notification` record plus `runNotificationSendJob`. Announcement
is inferred from `isAnnouncement` **or** a `[announcement]` / `📢` / `🔔` prefix on the text
(`messageController.ts:247`). Nothing about the delivery is persisted on the message.

## What to build

1. **Request**: accept `silent?: boolean` on `POST /channels/:id/messages`. When true:
   - persist and socket-broadcast the message exactly as now;
   - **skip** `notifyChannelSubscribers`, skip the `Notification` record and the send job.
   Absent or false ⇒ today's behaviour byte for byte. `silent` wins over `isAnnouncement` if both arrive
   (publishing an announcement nobody is told about is a contradiction the caller asked for; log it).
2. **Persist** on the message document: `isAnnouncement: boolean` (the *resolved* value, flag or legacy
   prefix) and `silent: boolean`. Default both `false` so existing rows read correctly.
3. **Return** both fields from `formatMessageResponse`, so the list, the pins endpoint, the send
   response and the socket `message` payload all carry them. Clients stop sniffing the text prefix.
4. Keep the legacy prefix inference for the mobile/legacy clients. An explicit `isAnnouncement: true`
   always wins; an explicit `false` with a `📢` prefix stays an announcement (the prefix is the older
   contract and other clients still emit it) — record that choice in the handler comment.

## Tests

Extend the chat integration tests (`src/tests/integration/chatPollMessages.integration.test.ts` is the
nearest neighbour; mock `notifyChannelSubscribers`):
- `silent: true` ⇒ message created, notifier **not** called, no `Notification` row, `silent: true` in the
  response;
- no flag ⇒ notifier called once (regression guard on the default);
- `isAnnouncement: true` ⇒ `Notification` created, `isAnnouncement: true` in the response;
- legacy `📢` prefix with no flag ⇒ still an announcement, `isAnnouncement: true` in the response.

## Acceptance

`npm run build` clean; the four tests above green; an old admin build (no `silent` in its payload) is
indistinguishable from today.
