# 09 Rename everywhere

**Type**: AFK
**Blocked by**: 08
**Feature**: C

## What to build

The Rename dialog's "Everywhere" option (board D). Add the module call "rename everywhere (class, title,
clear this course's name?)". It writes `Class.title`, adds the previous title to `oldTitles`, and
recomputes. Course-only names elsewhere are kept. Started from a course with its own name, the dialog
can also clear that course's name in the same call.

The class form's title edit (`PUT /api/classes/:id`) goes through rename everywhere, so old titles
are kept whichever screen changes the title. Renaming back to an old title removes it from `oldTitles`
and adds the replaced title. Add an admin-only route for "Everywhere" or reuse the class update route.
Say which.

## Acceptance criteria

- [ ] Rule unit tests:
  - renaming back swaps the titles and leaves no duplicate
  - `oldTitles` never contains the current title or a shown name
- [ ] Integration tests:
  - A rename everywhere keeps another course's own name.
  - The class form title edit adds an old title.
  - The clear-this-course option drops this course's name.
- [ ] Suites print NO NEW FAILURES.

## User stories covered

35, 36, 39, 41, 51, 52
