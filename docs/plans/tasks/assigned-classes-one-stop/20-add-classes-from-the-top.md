# "Add classes ▾" at the top, and "Where" in the top sheet

**Type**: AFK
**Blocked by**: — (round 3 is merged)

## What to build

PRD Round 4 decisions 39, 40 and 41. Admin only (the in-place endpoint already accepts any valid
section › topic › subtopic chain).

- **"Add classes ▾"** replaces the top "Add existing classes" button in `AssignedClassesView.tsx`
  (decision 40): Add recorded classes · Schedule live class · Add existing classes. It shows on empty
  and non-empty courses; the empty-state text points to it.
- **Course-level place picker** (decision 39): `AddClassInPlaceTarget` gains a `course` level. The
  dialog asks for Section first (`/sections/dropdown`), then Topic and Subtopic as it already does
  from a section header, including the round 2 "new subtopic typed in place". Lift the picker out of
  `MoveToDialog.tsx` into a shared component and use it in both; no third copy. Recorded mode keeps
  the one/several-videos shapes from tasks 15–16; live mode works the same way.
- With an empty place there is no series suggestion: the title starts empty (or from the file name)
  and the teacher comes from the course faculty.
- **"Where" in the top sheet** (decision 41): `AddExistingClassesSheet` with no place shows "Where
  each is filed" (default) | "In a place I choose". The second turns into the shared picker; once a
  topic is chosen the sheet behaves exactly like a header-opened one (target sent, `unpickableReason`
  with a place, the footer note). The no-place, no-topic row shows one line only: "No topic of its
  own: choose a place above to add it" (drop the duplicate "Filed under no topic").
- Fix the dialog description: "It goes last there and is active straight away." only in live mode;
  recorded mode says "It goes last there."

## Acceptance criteria

- [ ] On a course with no classes, "Add classes ▾ → Add recorded classes" lets you pick a section,
      topic and subtopic and creates the class there; the outline then shows that section.
- [ ] Same for Schedule live class.
- [ ] From the top sheet, "In a place I choose" + a topic makes a no-topic class pickable and adds it
      there; "Where each is filed" behaves as today.
- [ ] The no-topic row reads one line, not two.
- [ ] Move to… still works with the shared picker.
- [ ] Tests: dialog from the course level (section → topic → subtopic, body sent), the menu items,
      the sheet's Where switch (body with target, no-topic row pickable with a place, one-line
      reason without), the live/recorded description. Baselines stay green.

## User stories covered

- 54, 55
