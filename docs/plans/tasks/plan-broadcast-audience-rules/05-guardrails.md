# Guardrails: empty row, all-three hint, zero-count block

**Type**: AFK
**Blocked by**: #02 — Advanced mode, single row, end to end

## What to build

The form and the API refuse the easy mistakes. Notifications have no cancel, so these are the safety net.

- A row with **no** checkbox ticked shows a per-row error and blocks save; validation rejects it too.
- A row with **all three** ticked is allowed but shows the hint "This row matches every user — for all
  buyers of this plan tick Active + Expired".
- **Send / Schedule are disabled** while the count is 0 or still loading.
- The backend **refuses to persist** a Subscription Plan Broadcast (create, schedule, scheduled update)
  whose exact audience count is 0, with a clear 400.

## Acceptance criteria

- [ ] Validation unit test: a row with an empty states array ⇒ rejected.
- [ ] Admin component tests: empty-row error shown and save blocked; all-three hint shown; Send/Schedule disabled at count 0 and while loading.
- [ ] Backend test: creating a plan broadcast whose audience resolves to zero token users ⇒ 400, nothing saved, nothing sent.

## User stories covered

- Story 9: no empty rows.
- Story 10: all-three hint.
- Story 20: Send/Schedule blocked at zero.
