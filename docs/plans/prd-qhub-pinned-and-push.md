# PRD — Q-Hub: pinned messages you can reach, push you can see

**Status:** `ready-for-agent`
**Date:** 2026-09-17
**Repos:** `quicktricks-admin` (admin control plane), `quicktricks-backend` (LMS + Q-Hub chat API, `/api/v1`)
**Prototypes:** [Design canvas](https://claude.ai/artifact/KJmt1hCofiZbkw3m1mXMgG) — A1/A2 pinned, B1/B2 rejected bar, P1/P2 push
**Tasks:** [`tasks/qhub-pinned-and-push/`](./tasks/qhub-pinned-and-push/README.md)

## Why

Two complaints from the admin using **Broadcast → Messages** on `admin.quicktricksbysahilsir.com`:

1. **Pinned broadcasts are unreachable.** You scroll to the very top of the feed to see them, the
   chronological copy shows no pinned badge, and you cannot unpin while scrolling past a message.
2. **Push notifications are invisible.** The admin cannot tell whether publishing will notify 28 people,
   cannot phrase the alert, and cannot choose *not* to notify.

Both are real, and the cause of (1) is one design decision in `components/admin/MessagesDashboard.tsx`:

```
pinnedMessages        → rendered in a hoisted "Pinned (n)" block above every date group
unpinnedDateGroups    → the timeline, with the pinned ones REMOVED
<BroadcastCard … isPinned={false} />   ← every chronological card, unconditionally
```

Pinned broadcasts are therefore not in the timeline at all. The badge and the pin item in the `⋮` menu
exist; they render only in the hoisted block. Nothing is broken in the API.

For (2), the surprise is the opposite: **push already works and is always on.** Every
`POST /api/v1/channels/:id/messages` calls `notifyChannelSubscribers` (per-device, mute-aware,
`src/controllers/chat/messageController.ts:325`). "Announcement mode" does not turn push on — it swaps
the title/body and routes through a `Notification` record. The admin's only control today is a heuristic:
the composer prepends `📢 ` to the text and the server re-reads that prefix
(`messageController.ts:247`). An admin who happens to type 📢 silently changes how 28 phones buzz.

## What we are building

### Pinned

- **P-1 — Pinned broadcasts stay in the timeline.** No hoisted block. A pinned card renders in its
  chronological place with the amber rail, the `Pinned` badge, and an **Unpin** button that is visible
  without opening `⋮`. Unpinned cards reveal **Pin** on hover. This is the whole of complaint (1).
- **P-2 — A Pinned tab.** A segmented control in the header, `All broadcasts (n) / Pinned (n)`, where the
  count is itself the at-a-glance answer. The tab lists pinned broadcasts newest-pinned first with type,
  snippet, pin metadata, **Show in timeline**, **Unpin**, and **Unpin all**. It is backed by the existing
  `GET /api/v1/channels/:id/pins`.
- **Rejected: the Telegram-style pinned bar** (prototypes B1/B2). It costs 54px of permanent height in a
  pane already squeezed between a 60px header and a ~180px composer, and a jump-to-pin ticker is a
  *reader* affordance. Its home is the student app (`thedhronas` / the Flutter client), not the curation
  tool. Once P-1 lands, the bar's remaining win is the scroll it saves, which the tab's count and
  **Show in timeline** already cover.
- **Not in v1: manual pin ordering.** Order is `pinnedAt` desc, which is what the server already returns.
  Drag-to-reorder needs a `pinOrder` field on `Message` and a reorder endpoint; the tab is built so the
  handle can be added later without moving anything else.

### Push

- **P-3 — The notification mode is explicit.** The composer states what will happen and offers three
  modes: **Notify subscribers** (today's behaviour, the default), **Announcement** (custom title, routed
  through the `Notification` record as today), **Silent** (publish to the channel, send no push). The
  admin stops writing `📢 ` into the message body; the flag on the wire is the truth.
- **P-4 — The message carries its own delivery facts.** `isAnnouncement` and `silent` are persisted on
  the `Message` and returned by the API, so the feed can badge a broadcast **Announcement** or **Silent**
  from data instead of sniffing its first character. This is what makes P-3 safe: today the only record
  of "this was an announcement" is an emoji in the text.
- **P-5 (later) — Notify about an existing broadcast** (prototype P2). A new
  `POST /api/v1/messages/:id/notify`, cooldown-aware, for the "quiz closes tonight" re-ping. Specced,
  not built in this pass.

### Explicitly not building

- **Reach counts** ("24 of 28 devices"). Mute is evaluated per batch at delivery time
  (`channelPushTargets` + `mutedChannelUsers`), so a truthful pre-send number costs a scan of every
  subscriber's device tokens. The prototypes show placeholder numbers; the shipped UI states the
  subscriber count and that muted subscribers are skipped, and nothing it cannot prove.
- Per-broadcast delivery receipts ("Push sent to 24"). Same reason — `notifyChannelSubscribers` returns
  counts but nothing persists them against the message. Worth a follow-up; out of scope here.

## Contract changes

One request field and two response fields on the Q-Hub chat API, all **absent-means-today**:

| Direction | Field | Meaning |
|---|---|---|
| `POST /channels/:id/messages` request | `silent?: boolean` | `true` ⇒ persist and socket-broadcast the message, send no FCM push and create no `Notification`. Absent/`false` ⇒ exactly today's behaviour. |
| message response (list, pins, send, socket) | `isAnnouncement: boolean` | Persisted from the request flag or the legacy text-prefix inference, so clients stop re-deriving it. |
| message response | `silent: boolean` | Whether this broadcast was published without a push. |

The server keeps inferring announcements from a `[announcement]`/`📢`/`🔔` prefix for the mobile and
legacy clients; the admin simply stops producing that prefix. An explicit `isAnnouncement` always wins.

## Acceptance

1. A pinned broadcast appears once, in its date group, with the badge and a visible Unpin; unpinning from
   the timeline removes the badge in place and does not scroll the feed.
2. `Pinned (2)` in the header opens a list of exactly the two pinned broadcasts; Show in timeline scrolls
   to the card; Unpin all empties the tab and every badge in the timeline clears.
3. Publishing with **Silent** produces a message in the channel and no device notification; publishing
   with **Notify** behaves byte-for-byte as it does today; **Announcement** still creates the
   `Notification` record and uses the title.
4. No broadcast text sent by the admin contains a `📢` the admin did not type.
5. Existing messages (pre-migration, announcement-by-prefix) still render the Announcement badge.
