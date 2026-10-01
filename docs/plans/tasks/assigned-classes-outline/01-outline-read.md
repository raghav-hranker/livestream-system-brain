# Outline read, end to end

**Type**: AFK
**Blocked by**: None — can start immediately

## What to build

The tracer bullet. The Assigned Classes tab shows a course as the website does: Section › Topic ›
Subtopic › classes, in student order, with collapsible headers and counts. Nothing about writing changes
yet. ▲▼, Reverse priority and Change topic keep working against the new tree.

- **Backend: Course outline** (PRD Backend 1). Make it a pure module that replaces
  `groupCourseClassListings`.
  - Input: the listing rows and the course's topic order.
  - Output: sections → topics → subtopic groups → listings.
  - Topic order: the stored course topic order, then the topic's lowest Priority, then the name.
  - Section order: a section sits where its first topic sits.
  - Subtopic groups:
    - in order of first appearance;
    - an "Others" group only in mixed topics;
    - a single unnamed group when a topic has no subtopics.
  - Sequence runs 1…n through each topic, in group order.
  - `GET /api/admin/courses/:courseId/class-groups` returns the tree. Its only consumer is this
    branch, so the shape is free.
- **Backend `CONTEXT.md`**: add **Section order** and **Subtopic order** (both derived, never stored)
  under "Course class order".
- **Admin: Outline model** (PRD Admin 6, read half). Make it a pure module in `lib/` that replaces the
  flat-group helpers.
  - Input: tree + search + collapse state.
  - Output: the visible tree.
  - Search matches title or subtopic and expands the matching groups.
- **Admin: layout A** (PRD Admin 7, read half).
  - Nested collapsible Section, Topic and Subtopic headers:
    - section: topic and class counts;
    - topic: class and subtopic counts;
    - subtopic: class count.
  - The toolbar's Collapse/Expand all covers every level.
  - Section ⋯ collapses or expands its topics; topic ⋯ collapses or expands its subtopics. The other
    ⋯ items arrive in tasks 02, 07 and 08.
  - Rows keep today's columns for now; the removals are task 02.
  - The outline works at phone width.

## Acceptance criteria

- [ ] On a course with a stored topic order (one of the 11), the outline's section and topic order
      matches the website's section tabs and topic accordions. On a course without one, it matches the
      lowest-Priority fallback.
- [ ] A topic with no subtopics shows its classes directly, with no subtopic heading. A mixed topic
      shows its subtopic-less classes under "Others". Subtopics appear in website chip order.
- [ ] In a topic with interleaved subtopics, Sequence still runs 1…n through the topic across groups.
      The "All" order students see is unchanged: this task does not write.
- [ ] Every section, topic and subtopic header shows the counts in PRD stories 8–10 and collapses on
      its own. The toolbar and ⋯ collapse/expand controls work.
- [ ] Search narrows to matching classes and expands their groups. Clearing it restores the previous
      collapse state.
- [ ] ▲▼ and Change topic still save correctly from the nested view, and the tree refetches after
      each save.
- [ ] Backend unit tests for the Course outline cover the cases listed in the PRD's Testing Decisions.
      Admin `node --test` tests cover the outline model's search and collapse. A component test shows
      the nested headers with counts.
- [ ] The baselines in the README stay green.

## User stories covered

- 1–15, 29–31, 62
