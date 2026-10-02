# Row and bulk cleanup: Go live into ⋯, arrows out, Bulk edit trimmed

**Type**: AFK
**Blocked by**: — (round 1 tasks 01–07 are merged)

## What to build

PRD Round 2 decisions 17, 18 and 23. Admin only.

**Go live into the row ⋯ menu.**
- Move Go live from `OutlineRowActions` into `OutlineRowMenu` as the **first** item, styled as the
  menu's one emphasised item: red dot, "Go live", sub-line "Opens the class screen as the streamer".
- `useGoLive` (`hooks/use-go-live.ts`) is unchanged; `userId = classId` stays.
- Drop the row button and `goLiveSolid` / `isGoLiveSolid` (`lib/class-video-status.ts`) and their
  tests. The status pill stays.
- The Classes list and the live schedule keep their Go live buttons.

**Arrows out.**
- Remove the per-row ▲▼ buttons (`AssignedClassesView.tsx`, around `classMoveOrder`) and any code
  only they used.
- The drag handle becomes a real `<button>`: focusable, `aria-label` "Reorder ‹title›: drag, or press
  Space then arrow keys", and dnd-kit's announcements on. `KeyboardSensor` is already registered
  (`OutlineSortable.tsx:87-89`); check Space + arrows reorders a class within its group.
- Touch: make sure a class row can be dragged on a phone (add `TouchSensor` or a pointer activation
  constraint with a short delay, so a scroll is not a drag).
- Section and topic "Move up / Move down" menu items stay.

**Bulk edit trimmed** (`components/admin/assign-classes/BulkEditSheet.tsx`, its page handler
`app/admin/courses/assign-classes/page.tsx:665-720`).
- Keep **Start date & time** and **Free in this course**.
- Remove the main category, category, section, topic and subtopic name fields and their payload
  keys. Add one line: "To put these classes under another topic, use Move to… or drag them." (Move
  to… arrives with task 10; until then the line has no link.)

## Acceptance criteria

- [ ] No class row shows a Go live button; the row ⋯ menu opens with Go live first, and it opens ls
      as before.
- [ ] No ▲▼ on class rows. Keyboard reorder works through the handle; touch drag works at phone width.
- [ ] Bulk edit shows only start date & time and Free, and sends only those.
- [ ] Tests: the menu item calls `useGoLive`; Bulk edit's payload has no name keys.
- [ ] Baselines stay green.

## User stories covered

- 25, 26, 35
