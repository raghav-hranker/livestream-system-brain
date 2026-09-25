# Find a class by its course's title for it

**Type**: AFK
**Blocked by**: #01 — Classes section, end to end (guest view)

## What to build

A class also matches when an **active placement's** own title (`CourseClass.title`) matches the
query, even though `Class.title` doesn't (D5). `apxTitle` is never searched. Titles are almost
always the same, so this is a fallback: one class appears once, however many of its titles
match. It ranks by its best-matching title under the same title-search ranking, and newest class
still breaks ties.

The display rules from task 01 don't change: the result's `title` stays `Class.title`, and each
attached course still shows its own `classTitle`.

## Acceptance criteria

- [ ] A class whose `Class.title` doesn't match but whose active placement title does is
      returned, ranked by the placement title's match.
- [ ] A match only on a **deactivated** placement's title does not return the class.
- [ ] A match only on `apxTitle` does not return the class.
- [ ] A class matching on both its own title and a placement title appears exactly once.
- [ ] Integration tests for all four cases (prior art: the title-search integration test).

## User stories covered

- Story 8: find a class by the title my course shows for it
