# PRD: Assigned PDFs outline (Section › Topic, drag, Copy) and Free decided per place

State: ready-for-agent
Date: 2026-10-03
Owning repos: `quicktricks-backend` + `quicktricks-admin` (the client forks, line `quicktricks-admin`).
No service contract in `SYSTEM.md` is crossed: this is admin UI over the LMS admin API, plus one change to
how the LMS decides that a PDF is free. The student website (`thedhronas`) and the app are read-only
consumers; neither needs a change.
Prototype (accepted, version 3): https://claude.ai/artifact/P4o9kJKL6g7QkaGrLnfBDn — template
`reference/prototypes/assigned-pdfs-outline.template.html`, Railway Prime Batch's 42 real PDFs.
Builds on: the Assigned Classes outline and one-stop work
([`prd-assigned-classes-outline.md`](./prd-assigned-classes-outline.md),
[`prd-assigned-classes-one-stop.md`](./prd-assigned-classes-one-stop.md)). Their decisions are the
template; this PRD records only where PDFs differ.
Handoff and grill: `reference/assign-pdfs-outline-handoff-2026-10-01.md`, grilled 2026-10-01 → 2026-10-03.

## Problem Statement

A course admin managing a course's PDFs ("Ebooks" in the app) works in a flat table, 20 rows a page,
with no idea of the shape students see. The Ebooks tab groups PDFs into section chips and topic cards,
but the admin screen shows neither, so the admin cannot tell where a PDF will appear or in what order.

- **Order is a number box.** Each row has a Priority box that saves on every keystroke, plus a
  "Priority from N" bulk action. There is no way to move a topic or a section as a block, and no way to
  reverse a topic.
- **Moving a PDF to another topic is impossible from the course.** The only per-course name field is a
  Section text box nobody uses (0 rows in production).
- **The Free checkbox leaks.** Ticking Free on one course's screen writes the shared PDF record. The
  student rule is "free in this course OR free on the PDF", so the PDF becomes free in every course it
  is in. 343 of 1,065 placed PDFs are in more than one course. Eight paid books ticked on 2026-09-25 are
  now free in all 3–6 batches they sit in, and the admin cannot make one of them paid for a single
  course: the PDF's own flag always wins.
- **The Available view drops the admin's input.** It shows Free and Download checkboxes, then sends
  neither.
- **Re-using a course's PDF set is slow.** Giving another batch the same PDFs, under the same names and
  order, means assigning them one by one and renumbering by hand.

## Solution

The Assigned PDFs tab becomes the same outline the Assigned Classes tab already is, with two levels
instead of three. Free becomes a per-place decision everywhere.

- **One outline, Section › Topic › PDFs**, in exactly the order and names students see on the Ebooks
  tab (app and website). PDFs with no topic sit under **All Notes**, as students see them. Sections and
  topics collapse; a search narrows the outline to matching PDFs, topics and sections.
- **Drag everything.** PDFs move within a topic or into any other topic of the course and land where
  they are dropped. Ticking rows and dragging one moves them all. Topics move within their section, and
  sections move within the course. There are no ▲▼ arrows and no Priority box.
- **Move to…** in a row's ⋯ menu and in the selection bar picks a section and topic for this course
  only. Other courses keep their own names.
- **⋯ menus** hold the rare actions: Reverse priority (topic, or every topic), Move up / Move down
  (topic, section), Add existing PDFs here (topic), Copy to another course (row, topic, section, whole
  course), Remove (row).
- **Free (this course)** on each row and in the selection bar changes this course only.
  **Download (all courses)** stays a property of the file and says so.
- **Add existing PDFs here…** from a topic's ⋯ menu picks PDFs from the library and assigns them
  straight into that topic, last, paid.
- **Copy to another course** gives an existing course the same PDFs, under the same names and order,
  after that course's own PDFs in each topic. Nothing leaves the source course, PDFs already there are
  skipped, and removed ones are brought back.
- **Free is decided where the PDF is placed**: a course, a class, or a practice batch. The PDF's own
  Free flag stops granting access. The PDF page's Free checkbox becomes two actions: "Make free in all
  its places" and "Make paid in all its places". The 14 PDFs that are globally free today are first
  converted to per-place free flags, so no student sees a change.

## User Stories

### Seeing the course the way students see it

1. As a course admin, I want the Assigned PDFs tab grouped as Section › Topic › PDFs, so that I see the course the way students see the Ebooks tab.
2. As a course admin, I want sections, topics and PDFs in the exact order students see them, so that what I arrange here is what they get.
3. As a course admin, I want each PDF shown under the section and topic names students see, so that a PDF the course files differently from the library does not look misfiled.
4. As a course admin, I want PDFs with no topic grouped under "All Notes" in their section, as students see them, so that nothing is hidden or renamed.
5. As a course admin, I want each section and topic header to show how many topics and PDFs it holds, so that I can judge the size of a block before moving it.
6. As a course admin, I want each row to show a Sequence number that restarts at 1 in every topic, so that I can talk about "the third PDF in Syllogism".
7. As a course admin, I want each row to show the file size and how many other courses use the PDF, so that I know when a change to the file reaches other courses.
8. As a course admin, I want to collapse and expand each section and topic, and all of them at once, so that a 174-PDF course stays workable.
9. As a course admin, I want to search PDFs by title, topic or section, so that I can find one PDF in a long course.
10. As a course admin, I want matching topics to open while I search, and dragging to be off with a note saying so, so that I never reorder a filtered list by accident.

### Ordering

11. As a course admin, I want to drag a PDF within its topic, so that I can order it without typing numbers.
12. As a course admin, I want to drag a PDF into another topic of the same course and have it land where I drop it, so that re-filing and ordering are one step.
13. As a course admin, I want to tick several PDFs and drag one of them to move them all, in outline order, to the drop point, so that bulk re-filing is one drag.
14. As a course admin, I want to drag a topic within its section, so that students see topic cards in the order I want.
15. As a course admin, I want to drag a section within the course, so that students see section chips in the order I want.
16. As a course admin, I want Move up and Move down in the topic and section ⋯ menus, so that I can reorder without dragging.
17. As a course admin, I want "Reverse priority" in a topic's ⋯ menu, so that a topic imported newest-first can be flipped in one action.
18. As a course admin, I want "Reverse priority in every topic" in the toolbar ⋯ menu, leaving section and topic order alone, so that a whole imported course can be flipped at once.
19. As a course admin, I want the drag handle to be focusable and to move with the keyboard, so that ordering works without a mouse.
20. As a course admin, I want a clear message when the course changed since I loaded it, asking me to refresh, so that I never overwrite someone else's order.
21. As a student, I want section chips, topic cards and PDFs in the order the admin set, in the app and on the website, so that the course reads as intended.

### Moving a PDF to another place in this course

22. As a course admin, I want "Move to…" in each row's ⋯ menu, with a section and topic picker, so that I can re-file a PDF in this course without dragging across a long page.
23. As a course admin, I want "Move to…" in the selection bar for every ticked PDF, kept in outline order, so that bulk re-filing is one action.
24. As a course admin, I want the picker to offer the library's real sections and topics, so that I never invent a name students will see.
25. As a course admin, I want a moved PDF to go last in its new topic, so that I know where to find it.
26. As a course admin, I want a move to change only this course, so that other courses keep their own arrangement.
27. As a course admin, I want a move into "All Notes" refused, with the reason, when the PDF has its own topic in the library, so that I am never told it moved when students still see it elsewhere.
28. As a course admin, I want a topic or section to disappear from the outline when its last PDF moves out, so that the outline matches the students' view.
29. As a student, I want a PDF the admin moved to appear under its new section and topic straight away, so that the course reads correctly.

### Free and Download

30. As a course admin, I want each row's Free checkbox to mean "free in this course", so that making a sample free here does not make it free in every batch.
31. As a course admin, I want Free (this course) in the selection bar, so that I can make several PDFs free or paid here at once.
32. As a course admin, I want Download labelled "(all courses)", so that I know it changes the file everywhere it is used.
33. As a course admin, I want the Available view's Free checkbox to be saved, per course, when I assign, so that what I tick is what happens.
34. As a course admin, I want the Available view to stop offering Priority, Section and Download, so that it only asks what it saves.
35. As a content admin, I want "Make free in all its places" on a PDF's page, with a count of the courses and classes it reaches, so that a free sample book can be freed everywhere in one action.
36. As a content admin, I want "Make paid in all its places" on a PDF's page, so that I can undo that just as easily.
37. As a content admin, I want the same two actions for several PDFs in the PDFs list, so that bulk changes stay possible.
38. As a content admin, I want the PDFs list to show "Free in 3 of 6" instead of yes or no, so that I can see a PDF's reach at a glance.
39. As a content admin, I want the create form to stop offering Free, so that I am not asked about a PDF that is not in any course yet.
40. As a course admin, I want to make a globally free book paid in one batch while it stays free in the others, so that each batch's offer is its own.
41. As a student who has not bought a course, I want a PDF marked free in that course to open, and a paid one to stay locked, exactly as the lock icon says.
42. As a student, I want PDFs that are free today to stay free after the switch-over, so that nothing I could open disappears.
43. As the business owner, I want a PDF's free status in one course never to leak into another paid course, so that paid content stays paid.

### Adding existing PDFs into a topic

44. As a course admin, I want "Add existing PDFs here…" in a topic's ⋯ menu, so that I can put library PDFs straight into that topic.
45. As a course admin, I want to search the PDF library in that sheet, with PDFs already in the course shown disabled, so that I never add a duplicate.
46. As a course admin, I want PDFs that cannot sit in "All Notes" disabled with the reason when I add into "All Notes", so that what I add lands where I asked.
47. As a course admin, I want added PDFs to land last in the topic, paid, under this course's names, so that adding never changes access by accident.
48. As a course admin, I want a PDF this course once had and removed to be brought back instead of duplicated, so that its history stays clean.

### Removing

49. As a course admin, I want Remove in a row's ⋯ menu and in the selection bar, with a confirmation that states the count and that buyers lose them, so that I never remove by accident.
50. As a course admin, I want a removed PDF to come back if I assign it again, so that a mistake can be undone.

### Copy to another course

51. As a course admin, I want "Copy to another course…" for one PDF, the ticked PDFs, a topic, a section or the whole course, so that I can give another batch the same material.
52. As a course admin, I want to pick an existing course from a searchable list, so that I copy to the right batch.
53. As a course admin, I want a preview, per section and topic, of how many PDFs will be added, brought back and skipped, and where they land, so that I know exactly what will change in the other course.
54. As a course admin, I want copied PDFs to keep the section and topic names students see here, and this order, so that the other course reads the same.
55. As a course admin, I want copied PDFs to land after the other course's own PDFs in each topic, and new topics at its end, so that its existing arrangement is untouched.
56. As a course admin, I want PDFs the other course already has to be skipped and counted, keeping that course's names and order, so that copying never overwrites its arrangement.
57. As a course admin, I want PDFs the other course once had and removed to be brought back with the copied arrangement, so that copy behaves like assigning again.
58. As a course admin, I want Free (this course) copied as it is, so that the other course offers the same samples.
59. As a course admin, I want the same PDFs placed, with no new PDF records, so that a fix to a file shows up in both courses.
60. As a buyer of the source course, I want copying to change nothing in my course, so that I never lose access because of someone else's batch.

### Tidying the old screen

61. As a course admin, I want the Priority box, the "Priority from N" action, the Section text box and its bulk action gone, so that the screen offers only what works.

## Implementation Decisions

### Decisions settled in the grill (2026-10-01 → 2026-10-03)

| # | Decision |
|---|---|
| D1 | Two levels, **Section › Topic**. PDFs have no subtopic in the data or on either client. A placement with no topic shows under **All Notes**. |
| D2 | The outline shows the **names students see**: the placement's own section/topic names first, then the PDF's library filing. One shared naming function serves both the student read and the admin outline, so they cannot disagree. The student read's "No Topic" → "English Grammar" relabel stays as it is (0 rows reach it); deleting it is an optional cleanup for the client team. |
| D3 | **Order is one course-wide priority**, renumbered 1…N in outline order on every save. Topic and section order follow from first appearance, as they already do on the Ebooks tab. PDF order never shares the classes' stored course topic order. No new storage. |
| D4 | **Moving a PDF in a course writes that placement's section and topic names**, picked from the library's real taxonomy. No schema change; both clients already read these names first. A move that lands exactly on the PDF's library filing clears them, silently. There is **no "Reset" action** (the user found it confusing). |
| D5 | **Drag matches the classes outline after its round 2**: no ▲▼; a PDF drops into any topic and lands at the drop line; dragging a ticked row moves every ticked row, gathered in outline order. Refused, nothing moves: a drop into All Notes of a PDF that has its own library topic. One PDF cannot sit twice in a course (unique `(course, pdf)`), so the classes' "twice in one topic" rule does not arise. |
| D6 | **Free is decided per place.** The course screens write the placement's flag (`CoursePdf.isFree`); a class's PDFs sheet writes `pdfAssignments.isFree`; practice batches keep theirs. The PDF's own `isFree` stops granting access once the 14 globally free PDFs are converted (D13). |
| D7 | **Download stays global** (`Pdf.isDownloadable`), labelled "Download (all courses)". |
| D8 | **Available view**: Priority, Section and Download inputs go; Free stays and is now saved for this course. New PDFs land last in their topic. The tab stays for now; whether to remove it like the classes' Available tab is decided after "Add existing PDFs here" is in use. |
| D9 | **Add existing PDFs here** in the topic ⋯ menu: assigns the picked library PDFs into that topic under this course's names, last, paid; an inactive placement is reactivated, not duplicated. |
| D10 | **Copy to another course** follows the classes rules: an existing course; scopes PDF, selection, topic, section, course; preview first; same placed PDFs, no new `Pdf` records; names as students see them here, written as the target's names; order kept, landing after the target's maximum priority in each topic; already-active skipped and untouched; inactive reactivated with the copied arrangement; Free (this course) copied. Additive only (the "never remove granted access" product rule): nothing in the source changes. PDFs only in v1, never classes and PDFs together. |
| D11 | **Remove** stays (per row and bulk) with a confirmation. It sets the placement inactive; assigning again reactivates it. |
| D12 | **Removed from the screen**: the Priority box, "Priority from N", the Section text box (`overrideSectionName`, 0 rows) and its bulk action, and the unused Assigned PDFs bulk-edit sheet. The backend keeps accepting the old fields. |
| D13 | **Free switch-over**: (1) convert every globally free PDF to per-place flags on all its placements (course placements active and inactive, class attachments, practice-batch rows), then clear the PDF's flag; (2) only after that, the access check and every student read stop treating `Pdf.isFree` as free. Students see no change at any point. |
| D14 | **PDF page**: the create form loses Free. The edit page and the PDFs list replace the Free checkbox with "Make free in all its places (N courses, M classes)" and "Make paid in all its places", each confirming its counts; the list column shows "Free in X of Y". These are one-time bulk writes to the per-place flags. |
| D15 | **Course tests** (`CourseTest`, the same placement pattern) are out of scope; they are the next candidate. |
| D16 | **No guard on the AppX PDF port.** The port rewrites placement names and priority on every run, but the AppX migration is complete and will not run again (user, 2026-10-02). |

### Production facts the design rests on (read-only, 2026-10-01 → 2026-10-03)

| | |
|---|---|
| Active PDF placements | 2,478 across 80 courses; median 20 per course, max 174 |
| Sections / topics per course | median 2 / 2 |
| Placements with their own section name / topic name | 2,453 / 1,564; 683 topic names differ from the PDF's library topic |
| Railway Prime Batch | 42 PDFs; 32 sit somewhere other than their library filing (so rows carry no "moved" tag) |
| `overrideSectionName` used | 0 rows |
| Placements with `CoursePdf.isFree` | 0 (never written) |
| Globally free PDFs (`Pdf.isFree`) | 14: in 41 active course placements (8 paid courses), 1 class attachment, 0 practice-batch rows, 0 legacy-only class links; 4 sit nowhere |
| Student reads of course PDFs | the app's Ebooks screen and the website both use `GET /api/courses/:courseId/pdfs?groupBy=topic` |
| Reorder endpoint today | one update per row in a transaction, no clash bump, but no exact-set check: partial lists, duplicate numbers and foreign ids pass |
| Bulk endpoint today | `PATCH /api/courses/:courseId/pdfs/bulk` writes `isFree` and `isDownloadable` to the shared `Pdf` |

### Modules

**Backend: pure modules (no I/O, unit tested)**

- **Course PDF naming.** One function: a placement plus its PDF's library filing → the section name and
  topic name students see (placement names first, then the PDF's own; no topic ⇒ All Notes). It replaces
  the inline logic in the student read and is used by the admin outline. The "English Grammar" relabel
  stays in the student read, outside this function, until the client team decides.
- **Course PDF outline.** Active placements in priority order → Section › Topic › PDFs, in first-appearance
  order, each row with its title as students see it, Sequence, size, Free (this course), Download, other
  course count, and the PDF's library topic (needed to refuse All Notes). The student read's grouping and
  this outline must agree on every course.
- **Course PDF order.** The one place that turns an admin action into a renumbering. Inputs: the course's
  active placement ids as the admin saw them, and one of: a new full order; a move (PDF ids, target
  section and topic names, the PDF to land before or "last"); a topic reverse; a reverse of every topic.
  Output: either a refusal (stale set, unknown id, All Notes with an own topic) or the writes — priorities
  1…N in outline order, and the names for moved PDFs (cleared when they match the library filing).
- **Copy changes.** Source placements (in outline order, with names and Free) plus the target's
  placements (active and inactive, with names and priorities) → per PDF: add, bring back or skip; the
  target priority (after the target's maximum, so its own PDFs keep their places); per section and topic
  counts and "lands after its N" / "new topic at the end" for the preview.
- **Free-in-all-places changes.** A PDF (or several) and its places → the per-place writes for "make free / paid in
  all its places", with counts by kind (courses, classes, practice batches). Also used by the one-time
  conversion (D13).

**Backend: endpoints**

- **Outline read (new, admin).** `GET /api/admin/courses/:courseId/pdf-outline` → the Course PDF outline
  plus the active-set token the writes must echo.
- **Reorder (hardened).** `PUT /api/courses/:courseId/pdfs/reorder` validates that the list is exactly the
  course's active set with distinct priorities, writes in one transaction, never triggers the
  "clash → max+1" save hook, and answers 409 when the set changed.
- **Move (new, admin).** `POST /api/admin/courses/:courseId/pdfs/move` — names and priorities in one
  transaction, through Course PDF order. 409 on a stale set; 422 with the reason on an All Notes refusal.
- **Bulk (corrected).** `PATCH /api/courses/:courseId/pdfs/bulk` — `isFree` writes the placements of this
  course; `isDownloadable` writes the PDF.
- **Assign into a place (new, admin).** `POST /api/admin/courses/:courseId/pdfs/assign` with PDF ids and
  a section and topic → placements last in that topic, paid, under those names; reactivates inactive
  ones. The library list for the sheet reuses the existing ranked admin PDF title search, marking PDFs
  already in the course.
- **Copy (new, admin).** `POST /api/admin/courses/:courseId/pdfs/copy-to/:targetCourseId` with a scope
  (PDF ids, topic, section or course) and a preview flag. Preview writes nothing; a real copy writes those
  changes in one transaction; a re-run skips everything.
- **Free in all places (new, admin).** One endpoint for one or many PDFs, with a preview of the counts,
  writing through the Free-in-all-places changes.
- **Access rule.** Once the conversion has run, the access check, the course PDF listing, course search
  and every other student read decide Free from the place alone. A fact-check step lists every reader of
  `Pdf.isFree` before it is removed (D13).
- **Conversion script.** Dry run by default; `--commit` writes. It backs up every document it changes,
  then sets the per-place flags and clears the PDF flags. Prod run needs the user's go-ahead after
  seeing the planned rows.

**Admin**

- **Outline model (generalised).** The classes outline model and its move functions become generic over
  depth: three levels for classes, two for PDFs. The PDF view uses the same sortable, ⋯-menu, Move to…,
  picker and Copy dialog components, with PDF-specific rows.
- **Assigned PDFs view (rewritten).** The outline, toolbar (search, collapse all, ⋯), selection bar (Move
  to…, Free (this course), Download (all courses), Copy, Remove), row (handle, tick, Sequence, title and
  meta, Free (this course), Download (all courses), Preview, ⋯).
- **Add existing PDFs sheet (new)**, opened from a topic's ⋯ menu.
- **Available PDFs view (trimmed)**: Free only, saved per course.
- **PDF page and PDFs list**: create form without Free; edit page and list with the two "all its places"
  actions and the "Free in X of Y" column.

### Glossary and decision record

- `quicktricks-backend/CONTEXT.md` gains: **Course PDF names** (the per-placement section and topic names
  students see), **Course PDF order** (one course-wide priority; topic and section order by first
  appearance), and **Place free** (a PDF is free where it is placed, never by itself).
- An ADR in the backend fork records D6 + D13: "A PDF's Free is decided per place". The fork holds two
  ADR series with colliding numbers, so it is referred to by title.

### Branches and sequencing

1. **Free fix (ships now, alone):** a fix branch from `origin/quicktricks-admin` in both forks. The
   corrected bulk endpoint plus the admin's row, bulk and Available Free checkboxes writing
   `CoursePdf.isFree`. Until step 2, a globally free PDF shows a ticked, locked "Free (all courses)" box
   with a hint to change it on the PDF page.
2. **Free switch-over (ships after 1, alone):** the conversion (prod run approved by the user), then the
   access-rule change, the Free-in-all-places endpoint and the PDF page / PDFs list changes, deployed
   together. After this, the locked state never occurs.
3. **Outline:** `feat/course-pdf-outline` in both forks, cut from the `feat/assign-classes-one-stop`
   heads (round 4 merged), deployed after the classes work is deployed. Outline, drags and Move to… first;
   Add existing PDFs here and Copy in separate deployable tasks, as with classes.

## Testing Decisions

- **What makes a good test.** It asserts behaviour seen from outside the module, never how it is built:
  for the pure modules, inputs → outputs; for endpoints, HTTP in → status, body and the resulting
  documents; for the views, what an admin sees and the request a click sends.
- **Backend, unit tests (pure modules):**
  - **Course PDF naming:** placement names win; fallback to the PDF's own; no topic ⇒ All Notes; blank
    and whitespace names fall through.
  - **Course PDF outline:** first-appearance section and topic order; Sequence restarts per topic;
    interleaved topics grouped; agrees with the student read's grouping on the golden fixtures.
  - **Course PDF order:** exact-set validation (missing, extra, duplicate → refusal); priorities 1…N;
    move to a drop point and to "last"; multi-PDF moves keep outline order; names cleared when landing
    on the library filing; All Notes refusal; topic and all-topic reverse leave section and topic order.
  - **Copy changes:** add vs bring back vs skip; landing after the target's maximum per topic; new
    topics at the end; each scope; source order kept; Free copied.
  - **Free-in-all-places changes:** every place kind counted and written; idempotent on a re-run.
- **Backend, endpoint tests:** the outline read, reorder, move, bulk, assign-into-place, copy and
  free-in-all-places endpoints — validation, 409 on a stale set, 403 for non-admins, preview writes
  nothing, idempotent re-runs. The access rule gets tests that a placement-free PDF opens for a
  non-buyer, a PDF with only the old global flag no longer does, and a paid one stays locked.
- **Golden tests stay green:** the existing Ebooks-tab golden and snapshot tests (course PDF listing,
  course search's course-PDF section, placement-free listings and access) must pass unchanged through
  the naming extraction; the access-rule change updates only the cases that relied on the global flag.
- **Prior art:** the backend's course PDF listing golden and snapshot tests, placement-free access and
  listing tests, and the in-memory Mongo integration setup used by course search; the classes outline's
  course-outline and placement-move unit tests in the admin (`node --test`), and its component tests for
  the Assigned Classes view, Move to… dialog, Copy dialog and Add existing classes sheet.
- **Admin, unit tests (outline model):** the generalised model keeps every classes test green; PDF cases
  for two-level moves, multi-drag payloads, All Notes refusal, search and collapse.
- **Admin, component tests:** the Assigned PDFs view (headers and counts, no Priority or Section input,
  ⋯ items send the expected requests, drag off while searching), the Add existing PDFs sheet, the Copy
  dialog's preview for PDFs, and the PDF page actions' confirmations.

## Out of Scope

- Course tests (`CourseTest`): the next candidate for the same treatment.
- Removing the Available PDFs tab (decided after "Add existing PDFs here" is in use).
- Copying classes and PDFs together in one Copy.
- Deleting the student read's "No Topic" → "English Grammar" relabel (the client team's call).
- Unifying the website's two section-name reads (course pages vs batch pages); only matters if
  `overrideSectionName` is ever used.
- Class-attached PDFs as a screen (the one-stop PRD owns the class PDFs sheet); this PRD only converts
  their Free flags in D13.
- Any change to the student website or the app.
- A guard on the AppX PDF port (D16).

## Further Notes

- The first reorder in a course makes interleaved topic blocks contiguous in the flat priority order.
  Students see no difference: the Ebooks tab already groups by topic.
- Names written by Move to… are strings, not ids. Renaming a topic in the library later does not
  rename it in courses that moved PDFs into it. Accepted: it is the same behaviour the 2,453 existing
  placement names already have.
- After D13, "Free (all courses)" only exists as an action, never as a state; a PDF made free in all its
  places and later assigned to a new course is paid there until someone ticks it.
