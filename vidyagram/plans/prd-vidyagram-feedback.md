# PRD: Vidyagram student feedback (one system for every offering)

Status: needs-triage, draft 2026-10-22, revised 2026-10-22 (complaint-only tags, no direct teacher rating, practice batches and ebooks in v1). Vidyagram only (backend branch `vidyagram-admin`, admin branch `vidyagram-admin`). Nothing here ships to quicktricks. A later port to quicktricks is a separate change.

## Problem Statement

The Vidyagram team cannot tell which courses, practice batches, classes, PDFs, tests, ebooks or teachers students like and which ones they struggle with. The only per-content signal today is `ClassIssueReport` ("report a problem" on a class). Its routes take `userId` from the request body with no auth, and its admin page is unlinked and counts issue types the backend never writes. Teacher ratings on `FacultyDetails` are numbers an admin types in, and the app already shows them on the Teacher tab.

So a bad recording, a confusing PDF or a weak teacher is found only when someone complains on a call or stops renewing.

## Solution

One feedback record works the same way for every offering. A student opens any course, practice batch, class, PDF, test or ebook in the app and taps "Rate". They give 1 to 5 stars. If they give 1 to 3 stars, the app offers complaint tags for that kind of item ("Audio unclear", "Too fast", "Typos in PDF"), and the student may pick zero or more. Any rating may carry a short note. They can come back and change it at any time. One student has one feedback per item.

Students do not rate teachers directly. A teacher's rating is built from the ratings of the classes they taught, so every number leads back to specific classes and notes.

The admin gets a Feedback page. Each offering kind gets its own tab with a ranked table that lists the worst-rated items first, with count, average, a count of low ratings and the top complaint tags. A Teachers tab ranks teachers by their classes' ratings. Clicking a row opens the notes and the tag breakdown. A course page shows the course's own rating and the ratings of the classes, PDFs and tests students rated while inside that course. A practice batch page does the same for the batch. A teacher page shows the ratings of the teacher's classes and the courses they teach.

Feedback is admin-only for now. Teacher self-view and public ratings are later switches on the same data.

## User Stories

1. As a student, I want a "Rate" action on every course, practice batch, class, PDF, test and ebook screen, so that I can give feedback when I have something to say.
2. As a student, I want to give 1 to 5 stars, so that rating takes one tap.
3. As a student who gives 1 to 3 stars, I want complaint tags that fit the item ("Audio unclear" on a class, "Typos" on a PDF, "Wrong answer key" on a test), so that I can say what was wrong without typing.
4. As a student who gives 4 or 5 stars, I want no tag step, so that a good rating stays one tap.
5. As a student, I want an optional note on any rating, so that I can explain something the tags do not cover or say what I liked.
6. As a student, I want to see and change my earlier rating, so that I can update it after watching the rest of a class or after a fix.
7. As a student, I want rating to fail with a clear message on an item I cannot access, so that I know why.
8. As an admin, I want a Feedback page in the sidebar, so that all student feedback lives in one place.
9. As an admin, I want an overview with feedback count, average and trend per offering kind, so that I can see whether things are getting better or worse.
10. As an admin, I want a ranked tab per kind (courses, practice batches, classes, PDFs, tests, ebooks) with the worst items first, so that I fix the biggest problems first.
11. As an admin, I want a Teachers tab ranked by the ratings of each teacher's classes, so that I can see which teachers' classes students struggle with.
12. As an admin, I want an item with two ratings ranked below an item with two hundred, so that one angry student does not top the list.
13. As an admin, I want the top complaint tags on each row, so that I see what is wrong without opening it.
14. As an admin, I want to filter by date range, course, practice batch, teacher, star range, tag and "has a note", so that I can answer questions like "what did students say about Teacher X's classes last week".
15. As an admin, I want to open an item and read every note with the student's name, mobile and date, so that I can follow up with the student.
16. As an admin, I want to see whether the student actually watched the class, opened the PDF or ebook, or attempted the test before rating, so that I can weigh drive-by ratings.
17. As an admin, I want a feedback section on the course page and on the practice batch page, so that I see the container's own rating and its content's ratings together.
18. As an admin, I want a feedback section on the teacher page with that teacher's classes ranked worst first, so that I can open the classes that pull the rating down.
19. As an admin, I want to hide an abusive note, so that it stops showing without losing the rating.
20. As an admin, I want to add, rename, reorder and retire complaint tags per kind without an app release, so that the tag list follows what students actually complain about.
21. As an admin, I want a retired tag to stay on old feedback, so that history does not change.
22. As an admin, I want the Feedback page behind its own screen permission, so that I decide which admin roles see student notes.
23. As an app developer, I want one write endpoint and one read endpoint for every kind, so that the Rate sheet is one component.
24. As an app developer, I want the tag list served by the API, per kind or all kinds in one call, so that new tags need no app release and the app can cache the list.
25. As a developer, I want each kind's rules (how to load it, who may rate it, which teachers it belongs to, what counts as consumed) in one registry, so that adding a kind is one entry and no `if kind ===` spreads across files.

## Implementation Decisions

### Data

`Feedback` (new collection `feedbacks`):

| Field | Type | Meaning |
|---|---|---|
| `userId` | ObjectId | From the token, never the body. |
| `target.kind` | `'course' \| 'practiceBatch' \| 'class' \| 'pdf' \| 'test' \| 'ebook'` | The offering kind. `test` is a `Series`. `ebook` is the learn-library item the ebook access route serves. |
| `target.id` | ObjectId | The item. |
| `parent.kind`, `parent.id` | `'course' \| 'practiceBatch'`, ObjectId, optional | The container the student was in when they rated. Required for class, PDF and test, which students reach only through a course or a practice batch. Absent for course, practice batch and ebook. Drives the container rollups. |
| `facultyIds` | ObjectId[] | Teachers of the item at write time, from the registry. Drives the teacher rollup. |
| `rating` | int 1..5 | Required. |
| `tags` | string[] | Complaint tag codes valid for `target.kind`. Allowed only when `rating` is 1 to 3. Must be empty when `rating` is 4 or 5. |
| `note` | string, max 1000 | Optional, trimmed, allowed at any rating. |
| `consumed` | boolean | Snapshot at write time. Watched at least 90% (the `watchStatus` rule), opened the PDF or ebook (`DocumentRead`, kinds course-pdf, class-pdf, practice-batch-pdf, ebook), or attempted the test (`UserTestData` / `Scores`). Always true for course and practice batch. |
| `hiddenAt`, `hiddenBy` | Date, ObjectId, optional | Moderation. A hidden note is withheld from admin lists. The rating still counts. |
| `createdAt`, `updatedAt` | Date | |

Unique index on `{ userId, 'target.kind', 'target.id' }`. A write is an upsert on that key, so a retry or a second tap converges on one row. A student who changes a 2-star rating to 5 stars sends empty `tags`, and the upsert replaces the old tags. A class rated once from a course and later from a practice batch keeps one row, and `parent` takes the latest container. Read indexes are `{ 'target.kind', 'target.id', createdAt }`, `{ 'parent.kind', 'parent.id', createdAt }` and `{ facultyIds, createdAt }`. Indexes on rs0 are built by hand per the index ledger, because `autoIndex` never builds on prod.

`FeedbackTag` (new collection `feedbacktags`) holds `kind`, `code`, `label`, `order` and `active`. Every tag is a complaint. It is unique on `{ kind, code }`. A code never changes after creation. The label may change. Retiring sets `active: false`. An idempotent seed writes the starter set, matching on `{ kind, code }`.

Starter tags (labels open to the team):

- Class. Audio unclear, Video quality, Too fast, Too slow, Hard to follow, Teacher hard to understand, Started late.
- PDF. Typos or errors, Hard to read, Incomplete.
- Test. Wrong answer key, Unclear question, Too hard, Too easy, Technical issue.
- Course. Classes missed or late, Content outdated, Not worth the price.
- Practice batch. Too few tests, Questions repeat, Not worth the price.
- Ebook. Typos or errors, Hard to read, Outdated, Incomplete.

"Hard to follow" is about the material. "Teacher hard to understand" is about delivery. Both live on the class because the class is what the teacher delivered.

### Target-kind registry (one module)

One module maps each kind to its rules. No other file branches on kind.

- `load(id)` returns the item with a display title, or nothing.
- `authorize(userId, item, parent)` reuses Vidyagram's access checks. That includes partial build orders, because Vidyagram's `Order.build` grants topics and not whole courses.
  - Course uses `authorizeCourseAccess`. Practice batch uses `authorizePracticeBatchAccess`.
  - Class, PDF and test first check that the item is placed in `parent` (`CourseClass`, `CoursePdf`, `CourseTest`, or `PracticeBatchClass`, `PracticeBatchPdf`, `PracticeBatchTest`). Then they apply the parent's rule. A class under a course uses `authorizeClassAccess`, which knows free placements.
  - Ebook uses the ebook access route's rule. The ebook must be active, and either free or bought (`hasBoughtEbook`).
- `facultyIds(item, parent)` returns the teachers. Class uses the new `Class.facultyId` (see below). Course uses `faculties`. Practice batch, PDF, test and ebook return `[]` until they carry a teacher link.
- `consumed(userId, item)` applies the rule in the data table above.

### Class teacher link

`Class` has only `teacherName: String`. The teacher view is built from class ratings, so it needs a real id on every class. The fix adds `Class.facultyId` (ObjectId, ref `FacultyDetails`, optional). The admin "Change faculty" action writes both `facultyId` and `teacherName`. A one-off script matches existing classes to `FacultyDetails` by exact trimmed name and is dry-run by default, `--commit` to write. It reports unmatched names for an admin to fix by hand. A class with no `facultyId` counts for no teacher, so the unmatched list is the teacher view's coverage gap. Feedback written before the backfill keeps the `facultyIds` it had. A re-snapshot script refreshes `facultyIds` on class feedback after the backfill or after a "Change faculty".

### App API

- `GET /api/feedback/tags?kind=class` returns the active complaint tags for a kind, ordered, each with `code` and `label`. `kind` is optional. Without it the route returns every kind's tags grouped by kind, so the app can fetch the whole list once at startup and cache it. The app shows tags only after 1 to 3 stars and sends back codes only.
- `GET /api/feedback/mine?kind=class&id=<id>` returns the student's feedback for the item, or `null`.
- `PUT /api/feedback` takes `{ kind, id, parent?: { kind, id }, rating, tags, note }` and upserts. It returns 200 with the saved row. It returns 400 for a bad rating, an unknown or inactive tag, any tag with a rating of 4 or 5, a note over 1000 characters, or a class, PDF or test sent without `parent`. It returns 403 when `authorize` refuses and 404 when `load` finds nothing.

All three require `authenticateToken`. The user id comes from `req.user`.

### Admin API

All routes sit under `/api/admin/feedback` behind admin auth and the new "Feedback" screen permission.

- `GET /overview?from&to` returns per kind the count, average, low-rating count (1 or 2 stars) and a weekly trend.
- `GET /items?kind&from&to&parentKind&parentId&facultyId&sort` returns one row per item. Each row has `id`, `title`, `count`, `average`, `lowCount`, `score` and the top three tags with counts. It is paged.
- `GET /teachers?from&to&courseId&sort` returns one row per teacher from class feedback grouped by `facultyIds`. Each row has `facultyId`, `name`, `classesRated`, `count`, `average`, `lowCount`, `score` and the top three tags. It also carries `courseAverage`, the average course rating across courses whose `faculties` include the teacher, shown beside the class score and never mixed into it.
- `GET /?kind&id&parentKind&parentId&facultyId&minRating&maxRating&tag&hasNote&from&to` returns individual feedback rows with student name and mobile, newest first, paged.
- `PATCH /:id/hide` and `PATCH /:id/unhide`.
- `/tags` handles CRUD for `FeedbackTag`. There is no delete. Retiring sets `active: false`.

`score` is the Bayesian average `(C·m + Σrating) / (C + n)`. `m` is the mean over the same filter and `C` is 10. For teachers, `m` is the class mean. The ranked tables sort by `score`. Average and count stay visible next to it.

Aggregation runs live on the indexed collection. A daily rollup like `dashboardDailyFacts` is added only if a measured page load passes 1 s.

### Admin UI

- Sidebar entry "Feedback". It opens an Overview tab, one tab per kind (Courses, Practice batches, Classes, PDFs, Tests, Ebooks) and a Teachers tab. Each kind tab is a ranked table with the filters from story 14 and that kind's top complaint tags on each row.
- A row opens a drawer with the star histogram, the tag breakdown, the weekly trend and the notes list (student, mobile, date, consumed badge, hide action). A Teachers row opens the teacher's classes ranked worst first, and each class opens its own drawer.
- The course edit page and the practice batch edit page each get a Feedback section with the container's own row plus its content rows filtered by `parent`. The faculty page gets the Teachers row for that teacher plus their classes, filtered by `facultyId`.
- A Tags page lets the admin edit complaint tags, one section per kind. It has add, rename, reorder and retire actions.

### Visibility

This PRD ships only the admin view. The data already supports the two later switches. A teacher self-view filters by `Admin.facultyId`. A public teacher rating, computed from class ratings, replaces the manual `FacultyDetails.rating` and `reviewCount` (see Open Questions).

## Delivery slices

Each slice is one change with its own tests. The task files live in [`tasks/feedback/`](tasks/feedback/README.md).

1. **Class feedback end to end.** Build the models, tag seed, the registry with the class entry (course parent only), the three app routes, and a plain admin list of rows behind the screen permission. This proves the write path, the tag rule, authz and the admin read in one pass. It blocks everything else.
2. **Course, PDF and test feedback.** Add registry entries for course, PDF and test, and confirm the test placement check in Vidyagram's authz. Depends on 1.
3. **Practice batch feedback.** Add the practice batch entry and the practice batch parent for class, PDF and test. Depends on 2.
4. **Ebook feedback.** Add the ebook entry. Depends on 1.
5. **Class teacher link.** Add `Class.facultyId`, make "Change faculty" write it, and add the backfill and re-snapshot scripts with dry-run output. Depends on 1. The teacher view is only as complete as this backfill.
6. **Ranked admin views.** Build the overview, the items endpoint with `score`, the per-kind tabs, filters and the drawer. Depends on 1. It gains rows as 2, 3 and 4 land.
7. **Teachers tab and faculty page section.** Depends on 5 and 6.
8. **Course and practice batch page sections.** Depends on 3 and 6.
9. **Hide abusive notes.** Depends on 6.
10. **Tags page.** Depends on 1.
11. **App team API guide.** Write `vidyagram/reference/vidyagram-feedback-api-guide.md`. Depends on 2, 3 and 4.
12. **Prod indexes, seed, deploy and backfill.** Build the indexes on rs0 for `vidyagramdb`, run the tag seed, deploy backend (pm2 92) and admin, then run the class backfill with `--commit` and the re-snapshot. Depends on all of the above.

## Testing Decisions

A good test drives the public route or the rendered admin page and asserts what a student or admin observes. Tests do not assert on aggregation pipelines or registry internals.

Backend integration on in-memory Mongo, through the real routes:

- A student with access rates a class. `mine` returns it. A second `PUT` changes it, and the collection still holds one row.
- A student without access gets 403 and nothing is written. A Vidyagram build order that grants the class's topic allows the write.
- A class, PDF or test sent without `parent`, or with a `parent` it is not placed in, is refused and writes nothing.
- A student who bought a practice batch can rate a test placed in it with `parent: practiceBatch`. A student without that batch gets 403.
- A free ebook can be rated by any logged-in student. A paid ebook needs a purchase.
- A 2-star rating with two class tags saves both. A 4-star rating with any tag returns 400. Changing that 2-star rating to 5 stars with empty `tags` leaves the row with no tags.
- An unknown tag, a tag from another kind, a retired tag, rating 0 or 6, and a 1001-character note each return 400.
- A `PUT` with `kind: 'faculty'` returns 400.
- `GET /api/feedback/tags` with no `kind` returns every kind's active tags grouped. With `kind=pdf` it returns only PDF tags. A retired tag is in neither.
- `consumed` is true after a class progress span past 90% and false before it. It is true for an ebook after a `DocumentRead` of kind ebook.
- `facultyIds` on a class feedback equals the class's `facultyId`. A class with no `facultyId` gives `[]`, and its feedback is missing from `/teachers`.
- `/teachers` puts a teacher whose classes average 2 stars above one whose classes average 4 when sorted worst first, and `courseAverage` does not change `score`.
- In a fixture whose kind mean is 3, two five-star ratings score 3.33 and two hundred four-star ratings score 3.95, so `items` sorted best-first lists the second item first.
- `items` filtered by a practice batch parent returns only the content rated inside that batch.
- A hidden note is missing from the rows list, and its rating still counts in `items`.
- The tag seed run twice leaves one row per `{ kind, code }`.
- The backfill script dry-run writes nothing and lists unmatched names. The re-snapshot after `--commit` fills `facultyIds` on older class feedback.

Admin component tests cover the ranked table order, the filters building the right query string, the Teachers drill-down into classes, the drawer's hide action and the tags page retire action.

Manual before deploy means the admin against a local Vidyagram backend on a copy of `vidyagramdb`. Rate a class, a PDF, a test, a practice batch and an ebook as a seeded student with `curl`, then read them in the admin.

## Out of Scope

- Direct teacher rating. Students rate classes and courses. Teachers are judged through them (see Further Notes).
- Praise tags. A 4 or 5 star rating needs no reason. A student who wants to say what they liked uses the note.
- In-app prompts ("Rate this class" after it ends, after a test is submitted). The `stopped` event in `classLifecycleNotification.service.ts` and test submission are the natural triggers, and the write API already serves them. This is a follow-up once the "Rate" entry has data.
- Shorts, plans and test-series packages as feedback targets. Each becomes one registry entry later.
- Teacher self-view and public ratings.
- Replying to a student from the admin.
- Merging `ClassIssueReport` into feedback. It stays as it is. Its unauthenticated routes are a separate fix, recorded in the backend authz gaps ledger.
- Teacher links on PDF, test, practice batch and ebook. Their feedback reaches a teacher only through the course.
- Anything on quicktricks.

## Open Questions

1. **Public teacher rating.** The Teacher tab shows the manual `FacultyDetails.rating` today. Should the class-based rating replace it once a teacher's classes have, say, 20 ratings between them? Or should the manual number stay until the team decides to go public?
2. **Anonymity toward teachers.** When teacher self-view arrives, should teachers see notes with student names, notes without names, or only aggregates?
3. **Tag label language.** The starter labels are English. If the Vidyagram app shows Hindi, each tag needs a Hindi label as well, which adds a field to `FeedbackTag` in slice 1.

## Further Notes

- **Why one collection with a `target` pair.** A per-kind collection would copy the write path, the authz call, the admin list and the ranking six times. One collection plus a registry keeps every kind on the same code and makes the teacher and container rollups one query each.
- **Why `parent` and not `courseId`.** Classes, PDFs and tests reach students through both courses and practice batches, and each container has its own access rule. One `parent` pair lets the registry pick the rule and lets both admin pages use the same rollup query.
- **Why tags as well as notes.** Most ratings come without a note, and notes arrive in Hindi, English and Hinglish. A low rating with no note says something is wrong but not what. A tag is the one-tap reason, and tags are what the dashboard counts ("Audio unclear on a third of Teacher X's low ratings this week"). Reading or classifying notes can come later and builds on the tags.
- **Why complaint tags only, and only at 1 to 3 stars.** The goal is finding what is going badly. Stars already measure what is going well, and a good rating needs no reason. This halves the tag list and keeps a good rating at one tap.
- **Why no direct teacher rating.** "Rate this teacher" in the abstract measures how much students like the teacher, and nobody can act on it. The class is the unit a teacher delivers, so a class-based teacher rating leads every bad number to specific classes and notes. A direct rating beside it would give two numbers per teacher that often disagree. Dropping it also removes the awkward "who may rate a teacher" rule. The cost is that the teacher view depends on the `Class.facultyId` backfill.
- **Why tags live in the database.** The app team ships slowly. If tags lived in the app or in backend code, every new complaint category would wait for a release. Server-side tags with immutable codes keep history countable while labels change.
- **Why `facultyIds` and `consumed` are snapshots.** Teachers move between classes and progress grows after the rating. A snapshot records what was true when the student rated, and the teacher rollup needs no join through classes at read time.
- **Why the Bayesian score.** Ranking by plain average puts a single one-star rating at the top of "worst classes". The score pulls low-volume items toward the mean.
- **Low volume is the main risk.** With only an always-available "Rate" entry and no prompts, expect few ratings that lean to the extremes. The `consumed` flag and the score soften that. The prompts follow-up is the real fix.
- **Defaults taken without a team answer.** Students can edit their rating. Admins see the student's name and mobile on notes. Notes are capped at 1000 characters. The tags page stays in scope (slice 10). If the team rarely changes tags, the seed script alone is enough and the page can wait.
