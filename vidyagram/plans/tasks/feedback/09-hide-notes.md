# Hide abusive notes

**Type**: AFK
**Blocked by**: 06
**Repo**: backend + admin

## What to build

An admin hides a note; it disappears from every admin list and its rating still counts.

Backend: `PATCH /api/admin/feedback/:id/hide` and `/unhide`, setting or clearing `hiddenAt` and
`hiddenBy` (the admin id). `GET /` omits hidden rows unless `includeHidden=true`. Aggregates ignore
`hiddenAt`. A student's later `PUT` on the same item keeps the hide (the note may have changed, but the
admin decides when to unhide).

Admin: a hide action on each note in the drawer, and a "Show hidden" toggle that reveals them with an
unhide action.

## Acceptance criteria

- [ ] Integration: a hidden row is missing from `GET /` and present with `includeHidden=true`.
- [ ] Integration: `items` count and average are the same before and after hiding.
- [ ] Integration: a student `PUT` on a hidden row keeps `hiddenAt`.
- [ ] Admin component test: hide removes the note from the drawer; unhide restores it.
- [ ] `NO NEW FAILURES` against both baselines.

## User stories covered

- Story 19
