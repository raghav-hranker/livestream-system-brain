# The Pinned tab

**Type:** AFK
**Status:** done — quicktricks-admin `e22ec6c` on `feat/qhub-pinned-push` (not pushed)
**PRD:** [P-2](../../prd-qhub-pinned-and-push.md)

## Repo

`quicktricks-admin`: `components/admin/MessagesDashboard.tsx`, `hooks/api/use-chat-messages.ts`.
Server side already exists: `GET /api/v1/channels/:id/pins` → `{ data: { pins: [...], count } }`,
sorted `pinnedAt` desc, same message shape as the feed (`getPinnedMessages`).

## What to build

1. `usePinnedMessages(channelId)` in `use-chat-messages.ts`, normalized through the existing
   `normalizeMessage`, keyed `['chat-messages', 'pins', channelId]`. `usePinMessage`/`useUnpinMessage`
   invalidate it alongside `messageKeys.all`.
2. A segmented control in the feed header, after the subscriber count: `All broadcasts (n)` /
   `Pinned (n)`, the pinned count in an amber pill. State is local (`view`), not routed.
3. The Pinned view replaces the feed body (header, composer and insights stay):
   - an amber summary strip: "n pinned broadcasts", one line on what subscribers see, **Unpin all**;
   - one row per pin: type icon, title/snippet (2 lines), `Pinned <date> by <sender>`, view count, poll
     vote count when a poll, **Show in timeline** and **Unpin**;
   - empty state: "Nothing pinned yet — pin a broadcast from the timeline."
4. **Show in timeline** switches to the All view and scrolls to `#msg-<id>` (the ids already exist), the
   same mechanism the insights panel uses.
5. **Unpin all** confirms through the existing `AlertDialog` pattern, then fires the unpin mutations.
6. Order is server order (`pinnedAt` desc). Leave a `pinOrder` gap: no drag handle in v1.

## Acceptance

- The tab count matches the number of amber-railed cards in the timeline and updates after a pin/unpin
  from either surface, including one pushed over the socket by another admin.
- Show in timeline lands on the right card with the All view active.
- Unpin all empties the tab and clears every badge in the timeline.
