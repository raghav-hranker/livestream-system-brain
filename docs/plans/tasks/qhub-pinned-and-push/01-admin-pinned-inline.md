# Pinned broadcasts stay in the timeline

**Type:** AFK
**Status:** done — quicktricks-admin `e22ec6c` on `feat/qhub-pinned-push` (not pushed)
**PRD:** [P-1](../../prd-qhub-pinned-and-push.md)

## Repo

`quicktricks-admin`, `components/admin/MessagesDashboard.tsx` (`BroadcastCard`, the feed render block).

## The defect

`pinnedMessages` are rendered in a hoisted block above every date group and **removed** from
`unpinnedDateGroups`, and every chronological card is rendered with a literal `isPinned={false}`. A
pinned broadcast therefore never appears in the timeline: no badge, no unpin, and a scroll to the top to
find it.

## What to build

1. Delete the hoisted "Pinned (n)" section and `unpinnedDateGroups`. Group **all** messages by date
   (`groupByDate(filteredMessages)`) and pass the real `pinnedIds.has(msg.id)` to each card.
2. `BroadcastCard` keeps its amber treatment for a pinned card (left rail + tinted surface) and gains an
   always-visible **Unpin** button in the card header, left of the `⋮` trigger. The `⋮` menu keeps its
   pin/unpin item — it is the discoverable path for unpinned cards.
3. Unpinned cards reveal a single icon **Pin** button on hover (`group-hover`), same slot. Never a
   `div` with `onClick`: a real `<button>` with `aria-label`.
4. Unpinning must not move the card. The card stays where it is in the date group and loses its rail,
   badge and Unpin button in place.

## Acceptance

- Two pinned broadcasts from different days appear once each, in their own date groups, with the badge.
- Unpin from the timeline clears the badge without scrolling the feed; the toast and the existing
  optimistic `pinnedIds` update still work, including the socket `message_pinned` / `message_unpinned`
  path from another admin session.
- Vitest green.
