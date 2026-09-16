# Explicit notification mode in the composer

**Type:** AFK
**Status:** done — quicktricks-admin `e22ec6c` on `feat/qhub-pinned-push` (not pushed)
**PRD:** [P-3](../../prd-qhub-pinned-and-push.md) · prototype P1
**Blocked by:** 03 (field names only — build against them)

## Repo

`quicktricks-admin`: `components/admin/MessagesDashboard.tsx` (`BroadcastComposer`, `BroadcastCard`),
`hooks/api/use-chat-messages.ts` (`SendMessagePayload`), `types/message.ts`.

## Today

`isAnnouncement` is a local boolean that (a) prepends `📢 ` to the message text and (b) rides along in
the payload; the only UI is a megaphone icon button and a hint line reading "all subscribers will
receive a push notification" — which is true of every broadcast, announcement or not.

## What to build

1. A notification block in the composer, above the action row, stating the fact: **"Every broadcast
   notifies subscribers"**, then a three-way segmented control:
   - **Notify subscribers** (default) → `{}`
   - **Announcement** → `{ isAnnouncement: true, announcementTitle }`, reveals and re-uses the existing
     title input, labelled as the notification title
   - **Silent** → `{ silent: true }`, with the line "Published to the channel without a push."
   Keep it to one row plus one explanatory line; this composer is already tall.
2. **Stop prepending `📢 `** to the text. The flag is the contract (task 03 persists it).
3. `SendMessagePayload` gains `silent?: boolean`; `MessageData` gains `isAnnouncement?: boolean` and
   `silent?: boolean`, normalized in `normalizeMessage`.
4. `BroadcastCard` reads those fields instead of `msg.text.startsWith("📢")` — falling back to the text
   prefix so pre-migration messages keep their badge — and gains a **Silent** badge (slate, bell-off
   icon) when `silent`.
5. The insights "Send Announcement" quick action selects the Announcement mode instead of flipping the
   old boolean.
6. State the subscriber count, not a device count: "28 subscribers · muted subscribers are skipped."
   No invented reach numbers (PRD: explicitly not building).

## Acceptance

- Publishing in each mode sends exactly the payload above, verified in a vitest on the composer.
- No `📢` reaches the message text from the admin.
- A message published Silent shows the Silent badge in the feed after a refetch.
