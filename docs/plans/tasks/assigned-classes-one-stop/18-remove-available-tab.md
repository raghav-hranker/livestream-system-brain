# "Add existing classes" at the top, and the Available tab goes

**Type**: AFK
**Blocked by**: #16 (it edits the same view), #17 (the sheet and both endpoints)

## What to build

PRD Round 3, "Adding existing classes from the place", decisions 35 (no-target shape), 37 (no place)
and 38. Admin only, unless something turns up.

- An **"Add existing classes"** button at the top of the outline opens `AddExistingClassesSheet` with no
  place: no scope toggle, every row says "Filed under ‹path›", a class with no topic is disabled
  ("Filed with no topic: give it one in the class form"). Add calls the assign endpoint without
  `target`; the toast says each class went where it is filed.
- Remove the **Available Classes tab** and everything only it used (decision 38). Grep before deleting:
  `AvailableClassesView` (both copies), `AssignClassesContent`, `page-old.tsx`,
  `use-available-classes.ts`, the page's assign handlers. Keep anything another screen imports.
- The page no longer needs a tab switcher; the outline is the page. Keep the course header and Back
  to Courses.

## Acceptance criteria

- [ ] The course screen shows only the outline; there is no Available tab.
- [ ] "Add existing classes" adds each ticked class where it is filed, last; a class with no topic
      can't be picked.
- [ ] No dead imports; `npx tsc --noEmit` has no new errors.
- [ ] Tests: the no-place sheet (disabled no-topic rows, assign body without `target`); delete the
      tests of removed components rather than skipping them.
- [ ] Baselines stay green (adjust the counts in the README if removed test files change them, and
      say so).

## User stories covered

- 47, 48
