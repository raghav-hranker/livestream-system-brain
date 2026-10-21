# PRD: Vidyagram catalogue filters (Old, Exams, Skills, search)

Status: draft 2026-10-20. Vidyagram only (backend branch `vidyagram-admin`, admin branch `vidyagram-admin`). Nothing here ships to quicktricks.

Source: the "My courses" screen of the Vidyagram app prototype (`Vidyagram-App.html#courses`, 2026-10-18 build). Its catalogue has the tabs All, Exams, Skills, Teacher, New, Live, VOD, Old and Free. New, Live, VOD and Free already map onto `showInBatchFilter`, `isLive`, `isRecorded` and `isFree` on the course filter API. This PRD adds what is missing.

## Problem Statement

A student opening the catalogue in the Vidyagram app sees one flat list. They cannot browse by the exam they are preparing for, cannot find the non-exam skill courses (AI, design, video editing) as a group, and cannot tell a current batch from last year's cheaper recording of the same course. Old batches sit next to new ones at a lower price and confuse the buying decision.

The admin has no way to express any of this. The course form has no "this is an old batch" switch, and there is no place to say which part of the catalogue is skills rather than exams.

## Solution

The app's catalogue gets three new views on top of the existing filter API, each driven by data the admin already maintains or one new switch:

- **Exams.** A row of exam-group tiles (SSC, Railway, State exams) with a course count each, then a row of exam chips under the chosen tile (SSC CGL, SSC CHSL …). Tiles are the course's main category, chips are its category. Only groups that currently have a listable course appear.
- **Skills.** One chip row (All skills, AI, Design, Video editing) over the skill courses. Skills is one main category that exists from day one; its categories are the chips. Skill courses never appear under Exams and exam courses never appear under Skills.
- **Old.** Past batches sold as full recordings at a lower price. The admin ticks one "Old batch" switch on the course. An old course appears only under Old and nowhere else in the catalogue, is labelled "Old batch · VOD", and stays buyable.
- **Search.** Every catalogue tab except "My courses" has a text box that narrows the current tab by course title or teacher name.

## User Stories

1. As a student, I want an Exams tab, so that I see only the courses for the exam I am preparing for.
2. As a student, I want exam-group tiles (SSC, Railway, State exams) with a course count, so that I can tell at a glance how much is on offer for my group.
3. As a student, I want exam chips under the chosen group (SSC CGL, SSC CHSL …), so that I can narrow further to my exact exam.
4. As a student, I want an "All" chip under a group, so that I can see every course in the group without picking one exam.
5. As a student, I want empty groups and empty exams to be absent, so that I never tap into an empty list.
6. As a student, I want a Skills tab, so that non-exam courses (AI, design, video editing) are easy to find together.
7. As a student, I want skill chips (All skills, AI, Design, Video editing), so that I can narrow the skill courses.
8. As a student, I want skill courses kept out of the Exams tab, so that an exam group's count and list are about exams only.
9. As a student, I want an Old tab, so that I can buy a cheaper full recording of a past batch when I do not need live classes.
10. As a student, I want an old course labelled "Old batch · VOD", so that I know what I am buying.
11. As a student, I want old courses kept out of All, New, Live, VOD, Free, Exams and Skills, so that current batches are not mixed with last year's.
12. As a student who bought an old batch, I want it to stay in "My courses" with full playback, so that an admin marking it old never takes away what I paid for.
13. As a student, I want a search box on each catalogue tab, so that I can find a course by title or teacher without scrolling.
14. As a student, I want search to stay inside the tab I am on, so that searching under Exams › SSC does not show Railway courses.
15. As a student, I want an "All" tab that still shows the New, Live, VOD, Old and Free sections with counts and "See all", so that the landing view is a summary of the whole catalogue.
16. As a student, I want each tab to load fast, so that browsing feels instant on a phone.
17. As an admin, I want an "Old batch" switch on the course form, so that I can retire a batch in one click when its successor launches.
18. As an admin, I want ticking Old to switch "Live Course" off, so that an old batch can never be a live one.
19. As an admin, I want the API to reject Old together with Live, so that a stale or hand-crafted request cannot create an inconsistent course.
20. As an admin, I want unticking Old to bring the course back into every tab, so that marking old is reversible.
21. As an admin, I want an "Old" badge and an Old filter in the admin courses list, so that I can see which batches are retired.
22. As an admin, I want the Skills main category to exist without me creating it, so that the Skills tab works from the first deploy.
23. As an admin, I want to be unable to delete the Skills main category, so that the Skills tab can never silently vanish.
24. As an admin, I want to rename the Skills main category and give it an image, so that it matches the brand like any other group.
25. As an admin, I want to add categories under Skills (AI, Design, Video editing) in the normal Categories page, so that skill chips need no special screen.
26. As an admin, I want to file a skill course by picking "Skills" then "AI" in the same two dropdowns I use for exams, so that there is nothing new to learn.
27. As an admin, I want every other main category to count as an exam group with no action from me, so that existing data needs no backfill.
28. As an admin, I want the course list and course form to keep working for every course that has no new fields set, so that nothing changes for courses I do not touch.
29. As an app developer, I want the Exams tiles and counts returned by the filter API in the same response as the courses, so that one call renders the tab.
30. As an app developer, I want the Skills chips returned by the filter API, so that one call renders that tab too.
31. As an app developer, I want the filter API to take a `tab` value instead of me reconstructing each tab's flag combination, so that the rules live on the server and stay consistent with the website.
32. As an app developer, I want an old course to carry `isOld` in every course payload, so that I can label it wherever it appears.
33. As a developer, I want the "which tabs may show this course" rule in one place, so that a future tab cannot forget to exclude old or skill courses.

## Implementation Decisions

### Data

- `Course.isOld` (boolean, default false), through the existing course create and update validation. A request with `isOld: true` and `isLive: true` is rejected with a validation error. All course read projections include the field. No batch year: the title carries the year or version when it matters, and the card label is fixed text.
- `MainCategory.isSkills` (boolean, default false). No admin form field. Exactly one document has it true. The field is written only by a seed.
- No change to `Category`. A category's exam-vs-skill nature comes from its main category.
- A course remains in exactly one main category and one category. The prototype shows some courses under several exams; that is accepted as a limitation for now (see Out of Scope).

### Skills seed

- An idempotent seed, run as a one-off script against the Vidyagram database and safe to re-run, upserts one main category `{ isSkills: true }` named "Skills" with a placeholder image, status 1. It matches on `isSkills`, never on name, so a renamed Skills row is found again.
- The main category delete route refuses to delete a document with `isSkills: true`. The admin main category list shows a "Skills section" label on that row and hides its delete control.

### Catalogue tab rule (one module)

A pure rule module answers, for a course, which catalogue tabs may list it, and for a tab, which query clauses apply. It is the only place the following live:

- Old: `isOld: true` only on the Old tab; every other tab adds `isOld: { $ne: true }`.
- Exams: main category must have `isSkills: false`; grouping is by main category then category.
- Skills: main category must be the `isSkills: true` one; grouping is by category.
- New, Live, VOD, Free keep today's clauses (`showInBatchFilter`, `isLive`, `isRecorded`, `isFree`, and the existing "live implies not free" rule).
- All: no tab clause beyond the common ones (status 1, not old, not a hidden APX course, not inside an active course folder).

The admin courses list reuses the same rule for its "Old" filter so the badge and the app agree.

### Filter API

`POST /api/courses/filter` (and `/batch-filter`, which keeps forcing `showInBatchFilter`) gains:

- `tab`: one of `all`, `exam`, `skills`, `new`, `live`, `vod`, `old`, `free`. Optional. When absent, the request behaves exactly as today except that old courses are excluded, so the existing website and admin picker callers see no new courses appear and only retired batches disappear.
- `search`: optional text, matched case-insensitively against course title and the names of the course's faculties, after the tab clauses.
- `mainCategory` and `category` keep their meaning and narrow a tab further (Exams tile and chip).
- `isOld`: not accepted as a body field. Old is reached through `tab: 'old'` only, so no caller can accidentally mix old and current courses.

Response additions, alongside the existing `courses` and `courseFolders`:

- `groups`: for `tab: 'exam'`, one entry per main category with at least one matching course (id, name, image, priority, `coursesCount`, and its `categories` with id, name and `coursesCount`), ordered by priority. For `tab: 'skills'`, the same shape with the single Skills main category and its categories. Counts are computed from the same query as the courses, before `mainCategory`/`category` narrowing, so tiles keep their totals while a chip is selected.
- Every course carries `isOld`.

The admin picker mount (`/api/admin/courses/filter`) keeps old courses visible, since the admin must still be able to find and assign them. That mount passes a flag that the rule module honours.

### Other read paths

- `POST /api/courses/my-courses` and every entitlement, playback and PDF path ignore `isOld`. Buyers keep everything.
- The admin search (`GET /api/courses/search`) returns old courses; the admin list shows the badge.
- Home-page and website sections that call the filter API without `tab` lose old courses automatically. No other listing endpoint changes in this PRD.

### Admin

- Course form: an "Old batch" switch in the flags row with the other four switches. Turning Old on turns "Live Course" off and disables it with a hint. Loading an existing course sets it from the payload. The create and update payloads send it.
- Courses list (both the v1 and v2 pages): an "Old" badge in the title cell and an "Old" entry in the client-side flag filter, using the same rule helper as the "New Section" badge.
- Main category list: "Skills section" label and no delete for the seeded row.
- Nothing on the category form changes.

### Pricing and access

No change. An old course is priced like any other through `price` and `discountPrice`. Marking old does not touch orders, validity or entitlement.

### Teacher tab (added 2026-10-21)

The Teacher tab lists teachers, not courses, so it gets its own public endpoint rather than a `tab` value on the course filter: `GET /api/faculty/catalogue?subject=&search=` returning `teachers[]` (id, name, imageUrl, designation, subject, rating, reviewCount, coursesCount, mainCategories[] with id, name, image) sorted by rating desc, reviewCount desc, priority desc, and `subjects[]` (name, count) computed before the `subject` filter. Only teachers with at least one listable course appear; "listable" reuses the catalogue rule's common clauses so counts match the other tabs. `mainCategories` are the distinct main categories of those courses (the exam-body chips). Search matches teacher name or subject. Tapping a teacher uses the existing course filter with `facultyId` (plus `userId` for Enrolled/Open and `search` for the in-page search box); `GET /api/faculty/catalogue/:id` returns one teacher's header for a direct open.

New optional fields on `FacultyDetails`: `subject` (free text, one per teacher), `rating` (0–5, one decimal), `reviewCount` (integer). Admin-entered, with the same three fields on the faculty form and as columns on the faculty list. A teacher without a rating shows no stars. Decided against: mapping subject to the Sections taxonomy (mid-reconciliation, and skill teachers have no section) and a `tab: 'teacher'` on the course filter (would return an empty course list on one tab).

## Testing Decisions

A good test here drives the public HTTP route or the rendered form and asserts on what a student, admin or app developer observes: which courses come back for a tab, the group counts, a 400 for an invalid combination, a badge in the list. Tests do not assert on query objects or internal helper calls.

Backend, integration through the real routes on in-memory Mongo (prior art: the course state-flags and my-courses-tags integration suites under the backend's integration test folder):

- Old: a course with `isOld` appears only for `tab: 'old'`; absent for every other tab and for a request with no `tab`; present on the admin picker mount; still returned by my-courses for a buyer.
- Old validation: create or update with `isOld` and `isLive` both true returns 400 with the field named.
- Exams groups: two exam main categories with courses plus the Skills main category with courses; `tab: 'exam'` returns only exam courses, two groups with correct counts, and no Skills group; a main category with only old courses produces no group.
- Exams narrowing: `mainCategory` restricts courses and category chips while group counts stay whole.
- Skills: `tab: 'skills'` returns only courses under the `isSkills` main category and one group whose categories carry counts.
- Search: `search` narrows by title and by faculty name, case-insensitively, inside the chosen tab.
- No-tab compatibility: a request shaped like today's website call returns the same courses as before, minus old ones.
- Seed: running the seed twice leaves exactly one `isSkills` main category; renaming it and re-running does not create a second.
- Delete guard: deleting the `isSkills` main category returns an error and the document remains.

Rule module, unit: for each tab, the set of clauses, and for a sample course, the set of tabs it may appear in. This is the one pure module and the cheapest place to pin the matrix.

Admin, component tests (prior art: the existing CourseForm test file and the course-new-section rule test):

- Old switch turns Live off and disables it; the submitted payload carries it; loading a course with `isOld` shows it on.
- List badge and filter for Old.
- Main category list hides delete for the Skills row.

Manual, before deploy: the admin against the local Vidyagram backend and local Mongo, creating a Skills course and retiring a batch, then the three filter calls by hand.

## Out of Scope

- A real student review system. Teacher ratings are admin-entered numbers (see Teacher tab below) until one exists.
- Courses under more than one exam or skill. The prototype shows "Static GK 2.0" under four exams and a "3 in 1" bundle under three skills; with one category per course each lands under one chip. If this matters later, a `categories[]` list on the course would serve both tabs.
- The "Suggested for you" row and student exam preferences.
- Course-level chips inside a course (Not watched / In progress / Watched). Those filter classes, not courses.
- "Switch to the new batch" upsell linking an old batch to its successor.
- Any change to quicktricks, the thedhronas website or the home-page sections beyond the automatic loss of old courses.
- Backfilling `isOld` on existing data. Retiring batches is a manual admin decision.

## Further Notes

- Why Skills is a main category and not a separate list: `mainCategory` and `category` are required on every course, so a skill course has to fill them anyway. A separate skills model would mean a dummy exam category on every skill course or "if skill then ignore" branches in the form, filter and counts. One boolean on main category reuses the pickers, grouping and counting unchanged.
- Why the flag is seeded rather than ticked: it is true for exactly one row ever. A checkbox that is correct for one document and wrong for all others invites mistakes; a seed plus a delete guard cannot be misconfigured.
- Why Old is excluded everywhere rather than just from All: in the prototype, old courses have their own list and never appear under New, Live, VOD, Free, Exams or a teacher. One rule, "old is only in Old", is easier for the app and the admin to reason about.
- Why old courses are excluded even when `tab` is absent: the website and home sections call the same endpoint, and a retired batch sitting next to its successor there is the problem this PRD fixes. The admin picker is the one caller that needs them and gets them through its own mount.
- Default decisions taken without a team answer: search in scope; Teacher tab out. Batch year was considered and dropped 2026-10-20.
