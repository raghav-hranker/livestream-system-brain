# PRD: Assigned Classes one-stop (go live, upload video, PDFs, tests, add a class in place)

State: ready-for-agent
Date: 2026-10-02
Owning repos: `quicktricks-backend` + `quicktricks-admin` (the client forks, line `quicktricks-admin`).
Branch: `feat/assign-classes-one-stop` in both forks, cut from `feat/course-class-grouped-view` (the
outline, local and undeployed). This PRD builds on the outline:
[`prd-assigned-classes-outline.md`](./prd-assigned-classes-outline.md). It crosses no `SYSTEM.md`
contract: it is admin UI over existing admin APIs, plus one new admin endpoint.
Tasks: `docs/plans/tasks/assigned-classes-one-stop/`.

## Problem Statement

An admin arranging a course in the Assigned Classes outline has to leave it for everything else:
- **Go live:** the Classes list, or the live schedule.
- **Upload a recorded video:** the Classes list row action.
- **Attach PDFs or tests to a class:** separate pages reached from the Classes list.
- **Add a new class to a topic:**
  1. create it on the Classes page;
  2. fill in its whole form, including category, section, topic and subtopic, which the admin was
     already looking at;
  3. come back to Available Classes and assign it;
  4. find it at the end of the course and re-file it.

## Solution

> **Round 2 (2026-10-02) changes parts of this section.** Go live moves into the ⋯ menu, the ▲▼
> arrows and the Change topic link leave the row, classes move by drag or Move to…, and the class PDF
> upload changes. See [Round 2](#round-2-after-the-local-preview-2026-10-02) at the end; where the two
> disagree, Round 2 wins.

**Go live on the row, the rest in a ⋯ menu.** Every class row in the outline gets:
- **A Go live button on the row itself**, outside any menu: the same flow as the Classes list. It
  mints the Streamer token and opens the class screen in a new tab. It is solid when the class is live
  now or scheduled ahead, and lighter otherwise.
- **A video status pill** under the title: *Live now*, *Processing*, *Recording ready*,
  *Scheduled · 03 Oct, 10:00* or *No video yet*.
- **Resource counts next to the pill:** `📄 2 · 📝 1`, the class's PDFs and tests. Zeros show too
  (`📄 0`), so a class with no notes is visible without opening anything. Clicking a count opens
  that sheet.
- **An active switch instead of the Status column.** Every row said "active", so the column goes. A
  small switch on the row turns the class on or off **in this course**. An inactive row is dimmed and
  gets an *Inactive* tag beside the pill, so the only rows that draw the eye are the ones students
  can't see.
- **A ⋯ menu** with:
- **Upload video:** the existing upload dialog. If the class already has a recording, it warns that the
  upload replaces it.
- **PDFs:** a side sheet listing the class's PDFs. The admin can preview, reorder, remove, and upload or
  attach PDFs.
- **Tests:** the same side sheet for the class's tests.

The PDF and Tests sheets say **"Changes apply to this class in every course (N)"**, because a class's
PDFs and tests belong to the class itself, not to this course.

**Add a class in place.** Section, topic and subtopic ⋯ menus gain:
- "Add recorded class here", which opens a short dialog:
  - **Where it goes:** from a subtopic header, nothing to choose. From a topic header, the admin
    **must choose the subtopic**, or "No subtopic"; there is no default, except that a topic with no
    subtopics fills in "No subtopic". From a section header, the admin chooses the topic, then the
    subtopic. The title and teacher fill in once the place is chosen.
  - **Title:** suggested from the last class in that group. If it ends in a number ("Part-6",
    "Day 06"), the suggestion is the next number. It is always editable, and it must be unique across
    all classes.
  - **Teacher:** prefilled from the last class in that subtopic. If there is none, from the topic; if
    there is none there either, from the course's faculty. It is editable.
  - A link, "Open the full class form instead", for anything the short dialog does not cover.
  - **Create** files the class under that Section › Topic › Subtopic and gives it the course's main
    category and category. It assigns the class to this course, last in its group. It is **active
    straight away**, as on the Classes page today, and the upload dialog then opens.
- "Schedule live class here": the same dialog plus a start date and time. The class is then ready for
  Go live.

**Copy to another course is unchanged.** A class's PDFs and tests already come along, because Copy
places the same class in the target course.

## User Stories

1. As a course admin, I want a ⋯ menu on every class row for upload, PDFs and tests, so that a class's tools are in the outline where I arrange it.
2. As a course admin, I want a Go live button right on each class row, so that I can start a live class in one click without leaving the course.
3. As a course admin, I want Upload video from a class row, so that I can attach a recording to the class I am looking at.
4. As a course admin, I want a warning when the class already has a recording, so that I do not replace one by accident.
5. As a course admin, I want the row's status to show processing and then ready after an upload, so that I know when students can play it.
6. As a course admin, I want to see a class's PDFs from its row, preview them, reorder them and remove them, so that I can check its notes in place.
7. As a course admin, I want to upload new PDFs or attach existing ones to a class from its row, so that notes go on in one step.
8. As a course admin, I want the same for a class's tests, so that tests are handled where PDFs are.
9. As a course admin, I want the PDF and Tests sheets to say the change applies in every course that has the class, and how many, so that I am not surprised when another course changes too.
10. As a course admin, I want "Add recorded class here" in section, topic and subtopic ⋯ menus, so that a new class starts in the right place.
11. As a course admin, I want the class's section, topic, subtopic, main category and category filled in from where I clicked and from the course, so that I never re-enter what the screen already knows.
12. As a course admin, I want the title suggested as the next number after the group's last class, so that series like "Part-7" or "Day 07" take one keystroke.
13. As a course admin, I want the teacher prefilled from the group's last class, so that a series keeps its teacher.
14. As a course admin, I want a clear inline error when the title is already used by another class, so that I can fix it without losing the form.
15. As a course admin, I want the new class assigned to this course, last in its group, so that it lands where I asked.
16. As a course admin, I want the upload dialog to open right after creating a recorded class, so that creating and uploading is one flow.
17. As a course admin, I want "Schedule live class here" with a start time, so that live classes are planned in place too.
18. As a student, I want a newly added class to appear in the right topic and subtopic, in order, so that the course reads correctly.
19. As a course admin, I want a status pill on each class row (live now, processing, recording ready, scheduled, no video yet), so that I can see which classes still need a video.
20. As a course admin adding a class from a topic or section header, I want to choose the subtopic (and topic) myself, so that the class never lands somewhere I did not mean.
21. As a course admin, I want each class row to show how many PDFs and tests it has, zeros included, so that I can spot classes missing notes without opening each ⋯ menu.
22. As a course admin, I want to click a row's PDF or test count to open that sheet, so that fixing a gap is one click from seeing it.
23. As a course admin, I want a switch on each row instead of a Status column, so that turning a class off in this course is one click and the table isn't full of "active".
24. As a course admin, I want inactive rows dimmed and tagged, so that the classes students can't see stand out.

## Implementation Decisions

**Backend**
1. **Class course count.** The PDF and Tests sheets need to know how many courses the class is in.
   - Add `GET /api/admin/classes/:classId/courses-count` (or a `courseCount` field on an existing
     admin class read), returning the number of courses where the class has an active placement.
   - Admin auth (`requireAdmin`).
2. **Create a class in place.** `POST /api/admin/courses/:courseId/classes/in-place` with
   `{ sectionId, topicId, subTopicId?, title, teacherName, isLive, startDate?, endDate? }`.
   - **Derivation:** `mainCategory`/`category` come from the course, and the taxonomy comes from the body.
     Everything else takes the class-create defaults: chat on, not free, active, `priority` 0.
     The full class form defaults chat off and priority 1; the user chose to keep chat on here
     (2026-10-02), so the two create paths deliberately differ.
     Recorded: start = now. Live: start is required, and the end defaults to start + the live
     duration default.
   - **Placement:** in one transaction, it creates the Class and its placement in this course, and puts
     the placement last in its group. That uses the listing-aware max + 1 and the topic-order append
     from outline task 06.
   - **Errors:** 409 `{ field:'title' }` on a duplicate title. 404 for an unknown course. 400 when the
     topic/subtopic is not under the section.
   - **Hooks:** it must keep every behaviour of the normal class create, such as notification scheduling
     for live classes, by going through the same model save/hooks, not a raw insert.
3. **Video state on outline rows.** The outline rows (`loadListingRows` in
   `adminCourseClassGroupsController.ts`) must carry each class's `streamStatus` and `hasPlayback`
   (true when the class has an `hlsAsset`; the asset itself is never sent). The status pill, the Go
   live emphasis and the replace warning all read them.
   - They also carry **`pdfCount`** and **`testCount`**: the class's `pdfAssignments` /
     `seriesAssignments` (via the existing resolvers, so legacy `pdfIds`/`seriesIds` count too) that
     still point at an existing Pdf / Series. That is the set the sheets list with no filters.
     Two batched `$in` lookups per outline load, never one per row.
4. **Class tests auth** is a prerequisite for the Tests sheet. A separate task, "Guard class
   test-assignment routes with requireAdmin", adds `requireAdmin` to the series mutation routes and
   sends the admin token from `use-class-series.ts`.

**Admin**
5. **`useGoLive`.** Lift `ClassesDashboard.handleGoLive` into a hook used by the Classes list, the live
   schedule and the outline.
   - Keep `userId = classId` in the Streamer token, as the Classes list does. ls derives the socket
     identity from it.
   - The schedule screen's admin-id variant is the odd one out: either align it or record why it
     differs.
6. **Row actions** on every class row: a **Go live** button, then the ⋯ menu (`OutlineRowMenu`) with
   Upload video, PDFs and Tests. Both are disabled while a drag or save is in flight. A listing row's
   actions act on its class.
   - **Status pill** from one pure function of `{ streamStatus, hasPlayback, startDate, now }`:
     `live`/`preparing`/`reconnecting` → *Live now*; `processing` → *Processing*; `hasPlayback` or
     `ended` → *Recording ready*; otherwise a start in the future → *Scheduled · date*; otherwise
     *No video yet*. The start is the **placement's** start date, the date the row already shows,
     not the class's own start (user's choice, 2026-10-02).
   - The transcoder reports to the LMS only once, at the end, so the pill never shows *Processing*
     after an admin upload: a re-upload stays *Recording ready* (students keep the old recording
     until the new one lands) and a first upload stays *No video yet*. User story 5 is met only at
     the end of the transcode.
   - **Go live emphasis:** solid for *Live now* and *Scheduled*, light otherwise. The system has no
     field saying a class is meant to be live (see Alternatives considered), so "Scheduled" means only
     "starts in the future"; it is a display hint, never a gate. Go live is offered on every row.
7. **Upload video** reuses `SingleVideoUploadDialog`. It warns before replacing when the row's
   `streamStatus` / `hasPlayback` shows a recording exists.
8. **PDF sheet.** Make the assign-PDFs-to-class views (`AssignedPdfsViewForClass`,
   `AvailablePdfsViewForClass`) take `classId` as a prop, keeping the page working. Mount both in a
   `Sheet` with the course-count banner.
9. **Tests sheet.** The same, with the class series views.
10. **Resource counts** (`RowResourceCounts`): `📄 n · 📝 n` beside the status pill, zeros in muted
   text, an `aria-label` like "2 PDFs, 1 test". Each count is a button that opens the PDF or Tests
   sheet for the row's class. Any change made in a sheet invalidates the outline query, so the counts
   are fresh when the sheet closes.
11. **Active switch.** The Status column is removed. A compact `Switch` on the row writes the
   placement's `status` through the existing `onUpdateAssignment`, exactly what the badge did; it is
   disabled while that row saves.
   - It is the **placement** status, per course: off hides the class from students **in this course
     only** (`CourseClass.status`), never `Class.status`. Its label says so: "Active in this course".
   - Inactive rows: muted text and an *Inactive* tag beside the status pill.
   - The admin outline, its rows read and `useCourseClasses` used to drop `status: 0` placements, so
     a switched-off row vanished. They now keep every `isActive` placement; student reads still
     filter `status: 1`.
   - Copy copies a switched-off placement **as switched off** (status copied as it is, outline story
     50). Bulk Edit never had a placement Status field, so there was nothing to keep.
   - Known gaps, not fixed here: `GET /api/topics/:topicId/classes` and `POST
     /api/courses/:courseId/todays-classes` match `isActive` only, so a switched-off class still
     shows there. Available Classes also lists a switched-off class, and assigning it from there
     switches it back on.
12. **Add class dialog** (`AddClassInPlaceDialog`). It computes the title suggestion and the teacher
   prefill from the outline group already loaded.
   - **Place pickers:** section header → Topic then Subtopic selects; topic header → Subtopic select
     with a "No subtopic" option and no default (auto-filled when the topic has no subtopics);
     subtopic header → none. Create is refused with an inline "Choose a subtopic." / "Choose a topic."
     until the place is set.
   - **Title:** take the trailing number of the last class's title, including zero-padding (`Day 06` →
     `Day 07`); with no trailing number, leave it empty.
   - **Teacher:** the last class in the subtopic, else the topic, else the course faculty.
   - After the create, it refetches the outline and, for a recorded class, opens the upload dialog.

## Testing Decisions

- **Backend integration** (in-memory Mongo):
  - in-place create: derivations, landing last, topic-order append, duplicate title 409, taxonomy
    mismatch 400, live start required;
  - the class course count;
  - outline rows carry `pdfCount`/`testCount`, ignoring assignments whose Pdf/Series is gone.
- **Admin:**
  - pure tests for the title suggestion, the teacher prefill and the status pill;
  - the row resources: the counts render (zeros too), and each opens its sheet;
  - the active switch writes the placement status, and an inactive row is tagged;
  - component tests:
    - the row Go live button and the ⋯ items call the right hooks;
    - the topic and section pickers block Create until the place is chosen;
    - the replace warning;
    - the sheet banner shows N;
    - the dialog sends the derived body;
    - a 409 shows inline.
- **Not tested here:** the upload itself and the ls handoff, which are existing flows; a manual pass
  covers them.

## Out of Scope

- Per-course PDFs or tests: a class's PDFs and tests stay shared across courses.
- Course-level PDFs and tests in the outline.
- Copy carrying course-level PDFs and tests.
- Editing the full class form (thumbnail, description, etc.) from the outline. The class page is one
  link away.
- Multi-class drag: settled in Round 2 below.

## Alternatives considered (2026-10-02)

A clickable preview compared the row ⋯ menu with always-visible actions:
https://claude.ai/artifact/FhD4V5SgPczfghzZA1KoKn (A actions column, B status chips, C expand a row,
D class side panel, E/F one video button per row). **The ⋯ menu (board 0) was chosen, then tweaked (board G):** Go live moved
out onto the row, the status pill stayed, and adding from a topic or section header asks for the
subtopic.

The always-visible versions need to know, for a class with no video, whether it will be taught live or
uploaded. Nothing in the system records that reliably today:
- `Class.isLive` is no longer set by the class form; old values are noise, and the notification
  scheduler reads it.
- The Live Classes screen lists every class with dates in the tab's window; it never checks intent.
- Placement start dates are stamped at assign time, so "start in the future" is not "live".

Board G offers Go live and Upload video on every row, so it needs no such cue; its "Scheduled" pill
reads only the start date. If the row actions
come back, the first step is a stored intent field (for example `delivery: 'live' | 'recorded'`), set
by "Add recorded class here" / "Schedule live class here" and by the class form. The Live Classes
screen could then filter on it too.

## Round 2: after the local preview (2026-10-02)

The user previewed tasks 00–07 locally and asked for five changes. These were grilled the same day
against board H of the preview canvas (https://claude.ai/artifact/FhD4V5SgPczfghzZA1KoKn) and
accepted. Handoff: [`reference/assigned-classes-one-stop-round2-handoff-2026-10-02.md`](../../reference/assigned-classes-one-stop-round2-handoff-2026-10-02.md).

### What changes for the admin

- **Go live moves into the row ⋯ menu**, as its first item. The admin rarely teaches these classes;
  the streamer's own view has Go live. The Classes list and the live schedule keep their buttons.
- **The ▲▼ arrows leave class rows.** Drag does the same job. The section and topic "Move up / Move
  down" menu items stay.
- **"Change topic" becomes Move to…** in the row ⋯ menu: a section / topic / subtopic picker. There is
  no "Follow the class" / "Pick for this course" choice any more. Whatever the admin does in a
  course's outline changes **only that course**; re-filing the class everywhere stays on the class
  form. A row that was moved away from where the class is filed gets **"Reset to the class's
  topic"** in its ⋯ menu.
- **Drag works across subtopics and topics**, and the class lands exactly where it is dropped.
- **Dragging a ticked row moves every ticked class**, gathered at the drop point in outline order. The
  drag preview reads "3 classes".
- **Bulk edit shrinks** to start date & time and Free. The main category, category, section, topic
  and subtopic *name* fields go: they renamed labels without moving anything. A bulk **Move to…**
  joins the ticked-rows bar.
- **Class PDF upload.** The PDFs sheet's "Bulk Upload & Assign" becomes **"Upload PDFs"**. The PDFs
  are filed under the class's own main category, category, section and topic (shown, not asked). Their
  Free checkbox means **free in this class**, and it is off by default.

### Classes that appear in two places in one course

About 400 placements (mostly the RRB and SRB Record Breaking batches) show one class in two places of
the same course: the migration kept every folder the old platform had put the video in. Underneath it
is one placement carrying a list of places (`CourseClass.apxDisplayPlacements`, one outline row per
entry). The admin **never says "AppX"** about these rows; the migration is complete and no bulk writer
will touch them again.
- Each place moves on its own (drag or Move to…). It has no Reset.
- Its row shows an **"Also under ‹path›"** tag.
- **Remove** takes away only that place. If both places are ticked, the class leaves the course.
- **The In course switch** covers the class in every place, and its toast says "Also hidden under
  ‹path›".

### Rules every move follows

- A move changes this course only.
- A drop or Move to… that lands an ordinary row exactly where the **class itself** is filed clears the
  placement's override, so it follows the class again. The "pinned but identical" state is no longer
  created.
- **Refused, and nothing moves:**
  - a drop into the "No topic" section (a course placement needs at least a section and a topic);
  - anything that would put one class twice in the same topic, **including two different subtopics of
    that topic**: "‹title› is already in ‹topic›".
- When a topic's last class moves out, its tab disappears for students. There is no confirm and no
  Undo; dragging back is the undo.

### Round 2 user stories

25. As a course admin, I want Go live in the row ⋯ menu instead of on the row, so that the outline row stays quiet for classes I don't teach.
26. As a course admin, I want the reorder arrows gone from class rows, so that rows have room and drag is the one way to reorder.
27. As a course admin, I want to move a class to another topic or subtopic of this course with Move to…, so that I don't have to think about "placements".
28. As a course admin, I want to drag a class into another topic or subtopic, so that re-filing is the same gesture as reordering.
29. As a course admin, I want a dragged class to land exactly where I drop it, so that I don't have to reorder it again.
30. As a course admin, I want to drag several ticked classes at once, so that moving a series is one gesture.
31. As a course admin, I want to move several ticked classes with Move to…, so that I can move a series far away or from a phone.
32. As a course admin, I want to put a moved class back under its own topic in one click, so that a mistake is easy to undo.
33. As a course admin, I want a class that appears in two places to say where else it is, so that removing or switching it off never surprises me.
34. As a course admin, I want removing one place of such a class to leave the other place alone, so that students who bought the course don't lose it by accident.
35. As a course admin, I want Bulk edit to offer only what it really changes (start time and Free), so that I don't rename labels by mistake.
36. As a course admin, I want PDFs uploaded for a class to be filed from the class and not free unless I say so, so that uploading notes is one step and never makes a PDF free in every course.
37. As a student, I want a class to appear only once in a topic, so that lists don't repeat.

### Round 2 implementation decisions

**Backend**
13. **One move endpoint.** `POST /api/admin/courses/:courseId/placements/move` with
    `{ rows: [{ placementId, listingId? }], target: { sectionId, topicId, subTopicId? }, order? }`,
    admin auth. It moves the rows and, when `order` is sent, saves the destination topic's order, **in
    one transaction**.
    - **`order`** is the full new row order of the destination topic, `{ placementId, listingId? }[]`,
      as `topic-order` takes it. It must equal the destination topic's current rows plus the moved
      rows (else 409, like `topic-order`). The priorities are handed out as `reshuffleTopicPriorities`
      does, over that union. Without `order`, moved rows land **last**: course max + 1 upward, in the
      order sent.
    - **Ordinary row** (`listingId` absent): set the placement's `section`/`topic`/`subTopic` and unset
      its name overrides, as the taxonomy PATCH does. If the target equals the Class's own taxonomy
      (section, topic, and subtopic or its absence), unset the override instead: the placement follows
      the class.
    - **Row of a class in two places** (`listingId` = the entry's `apxClassId`): set that entry's
      `section`/`topic`/`subTopic` with a positional update and unset its `sectionName`/`topicName`/
      `subTopicName`. Positional `$set` skips mongoose validators, so check the ids by hand
      (`taxonomyChainError`). Never "follow the class".
    - **Refusals** (400, nothing written): no topic in the target; a topic not under the section or a
      subtopic not under the topic; a placement or entry not in this course. **409
      `{ code: 'CLASS_ALREADY_IN_TOPIC', title }`** when, after the move, one CourseClass would have
      two rows in the same topic (any subtopic).
    - **Topic tabs:** a destination topic new to the course is appended to the stored topic order.
      `appendNewPlacementTopicsToCourseTopicOrder` works per placement and gathers sibling entries'
      topics, so its "already present" check can skip or misplace a topic; compute the new topics from
      the destination alone.
    - The taxonomy PATCH stays for **Reset** (`{ followClass: true }`) and loses its other callers.
14. **Remove one place.** `DELETE /api/admin/courses/:courseId/placements/:placementId/listings/:listingId`
    pulls one entry from `apxDisplayPlacements`. Removing the **last** entry is refused (409); the
    admin removes the class instead, through the existing remove. The admin's bulk Remove sends a
    place delete for a ticked row whose sibling stays unticked, and the class remove when every place
    of that class is ticked. Never takes a class out of the course unless every place was ticked
    (memory "Never remove granted access").
15. **Outline rows carry the other places** of a class in two places (`otherPlaces: string[]`, the
    group paths), so the tag and the switch toast need no extra read.
16. **Class PDF upload** keeps the bulk session path. When opened for a class:
    - the metadata is the class's own `mainCategory`, `category`, `section` and `topic` (`topic` may be
      null; the backend already accepts it). Pdf has no subtopic;
    - `Pdf.isFree` is **false**; the row's "Free in this class" goes to the assignment instead:
      `POST` the class PDF assign with `pdfs: [{ pdfId, isFree }]` (that body is already accepted).

**Admin**
17. **Go live** becomes the first `OutlineRowMenu` item (`useGoLive` unchanged). The row button and
    `goLiveSolid` / `isGoLiveSolid` go.
18. **Arrows out.** The per-row ▲▼ (`classMoveOrder`, `AssignedClassesView.tsx`) go. The drag handle
    must be focusable, announce itself, and reorder with Space + arrow keys (dnd-kit `KeyboardSensor`
    is already registered in `OutlineSortable.tsx`). Drag must work by touch on a phone (a
    `TouchSensor` / pointer activation delay), since the arrows were the phone path.
19. **Move to…** replaces `PlacementTaxonomyDialog`'s radio dialog and the row "Change topic" link. It
    is one dialog for one row or a ticked set: section, topic, subtopic pickers; "Only this course
    changes"; "It goes last in ‹path›"; an amber note when the topic is new to the course ("students
    will see a new topic tab"); a green note when an ordinary row lands back on its class's topic; the
    409 shown inline with Move disabled. **Reset to the class's topic** shows only on an ordinary row
    whose `taxonomyState` is `custom`.
20. **Cross-group drag.** Collision detection lets a class row drop in any class group (`classDropMove`
    stops refusing other subtopics and topics). A drop between groups calls decision 13's endpoint
    with `order`; a drop inside one group keeps `topic-order`. Leaf group headers accept a drop at the
    top of their group. While dragging, the drop line turns red with the reason over "No topic" and over
    a topic the class is already in; dropping there does nothing.
21. **Multi-drag.** Dragging a ticked row drags every ticked row, in outline order, gathered at the drop
    point. The overlay is a stacked card: "3 classes" + the first title + "+2 more". The ticked set
    clears after a cross-group move. A ticked set spanning groups is allowed.
22. **Repeated rows:** an "Also under ‹path›" tag; the switch toast "Also hidden under ‹path›" (the
    switch already writes the placement, so it covers every place).
23. **Bulk edit** keeps start date & time and Free; the five name fields go, with a line pointing to
    Move to… The bulk bar gets Move to…
24. **Class PDF upload** (`BulkUploadPdfsSheet` opened from the class PDFs sheet): titled "Upload
    PDFs", the button renamed from "Bulk Upload & Assign"; Filters hidden and the class's taxonomy
    shown read-only; the topic requirement relaxed for a class with no topic; the row and default
    checkbox read **"Free in this class"**, off. On the PDFs dashboard, "Free by default" starts
    **off** too.
25. **The "Showing 25 of 8565" line** the user saw in the class PDFs sheet comes from the Available tab
    (`AvailablePdfsViewForClass`, `totalAvailablePdfs`). Confirm that is what was on screen; the
    class's own tab must count only its PDFs.

### Round 2 out of scope

- Reset for a class shown in two places (no stored origin to go back to).
- Switching one place of such a class off on its own.
- Undo after a move.
- Live classes made in place: the end stays the end of the start's IST day, and a past start is still
  accepted (user, 2026-10-02).
- Student `class-tabs` reads the placement-level taxonomy and never the per-place list, so a moved
  place doesn't change class-tabs (known gap, as before).
