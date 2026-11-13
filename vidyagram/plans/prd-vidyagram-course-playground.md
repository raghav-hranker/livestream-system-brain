# PRD: Vidyagram Course Builder Playground

Status: ready-for-agent, drafted 2026-10-28 from the prototype sessions (v1 2026-10-26, v4 2026-10-27). Vidyagram only
(backend branch `vidyagram-admin`, admin branch `vidyagram-admin`). Nothing here ships to quicktricks.

Prototype (throwaway, the agreed design):
[`../prototypes/course-playground/course-builder-playground.html`](../prototypes/course-playground/course-builder-playground.html),
published at https://claude.ai/artifact/Exw3mLcYufNYYucHsE3xfT. Background: [`prd-vidyagram-course-builder.md`](prd-vidyagram-course-builder.md)
(the pricing model and the access rules this PRD changes).

## Problem Statement

To sell a Course Builder course today, the admin first needs an existing course, then works on its classes screen in
Courses. The client team wants to put together a new course from pieces of courses that already exist (a few
chapters of one maths course, the reasoning of another), without touching those courses. Today that means creating
an empty course, then copying classes, PDFs and tests over course by course on three different screens, then setting
the builder price on a fourth. Nobody can see the whole new course while assembling it.

Separately, the client team has changed what Revision means: picking a chapter should not include its revision
classes. Revision is something a student adds on, like Notes and Tests.

## Solution

A new admin screen, **Build a course** (`/admin/courses/v2/build`), reached from a button on the Courses list and a
sidebar entry. It is four steps in a stepper: **Content → Price → Details → Review**.

- **Content.** Two panes. Left, **Bring in content**: the list of courses (search, exam filter). Opening one shows its
  outline as a tree, Section › Topic › Subtopic › class / PDF / test, with cascading checkboxes. A tray at the bottom
  says what is ticked, where it will land ("Arithmetic › Percentage · joins existing" or "new"), and offers **Goes
  into**: the same section as in the source course (default), one of the new course's sections, or a new section.
  **Add to course**, or drag the ticked rows across. Right, **Your course**: the new outline. Content keeps its
  section, topic and subtopic, and merges into same-named groups. Each row shows which course it came from. Sections
  and topics can be renamed, reordered by drag (within their parent) and removed, with Undo. Anything already in the
  new course shows "Added" in the tree and cannot be ticked again, including a class that sits in two source courses.
- **Price.** Course Builder is the only way this screen sells a course. Maximum selling price, minimum selling price,
  MRP (optional). Each topic of the outline is a chapter, with a weight % (pre-split by class count, with "Split
  evenly") or a custom price. Extras **Notes, Tests, Revision**, each with **Show in the app**, a price, and "Ticked
  when a student opens the builder". A student preview on the side runs the real pricing rule.
- **Details.** Title, short description, category (pre-filled from the source courses), Live/Recorded, faculty in
  order, validity, app banner, and the usual extra settings (show in New, close admission, tags, priority).
- **Review.** A checklist. Blockers stop **Create** (no content, no title, no category, no validity, no prices, min
  above max, weights not 100%); warnings don't (no banner, chapters with no weight, a shown extra with no price).
  The admin chooses **Keep it off sale** (default, inactive) or **Put it on sale now**.

Create makes the course in one step: the course, its outline (the same Class, PDF and test records, placed in the new
course, never copied), and its builder settings. Then the admin lands on the new course's outline in Courses. Source
courses and their buyers are not touched.

The half-built course is kept in the admin's browser until Create (the user's call, 2026-10-28). Nothing is written to
the database before Create.

**Revision becomes an extra, on every Course Builder course** (the user's call, 2026-10-28). A bought chapter opens
its ordinary classes. Its revision classes (placements tagged `isRevision`) open only when the build includes the
Revision extra. The "Revision only" whole-course mode goes away. Builds bought before the change keep what they
bought.

## User Stories

1. As an admin, I want to start a course from an empty screen, so that I build it from what I need instead of editing
   an existing course.
2. As an admin, I want to browse one source course at a time, filtered by exam, so that I pick from a course I know.
3. As an admin, I want to tick a whole section, a topic, a subtopic or a single class, PDF or test, so that I take
   exactly what I need.
4. As an admin, I want imported content to keep its section, topic and subtopic, so that the new outline stays in
   the same order as the source.
5. As an admin, I want content that lands on an existing section or topic name to merge into it, so that two courses'
   "Arithmetic" become one.
6. As an admin, I want to see where ticked content will land before I add it, so that I am not surprised.
7. As an admin, I want to put content into a section of my choosing, or a new one, so that "Arithmetic" from one
   course can go under "Quant".
8. As an admin, I want to drag ticked content onto the new course, so that adding feels direct.
9. As an admin, I want content already in the new course to show as Added, so that I never add a class twice.
10. As an admin, I want each row to show its source course, and to highlight one source's rows, so that I know where
    the content came from.
11. As an admin, I want to rename, reorder and remove sections and topics, and undo, so that I can shape the outline.
12. As an admin, I want a renamed section to keep catching content from its old name, so that later imports land in
    the right place.
13. As an admin, I want my half-built course to survive a page reload, so that I don't lose work.
14. As an admin, I want chapter weights pre-filled from class counts, so that I start from a sensible split.
15. As an admin, I want to see what a student pays for a few chapters while I set prices, so that I can check the
    numbers.
16. As an admin, I want to hide an extra from the app, so that a course without notes doesn't sell Notes.
17. As an admin, I want Revision as a priced extra, so that students pay for revision classes on top of chapters.
18. As an admin, I want course details pre-filled from the source courses, so that I type less.
19. As an admin, I want a checklist that tells me what stops Create and takes me to the step that fixes it, so that I
    don't hunt for errors.
20. As an admin, I want the course created off sale by default, so that I can check it in the app before selling.
21. As an admin, I want source courses untouched and their buyers keeping access, so that building is safe.
22. As a student, I want a build without the Revision extra to open the chapter's ordinary classes only, and with it
    the revision classes too, so that I get what I paid for.
23. As a student, I don't want to see an extra the admin hid, so that I can't pick something the course doesn't sell.
24. As a student who bought a build before this change, I want to keep every class I could open, so that nothing I
    paid for disappears.

## Implementation Decisions

### Data the playground writes (at Create only)

- **Course**: the existing Course model. `status` 0 (inactive) or 1 as the admin chose. The existing create controller
  writes `status || 1`, which turns 0 into 1; the playground's create path sets status itself and is tested for it.
  Required `mainCategory` and `category` come from the Details step. `validity` uses the same string format the
  existing course form writes. `faculties` in the order chosen.
- **Classes**: one `CourseClass` per class, `priority` in outline order, `isActive` true, `status` 1. `isRevision`,
  `isFree`, `startDate`/`endDate` copied from the class's placement in the source course it was taken from. Section,
  topic and subtopic per placement are the resolved taxonomy ids (below), stored as the per-course overrides with
  their cached names.
- **Topic order**: one `CourseTopic` row per topic, in outline order.
- **PDFs**: one `CoursePdf` per PDF, placed by names (`sectionName`, `topicName`), `isFree` copied from the source
  placement, `priority` in order.
- **Tests**: one `CourseTest` per test (Series), `topic` set to the resolved topic id when the test sits under a topic,
  `overrideSectionName` when its section differs from the Series' own section; `customTag`, `isFree`,
  `maxAttemptedLimit`, `startDate` copied from the source placement.
- **Builder**: `Course.builder` saved through the existing rules (`courseBuilderError`), checked against the outline
  being created, `enabled` true.
- All of it in one transaction (`startPrimarySession` + `withTransaction`). Any failure writes nothing.

### Taxonomy resolution (the user's call: create the new name)

Sections, topics and subtopics are shared records. The playground works in names; Create resolves names to ids:

1. If a group's name equals the name it had in the source course (no rename, no move), reuse the source's id.
2. Otherwise find an existing record by exact name (case-insensitive, trimmed) under the resolved parent (topic under
   section, subtopic under topic); reuse it if found.
3. Otherwise create a new record under that parent.

Two source courses whose "Arithmetic" sections are different records merge into one section; rule 1 picks the id of
the first content added. Created records appear in taxonomy dropdowns elsewhere; that is accepted.

### Revision as an extra (all builder courses)

- `BUILD_EXTRAS` becomes `notes`, `tests`, `revision`. `Course.builder.extras.revision` is `{offered, value,
  defaultOn}` like the others. `builder.revisionOnly` is removed from the save schema and the pricing rule.
- `priceBuild`: Revision is subtracted when offered and switched off, like Notes and Tests. The extras-total rule
  (offered extras ≤ max − min) counts it.
- `chapterOpensClass(chapter, isRevision, extras)`: a bought chapter opens a class when it is not a revision placement,
  or when the build includes `revision`. One rule for classes, notes, the certificate policy and the listings.
- Builds bought before the change: new build orders carry `build.rules: 2`. A build without it is read as before
  (a normal build opens revision classes; a Revision-only build opens only revision classes). Admin manual grants use
  the new rule.
- Build checkout refuses `revisionOnly` with a 400 explaining the change.
- **Show in the app** is the existing `offered` flag. Not offered already means the extra cannot be bought (checkout
  400) and so is not given; the admin label changes, the app hides it. Full-course owners (plan or whole-course
  purchase) keep owning everything; the flag is about builds.
- The existing Courses screen builder strip (`CourseBuilderMode.tsx`) gets the same change: Revision extra instead of
  Revision only, "Show in the app", and the labels MRP / Maximum selling price / Minimum selling price.

### Playground backend routes (new, `requireAdmin`, full-access roles, under `/api/admin/course-playground`)

- `GET /sources?search=&category=` — courses to import from: id, title, faculties, category names, live/recorded,
  counts of sections, classes, PDFs and tests.
- `GET /sources/:courseId/outline` — one tree for the Content step: sections › topics › subtopics › items, where an
  item is `{kind: 'class'|'pdf'|'test', id, title, meta}` (minutes, pages, questions) plus the source ids of its
  section/topic/subtopic. Built from the existing outline readers (`loadListingRows`/`buildCourseOutline`, the PDF
  outline, course tests). PDFs and tests with no topic sit in a "Section-wide" group under their section.
- `POST /courses` — Create. Body: details, outline (names, order, items with their source course), builder settings,
  status, and an optional banner (multipart, the existing upload). Validates everything first (unknown ids, an item in
  a course it isn't in, duplicates, builder rules, title taken), answers 400 with the first problem in words, writes
  nothing on failure. Returns the new course id.

### Admin

- New page `app/admin/courses/v2/build/page.tsx`, a "Build a course" button on the Courses list, a sidebar child
  under Learning › Courses (inherits the Courses screen permission) and a SidebarSearch keyword.
- State in one reducer, persisted to `localStorage` (try/catch, versioned key). Drag via the existing `@dnd-kit`.
- The price maths uses the admin's `lib/course-builder.ts` helpers, updated for the Revision extra, so the preview and
  checkout agree. Weights are entered and split in 0.5% steps (the save rule).
- After Create: clear the draft, toast, go to the course's outline page.

### App (the client's Flutter team)

The app guide (`vidyagram/reference/vidyagram-course-builder-app-guide.md`) is updated: Revision is a third extra
with a price and default; "Revision only" is gone; hidden (not offered) extras are not shown. No backend change is
needed for the app to read playground-made courses; they are ordinary builder courses.

## Testing Decisions

- Test behaviour through the public interfaces: the pure rules (`priceBuild`, `chapterOpensClass`, the taxonomy
  resolver, the builder config) with unit tests; the routes with integration tests on the existing
  `MongoMemoryReplSet` harness; admin reducers and helpers with `node --test`/vitest.
- Prior art: `adminCourseBuilder.integration.test.ts`, `courseScope.integration.test.ts`, the course-copy and
  class-assign integration tests.
- Must-cover: a pre-change build still opens revision classes; a new build without Revision does not, with it does;
  Revision-only checkout is refused; Create with status 0 stays inactive; Create rolls back completely when the
  builder settings fail; a rename creates a new topic and leaves the source topic alone; a class from two source
  courses is placed once; source courses' placements are byte-for-byte unchanged after Create.
- Every task: `NO NEW FAILURES` against the task folder's baselines.
- End to end locally on a copy of 5–6 real Vidyagram courses (read-only export from `vidyagramdb`, the user approves
  the read), with an admin click-through of the whole flow and a student build check through the API.

## Out of Scope

- Server-side drafts and sharing a draft between admins.
- Selling a playground course at one price (no builder); editing an existing course in the playground.
- Search across the whole catalogue (the user's call: one course at a time).
- Moving topics between sections by drag (Goes into covers it); cross-parent drag of classes.
- Tagging revision classes in the playground: done on the course outline after Create, as today.
- Any quicktricks change. A shared-code bug found here (the create `status || 1`) is reported for quicktricks
  separately.

## Further Notes

- The live demo builder course (`6ad73b8ac90f6da685048d8c`) has a Revision-only discount today; the deploy task maps
  it to a Revision extra price with the user.
- Count real build orders before deploying the Revision change; the `build.rules` read keeps them whole either way.
