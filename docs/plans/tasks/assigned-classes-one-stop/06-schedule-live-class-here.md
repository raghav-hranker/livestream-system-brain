# Schedule live class here

**Type**: AFK
**Blocked by**: #05 — Add recorded class here

## What to build

The live variant of task 05. The same ⋯ menus get **Schedule live class here**, which opens the same
dialog with a start date and time; the end comes from the live-duration default.

- The backend in-place endpoint requires `startDate` when `isLive`.
- Keep whatever the normal class create does for live classes, such as scheduling the class-lifecycle
  notifications.
- Afterwards the row is there and its ⋯ offers Go live (task 01, if it has landed).

## Acceptance criteria

- [ ] A live class is created in place with the chosen start, placed last in its group, and gets the
      same lifecycle side effects as a live class made on the Classes page (integration test).
- [ ] A missing start gives a 400 shown inline.
- [ ] Component test for the live dialog body.
- [ ] Baselines stay green.

## User stories covered

- 17, 18
