# Copy a topic to another course, end to end

**Type**: AFK
**Blocked by**: #01 — Outline read, end to end; #05 — Course topic order: topic and section drag; delete Topic Priority page

## What to build

The tracer bullet for Copy (PRD Backend 4, Admin 8): the narrowest scope, `topic`, working end to end
from the topic ⋯ menu. It assigns the **same classes** to an existing course. Nothing is removed from
either course, and no class is replicated.

- **Backend: Copy plan**, a pure core.
  - Input: the source placements in scope (outline order), the target's placements (active and
    inactive) and the target's course topic order.
  - Output per Section › Topic:
    - **added**, **skipped** (already active in the target) and **reactivated** (inactive in the target)
      counts;
    - where they land: after N existing classes, or as a new topic at the end.
  - Added and reactivated placements:
    - keep the source taxonomy pin (Section, Topic, Subtopic, name overrides), Is Free, start date and
      status;
    - get target Priority numbers above the target's current maximum, in source order.
  - New topics are appended to the target's course topic order through task 06's helper.
- **Endpoint**: `POST /api/admin/courses/:courseId/copy-to/:targetCourseId`, body
  `{ scope: { kind: 'topic', sectionId, topicId }, preview }`.
  - `preview: true` writes nothing and returns the plan.
  - `preview: false` writes the plan in one go and returns it.
  - Errors: 403 for restricted roles, 404 if either course is missing, 400 for source = target.
  - Accept only the `topic` kind for now and reject the others with 400; task 08 adds them.
- **Admin dialog**:
  - step 1: a searchable picker over existing courses, excluding the source;
  - step 2: a preview table per Section › Topic with Add, Skip and Lands columns;
  - Confirm, then a result such as "N classes added to X, M already there";
  - "Nothing to copy" (disabled) when nothing would be added.
  - Entry point: topic ⋯ → "Copy this topic to another course…". Hide it for restricted roles.
- This task leaves listings out (task 09). If the scope holds a placement with listings, copy it without
  them for now. Do not ship this task alone: 09 must land before deploy (task 12).

## Acceptance criteria

- [ ] Preview on a topic shows correct Add, Skip and Lands values and writes nothing (integration test
      checks the documents).
- [ ] Confirm creates placements that point at the **same** Class ids, with the source taxonomy pin, Is
      Free, start date and status. They land after the target's own classes in that topic, in source
      order.
- [ ] A topic new to the target is appended to its course topic order, if the target has one.
- [ ] A class inactive in the target is reactivated with the copied arrangement and counted as such.
- [ ] Re-running the same copy skips everything, and the dialog shows "Nothing to copy".
- [ ] The source course's placements and `coursetopics` are byte-for-byte unchanged.
- [ ] 403 restricted role, 404 missing course, 400 source = target, 400 non-topic scope.
- [ ] Unit tests (Copy plan): skip vs add vs reactivate, landing after the target max, new topic
      appended, source order preserved. Component test: preview, then confirm, then result counts.
- [ ] The baselines in the README stay green.

## User stories covered

- 41 (topic), 43–54, 56, 59
