# Q-Hub: the app keeps showing deleted broadcasts (app-side bug)

**Date:** 2026-09-18 · **Surface:** mobile app, Q-Hub channel feed · **Backend:** verified correct, no change needed

## Symptom

A broadcast deleted from the admin Q-Hub keeps showing in the app indefinitely.

## What the server does

Deletion is a **soft delete** (`quicktricks-backend` `src/controllers/chat/messageController.ts`):
the document stays with `isDeleted: true` + `deletedAt`, so the change can be reported. Clients
learn about it in exactly two ways:

1. **Delta sync** — `GET /api/v1/channels/{id}/messages?since=<ISO>` returns
   `data.deletedIds: string[]` (every message soft-deleted after `since`), alongside
   `data.messages` (created or updated after `since`).
2. **Socket** — `message_deleted { id, chatId }` to the channel room, for connected clients.

Deleted messages are filtered out of the plain history page (`?limit=N`), the pinned list, and
the admin. A deleted message is never *sent* again — its id is only ever announced.

## Evidence that the server reports it correctly

Replaying the app's own request verbatim (prod, 2026-09-18 00:0x IST):

```
GET /api/v1/channels/6a71d944a7507c01f2c3f578/messages
    ?userId=6a7eb7ce543dd0b9881e0a27&since=2026-09-17T15%3A34%3A46.493Z

deletedIds: ['6aac0b94783a395eb04fde07', '6aac07bb035db786925ba486',
             '6aabfe93baca7b89a154db5e', '6aabe4e5d661e89e4b721b57']
```

One second after that sync the app posted `/api/v1/messages/6aabfe93…/view` and
`/api/v1/messages/6aabe4e5…/view` — i.e. it still holds and renders two of the ids it was just
told were deleted.

## Bug 1 — `deletedIds` is not applied

The sync handler merges `data.messages` into the local cache but never removes the ids in
`data.deletedIds`. Fix: on every delta response, delete those ids from the local store (and from
the rendered list) before/after merging `messages`.

## Bug 2 — `since` is derived from the newest message, not a sync cursor

Every sync for hours sent the identical `since=2026-09-17T15:34:46.493Z`, which is the timestamp
of the newest message the device holds — not the time of the last sync.

Why this bites even after Bug 1 is fixed: `deletedIds` is computed as
`deletedAt > since`. Delete a broadcast, then post a new one. A device that was offline for both
comes back, syncs with `since` = the *new* message's timestamp, which is **later** than the
deletion's `deletedAt` — so that deletion is never reported to it, and the message is stranded in
its cache permanently.

Fix: persist a sync cursor — the server time of the last successful sync — and send that as
`since`. Keeping it slightly behind (a few seconds of overlap) is safe: both `messages` and
`deletedIds` are idempotent to reapply.

## Not a bug: a hand-deleted document

Removing a message document directly in MongoDB (rather than deleting via the admin) leaves
nothing to report — `deletedIds` can only list rows it finds — so every incremental client keeps
its cached copy forever. Repair for an already-removed message: re-insert it as a tombstone with
its original `_id` and `chatId`, `isDeleted: true`, `deletedAt: <now>`. At the DB level, delete
means:

```js
db.messages.updateOne({ _id: ObjectId("…") },
  { $set: { isDeleted: true, deletedAt: new Date(), isPinned: false, pinnedAt: null } })
```

## Server-side option (not recommended on its own)

`formatMessageResponse` does not serialize `isDeleted`, and delta sync's `messages` array excludes
deleted rows. We could include tombstones there flagged `isDeleted: true`, giving merge-based
clients a second way to learn of a deletion. Rejected for now: a client that ignores `deletedIds`
may equally ignore the flag, and would then *render* a deleted message it never had. The app
applying `deletedIds` is the correct fix.

## Update 2026-09-18 — tombstoning did not clear the app (Bug 1 confirmed again)

`6aabfe93…` and `6aabe4e5…` were tombstoned on 2026-09-17 ~21:30 IST and the server has listed
them in `deletedIds` on every sync since (re-verified 2026-09-18 by replaying the app's request).
The app still posted `/view` for both at 00:00 and 00:02 IST on 2026-09-18 — two and a half hours
after the server started reporting them deleted. The server side is exhausted for these two; only
the app applying `deletedIds` (or handling `message_deleted`, or a cache clear / reinstall) removes them.

A third ghost surfaced in the same logs: **`6aac089a035db786925ba553`** (created 2026-09-17 21:04
IST), `/view` → 404 on every attempt through 00:00 IST 2026-09-18. It was never tombstoned, so it is
not in `deletedIds` at all. Repair script: `reference/scripts/qhub_repair.js` in this repo — copy it
into the prod checkout (`/var/www/backend.quicktricksbysahilsir.com/quicktricks-backend`) and run it
there with node (report-only by default, `--commit` to write): it tombstones missing ids and broadcasts
`message_deleted {id, chatId}` to the channel room through the same Redis adapter the admin DELETE
uses — the one server-side lever left, effective only if the app handles that socket event.

Older 404 ghosts from 2026-09-06/07 (`6a9581…`, `6a957a…`, `6a956e…`, `6a9564…`, `6a9563…`) stopped
being polled, so they were presumably cleared by an app reinstall — which is also the quickest
user-side check: a fresh install cannot show a message the server never sends.

## Update 2026-09-18 (later) — the live `message_deleted` event is delivered and is not enough

The mobile developer's position: a delete needs "an event" that refreshes the phone. That event
exists and was delivered. Traced on prod (pm2 log times are **IST**; the phone's chat socket
connects to the API process itself, so no Redis hop is involved and zero broadcast errors are logged):

| Message | Created | On the phone? | Admin `DELETE` | Phone socket joined to the room at that moment | Afterwards |
|---|---|---|---|---|---|
| `6aac3f54…` (text) | 00:58:20 | yes (`/view` 00:59:03) | 00:59:15 | yes (`uqXxfQbJ…`, joined 00:58:25, left 00:59:59) | never rendered again |
| `6aac3d2c…` (image + text; edited 00:55, pinned/unpinned 00:59) | 00:49:09 | yes (`/view` ×5) | 01:00:25 | yes (`hEVVj_7u…`, joined 01:00:02, left 01:00:47) | rendered again on the next Q-Hub open at 01:41:53 and every open since (12:29, …) |

Both deletes fired `message_deleted { id, chatId }` into the room while the phone was in it. The first
message vanished, so the app does listen for the event. The second came back on the next cold open,
**one second after a delta sync whose response listed it in `deletedIds`** (`since=2026-09-17T19:30:14Z`,
then `since` jumped to `19:30:29.820Z` = the timestamp of the newest message, Bug 2 exactly).

Consistent explanation: the socket event removes the message from the in-memory list only; a message
that had already been persisted by an earlier sync (`6aac3d2c…`, synced at 00:5x) is rehydrated from the
local store on the next open, and the sync that follows ignores `deletedIds`, so nothing removes it
again. `6aac3f54…` lived for 55 s, arrived by socket and was never persisted, which is why it stayed gone.

Conclusion for the app team: the live event is a nicety for phones that happen to be in the room; the
**only** delete path that reaches every device is `deletedIds` on sync (plus a real sync cursor). Nothing
server-side changes this — the server already emits the event and reports the ids.

Reproduction: post a broadcast, sync the phone (background it or wait for a sync), then delete it from
the admin while the phone is in the channel. It disappears. Kill the app, reopen Q-Hub: it is back, and
the sync response the app just received lists its id in `deletedIds`.

**Status 2026-09-18 (evening IST):** user reports deleted images now clear on the phone. Cause of the
change not confirmed from our side (app update vs. reinstall). Still open: the hand-deleted
`6aac089a035db786925ba553` has no tombstone, so even a fixed app cannot be told about it — run
`reference/scripts/qhub_repair.js --commit` if it is still visible anywhere.
