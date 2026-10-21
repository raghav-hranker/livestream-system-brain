# Audience field + Default mode round-trip

**Type**: AFK
**Blocked by**: None — can start immediately

## What to build

The tracer bullet. The Notification gains the optional `audience` field
(`{ mode: 'default' | 'advanced', rules: [...] }`, PRD "Schema — Notification") and the
**audience settings validation** module (PRD module 3) in its first form: a missing `audience` or
missing mode normalises to Default; `advanced` is rejected for now with a clear 400 (it arrives in 02).

Default mode flows through the **audience rule compiler** (PRD module 2) path, which for now compiles
Default to exactly today's rule — exclude the promoted plan's active holders — so the send loop,
scheduler, resend and audience estimate all go through one path that later tasks extend. Behaviour
for every existing notification is byte-for-byte unchanged.

The admin sends `audience: { mode: 'default' }` for Subscription Plan Broadcast on create, schedule
and estimate, and the notification history/detail shows "Audience: Default" for plan broadcasts.

## Acceptance criteria

- [ ] `POST /api/notifications` and the scheduled-notification update accept and persist `audience` for a Subscription Plan Broadcast; a request without it is stored/treated as Default.
- [ ] The existing plan-broadcast unit tests pass unchanged; a new unit test proves Default compiles to "exclude the promoted plan's active holders" and that a missing `audience` behaves identically.
- [ ] Validation unit tests: missing `audience` ⇒ default; missing mode ⇒ default; unknown mode ⇒ 400.
- [ ] Admin sends `{ mode: 'default' }` for plan broadcasts; history shows the mode. No other notification type's payload changes.
- [ ] Deployable backend-first: the currently live admin (no `audience`) keeps working against the new backend.

## User stories covered

- Story 1: Default stays a one-picker task.
- Story 28: pre-existing and already-scheduled notifications behave as Default.
- Story 31 (mode part): backend rejects an invalid mode.
- Story 32: backend ships first, missing mode ⇒ Default.
