# Notify about an existing broadcast (endpoint)

**Type:** AFK
**Status:** `ready-for-agent` (not in the first pass)
**PRD:** [P-5](../../prd-qhub-pinned-and-push.md) · prototype P2
**Blocked by:** 03

## What to build

`POST /api/v1/messages/:id/notify`, admin-authenticated, body `{ title?, body?, audience? }`:

1. Resolve the message and its channel; 404 if either is gone or the message is soft-deleted.
2. Defaults: `title` = channel name, `body` = the message text with any legacy announcement prefix
   stripped — the same derivation `sendMessage` uses, extracted into one helper so the two paths cannot
   drift.
3. Send through `notifyChannelSubscribers` with `type: 'channel_message'` and the message's id, so a tap
   opens the same place as the original push.
4. **Cooldown**: record `lastNotifiedAt` per message and per channel. Reject with 429 and the remaining
   seconds when the channel pushed inside `QHUB_PUSH_COOLDOWN_MINUTES` (env, default 15). The admin UI
   shows this as a warning before the send; the server is what enforces it.
5. Persist a small delivery record on the message: `{ notifiedAt, successCount, failureCount }` from the
   notifier's return, appended. This is also what would let the feed say "Push sent to 24" — the PRD's
   deferred receipt.

`audience` is out of scope until there is a segment model; accept only `'all'` (or omit the field) and
reject anything else rather than silently ignoring it.

## Acceptance

Integration tests: happy path calls the notifier once with the derived title/body; second call inside
the cooldown ⇒ 429 and no notifier call; unknown id ⇒ 404; delivery record appended.
