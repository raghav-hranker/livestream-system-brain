# Tasks: Assigned Classes outline

State: `ready-for-agent` (01–09) · `ready-for-human` (10–12)

Vertical-slice breakdown of [the PRD](../../prd-assigned-classes-outline.md). Tasks cite the PRD's
numbered modules (Backend 1–5, Admin 6–10) and user stories; they do not restate them. Glossary: fork
`CONTEXT.md` → "Course class order" (Placement, Placement taxonomy, Class taxonomy, Listing, Priority,
Sequence). Tasks 01 and 05 add Section order, Subtopic order and Course topic order.
Prototype (layout A): https://claude.ai/artifact/XUpEiDuAbsg1WeacpoZ3Fu

**Working-copy rules.**
- Both forks, branch `feat/course-class-grouped-view`, **local only** (not pushed, not deployed):
  - backend worktree `~/Projects/worktrees/qt-grouped-view-backend` (head `6058c6596`);
  - admin worktree `~/Projects/worktrees/qt-grouped-view-admin` (head `1da75b3`). Its uncommitted
    `config.ts` points the admin at a local backend on `:5912`. **Never commit it.**
- Existing code to build on, not copy:
  - backend `src/utils/courseClassGroups.ts` (grouping, `reshuffleTopicPriorities`),
    `src/utils/courseClassTaxonomy.ts`, `src/controllers/adminCourseClassGroupsController.ts`,
    routes in `src/routes/adminCoursePickerRoutes.ts`;
  - admin `components/admin/assign-classes/{AssignedClassesView,BulkEditSheet,PlacementTaxonomyDialog}.tsx`,
    `lib/course-class-groups.ts`.
- **Local preview writes to production.** A local admin points at a local backend that uses the
  production database (ssh tunnel, see memory `course-class-grouped-view`). Test drags and copies only
  on a course the user names. Anything destructive belongs in the in-memory integration tests.
- Commit as the work email, with **no co-author trailers**. Never push or deploy without asking.
- Tests:
  - backend: `node:test` with `npm test` (unit) and `npm run test:integration` (in-memory Mongo);
  - admin: vitest (`--exclude .sandcastle/**`) for components, `node --test` for `lib/` helpers.
- Baselines to keep green: 22 backend grouped-view tests, 28 admin vitest tests, 9 admin `node --test`
  tests, and a clean backend type-check. The 17 backend suite failures and ~138 admin type errors
  already on origin must not grow.

| # | Task | Type | Blocked by |
|---|---|---|---|
| 01 | [Outline read, end to end](01-outline-read.md) | AFK | — |
| 02 | [Assigned Classes removals; Reverse moves into ⋯ menus](02-assigned-classes-removals-and-reverse-menus.md) | AFK | 01 |
| 03 | [Manage Course Assignments removals (class side)](03-manage-course-assignments-removals.md) | AFK | — |
| 04 | [Drag classes and subtopics within their group](04-drag-classes-and-subtopics.md) | AFK | 01 |
| 05 | [Course topic order: topic and section drag; delete Topic Priority page](05-course-topic-order-topic-and-section-drag.md) | AFK | 04 |
| 06 | [New topics get a course topic order row](06-new-topics-append-course-topic-row.md) | AFK | 05 |
| 07 | [Copy a topic to another course, end to end](07-copy-topic-to-another-course.md) | AFK | 01, 05 |
| 08 | [Copy scopes: whole course, section, selection](08-copy-scopes-course-section-selection.md) | AFK | 07 |
| 09 | [Copy brings multi-topic listings along](09-copy-multi-topic-listings.md) | AFK | 07 |
| 10 | [Build the unique (course, topic) index on prod](10-prod-coursetopics-index.md) | HITL | 05 |
| 11 | [Preview and deploy the outline and drags](11-preview-deploy-outline-and-drags.md) | HITL | 01–06, 10 |
| 12 | [Preview and deploy Copy to another course](12-preview-deploy-copy.md) | HITL | 07–09, 11 |

What can run in parallel:
- 03 can start right away.
- After 01, three tracks run side by side:
  - removals (02);
  - drags (04 → 05 → 06);
  - copy (07 → 08 / 09), which starts once 05 lands.

Copy ships in its **own deploy** (12), after the outline and drags (11), so it cannot hold them back.
