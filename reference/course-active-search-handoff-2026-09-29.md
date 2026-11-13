# Handoff: `/api/courses/search` — active-only, `isLive`/`isRecorded` filters, page/limit default fix

**Date:** 2026-09-29 · **Repo:** production LMS fork `quicktricks-backend` (branch `quicktricks-admin`)
· **Brain:** `/Users/raghav/Projects/system-brain` (read its CLAUDE.md, SYSTEM.md, GLOSSARY.md first)

## The ask (from the user, verbatim intent)

> Create another course search API similar to
> `GET https://backend.quicktricksbysahilsir.com/api/courses/search?search=testin&page=1&limit=100`,
> but it should only return **active** courses. Maybe we can just extend this one?

## Key finding: the existing endpoint already filters by status

`GET /api/courses/search` already takes `status`, and `status=1` or `status=active` means active.
Checked on prod 2026-09-29 (read-only GETs):

| Query | Result |
|---|---|
| `?search=railway&page=1&limit=100` | 16 courses, statuses {0, 1} |
| `?search=railway&status=1&page=1&limit=100` | 7 courses, all status 1 |
| `?search=railway&status=active&page=1&limit=100` | same 7 |

So the likely answer is **no new API**: the caller adds `&status=1`. Confirm that with the user
before building anything.

## Decided scope (user, 2026-09-29): extend `/api/courses/search`, no new route

Build these three additive changes in `/api/courses/search`:

1. **`isLive` and `isRecorded` filters.** The user asked "what if they want to search for live
   courses?" and settled on the product-type flags. Today `&isLive=true` returns **400**
   ("Unrecognized key(s) in object: 'isLive'", because the schema is `.strict()`).
   `POST /api/courses/filter` (`courseFilterSchema`, ~`courseSchemas.ts:395`) has these flags but no
   text search, so no single call does "text + live only".
   - Add `isLive` and `isRecorded` to `courseSearchSchema`, parsed exactly like `isFree`
     (`'true'` → true, `'false'` → false, absent → no filter). Add one `matchQuery` line each in
     `searchCourses`.
   - Target call: `?search=railway&status=1&isLive=true&page=1&limit=100`. On prod today that should
     return only Railway Prime Batch (2026-27). Of the 7 active "railway" courses, 1 is `isLive`, 5 are
     `isRecorded`, and 1 (RAILWAY EXPRESS SERIES) has neither flag, so `isLive=false` ≠ `isRecorded=true`.
   - "Live" here is `Course.isLive`, the **product type** (a live-classes batch vs recorded/VOD). It
     is NOT "streaming right now". Runtime liveness is `Class.streamStatus`, per class, already served
     by class-tabs Today and the class listings (GLOSSARY → "isLive is three different things").
     Don't try to derive "live now" in course search.
2. **Fix the `page`/`limit` defaults.** Leaving out `page` or `limit` returns **400 "Expected number,
   received nan"**, verified on prod. The `z.preprocess((val) => parseInt(String(val), 10), …default(1))`
   turns `undefined` into `NaN` before `.default()` can apply. Fix: return `undefined` from the
   preprocess when the value is absent or empty, so the defaults (page 1, limit 10) work. Consider
   capping `limit` (e.g. ≤ 100) while there. Check with the user first, because `limit=100` is in the
   URL they shared and admin pickers may send more.
3. **Active-only** stays the existing `status=1` / `status=active`, with no code change. Optional:
   scope the spelling vocabulary to the same filter (gap 1 below). Ask before doing it.

Acceptance, in tests plus a prod smoke after deploy:
- `isLive=true` returns only `isLive` courses. `isRecorded=true` returns only `isRecorded` courses.
  Both combine with `status`, `isFree`, `excludeApx` and `search`.
- Omitting either flag gives today's result byte for byte.
- A non-boolean value (`isLive=yes`) is a 400. Match `isFree`'s behaviour; `isFree` currently maps
  any non-`'true'` string to `false`. Decide with the user whether to keep that leniency or be strict.
- No `page` / no `limit` gives 200 with page 1 / limit 10.
- Admin callers are unaffected: `../quicktricks-admin/hooks/api/use-courses.ts:211`,
  `components/admin/NotificationForm.tsx:685,709`, `async-select` / `async-multi-select`.
- There's no test file for `searchCourses` yet (grep `src/tests` for `searchCourses` /
  `courses/search` to confirm). Add a controller-level test with in-memory Mongo, following the
  pattern of `src/tests/integration/courseSearch.integration.test.ts`.

Code (fork, at `a8b5414b4`):
- Route: `src/routes/courseRoutes.ts:47`, `router.get('/search', searchCourses)`. Public, no auth.
- Controller: `src/controllers/courseController.ts`, `searchCourses` (~line 1552). Word-based,
  typo-tolerant ranked title search (`src/services/titleSearch.ts`), then sort
  rank → priority → createdAt → title, then `$skip`/`$limit` page paging. Response
  `data: { courses, pagination, searchQuery, similarSpellings }`.
- Schema: `src/schemas/courseSchemas.ts:377`, `courseSearchSchema`, `.strict()`. Params:
  `search`, `status` (via `preprocessCourseStatus`: `active`→1, `inactive`→0, `draft`→2, or a number),
  `isFree`, `excludeApx`, `page`, `limit`. **No max on `limit`**, so `limit=100` or larger is allowed.

## Gaps if "just send status=1" isn't enough

1. **Spelling suggestions ignore the filter.** `courseTitleVocabulary` is `Course.distinct('title')`
   over **every** course (5-minute cache), so with `status=1` the `similarSpellings` can still
   suggest words that only appear in inactive or draft titles. A small, safe extension: build the
   vocabulary from the same status filter, one cache entry per status. Prior art for keying
   `createVocabularyCache` by scope: `src/services/courseSearch/classSection.ts`
   (`{ courseId, section }`).
2. **Enforced vs. optional.** `status` is a client-controlled param. If the caller must not be able
   to see inactive courses (e.g. a student app screen), add a separate route that pins `status: 1`,
   such as `GET /api/courses/search/active` or a student variant, reusing the same pipeline.
   Register it **before** `/:id` in `courseRoutes.ts`. Don't flip the default: admin pickers depend
   on seeing every status (`../quicktricks-admin/hooks/api/use-courses.ts:211`,
   `components/admin/NotificationForm.tsx:685,709`, and the `async-select` / `async-multi-select`
   components that read `container.pagination`).
3. **What "active" means.** `Course.status` 1 = active (default), 0 = inactive, 2 = draft. Status 0
   means off-sale only; existing buyers keep access (memory `inactive-course-keeps-buyer-access`).
   So "active only" is a catalogue/sale filter, not an entitlement rule. If this is for a
   student's own courses, it's the wrong filter.
4. **No limit cap.** Consider clamping `limit` (e.g. 1–100) if the new route is public-facing.

**Still open for the user** (scope is decided above; these are details): who calls it (app team,
website, or admin)? Is `status=1` enough, or must active-only be enforced server-side (gap 2)?
Should suggestions come only from matching titles (gap 1)? Strict or lenient boolean parsing? A
`limit` cap?

## If code is needed: working conventions (all verified this session)

- Work in a **fresh worktree** off the latest `origin/quicktricks-admin`. Fetch via the host alias:
  `git fetch raghav-hranker:abhi092515/quicktricks-backend.git quicktricks-admin:refs/remotes/origin/quicktricks-admin`.
  Plain `origin` over ssh fails. Symlink `node_modules` from
  `~/Projects/quicktricks-backend-auto-extension/node_modules`. Don't build in the main checkout
  `~/Projects/quicktricks-backend`, which has unrelated uncommitted work.
- Tests: `node:test` + `node:assert/strict`; `npm test`, `npm run test:integration` (in-memory Mongo).
  Baseline at `a8b5414b4`: unit 1909 tests / 17 failing, integration 505 / 6 failing (admin-create ×3,
  media-caption, streak ×2), `npx tsc --noEmit` 0. Redirect long suite output to a file; a streamed
  run stalled a subagent this session.
- Commit as the repo's configured work identity, **no** Co-Authored-By or Claude-Session trailers
  (memories `no-coauthor-trailers`, `git-identity-work-email`).
- Deploy = surgical dist (memory `quicktricks-backend-dist-deploy`): `npx tsc --outDir <tmp>`, list
  the `.js` that differ from the committed `dist` (it must be only your files; that also proves
  the client's dist is in sync), copy those `.js` and `.js.map` files and rewrite each map's `sources` to the
  path relative from `dist/…` back to `src/…`, `node --test` the dist tests, commit
  `build: dist for …`, rebase onto the client's latest pushes first (they push often), then push
  to `quicktricks-admin`. Box: `git pull --ff-only` and `pm2 restart 27` (API only). Access and PATH
  details are in memories `quicktricks-prod-box` and `quicktricks-box-ssh-key`. Record a rollback SHA.
  Pushes and box steps need the user's explicit go-ahead; auto mode blocks them.
- Local test against prod data (read-only): `reference/postman/course-search.README.md` describes
  the bed. The runner is `reference/scripts/automatic-plan-extension-local/run-prod-readonly.sh`
  with `QT_AUTOEXT_WORKTREE` pointed at a worktree (port 3110, one bed at a time). The existing bed
  `~/Projects/worktrees/qt-csearch-local-test` is still detached at an old commit. Re-detach and
  restart it before use.

## Context: what shipped in this session (don't redo)

In-course search `POST /api/courses/:courseId/search` is **live** on prod at `a8b5414b4`
(2026-09-29). Rollback: `313a6f073`. It is a different endpoint from `/api/courses/search`: it searches
one course's classes, `ebooks` (course PDFs) and tests, with per-section paging
(`section` + `offset` → `hasMore` + `totalCount`). Details:
- PRD: `docs/plans/prd-course-search.md` (D1–D12). Tasks: `docs/plans/tasks/course-search/` 01–07
  (01–04 and 07 done, 05 partially done, 06 open). Fork copies are in the worktree
  `~/Projects/worktrees/qt-course-search`, branch `feat/course-search`.
- Memory `course-search.md` has the deploy record and the smoke results.
- Still open there: signed-in parity check on prod (needs a real student token), the app-team guide
  and Postman paging cases (task 06).

**Also queued by the user:** add the same `section` + `offset` (+ `hasMore`/`totalCount`) paging to
global search `POST /api/search` (`src/controllers/searchController.ts`,
`src/services/search/orchestrator.ts`). Today it has only `limit` (1–50 per section) and the app
filters capsules on the client. Mirror `src/services/courseSearch/sectionPage.ts` and task
`07-section-paging.md`. Note that global search still reads a body `userId` for logging and test
attempts, and it writes the search log.

## Suggested skills

- `grilling`: settle the open details above (boolean leniency, `limit` cap, vocabulary scope) in a
  few questions. Don't reopen the decided scope.
- `tdd`: pin today's `searchCourses` output first (a golden for the no-flag case), then red → green
  for `isLive`/`isRecorded` and the `page`/`limit` default fix.
- `codebase-design`: if adding a route, to share one pipeline between the public and active-only
  variants rather than copying it.
