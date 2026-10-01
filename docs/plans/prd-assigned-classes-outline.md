# PRD: Assigned Classes outline (Section › Topic › Subtopic, drag everywhere, Copy to another course)

State: ready-for-agent
Date: 2026-10-01
Owning repos: `quicktricks-backend` + `quicktricks-admin` (the client forks, line `quicktricks-admin`).
Work continues on the existing local branch `feat/course-class-grouped-view` in both forks (not pushed,
not deployed). No service contract in `SYSTEM.md` is crossed: this is admin UI over the LMS admin API.
The student website and the app are read-only consumers of the order this screen writes.
Glossary: `quicktricks-backend/CONTEXT.md` → "Course class order" (Placement, Placement taxonomy, Class
taxonomy, Listing, Priority, Sequence). This PRD adds **Course topic order** (below).
Prototype (layout A was chosen): https://claude.ai/artifact/XUpEiDuAbsg1WeacpoZ3Fu
Builds on: the grouped Assigned Classes tab already on the branch (see the
`course-class-grouped-view` handoffs of 2026-09-30 and 2026-10-01).
Tasks: `docs/plans/tasks/assigned-classes-outline/` (12 tasks, cut 2026-10-01).

## Problem Statement

An admin arranging a course's classes cannot see the course the way students see it. The student
website shows **Section tabs → Topic accordions → Subtopic chips → classes**. The admin's Assigned
Classes tab shows one flat "Section › Topic" heading per topic, with no subtopic level. A 157-class topic
such as Railway Prime Batch's "Core Maths" is therefore one long undifferentiated list in the admin, while
students see it split into Number System, LCM & HCF, Simplification and ten more subtopics.

Ordering is also harder than it needs to be:

- **Priority boxes.** Every row carries a Priority box. A number typed into it that is already used
  silently sends the class to the end of the whole course.
- **Section and topic order.** The admin cannot set the order of sections or topics at all. The old
  Topic Priority page calls an endpoint that does not exist, so it fails on every load, and nothing
  links to it. No code anywhere writes the stored topic order the website reads; only 11 of 103
  courses have one, left over from a script on 2026-08-29.
- **Reverse priority** sits as a prominent text button on every topic header, although it is rarely
  wanted and hard to undo.

**End date and time** is asked for on every placement and in Bulk Edit, on both the Assigned Classes tab
and the class-side Manage Course Assignments page. It does nothing for students: no student listing
filters on a placement's end date. It only feeds the teacher/admin live schedule.

Finally, an admin who has arranged a course well cannot reuse that arrangement. Putting the same classes
into another course means assigning them one by one and re-filing and re-ordering each.

## Solution

Rebuild the Assigned Classes tab as one outline (layout A of the prototype): **Section › Topic › Subtopic
› classes**, in exactly the order students see.

**What the outline shows**
- **Sections.** Section, topic and subtopic headers each collapse. A section header shows its topic
  and class counts.
- **Topics.** A topic header shows its class count and how many subtopics it has.
- **Subtopics.**
  - They appear only inside topics that use them.
  - In mixed topics, the classes without one go under "Others".
  - Subtopics come in the order the website shows its chips.
- **Sequence numbers** run straight through each topic, matching what students see under the website's
  "All" chip.

**Ordering is done by dragging, at every level**
- A **class** moves within its subtopic (or within its topic when the topic has no subtopics).
- A **subtopic** moves within its topic.
- A **topic** moves within its section.
- A **section** moves within the course.
- ▲▼ arrows stay on each row as the keyboard and accessible way to move a class.
- Moving a class to a different subtopic or topic stays a deliberate action through **Change topic**, as
  today. A drop across groups is not allowed.
- Section and topic moves save the course's topic order, which the website already reads, so students
  see the new tab and accordion order with **no website change**.

**What is removed, and where the rare actions go**
- The Priority box, the listing Priority box, the End column and Bulk Edit's "Set End Date" are gone.
  Start date, Status and Is Free stay.
- Reverse priority moves into the topic header's ⋯ menu. Course-wide reverse moves into a toolbar ⋯ menu
  as "Reverse priority in every topic".
- Manage Course Assignments (the class-side page) loses End date and Priority the same way. New
  assignments from either side land at the end, as the Available Classes step already does.

**Copy to another course** (in the toolbar ⋯ for the whole course, a section's or topic's ⋯, or the
selection bar for ticked classes)
- **What it does.** It assigns the **same classes** to an existing course, under the same Section ›
  Topic › Subtopic and in the same order, after that course's own classes in each topic.
- **Nothing is removed.** Nothing leaves the source course and nothing is replicated. Rule: once a student
  has access to something, it is never taken away.
- **Before copying, a preview** shows per topic how many classes will be added, how many are already
  there and will be skipped, and where they land.

The broken Topic Priority page is deleted.

## User Stories

1. As a course admin, I want the Assigned Classes tab grouped by Section, then Topic, then Subtopic, so that I see the course exactly as students see it on the website.
2. As a course admin, I want sections in the same order as the website's section tabs, so that what I arrange is what students get.
3. As a course admin, I want topics inside a section in the same order as the website's topic accordions, so that I can trust the outline.
4. As a course admin, I want subtopics in the same order as the website's subtopic chips, so that the chip order is visible and controllable from the admin.
5. As a course admin, I want a topic without any subtopics to show its classes directly, with no extra heading, so that the 88% of topics that do not use subtopics stay as compact as today.
6. As a course admin, I want classes without a subtopic in a mixed topic grouped under "Others", so that nothing is hidden and the label matches the website's chip.
7. As a course admin, I want the sequence number to run straight through a topic across its subtopics, so that it matches the "All" order students see and titles like "Day 06 … Part-6".
8. As a course admin, I want each section header to show how many topics and classes it holds, so that I can judge its size before expanding it.
9. As a course admin, I want each topic header to show its class count and subtopic count, so that I know what is inside without opening it.
10. As a course admin, I want each subtopic heading to show its class count, so that I can spot thin or overloaded subtopics.
11. As a course admin, I want to collapse and expand any section, topic or subtopic, so that I can work on one part of a 900-class course without scrolling past the rest.
12. As a course admin, I want one toolbar control to collapse or expand everything, so that I can reset the view quickly.
13. As a course admin, I want a section's ⋯ menu to collapse or expand all of its topics, so that I can focus on one section.
14. As a course admin, I want a topic's ⋯ menu to collapse or expand all of its subtopics, so that I can scan a topic's subtopics before diving in.
15. As a course admin, I want search to show only matching classes (by title or subtopic) with their groups expanded, so that I can find a class anywhere in the course.
16. As a course admin, I want drag-and-drop turned off while a search is active, with a note saying so, so that I never reorder a filtered list by mistake.
17. As a course admin, I want to drag a class to a new place within its subtopic, so that I can fix the order in one gesture instead of typing priority numbers.
18. As a course admin, I want to drag a class within a topic that has no subtopics, so that ordering works the same everywhere.
19. As a course admin, I want a class drag to change only that topic's order, so that no other topic and nothing outside the course moves.
20. As a course admin, I want to drag a whole subtopic within its topic, so that I control the order of the website's subtopic chips.
21. As a course admin, I want to drag a topic within its section, so that I control the order of the website's topic accordions.
22. As a course admin, I want to drag a whole section, so that I control the order of the website's section tabs.
23. As a course admin, I want a class I cannot drop into another subtopic or topic, so that re-filing a class always goes through the deliberate Change topic dialog.
24. As a course admin, I want ▲▼ arrows on each class, so that I can reorder with the keyboard or without dragging.
25. As a course admin using a keyboard or screen reader, I want every drag action to have a non-drag equivalent, so that the screen stays accessible.
26. As a course admin, I want Reverse priority for one topic inside that topic's ⋯ menu, so that a rare and hard-to-undo action is not a button on every header.
27. As a course admin, I want "Reverse priority in every topic" in the toolbar's ⋯ menu, so that the course-wide reverse is still available but out of the way, and section and topic order stay as they are.
28. As a course admin, I want reversing a topic that has subtopics to reverse both the subtopic order and the classes inside each, so that the result is the exact mirror of what I see.
29. As a course admin, I want Change topic to keep working on each class, so that I can re-file a class into another section, topic or subtopic for this course only.
30. As a course admin, I want a class I re-file to land last in its new place, so that the behaviour stays predictable.
31. As a course admin, I want classes that are listed under several topics to stay draggable within each topic but not re-fileable through Change topic, so that the existing rule for listings is kept.
32. As a course admin, I want the Priority box and the listing Priority box removed, so that I can no longer send a class to the end of the course by typing a number that is already used.
33. As a course admin, I want the End date column removed, so that I stop setting a value that has no effect for students.
34. As a course admin, I want Bulk Edit to keep Status, Start date and Is Free but drop End date and priority, so that bulk changes match what the row still offers.
35. As a course admin, I want Start date, Status and Is Free unchanged on every row, so that today's day-to-day edits still work.
36. As a course admin on the class side (Manage Course Assignments), I want the assign dialog to stop asking for End date and Priority, so that assigning a class to a course is the same simple step on both sides.
37. As a course admin on the class side, I want the assigned-courses list and its bulk update to drop End date and Priority, so that no screen still writes them.
38. As a course admin, I want a newly assigned class to land at the end of its topic, so that assigning never disturbs the order I have arranged.
39. As a course admin, I want existing end dates left as they are in the data, so that removing the field changes nothing for students or for the live schedule that reads it.
40. As a course admin, I want "Copy to another course…" in the toolbar's ⋯ menu, so that I can put a whole course's arrangement into another course.
41. As a course admin, I want "Copy this section to another course…" and "Copy this topic to another course…" in those headers' ⋯ menus, so that I can reuse one part of a course.
42. As a course admin, I want a "Copy to another course" button in the selection bar, so that I can copy just the classes I ticked.
43. As a course admin, I want to pick the target from a searchable list of existing courses, so that I can find it among more than a hundred.
44. As a course admin, I want a preview before copying that shows per topic how many classes will be added, how many are skipped and where they land, so that I know exactly what will change in the other course.
45. As a course admin, I want copied classes to keep their Section › Topic › Subtopic and their order, so that the other course gets the same arrangement.
46. As a course admin, I want copied classes to land after the other course's own classes in each topic, so that its existing order is never disturbed.
47. As a course admin, I want topics that are new to the other course to land at the end of its outline, so that its existing sections and topics keep their places.
48. As a course admin, I want classes the other course already has to be skipped and counted, so that copying never creates duplicates or overwrites how that course has arranged them.
49. As a course admin, I want a class that the other course once had but deactivated to be reactivated with the copied arrangement, so that copy behaves like assigning it again.
50. As a course admin, I want Is Free, start date and status copied as they are, so that the other course behaves the same for students.
51. As a course admin, I want the copied placements to point at the same classes, with no new class records, so that a later fix to a class title or video shows up in both courses.
52. As a course admin, I want copying to leave the source course completely untouched, so that no student ever loses access to something they have.
53. As a course admin, I want a clear result after copying ("134 classes added to X, 23 already there"), so that I can confirm it worked.
54. As a course admin, I want the Copy button disabled with "Nothing to copy" when everything is already in the target, so that I am not asked to confirm a no-op.
55. As a course admin, I want classes listed under several topics to come across with all their listings when any of them is in what I copy, and the preview to say so, so that the other course gets the same listings.
56. As a restricted admin (a role that only sees its own classes), I want Copy to another course to be unavailable, so that I cannot write classes into a course I do not manage.
57. As a course admin, I want an outline that changed under me (another admin reordered it) to refuse my save and ask me to refresh, so that I never overwrite someone else's order with a stale one.
58. As a student on the website, I want section tabs, topic accordions and subtopic chips to follow the admin's arrangement, so that the course reads in the intended order.
59. As a student, I want nothing I have access to removed when an admin copies classes, so that my course never shrinks under me.
60. As a student in a course that never had a stored topic order, I want the order to stay exactly as it is until an admin moves a section or topic, so that nothing shifts unexpectedly.
61. As a course admin, I want the old Topic Priority page removed, so that nobody lands on a screen that fails on every save.
62. As a course admin on a phone, I want the outline to stay usable at phone width, so that I can make a quick fix away from a desk.

## Implementation Decisions

**Vocabulary.** Keep the CONTEXT terms (Placement, Placement taxonomy, Class taxonomy, Listing,
Priority, Sequence) and add these to the backend `CONTEXT.md` under "Course class order":
- **Course topic order**: the stored order of a course's topics (`coursetopics.priority`), the only
  stored order above the class level.
- **Section order**: derived, never stored. A section sits where its first topic sits, the same rule the
  website uses for its tabs.
- **Subtopic order**: derived, never stored. A subtopic sits where its first class sits in Priority order,
  the same rule the website uses for its chips.

No "APX" anywhere in UI or glossary; never "order" (purchase), "position" (playback) or "rank".

**Backend modules**

1. **Course outline** (pure, replaces today's flat grouping)
   - Input: a course's listing rows (as loaded today, with effective taxonomy) and its course topic order.
   - Output: a tree, sections → topics → subtopic groups → listings.
   - Topic order: the course topic order first, then the topic's lowest Priority, then the name. Keep the
     current rule.
   - Section order: a section sits where its first topic sits.
   - Subtopic groups: in order of first appearance. Classes without a subtopic form an "Others" group,
     present only when the topic has at least one real subtopic. A topic with no subtopics has a single
     unnamed group.
   - Sequence runs 1…n through the topic in group order.
   - `GET /api/admin/courses/:courseId/class-groups` returns this tree in place of the flat group list.
     Its only consumer is this unreleased branch, so the shape may change freely.
2. **Course topic order** (pure core plus a new admin endpoint)
   - Endpoint: `PUT /api/admin/courses/:courseId/topic-priorities`, body: every topic id in the course's
     outline, in the new order.
   - The core checks the list is exactly the course's current topic set: no missing, extra or
     duplicated topics. Otherwise 409 "changed since loaded".
   - It writes priorities 1…n as active `coursetopics` rows (`course`, `topic`, `priority`, `isActive`,
     timestamps), creating rows where none exist and reactivating inactive ones.
   - Section drags and topic drags both send the full list. A section drag sends the topics with that
     section's topics moved as one block.
   - Every write that brings a new topic into a course that already has a stored topic order (Change
     topic, Copy, assign) appends a row at the end. Otherwise the website's fallback (lowest class
     Priority) could place the new topic anywhere.
   - `coursetopics` has only an `_id` index today. Add a unique `(course, topic)` index, built under the
     index-build caution in memory `mongo-index-build-commit-quorum`. Ask before building on prod.
3. **Topic order** (existing `PUT …/topic-order`) is unchanged. Class drags and subtopic drags both
   produce a full new order of one topic's listings, which it already accepts. It still hands the topic
   its own Priority numbers back, so no other topic moves. A topic whose subtopics were interleaved
   (8 topics, 1,139 classes on prod) becomes contiguous by subtopic the first time anyone reorders it.
   That changes its "All" order for students; this is accepted.
4. **Copy plan** (pure core plus a new admin endpoint)
   - Endpoint: `POST /api/admin/courses/:courseId/copy-to/:targetCourseId`, body:
     - `scope`, one of: `{ kind: 'course' }`, `{ kind: 'section', sectionId }`,
       `{ kind: 'topic', sectionId, topicId }` or `{ kind: 'placements', placementIds }`.
     - `preview`, a boolean.
   - The core takes the source placements in scope (in outline order), the target's placements (active and
     inactive) and the target's course topic order. It returns, per source Section › Topic:
     - how many are added, skipped (already active in the target) and reactivated;
     - where they land: after N existing classes, or as a new topic at the end;
     - whether any multi-topic listings come along.
   - **Priority.** Added placements keep their source taxonomy pin (Section, Topic, Subtopic and name
     overrides), Is Free, start date, status and listings. They get target Priority numbers above the
     target's current maximum, in source order. Listings likewise land after the target's own listings
     in each of their topics.
   - **Same classes, no copies.** A placement points at the same Class. The unique `(course, class)` index
     guarantees one placement per class per course.
   - **Writing.** `preview: true` returns the plan only; otherwise the plan is written in one go and the
     same plan is returned as the result.
   - **Nothing is ever removed** from either course.
   - **Who can copy:** full-access roles only (`admin`, `sub_admin`); 403 for restricted roles. Both
     courses must exist (404), and source ≠ target (400).
5. **Assign defaults** are unchanged: an omitted priority means last + 1, and omitted dates use the
   existing assignment window. Admin screens stop sending priority and end date. The backend keeps
   accepting both, for other clients.

**Admin modules**

6. **Outline model** (pure)
   - Input: the class-groups tree plus search and collapse state.
   - Output: the visible tree and the request each move produces: class within its group, subtopic within
     its topic, topic within its section, section in the course, reverse a topic, reverse every topic.
   - A move returns a `topic-order` payload (class and subtopic moves, reverses) or a
     `topic-priorities` payload (topic and section moves). It refuses cross-group moves.
   - It replaces the flat-group helpers on the branch.
7. **Assigned Classes view (layout A)**
   - Nested collapsible headers with counts. Rows show: drag handle, checkbox, Sequence, title, teacher,
     ▲▼, Change topic, Start date, Status, Is Free.
   - Drag uses `@dnd-kit` (new dependency): one sortable context per container, with handles per level,
     so a row handle never drags its topic.
   - Drag is disabled while searching.
   - ⋯ menus:
     - **toolbar:** reverse priority in every topic, Copy to another course;
     - **section:** collapse/expand topics, copy section;
     - **topic:** reverse priority, collapse/expand subtopics, copy topic.
   - The selection bar gains "Copy to another course".
   - Saves invalidate and refetch the class-groups query. A 409 shows "This course changed since it was
     loaded. Refresh and try again."
8. **Copy to another course dialog**
   - Step 1: a searchable picker over existing courses, excluding the source.
   - Step 2: a preview table per Section › Topic with Add, Skip and Lands columns, from the endpoint with
     `preview: true`.
   - Confirm runs the copy and shows the result counts.
   - When nothing would be added, the button is disabled and reads "Nothing to copy".
9. **Manage Course Assignments** (class side): remove End date and Priority from the assign dialog, the
   assigned-courses list and its bulk update. The unused `ManageCoursesDialog` component may be deleted
   along the way.
10. **Delete** the Topic Priority page, its hook and its utilities.

**Order of work** (to be cut into tasks):
1. Outline read + layout A + removals.
2. Class and subtopic drag.
3. Course topic order endpoint + topic and section drag + page deletion.
4. Copy to another course.

The branch is deployed together at the end, after the user previews it locally against production reads.
Copy may ship as its own deploy if it lags.

## Testing Decisions

- **What makes a good test.** It asserts behaviour seen from outside the module, not how it is built:
  - for the pure modules: inputs → outputs;
  - for endpoints: HTTP in → status, body and resulting documents;
  - for the view: what an admin sees and the request a click sends.
- **Backend, unit tests (pure modules):**
  - **Course outline:**
    - section, topic and subtopic ordering;
    - "Others" only in mixed topics;
    - no group heading for topics without subtopics;
    - Sequence continuity across subtopics;
    - interleaved subtopics grouped by first appearance;
    - topics with and without a stored order.
  - **Course topic order:**
    - exact-set validation (missing, extra and duplicate topics → error);
    - priorities 1…n;
    - a section block move.
  - **Copy plan:**
    - skip vs add vs reactivate;
    - landing after the target's maximum per topic;
    - a new topic appended to the target's topic order;
    - each scope kind;
    - multi-listing placements pulled in whole;
    - source order preserved.
- **Backend, endpoint tests:** `PUT …/topic-priorities` and `POST …/copy-to/:target`. Cover: validation,
  409 on a stale list, 403 for restricted roles, preview writes nothing, a real copy writes the planned
  placements and the target's topic order, and a re-run is idempotent (everything skipped). Prior art:
  the grouped-view unit and integration tests already on the branch (course class groups), using the
  in-memory Mongo integration setup.
- **Admin, unit tests (outline model):** each move kind produces the right payload; cross-group moves are
  refused; reverse mirrors subtopics and classes; search filtering and collapse state. Prior art: the
  course-class-groups helper tests run with `node --test`.
- **Admin, component tests (Assigned Classes view):**
  - nested headers render with counts;
  - Priority and End are absent;
  - ▲▼ and the ⋯ menu items send the expected requests;
  - drag handles are disabled while searching;
  - the copy dialog's preview and confirm.

  Drag gestures themselves are not simulated in jsdom; they go through the same outline-model functions
  that the arrows and menus call. Prior art: the existing Assigned Classes and Available Classes vitest
  files (run with `--exclude .sandcastle/**` where the runner needs it).
- **No new tests** for the Manage Course Assignments field removals or the page deletion. Type-checking
  and a manual pass cover them.
- **Baselines to keep green:** the branch's 22 backend grouped-view tests, the 28 admin vitest tests and
  the 9 admin `node --test` tests, plus a clean backend type-check. The full backend suite's 17 failures
  and the admin's ~138 type errors already exist on origin; do not add to them.

## Out of Scope

- **The one-stop screen:** assigning PDFs, creating recorded classes and going live from Assign Classes.
  It gets its own PRD later; v1 there will link out to the existing upload and live flows.
- **Moving classes between courses**, or any action that removes classes from a course students may
  have bought. Not offered by design.
- **Copying into a new course.** Duplicate stays a course-document-only copy. To copy into a new course,
  create it first, then use Copy to another course.
- **Dragging a class across subtopics or topics.** Change topic remains the way to re-file.
- **Student website or app changes.** The website already honours course topic order and derives
  section and subtopic order. The app may still order topics differently (open issue in memory
  `course-class-grouped-view`), but that is not addressed here.
- **Clearing existing placement end dates**, or changing what the live schedule does with them.
- **PDFs and tests** in Copy to another course, until the one-stop screen brings them into this view.
- **Copy for restricted (own-classes-only) roles.**

## Further Notes

**Production facts this PRD rests on** (read-only, 2026-10-01):
- **Topics and sections.** 103 courses have active placements, in 1,613 topic groups. No topic is
  split across two sections. A typical course has 3 sections and 10 topics; the largest has 32 sections
  and 102 topics.
- **Subtopics.** 15,338 of 32,302 active placements have a subtopic, but only 190 of 1,613 topic groups
  use subtopics (157 fully, 33 mixed). The most subtopics in one topic is 39. 8 topics with 1,139
  classes have interleaved subtopics.
- **Stored topic order.** `coursetopics` holds 114 rows across 11 courses, all with a priority; the
  last write was 2026-08-29. No code writes it, and it has no index besides `_id`.
- **Multi-topic listings.** 415 placements carry listings, across 18 courses.
- **End dates.** Placement end dates are read only by the teacher/admin live schedule, never by a
  student listing.

**Notes for implementers**
- **Local preview writes to production.** Follow the handoff's local-preview steps. Writes from a local
  admin hit the production database, so test drags and copies on a course the user names, and prefer
  the in-memory integration tests for anything destructive.
- **Fork rules:** commit as the work email, no co-author trailers, and never push or deploy without
  asking.
- **Separate bug:** the class "add and assign" flow likely fails validation on empty start/end dates. It
  is tracked as its own task, not part of this PRD.
