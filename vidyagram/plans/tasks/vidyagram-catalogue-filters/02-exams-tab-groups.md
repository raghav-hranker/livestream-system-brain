# Exams tab with groups and counts

**Type**: AFK
**Blocked by**: 00 — Skills main category; 01 — Old batch (catalogue rule module)
**Repo**: backend only

## What to build

`tab: 'exam'` on the filter API returns the exam courses plus a `groups` array the app renders as tiles
and chips: one entry per main category that has at least one listable course, each with its categories and
counts.

- Extend the catalogue rule: `exam` requires the course's main category to have `isSkills: false` (join or
  pre-resolved id list, whichever is cheaper) and adds the common clauses (status 1, not old, not hidden
  APX, not inside an active course folder, as the handler already does).
- Response: `groups: [{ id, name, image, priority, coursesCount, categories: [{ id, name, coursesCount }] }]`
  ordered by main category priority then category priority. Counts come from the same query as the
  courses **before** `mainCategory` / `category` narrowing, so a selected tile or chip keeps every tile's
  total. Groups with zero listable courses are absent; a main category whose only courses are old or
  inactive produces no group.
- `mainCategory` and `category` on the body keep their meaning and narrow the `courses` array (tile and
  chip selection).
- `groups` is present only for `exam` (and `skills`, task 03); other tabs omit it.

## Acceptance criteria

- [ ] Integration tests: two exam main categories with courses plus the Skills main category with courses;
      `tab: 'exam'` returns only exam courses, two groups with correct course and category counts, and no
      Skills group.
- [ ] Integration test: a main category with only old courses, and one with only status-0 courses, produce
      no group.
- [ ] Integration test: `mainCategory` restricts `courses` and the group's `categories` while every group's
      `coursesCount` stays whole; `category` narrows further.
- [ ] Integration test: a course inside an active course folder counts once, via the folder, as the
      handler already does for the list (document the choice in the test name).
- [ ] Unit test on the rule for `exam`.
- [ ] `NO NEW FAILURES` against the backend baseline.

## User stories covered

- Stories 1, 2, 3, 4, 5, 8, 15, 16, 29, 31
