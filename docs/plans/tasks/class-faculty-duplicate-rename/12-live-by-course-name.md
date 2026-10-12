# 12 Live classes by course shows the course's name

**Type**: AFK
**Blocked by**: None, can start immediately
**Feature**: C

## What to build

The live-classes-by-course endpoint uses the placement's shown name, through the same card title expression
class-tabs uses (`title`, then `apxTitle`, then class title), instead of `Class.title`. Live schedule,
flags and banners stay on the class title.

## Acceptance criteria

- [ ] Integration test: a class with a course-only name shows that name from live-by-course for that course
      and the class title for another course.
- [ ] Suites print NO NEW FAILURES.

## User stories covered

57
