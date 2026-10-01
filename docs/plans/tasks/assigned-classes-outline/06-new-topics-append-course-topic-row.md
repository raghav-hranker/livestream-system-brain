# New topics get a course topic order row

**Type**: AFK
**Blocked by**: #05 — Course topic order: topic and section drag; delete Topic Priority page

## What to build

PRD Backend 2, last bullet. Once a course has a stored topic order, any write that brings a **new**
topic into it appends an active `coursetopics` row at the end. Otherwise the website's fallback (lowest
class Priority) could place the new topic anywhere, even ahead of topics the admin arranged.

- Writes that apply:
  - Change topic: `updatePlacementTaxonomy`, re-filing into a topic the course did not have;
  - assigning classes to a course from either side, in every admin assign path that can create a
    placement under a new topic.
- Courses with **no** stored topic order are left alone. Their fallback order still applies, which
  keeps PRD story 60.
- Put the append in one helper in the Course topic order module; task 07 reuses it for Copy.
- **"Lands at the end" gaps found by task 03** (backend `src/controllers/courseClassController.ts` at
  `6058c6596`):
  - **Reactivation keeps its old Priority.** When an admin re-assigns a class that was deactivated in
    this course (`:172-174`) and omits `priority`, the class keeps its old number. It should get
    max + 1, like a new assignment. Before task 03 the class side sent `priority: 1`.
  - **Listings are not counted.** The max + 1 default (`:193-198`) counts placement Priority numbers
    only. A listing that was given a higher number in the same topic can still sort after a newly
    assigned class. The max must include listing Priority numbers.

## Acceptance criteria

- [ ] In a course with a stored topic order, re-filing a class into a topic new to the course adds that
      topic last, in both the admin outline and the website.
- [ ] Assigning a class under a new topic does the same, from both the course side and the class side.
- [ ] Re-filing or assigning into a topic that already has a row does not touch `coursetopics`.
- [ ] A course with no stored topic order gets no rows from these writes.
- [ ] Re-assigning a deactivated class with no `priority` puts it last, above every placement and
      listing Priority in the course.
- [ ] Integration tests cover the Change topic path and one assign path, for both a course with and a
      course without a stored topic order.

## User stories covered

- 30, 38 (and the topic-order half of 47, via the shared helper)
