# Handoff: Assign PDFs, the same outline treatment as Assign Classes (2026-10-01)

**The next session's job:** bring the Assigned PDFs tab up to the same level as the Assigned Classes
outline.
1. **Grill the user** on the questions below, one recommended answer per question, in rounds.
2. **Build a clickable prototype artifact** if the user wants one (they did for classes, and chose
   layout A).
3. **Write the PRD with `to-prd`**, to `docs/plans/prd-assigned-pdfs-outline.md`. Then **`to-issues`**
   into `docs/plans/tasks/assigned-pdfs-outline/`.

**Don't write code until a point is settled and ticketed.** The user wants to discuss and see prototypes
first.

Production repos are the client forks `quicktricks-backend` and `quicktricks-admin` (line
`quicktricks-admin`). The student website is `thedhronas`, branch `quicktricksbysahilsir-new`, which is
read-only for us.

## Read first

- **The classes PRD:** `docs/plans/prd-assigned-classes-outline.md`. Its tasks are in
  `docs/plans/tasks/assigned-classes-outline/` (12 tasks; start with 01 and 03). Most decisions there
  are the template for this one.
- **Memory:** `course-class-grouped-view.md` (the classes decisions) and
  `never-remove-granted-access.md` (the product rule: admin bulk actions are additive only, never take
  content from buyers).
- **The classes prototype** (layout A was chosen): https://claude.ai/artifact/XUpEiDuAbsg1WeacpoZ3Fu.
  Its template is saved at `reference/prototypes/assigned-classes-outline.template.html`; the data was
  injected at `__DATA__`. For a PDF prototype, Railway Prime Batch (`6a4558e8ebb42f585d9a9f29`) has
  42 active course PDFs.

## What the user asked for

"Do the same for assign pdf views." Read that as: the outline the classes got, applied to PDFs —
- nested grouping that mirrors the website, with drag to reorder;
- Reverse priority in ⋯ menus, and the Priority box removed;
- Copy to another course (additive);
- collapse and search.

Confirm which parts apply. PDFs differ from classes in structure, see below.

## How PDFs differ from classes (verified 2026-10-01, file refs on the backend worktree)

**Data model**
- **No subtopic level at all.** `Pdf` has `section` (required) and `topic` (optional); there is no
  `subTopic`. The website shows no subtopic level for PDFs either. So the outline is **Section › Topic ›
  PDFs**, two levels.
- **No per-course taxonomy ids.** `CoursePdf` has no section/topic ids. It has:
  - `priority` (with the same "clash → max+1, end of course" pre-save trap);
  - `overrideSectionName` (free text);
  - `isActive`, `isFree` (per course) and `addedAt`;
  - APX name snapshots `sectionName` and `topicName`.

  There is no status and no start or end date. Removing a PDF sets `isActive: false`, and assigning it
  again reactivates that row. There is a unique index on `(course, pdf)`.

**How students see them**
- **Names come from the snapshot first.** The student read (`GET /api/courses/:courseId/pdfs`, builder
  in `services/coursePdfItem.ts`) shows:
  - section name: the snapshot `sectionName`, else `overrideSectionName`, else the `Pdf.section` name;
  - topic name: the snapshot `topicName`, else the `Pdf.topic` name.

  So the snapshot names are already, in effect, a **per-course name pin**.
- **One flat order per course.** PDFs are sorted by `CoursePdf.priority` across the whole course, then
  newest first. There is no topic order and no section order stored for PDFs: `coursetopics` is not
  read by any PDF code.
  - With `?groupBy=topic`, topic cards appear in **first-appearance** order of that flat list.
  - Website section chips likewise appear in first-appearance order.
  - So moving a topic or a section block = **renumbering PDF priorities**. No new storage is needed and
    the website follows automatically.
- **Hard-coded topic names.** In `coursePdfController.ts` ~810, a missing topic is shown as **"All
  Notes"**, and a topic literally named "No Topic" is shown as **"English Grammar"**. The second looks
  like a one-customer hack; ask before carrying it into the admin outline.
- **Two website pages read the names differently.** The course pages build chips from
  `overrideSectionName || section.sectionName`; the batches pages use `section.sectionName` only. This
  only matters if overrides start being used.

**The admin today** (`components/admin/assign-pdfs/`)
- The Assigned view is a **flat table**, paged 20 at a time on the client, with no grouping. Each row
  has:
  - a Section text box (writes `overrideSectionName`);
  - Free and Download checkboxes;
  - a Priority box (a `PUT` on every keystroke);
  - Preview and Remove.

  Bulk actions: "Priority from N", Section, Free, Download, Remove, all as per-row calls.
- **The Free and Download checkboxes write the global `Pdf`** (`PUT /pdfs/:id`), not `CoursePdf.isFree`.
  The student "free" flag is `CoursePdf.isFree` **OR** `Pdf.isFree` (`coursePdfItem.ts` ~129). So
  ticking Free on one course's screen makes that PDF **free in every course it is in**. 343 of 1,065
  assigned PDFs are in more than one course. This is a real defect to raise first, independent of the
  outline.
- **The Available (assign) view drops its own Free/Download selections.** `buildConfigs` sends only
  `priority` and `sectionName`.
- **Backend endpoints the admin never calls:** `PUT /courses/:c/pdfs/reorder`
  (`{pdfOrder:[{pdfId, priority}]}`), `PATCH …/override-section/bulk`, `PATCH …/pdfs/bulk`,
  `PATCH …/toggle-status`. The reorder endpoint may already fit drag saves; check its validation and
  clash behaviour.
- `assign-pdfs/BulkEditSheet.tsx` is not imported anywhere. The PDF-side page
  `app/admin/pdfs/manage-courses/` also exists, and is the PDF counterpart of Manage Course Assignments.
- **Class-row "PDF" buttons are separate.** They are class-attached PDFs (`Class.pdfIds` /
  `pdfAssignments`, `GET /api/classes/:id/pdfs`), not `CoursePdf`, and are out of scope here.

## Production numbers (read-only, 2026-10-01)

| | |
|---|---|
| Active PDF placements | 2,478, across 80 courses |
| PDFs per course | median 20, max 174 |
| Sections / topics per course | median 2 / 2 |
| `overrideSectionName` used | **0** rows (dead field) |
| Snapshot `sectionName` set | 2,453 |
| Snapshot `topicName` set | 1,564, of which **683 differ** from the PDF's real topic |
| PDFs without a real topic | 69 (shown as "All Notes") |
| PDFs in more than one course | 343 of 1,065 |

## Questions to grill (recommended answers)

1. **Levels.** The outline is Section › Topic › PDFs, mirroring the website's PDFs tab (section chips ›
   topic cards › rows). There is no subtopic level, because the data has none.
2. **Whose names the outline shows.** Exactly what students see: snapshot first, then the real
   taxonomy. Otherwise the 683 differing placements look misfiled in the admin.
3. **Change topic for a PDF: where does it write?**
   - (a) The per-course snapshot names (`sectionName` / `topicName`, picked from the real taxonomy).
     These are per course, need no schema change, and the website already reads them first.
   - (b) New per-course taxonomy ids, mirroring `CourseClass`.
   - (c) The global `Pdf`, which changes it in every course.

   ➡️ (a). Note that this makes the APX snapshot fields an admin-owned per-course pin. Check whether
   anything still rewrites them: the APX PDF catch-up is stopped (memory `apx-catchup-stopped`), but
   confirm.
4. **Ordering storage.** Section and topic drags renumber `CoursePdf.priority` as a block. That is
   unlike classes, which store a course topic order. The PDFs tab never reads `coursetopics`. Recommend
   **not** sharing the classes' topic order. PDF order stays independent, and needs no new
   storage and no website change.
5. **Drag levels.** PDFs within a topic, topics within a section, and sections. Cross-topic moves go
   through Change topic, as with classes.
6. **Removals.** Remove the Priority box and the "Priority from N" bulk action, and the dead Section text
   box (`overrideSectionName`, 0 rows). Reverse priority goes into the topic ⋯ menu.
7. **Free and Download.**
   - Free becomes **per course** (`CoursePdf.isFree`), so it stops leaking into other courses. Existing
     global `Pdf.isFree` values stay.
   - Download stays global (it is a property of the file), but is labelled "(all courses)".
   - Ask whether to audit which PDFs are globally free today.
8. **Available (assign) view.** New PDFs land last in their topic. Drop the Priority, Section, Free and
   Download inputs there (they are dropped or harmful today); set these after assigning.
9. **"English Grammar" / "All Notes".** Ask whether "No Topic" → "English Grammar" is intended. Show
   "All Notes" for PDFs without a topic, as students see it.
10. **Copy to another course for PDFs.**
    - The same rules as classes: an existing course; scopes course / section / topic / selection; same
      names and order, landing after the target's own PDFs in each topic.
    - Skip PDFs already there, and reactivate inactive rows. Never remove anything.
    - Ask whether one Copy should carry **both** classes and PDFs of a section once both outlines
      exist. Recommend no, keep them separate in v1.
11. **Reuse.** Make the admin outline model from the classes work (task 04 there) generic over levels
    (classes: three, PDFs: two) instead of copying it. The backend PDF read is a separate small pure
    module, because storage differs.
12. **Branch and sequencing.** A new branch `feat/course-pdf-outline`, cut from
    `feat/course-class-grouped-view` after its outline tasks land, so the classes work can ship first.
    Recommend the Free-leak fix (point 7) as a **separate small ticket that can ship now**.
13. **Course tests** (`CourseTest`, the same pattern as `CoursePdf`): out of scope; mention as the next
    candidate.

## Fact gaps to close at the start of the next session

- **The app's "Ebooks" screen** (`CONTEXT.md` ~841): how does it group and order course PDFs? The app
  is not in our repos; check whether the backend serves it a different shape.
- **Snapshot rewriting:** does any running cron or script still rewrite `CoursePdf.sectionName` /
  `topicName`?
- **The unused reorder endpoint:** does `PUT /courses/:c/pdfs/reorder` validate the exact set and avoid
  the clash bump?
- **Free audit:** how many `Pdf.isFree = true` PDFs sit in a paid course where `CoursePdf.isFree` is
  false? That is the leak's actual reach.

## Local preview and rules

The same as the classes handoff (`/private/tmp/course-class-grouped-view-handoff-2026-10-01.md`):
- **Tunnel.** The user starts the tunnel (`-L 27018:148.113.8.241:27017` via the box). Rebuild
  `MONGO_URI` with the host swapped, and never print it; a parse error once echoed the password.
- **Local writes hit the production database.**
- **Prod reads from the Mac:** `require('mongoose')` with
  `NODE_PATH=<backend>/node_modules`.
- **Commits:** commit as `raghavsharma@hranker.com`, with no co-author trailers, in the forks. Don't
  push or deploy without asking.
