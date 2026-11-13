# Combos and sub courses

**Type**: AFK
**Blocked by**: 03
**Repo**: Backend + admin

## What to build

The Make this a combo row: search for sub courses and drag to order them. The main plan holds this course first, then the sub courses. The switch sets `isCombo`. The course read gains an ordered `subCourses` for the Sub Courses tab. Additions reach past buyers, and the form shows the order count. A removal warns with the count first, then lets the admin go ahead.

## Acceptance criteria

- [ ] A combo's buyer can open every sub course, and a past buyer gets an added one.
- [ ] `by-id-2` returns sub courses in the dragged order, and a combo shows on the catalogue's Combo tab.
- [ ] The plan's course list keeps this course first.
- [ ] Removing a sub course shows the warning, and the save reports what changed.
- [ ] Drag and arrow-key reordering are saved.
- [ ] `NO NEW FAILURES` against the baselines.

## User stories covered

- Stories 15, 16, 19, 20, 21, 22, 23
