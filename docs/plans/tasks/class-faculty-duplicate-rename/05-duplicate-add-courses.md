# 05 Add other courses in the Duplicate dialog

**Type**: AFK
**Blocked by**: 04
**Feature**: B

## What to build

The Duplicate dialog's course list ends with "+ Add another course…". It reuses the course picker from the
in-place create's "also add to other courses". Added courses appear as ticked rows with the place "Where
the class is filed, at the end". The planner places them using the existing assign rule: the class's own
filing, appended at the course's end. The button count includes them.

## Acceptance criteria

- [ ] Planner unit test: an added course gets one placement at the end, filed where the class is filed.
- [ ] Integration test: duplicating into 2 original courses plus 1 added course creates 3 placements.
- [ ] A course the original is already in cannot be added twice.
- [ ] Suites print NO NEW FAILURES.

## User stories covered

24
