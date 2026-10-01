# Course topic order: topic and section drag; delete Topic Priority page

**Type**: AFK
**Blocked by**: #04 — Drag classes and subtopics within their group

## What to build

The first code that writes `coursetopics.priority`. Admins control the order of the website's topic
accordions and section tabs, with no website change (PRD Backend 2, Admin 6–7, Admin 10).

- **Backend: Course topic order**, a pure core plus `PUT /api/admin/courses/:courseId/topic-priorities`.
  - Body: every topic id in the course's outline, in the new order.
  - An exact-set check: a missing, extra or duplicated topic returns 409 "changed since loaded".
  - Writes priorities 1…n as active `coursetopics` rows (`course`, `topic`, `priority`, `isActive`,
    timestamps), creating missing rows and reactivating inactive ones.
- Declare a unique `(course, topic)` index on the model. Do **not** let it auto-build on prod (check how
  the fork's `autoIndex` and `app.ts` `createIndexes` behave); task 10 builds it.
- Backend `CONTEXT.md`: add **Course topic order** under "Course class order".
- **Admin: topic drag** within its section and **section drag** within the course, through outline-model
  moves that return a `topic-priorities` payload. A section drag moves that section's topics as one
  block. Both are disabled during search, and a 409 shows the refresh message.
- **Delete** `app/admin/courses/topic-priority/page.tsx`, `hooks/api/use-course-topic-priority.ts` and
  `lib/course-topic-priority-utils.ts`, plus any dead link or menu entry.

## Acceptance criteria

- [ ] Dragging a topic within its section saves the full topic list. After a refetch, the outline and
      the website's accordions show the new order.
- [ ] Dragging a section moves all of its topics as a block. The website's section tabs follow.
- [ ] A course with no stored topic order is unchanged until the first topic or section drag. After
      it, every topic has an active row with priorities 1…n.
- [ ] A missing, extra or duplicated topic id → 409, and nothing is written.
- [ ] Unit tests: exact-set validation, priorities 1…n and a section block move. Integration tests:
      `PUT …/topic-priorities` validation, 409 on a stale list, 403 for a restricted role (match
      `requireAdmin` / `hasFullAccess` as the other routes do), rows created and reactivated.
- [ ] Admin `node --test`: topic and section moves produce the right `topic-priorities` payload.
- [ ] The Topic Priority page, hook and utilities are gone, and nothing links to them.
- [ ] The baselines in the README stay green.

## User stories covered

- 21, 22, 57, 58, 60, 61
