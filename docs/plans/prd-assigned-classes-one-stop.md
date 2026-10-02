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
     *No video yet*.
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
   - Bulk Edit keeps Status, and Copy still copies it.
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
- Multi-class drag, which is a separate decision pending.

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
