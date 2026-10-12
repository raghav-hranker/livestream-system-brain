# 11 "Also known as" chips

**Type**: AFK
**Blocked by**: 09
**Feature**: C

## What to build

The class read used by the class form returns `otherNames: [{ name, source: 'oldTitle' | 'course',
courseId?, courseTitle?, removable }]`. The class form shows them as "Also known as" chips (board E). Each
chip says "old title" or the course title. Only removable chips have an ×.

Add the module call "remove old title (class, name)" behind an admin-only route. It refuses a name that
is the title or that a placement shows (409), and it recomputes. When a course goes back to the class
title, its chip disappears.

## Acceptance criteria

- [ ] Integration tests:
  - Removing an old title drops it from `oldTitles` and `searchNames`.
  - Removing a shown name returns 409.
  - The route returns 401 without an admin token.
- [ ] The chip list renders sources, and × only on removable chips (component test).
- [ ] Suites print NO NEW FAILURES.

## User stories covered

47–50, 53
