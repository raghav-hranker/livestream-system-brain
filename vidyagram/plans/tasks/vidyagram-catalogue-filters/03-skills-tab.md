# Skills tab

**Type**: AFK
**Blocked by**: 02 — Exams tab (groups shape)
**Repo**: backend only

## What to build

`tab: 'skills'` returns the courses under the `isSkills` main category and one group, in the same `groups`
shape as task 02, whose `categories` are the chips (All skills, AI, Design, Video editing).

- Extend the catalogue rule: `skills` requires the course's main category to be the `isSkills` one. If no
  such main category exists the tab returns empty `courses` and `groups` (not an error).
- `category` on the body narrows `courses` to one chip; the group's counts stay whole.
- No admin change: the admin files a skill course by picking Skills then a category in the existing form.

## Acceptance criteria

- [ ] Integration tests: `tab: 'skills'` returns only courses under the `isSkills` main category, one group
      with per-category counts, and no exam course; `tab: 'exam'` on the same data returns no skill course.
- [ ] Integration test: `category` narrows `courses` while the group counts stay whole.
- [ ] Integration test: with no `isSkills` main category the response is empty, status 200.
- [ ] Unit test on the rule for `skills`.
- [ ] `NO NEW FAILURES` against the backend baseline.

## User stories covered

- Stories 6, 7, 8, 25, 26, 30
