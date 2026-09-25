# PRD: Global search — classes section

State: `needs-triage`
Owning repos: LMS fork **quicktricks-backend** (all behaviour, off `origin/quicktricks-admin`).
Mobile app: consumes a new `classes` section. No admin or website change.
Decision record: the 2026-09-25 grilling session (Q1–Q10), summarised in **Decisions** below.
Glossary: fork `CONTEXT.md` → "Global search" (**Global search**, **Class search result**,
**Attached course**). Drafted in the fork working tree, uncommitted. No ADR, because none of
these decisions is hard to reverse.
Tasks: [`tasks/global-search-classes/`](./tasks/global-search-classes/README.md) (01–05).

## Problem Statement

Global search (`POST /api/search`) finds courses, ebooks and tests, but not classes. Most of what a
student actually studies is individual classes: a topic lecture, a numbered class in a batch, a
live session happening now. A student who remembers "Class 44 Mixture and Allegation" has to guess
which course it's in, open that course, and scroll or filter its class list. If the class sits in
several courses (common for migrated APX content), the student can't tell which one they own.
Searching for a class returns nothing, so the student concludes it doesn't exist.

## Solution

Global search gets a **Classes** section, shown directly after Courses. Each **Class search
result** carries every course the student could open it through (its **attached courses**). For
each of those courses it says whether the student bought it and whether it's free. For the class
it says whether the student can play it right now, and whether it's upcoming, live, processing or
recorded. The app decides which course to open the class through: by default the first one, which
the server orders purchased, then free, then by course priority. The app then plays the class
through the existing `/playback` flow, which still enforces access.

Search remains a **catalogue**. Classes the student hasn't bought still appear, so a locked hit
can lead to buying a course. Purchases are only ever read from a verified sign-in. A request
without one gets guest results: nothing bought, only active courses.

## Decisions (from the grilling session)

| # | Decision |
|---|---|
| D1 | Catalogue search: no class is hidden because the student doesn't own it. `/playback` remains the only place access is enforced. |
| D2 | An inactive class never appears. A deactivated placement never attaches its course. An inactive course attaches only if the searcher bought it. A class left with no attached course does not appear. |
| D3 | "Bought" is the **Entitlement check**'s own order match (successful orders; `courseId`, `latestCourseId`, and active-plan course grants; expiry exactly as the `ENFORCE_ORDER_EXPIRY` flag decides for playback). No ownership rule specific to search. |
| D4 | Each attached course carries `isPurchased` and `isFree` (placement free ∨ course free). The class carries `canPlay` = class free ∨ any attached course free or bought. `canPlay` is a hint as of search time, not a promise. |
| D5 | Matching is on `Class.title` or an active placement's `CourseClass.title`, but never `apxTitle`. Ranking reuses the admin **title search**: all words in any order, whole numbers, close spellings, ranked exact > prefix > phrase > all words > similar. Ties go to the newest class. |
| D6 | Classes at every stage appear (upcoming, live, processing, recorded), each carrying `streamStatus` + `hasPlayback` from the **Listing liveness** contract. `Class.isLive` is not sent. |
| D7 | Clicks accept type `class`; the collections strip gets a "Classes" capsule; trending does **not** include classes (the `classes` trending section is always empty). Section order: courses, classes, ebooks, … |
| D8 | Purchases come only from a verified token (optional auth on `POST /api/search`). A `userId` in the request body keeps its current jobs (logging, test attempt counts) and never reveals purchases. No or invalid token means guest. |
| D9 | Wire shape as below. Attached courses are ordered purchased → free → course priority, with no cap. |

## User Stories

1. As a student, I want classes to appear when I search, so that I can find a lecture without knowing which course it's in.
2. As a student, I want the Classes section right after Courses, so that the two things I most often look for are together.
3. As a student, I want a "Classes" capsule in the collection strip, so that I can narrow search to classes only.
4. As a student, I want to find a class by typing its words in any order (`mixture 44`), so that I don't have to remember the exact title.
5. As a student, I want `class 2` to find "Class-02" but not "Class-12", so that numbered classes match the way I think of them.
6. As a student, I want a small misspelling (`alligation`) to still find the class, so that typos don't hide content.
7. As a student, I want the closest title matches first, so that the class I meant is in the top results rather than hidden behind hundreds of loose matches.
8. As a student, I want to find a class by the title my course shows for it, so that a per-course renamed class is still findable.
9. As a student, I want each class result to list the courses it belongs to, so that I can open it the same way I would from inside a course.
10. As a student who bought one of those courses, I want it marked as purchased and listed first, so that I open the class through a course I already own.
11. As a student, I want free courses and free classes marked as free, so that I know I can watch without paying.
12. As a student, I want a clear "you can play this" signal on the class, so that the app shows Play instead of Buy when I have access.
13. As a student without access, I want the class result to show the courses I could buy to unlock it, so that search leads me to a purchase.
14. As a student who bought an older batch that is now inactive, I want that batch still listed on its classes, so that I'm not told to buy a new batch for a class I already own.
15. As a student who did not buy an inactive batch, I don't want it offered to me, so that I'm never sent to a course I can't purchase.
16. As a student whose order has expired (when expiry is enforced), I want search to stop marking that course as purchased, so that search and playback agree.
17. As a student with a plan purchase, I want courses granted through my plan to count as purchased, so that plan buyers aren't told to buy what they already have.
18. As a student, I want an upcoming class to be findable with its scheduled dates, so that I can see when it happens.
19. As a student, I want a class that is live right now to say so, so that I can join it from search.
20. As a student, I want a class whose recording is still processing to say so, so that I'm not confused by a failed play.
21. As a student, I want each course's own dates for the class, so that the time I see matches what that course shows.
22. As a student, I want the class title each course uses, so that the name doesn't change when I tap through.
23. As a student, I don't want to see classes an admin has deactivated or removed from courses, so that search doesn't show dead content.
24. As a student, I don't want to see classes that belong to no course I could open, so that every result leads somewhere.
25. As a student, I want tapping a class result to be recorded like any other result, so that search analytics include classes.
26. As a student, I want my recent searches to still work when I tap a class, so that I can go back to it.
27. As a student, I want the rest of search (courses, ebooks, tests) to behave exactly as before, so that nothing I rely on changes.
28. As a student, I want search to still return other sections if the class search fails, so that one broken section doesn't break the page.
29. As a student, I want my purchases never shown to anyone who puts my user id in a request, so that my purchase history stays private.
30. As a guest or a user whose token expired, I want search to still work, so that I can browse before signing in.
31. As the app developer, I want class results in the same envelope as other sections, so that the section renderer is reused.
32. As the app developer, I want each attached course to carry the same fields as a course search result, so that I can reuse the course card for the buy flow.
33. As the app developer, I want the attached courses already ordered, so that `courses[0]` is a sensible default without client-side sorting.
34. As the app developer, I want readiness (`streamStatus`, `hasPlayback`) kept separate from access (`canPlay`), so that I can show Upcoming, Live, Locked and Play correctly.
35. As the app developer, I want `/playback` to remain the only enforcement, so that a stale `canPlay` fails safely with the same 403 handling I already have.
36. As an operator, I want search's idea of "purchased" to come from the same code as the Entitlement check, so that a fix to ownership fixes both.
37. As an operator, I want class search to load the searcher's orders only when a result actually needs them, so that most searches don't pay for an orders lookup.

## Wire contract

The existing `SearchResult` envelope, in a new `classes` section of `POST /api/search`:

- `id` (class id), `type: "class"`, `title` (`Class.title`), `subtitle` (teacher name),
  `imageUrl` (class image or null), `deepLink` (`/classes/{classId}`).
- `meta.teacherName`, `meta.durationSec` (null if unknown), `meta.streamStatus`
  (`preparing|live|reconnecting|processing|ended|null`), `meta.hasPlayback` (boolean; never the
  asset), `meta.isFree` (`Class.isFree`), `meta.canPlay`.
- `meta.courses[]`, ordered purchased → free → course priority. Each entry has the course
  search result's fields (`id`, `title`, `imageUrl`, `deepLink`, `price`, `isLive`,
  `isRecorded`), plus this course's view of the class: `isActive` (course status 1; false means
  it is here only because it was bought), `isFree` (placement ∨ course), `isPurchased`,
  `classTitle` (placement title → APX title → class title, as the course's class listing shows
  it), `startDate`, `endDate` (this placement's window).

`/api/search/click` accepts `type: "class"`. `/api/search/collections` lists `classes` after
`courses`. `/api/search/trending` includes `classes: []`.

## Implementation Decisions

- **Class result builder (new, pure).** Given a class, its placements, the placements' courses
  and the searcher's owned-course set, it returns a Class search result or nothing. It owns every
  rule in D2, D4, D6 and D9: inactive class → nothing; deactivated placement dropped; inactive
  course kept only if owned; per-course free/purchased; class `canPlay`; per-course class title
  fallback and dates; ordering; empty attached-course list → nothing. It does no I/O, so every
  rule is testable as a table of cases.
- **Owned courses (extracted from the Entitlement check).** A function from (orders, enforce
  expiry, now) to the set of course ids the user bought. The Entitlement check's own order
  matching is rewritten on top of it, so search and playback share one definition. The existing
  order loader (orders + active-plan grants) is reused unchanged.
- **Class searcher (new, DB-bound).** It implements the existing `Searcher` contract. It matches
  and ranks with the admin title-search module over `Class.title`, plus active placement titles
  as a fallback (never `apxTitle`), for active classes only. It over-fetches candidates, loads
  their active placements and courses in batch, asks the viewer for owned courses only when some
  candidate has an inactive course, runs the builder, and returns the top N that survive. Ties
  go to the newest class.
- **Search plumbing (modified).** Searcher options gain an optional **viewer**: a lazily
  evaluated, memoised owned-course lookup, plus a guest viewer that owns nothing. The
  orchestrator passes it through untouched; existing searchers ignore it. The section key
  `classes` / entity type `class` are added to the section/type maps; default section order
  becomes courses, classes, ebooks, words, editorials, books, tests. The class searcher is
  registered beside the declarative entries, not as one, because it is not a single-collection
  regex. The collections strip, the click endpoint's valid types, the search logger and
  trending all learn the new section. Trending returns an empty `classes` list and never
  hydrates classes.
- **Route/controller (modified).** Optional authentication is added to `POST /api/search`. The
  controller builds the viewer only from the verified token's user. The body `userId` fallback
  stays for its existing uses (the 400 when absent, test attempt counts, logs) and never builds
  a viewer. Optional authentication treats an invalid or expired token as a guest; it never
  rejects the request.
- **No schema change.** Existing indexes cover the placement read by class (the compound
  index on class, isActive and status). The title-search module's per-collection spelling
  vocabulary cache is reused for classes.
- **Performance.** At most one orders lookup per search request, and only when an inactive
  course is involved. Placements and courses are loaded in two batched queries per request,
  never one per class.

## Testing Decisions

- A good test drives a module through its public interface and asserts on observable output
  (the returned results and HTTP responses), never on which queries ran or in what order. Tests
  use `node:test` + `node:assert/strict`, as the rest of the fork does.
- **Class result builder (unit).** A table of cases covering every rule: inactive class;
  deactivated placement; inactive course owned vs not owned; free by class, by placement, by
  course; `canPlay` true/false combinations; title fallback order; per-placement dates;
  ordering purchased → free → priority; empty result. Prior art: the search mapper tests.
- **Owned courses (unit).** Parity with the Entitlement check: direct course ids, latest
  course ids, active-plan grants, inactive plans ignored, expiry on/off, null expiry. The
  existing Entitlement check tests must still pass unchanged after the extraction. Prior art:
  the class access authz tests.
- **Class searcher (integration, real Mongo).** Word-order, whole-number and close-spelling
  matches; placement-title fallback; `apxTitle` never matched; ranking and newest-first
  tie-break; inactive classes excluded; top-N applied after the builder drops classes.
  Prior art: the title-search integration test.
- **Plumbing + guest vs token.** The orchestrator passes the viewer to every searcher and
  still degrades a failing class searcher to an empty section. Section order includes
  `classes` after `courses`. Clicks accept `class`. Collections include "Classes". Trending
  returns `classes: []`. A request with only a body `userId` yields no `isPurchased: true` and
  no inactive courses; a request with a valid token for the same user does. Prior art: the
  search orchestrator, click logger and trending tests.

## Out of Scope

- Trending classes (the per-user result shape conflicts with the global, unauthenticated
  trending cache). Clicks are still counted, so the data accumulates for later.
- Moving courses, ebooks or tests onto the ranked title search (that would be a separate
  consistency change).
- Searching `apxTitle`, descriptions, teacher names or topics.
- Filtering classes by ownership ("my classes" search).
- Turning on mandatory auth for the other search routes, or removing the body `userId`
  fallback.
- Any app or website change beyond consuming the new section. A short client guide for the
  app team is a deliverable, but not in this PRD's code scope.
- Classes reachable only through practice batches (not course placements).

## Further Notes

- **Unverified assumption:** the app sends its `Authorization` header on `/api/search`. If it
  doesn't, everything still works in guest mode, but `isPurchased` is false for everyone. The
  first acceptance step is one real app search, checking that the token user was recognised.
- A class that is itself free but has no attached course does not appear. The app has no
  place to open a class that belongs to no course.
- `canPlay` is only a hint; an order expiring between search and tap produces the usual
  `/playback` 403.
- Deploy: the fork's usual dist-tracked flow (commit → push → box pull → pm2 restart). No env
  change and no migration.
