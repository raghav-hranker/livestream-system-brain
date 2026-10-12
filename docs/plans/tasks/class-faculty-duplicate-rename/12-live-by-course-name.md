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

## Outcome (2026-10-12): wontfix

The premise was wrong. `GET /api/classes/live` takes no course. It returns every class live right now,
built from Class documents only. So it belongs with live schedule, flags and banners, which keep the class
title. The agent's version added an optional `?courseId=` that no known caller sends (backend `c0acd900e`
on `feat/class-rename-aliases-12`, kept unmerged). Not merged, because it is a parameter nobody uses.
Side finding, not fixed: the response's `id` is always missing, because the formatter writes `cls._id`
after a `$project` that renamed it to `id`.
