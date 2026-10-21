# PRD: Course search — classes, course PDFs and tests inside one course

State: `needs-triage`
Owning repos: LMS fork **quicktricks-backend** (all behaviour, off `origin/quicktricks-admin`).
Mobile app: consumes a new endpoint from the course screen. No admin or website change.
Decision record: the 2026-09-25 → 2026-09-28 grilling session, summarised in **Decisions** below.
Glossary: fork `CONTEXT.md` → "Course search" (**Course search**, **Course PDF**, **Class PDF**,
**Course test**), drafted on branch `feat/course-search` in worktree
`~/Projects/worktrees/qt-course-search`, uncommitted. No ADR, because every decision is
cheap to reverse.
Builds on: [Global search — classes](./prd-global-search-classes.md) (LIVE `71e30fda6`) and the
course class tabs (LIVE `97fb3f251`, watch status `239946355`, resume point `c0976671c`).
Tasks: [`tasks/course-search/`](./tasks/course-search/README.md) (01–06).

## Problem Statement

A student inside a course has no way to find something by name. The course screen splits content
across three tabs: **Content** (classes by topic, or Today/Upcoming/Previous), **Ebooks** (the
course's PDFs, grouped by topic) and **Tests** (grouped by topic). A student who remembers
"Percentage class 12", or the notes for "Mixture and Allegation", has to guess the right tab and
topic, then scroll. Large batches hold hundreds of classes (up to 606 placements in one course),
so scrolling doesn't scale.

Global search doesn't help either. It spans the whole catalogue, so a hit may be in a course the
student isn't studying. It shows catalogue cards, with no resume point, watched state or class
notes. Its "ebooks" section means learn-library ebooks, not the course's Ebooks tab.

## Solution

The course screen gets its own search. The student types at least two characters and gets up to
three flat, ranked sections: **Classes**, **Ebooks** (course PDFs) and **Tests**, each holding
only this course's items. Every result is **the same item the course's tab shows**, with the same
fields, the same lock state and the same per-student state (watched, resume point, test
attempts), so the app reuses its existing course cards. A class result carries its class PDFs,
so finding a class also finds its notes.

Matching is on the title the student sees, with the admin search's word- and typo-tolerant
ranking. Equally good matches keep the course's own order. Search is a view of the course, not
an access check: locked items appear locked, exactly as in the tabs, and opening one still goes
through `/playback` or the PDF `/access` route.

## Decisions (from the grilling session)

| # | Decision |
|---|---|
| D1 | **Course search** covers one course, in three sections: classes, **course PDFs** (labelled "Ebooks" in the app) and **course tests**. Filters (Read/Watched, Today/Previous) are out of scope for now. |
| D2 | A class result **carries its class PDFs**. They are never their own section or result. |
| D3 | The domain and code term is **course PDF**; "Ebooks" is only the app's label. The wire key is `coursePdfs`. "Ebook" stays reserved for the learn library. |
| D4 | It is a **sibling endpoint**, `POST /api/courses/:courseId/search`, not a mode of `POST /api/search`. It never writes to the global search log, so it never feeds global trending or recent searches. |
| D5 | Each section is a **flat ranked list**, like global search. **Each item is the course-tab item**: the class-tabs card, the Ebooks tab's PDF item, and the Tests tab's mobile series item. |
| D6 | **Every active class placement is searchable**, including ones no course class tab shows (no start date, or past with nothing to play). Each class result carries `tab: today \| upcoming \| previous \| null`. Deactivated placements and inactive classes are never searchable. |
| D7 | Matching is on the **title the card shows** (class: placement `title` → `apxTitle` → `Class.title`; PDF: `CoursePdf.apxTitle` → `Pdf.title`; test: `series_name`), using the admin **title search** (all words in any order, whole numbers, close spellings; ranked exact > prefix > phrase > all words > similar). Class PDF titles, topics, sections and teacher names are not matched. |
| D8 | **Global search's limits:** the query must be at least 2 characters (otherwise 400), `limit` defaults to 10 per section and is clamped to 1–50, there's no paging, and all three sections are always present (`[]` when empty). |
| D9 | Equal-rank matches keep **the course's order**: the placement `priority`, then that tab's existing secondary order. |
| D10 | Optional sign-in. **Per-student fields come only from the verified token** (the global-search D8 rule). A guest, or an invalid or expired token, gets the same items with no per-student state. A `userId` in the body or query is ignored. |
| D11 | An unknown course returns 404. An **inactive course is still searchable**: an off-sale course keeps its buyers' access, and its screen keeps working for them. |

## User Stories

1. As a student inside a course, I want a search box on the course screen, so that I can find content without knowing which tab or topic it's in.
2. As a student, I want search to cover only this course, so that every result is something I can open from where I am.
3. As a student, I want classes, ebooks and tests in separate sections, so that I can tell what kind of thing each result is.
4. As a student, I want to find a class by typing its words in any order (`12 percentage`), so that I don't need the exact title.
5. As a student, I want `class 2` to find "Class-02" and not "Class-12", so that numbered classes match the way I think of them.
6. As a student, I want a small misspelling (`alligation`) to still find "Allegation", so that typos don't hide content.
7. As a student, I want the closest title matches first, so that the class I meant is at the top rather than buried under loose matches.
8. As a student, I want equally good matches in the course's own order, so that "Percentage Class 1…30" comes out in sequence.
9. As a student, I want to find a class by the name this course shows for it, so that a class renamed in this course is still findable by what I see.
10. As a student, I want a class result to show its PDFs, so that finding the class also gets me its notes.
11. As a student, I want a class result to show whether I've watched it, so that I can skip what I've done.
12. As a student, I want a class result to resume where I left off, so that search is as good as the tab for continuing.
13. As a student, I want my "mark complete" state on class results, so that the completion menu behaves as it does in the tab.
14. As a student, I want an upcoming class to be findable and marked upcoming, so that I can check when it happens.
15. As a student, I want a live class to show as live in results, so that I can join from search.
16. As a student, I want to find a past class even when it has no recording yet, so that I learn it exists instead of wondering whether it was removed.
17. As a student, I want a class with no date to still be findable, so that nothing placed in my course is unfindable.
18. As a student, I don't want classes an admin removed from this course, so that search doesn't show dead content.
19. As a student, I want to find an ebook by the title the Ebooks tab shows, so that the same name works in both places.
20. As a student, I want ebook results to show the course's own section and topic names, so that I know where the ebook lives in the course.
21. As a student, I want ebook results locked or free exactly as in the Ebooks tab, so that search never promises access the tab doesn't.
22. As a student, I want to find a test by its name, so that I can reach a specific paper quickly.
23. As a student, I want test results to show my attempts and the attempt limit, so that I know whether I can still take it.
24. As a student, I want test results to show their sections, so that I recognise the paper.
25. As a student, I want an empty section to show nothing instead of an error, so that a query matching only tests still works.
26. As a student, I want the other sections to still come back if one fails, so that one broken section doesn't break search.
27. As a student, I want a clear message when I've typed fewer than two characters, so that I know to keep typing.
28. As a buyer of a course that's no longer on sale, I want search to keep working in it, so that I can still find my content.
29. As a guest or a user whose session expired, I want search to still return results, so that I can explore a course before signing in.
30. As a student, I want my watch and test history never revealed to anyone who puts my user id in a request, so that my progress stays private.
31. As a student, I want my in-course searches kept out of global trending and recent searches, so that the catalogue search isn't cluttered with "chapter 3 notes".
32. As the app developer, I want each result to be the exact item the tab already renders, so that I reuse the class, ebook and test cards unchanged.
33. As the app developer, I want each class result to name its tab, or `null`, so that I can badge Live or Upcoming and keep Play off cards with nothing to play.
34. As the app developer, I want all three section keys always present, so that my parser needs no null handling.
35. As the app developer, I want the same length rule and `limit` semantics as global search, so that I can share the debounce and minimum-length logic.
36. As the app developer, I want per-student fields read from the same `Authorization` header I already send, so that I pass no extra ids.
37. As an operator, I want the Ebooks and Tests tabs to stay exactly the same after the item builders are shared with search, so that the live course screen doesn't regress.
38. As an operator, I want search and the tabs to build items from one piece of code, so that a fix to a card fixes both.
39. As an operator, I want the per-student lookups done once per request for all results, never once per item, so that a broad query stays fast.

## Wire contract

`POST /api/courses/:courseId/search`, optional `Authorization: Bearer`.

Request body: `{ query: string, limit?: number }`. Other body fields, including `userId`, are
ignored.

Responses, in the fork's usual envelope `{ state, msg, data }`:
- `400`: the course id is malformed, or the trimmed query is shorter than 2 characters.
- `404`: the course doesn't exist. An inactive course is **not** 404.
- `200`: `data = { classes: [...], coursePdfs: [...], tests: [...] }`. Each array is ranked,
  capped at `limit` (default 10, clamped 1–50) and never absent.

Items:
- **`classes[]`**: the class-tabs card exactly as `POST /courses/:id/class-tabs` returns it,
  including `classPdf`, `watchStatus`, `watchTime`, `manualCompleted` and `videoPosition`.
  **Plus** `tab: "today" | "upcoming" | "previous" | null`. Per-student fields follow the
  class-tabs rules: guests and upcoming classes get the Not watched / 0 defaults.
- **`coursePdfs[]`**: one PDF item exactly as an entry of `GET /courses/:id/pdfs?groupBy=topic`
  (the effective title, the course's own section and topic names, the effective `isFree`,
  `isDownloadable`, and the `asset` summary only — never `uploadPdf` or a storage key).
- **`tests[]`**: one series item exactly as an entry of the mobile `GET /courses/:id/tests`
  response (`series_id`, `series_name`, `section_details` with resolved names, `is_free`,
  `max_attempted_limit`, …). `is_attempted` / `attempted_count` come from the **token** user; a
  guest gets the listing's defaults.

## Implementation Decisions

- **Course search service (new, deep).** One entry point: course id, raw query and options
  (`limit`, the verified user id or none) go in; the three sections come out. It owns the
  minimum length, the `limit` clamp, running the three sections in parallel, turning a failed
  section into `[]` with a log line, and the rule that nothing is written to the search log.
  The course existence check stays in the controller, as in class tabs.
- **Class section search (new, built on the class-tabs internals).** It reuses the eligible
  placement stages (active placement, active class), the tab classifier and its aggregation twin,
  the watch-status stages, the card projection, the class PDF attachment and the resume-point
  loader. It adds: an effective display title field matched and ranked with the title search;
  `tab` set from the classifier, with "none" becoming `null`; sorting by rank, then placement
  `priority`, then the placement id for stability; and the cut at `limit` **before** class PDFs
  and resume points are attached. Watch status is computed for every result the way the
  Today/Previous tabs compute it; upcoming results keep the tab's pinned defaults. One grouped
  progress lookup per request, only when there is a token user.
- **Course PDF item (extracted from the Ebooks listing).** The placement → PDF item pipeline and
  its finishing step (title precedence, the course's own taxonomy names, the public serializer)
  move into one module with a stable interface. The listing calls it and keeps its grouping,
  pagination, admin ownership filter and admin search as they are. Course search calls it with a
  title-search filter and rank on the **effective** title. That title is currently computed in
  JS after the pipeline, so the module must also express it as a pipeline field, both ways from
  one definition.
- **Course test item (extracted from the Tests listing, mobile mode).** The placement → series
  item pipeline, the batched section-name resolution and the attempt enrichment move into one
  module that takes the user id as an argument. The listing keeps passing its query `userId`
  (unchanged behaviour). Course search passes only the verified token user. Test topic grouping
  stays in the listing.
- **Spelling vocabulary.** The title search's vocabulary cache is reused, scoped per course and
  per section, so close-spelling help comes from the words in that course's titles.
- **Route/controller (new).** `POST /api/courses/:courseId/search` with optional
  authentication, validated by a request schema. The user id is read only from the verified
  token. An invalid or expired token is treated as a guest, never rejected.
- **No schema change, no new index.** Every section reads one course's placements through the
  existing `(course, isActive, …)` indexes; the largest course is ~600 class placements. The
  per-student reads (progress, test attempts) are the ones the tabs already make, batched per
  request.
- **Performance budget.** Measure on prod-sized data before shipping, as with the global class
  searcher. Target: a broad two-letter query on the largest course under ~150 ms server time.

## Testing Decisions

- A good test drives a module through its public interface and asserts on what comes out (items,
  their order, HTTP status and body), never on which queries ran. `node:test` +
  `node:assert/strict`, as in the rest of the fork. Unit tests run with `npm test`; real-Mongo
  tests run with `npm run test:integration` on the in-memory Mongo harness.
- **Parity (first, before any extraction lands).** Golden tests pin the current Ebooks tab
  (`groupBy=topic` and flat) and the mobile Tests tab responses on fixtures that cover title
  precedence, snapshot vs taxonomy names, the effective free flag, the asset summary, section-name
  overrides and attempt counts. They must pass unchanged after M3/M4 are extracted. Prior art: the
  course PDF listing snapshot tests.
- **Class section search (integration).** Word order, whole numbers and close spellings; the
  display-title precedence (a placement title beats `apxTitle`, which beats the class title); each
  `tab` value including `null` for no-date and past-unplayable; deactivated placements and
  inactive classes excluded; tie-break by `priority`; the `limit` cut; class PDFs present; watch
  status and resume point for a token user, and defaults for a guest. Prior art: the class-tab
  classifier and watch-status fixtures, and the title-search tests.
- **Course PDF and test sections (integration).** Matching on the effective title only; rank then
  `priority`; per-course names; inactive placements excluded; attempts only for the token user.
- **Course search service (unit, stubbed sections).** Minimum length, `limit` clamp, all three
  keys always present, a throwing section degrades to `[]` while the others return, and no search
  log write. Prior art: the global search orchestrator tests.
- **Controller.** 400 for a bad id and a short query; 404 for an unknown course; 200 for an
  inactive course; a body `userId` with no token yields no per-student state; a valid token for
  the same user does; a garbage token acts as a guest. Prior art: the class list search and PDF
  access controller tests.

## Out of Scope

- The **Read / Not read** and **Watched / Not watched** filters, and the **Today / Previous** date
  toggle from the original mock. The app's Recent classes sheet (an unwired stub with its own
  filters) stays unwired by this PRD. The item shapes chosen here leave room for filters later.
- Browse mode (an empty query listing everything).
- Paging, and a per-section "see all" request.
- Matching class PDF titles, topics, sections, teacher names or descriptions.
- Learn-library ebooks and legacy `/api/ebooks` items, which belong to no course.
- Practice batches, and any content reached by a route other than a course placement.
- Search logging, analytics or clicks for course search.
- Any change to global search, or to the class-tabs, Ebooks or Tests tab responses.
- App and website UI. A client guide for the app team is a deliverable, but the UI is theirs; the
  app repo is read-only for us.

## Further Notes

- **Reading-model reminder for the app guide.** The PDF opens through
  `/courses/:courseId/pdfs/:pdfId/access`; a class PDF opens through
  `/classes/:classId/pdfs/:pdfId/access`; a class plays through `/classes/:classId/playback`.
  Search never returns a signed URL.
- A class whose `tab` is `null` because it's past with nothing to play will get "Video is not
  available right now" at `/playback`, the same as today. That's accepted: the student learns the
  class exists.
- The Tests tab listing reads attempts from a query `userId`. That trust issue is **not** fixed
  here (out of scope), but course search does not inherit it.
- Deploy: the fork's usual dist-tracked flow (commit → surgical `dist` → push → box pull → pm2
  restart of the API only). No env change and no migration. A push ships, because the client team
  deploys by pulling.
