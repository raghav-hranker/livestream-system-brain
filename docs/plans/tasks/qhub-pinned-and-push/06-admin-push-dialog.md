# Send-push dialog for a published broadcast

**Type:** AFK
**Status:** `ready-for-agent` (not in the first pass)
**PRD:** [P-5](../../prd-qhub-pinned-and-push.md) · prototype P2
**Blocked by:** 05

## What to build

1. A **Send notification** item in the `BroadcastCard` `⋮` menu, opening a dialog: the target broadcast
   summary, notification title, notification text (prefilled from the broadcast, counter at 120), and
   the cooldown warning when the channel pushed recently.
2. `useNotifyMessage(messageId)` against `POST /api/v1/messages/:id/notify`; surface the 429 as the
   cooldown message with the remaining minutes rather than a generic error toast.
3. `DialogContent` is a grid — give it `grid-cols-1` so a long broadcast snippet cannot widen every row
   (the trap already hit `SingleVideoUploadDialog` and `ShortVideoUploadDialog`).
4. After a successful send, show the delivery counts the endpoint returns; do not invent a reach
   estimate before sending.

## Acceptance

Dialog renders in the mobile harness at 390px without horizontal scroll; a 429 shows the cooldown copy;
a success updates the card's footer from the response.
