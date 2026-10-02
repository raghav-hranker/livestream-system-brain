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

**Row ⋯ menu.** Every class row in the outline gets a ⋯ menu with:
- **Go live:** the same flow as the Classes list. It mints the Streamer token and opens the class
  screen in a new tab.
- **Upload video:** the existing upload dialog. If the class already has a recording, it warns that the
  upload replaces it.
- **PDFs:** a side sheet listing the class's PDFs. The admin can preview, reorder, remove, and upload or
  attach PDFs.
- **Tests:** the same side sheet for the class's tests.

The PDF and Tests sheets say **"Changes apply to this class in every course (N)"**, because a class's
PDFs and tests belong to the class itself, not to this course.

**Add a class in place.** Section, topic and subtopic ⋯ menus gain:
- "Add recorded class here", which opens a short dialog:
  - **Title:** suggested from the last class in that group. If it ends in a number ("Part-6",
    "Day 06"), the suggestion is the next number. It is always editable, and it must be unique across
    all classes.
  - **Teacher:** prefilled from the last class in that subtopic. If there is none, from the topic; if
    there is none there either, from the course's faculty. It is editable.
  - **Create** files the class under that Section › Topic › Subtopic and gives it the course's main
    category and category. It assigns the class to this course, last in its group. It is **active
    straight away**, as on the Classes page today, and the upload dialog then opens.
- "Schedule live class here": the same dialog plus a start date and time. The class is then ready for
  Go live.

**Copy to another course is unchanged.** A class's PDFs and tests already come along, because Copy
places the same class in the target course.

## User Stories

1. As a course admin, I want a ⋯ menu on every class row, so that a class's tools are in the outline where I arrange it.
2. As a course admin, I want Go live from a class row, so that I can start a live class without leaving the course.
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
3. **Class tests auth** is a prerequisite for the Tests sheet. A separate task, "Guard class
   test-assignment routes with requireAdmin", adds `requireAdmin` to the series mutation routes and
   sends the admin token from `use-class-series.ts`.

**Admin**
4. **`useGoLive`.** Lift `ClassesDashboard.handleGoLive` into a hook used by the Classes list, the live
   schedule and the outline.
   - Keep `userId = classId` in the Streamer token, as the Classes list does. ls derives the socket
     identity from it.
   - The schedule screen's admin-id variant is the odd one out: either align it or record why it
     differs.
5. **Row ⋯ menu** (`OutlineRowMenu`) on every class row, disabled while a drag or save is in flight. A
   listing row's menu acts on its class.
6. **Upload video** reuses `SingleVideoUploadDialog`. It warns before replacing when the row's
   `streamStatus` / `hasPlayback` shows a recording exists.
7. **PDF sheet.** Make the assign-PDFs-to-class views (`AssignedPdfsViewForClass`,
   `AvailablePdfsViewForClass`) take `classId` as a prop, keeping the page working. Mount both in a
   `Sheet` with the course-count banner.
8. **Tests sheet.** The same, with the class series views.
9. **Add class dialog** (`AddClassInPlaceDialog`). It computes the title suggestion and the teacher
   prefill from the outline group already loaded.
   - **Title:** take the trailing number of the last class's title, including zero-padding (`Day 06` →
     `Day 07`); with no trailing number, leave it empty.
   - **Teacher:** the last class in the subtopic, else the topic, else the course faculty.
   - After the create, it refetches the outline and, for a recorded class, opens the upload dialog.

## Testing Decisions

- **Backend integration** (in-memory Mongo):
  - in-place create: derivations, landing last, topic-order append, duplicate title 409, taxonomy
    mismatch 400, live start required;
  - the class course count.
- **Admin:**
  - pure tests for the title suggestion and the teacher prefill;
  - component tests:
    - the row ⋯ items call the right hooks;
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
