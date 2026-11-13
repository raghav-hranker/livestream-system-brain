# Course search: local Postman test bed (tasks 01–04)

Manual acceptance for `docs/plans/tasks/course-search/` over the real
`POST /api/courses/:courseId/search` route. The route is served by a **local** server running
`feat/course-search`, which reads **prod data read-only**.

| Piece | Where |
|---|---|
| Collection | `course-search.postman_collection.json` (generated). `base`, `course_id`, `inactive_course_id`, `user_id`, the queries and the local `jwt_secret` are collection variables; there is no environment file. |
| Generator (edit cases here) | `reference/scripts/course-search-local/build-postman.cjs` |
| Code under test | worktree `~/Projects/worktrees/qt-csearch-local-test`, detached at `feat/course-search` (last run: `e8d798f30`, tasks 01–04; `feat/course-search` is now `e0fa75672` with the `ebooks` rename + dist — re-detach the worktree before the next run). `node_modules` is symlinked from `../quicktricks-backend-auto-extension`. Its gitignored `.env.development` is a copy of the gsearch bed's: **local-only** secrets, Redis in the throwaway container `qt-gsearch-redis` (127.0.0.1:6380). |
| Prod read-only runner | the plan-extension runner pointed at this worktree: `readonly-guard.cjs` blocks every Mongo write, index build and collection creation; reads go to secondaries; crons are off. |

## Run

```sh
docker start qt-gsearch-redis
QT_AUTOEXT_WORKTREE=/Users/raghav/Projects/worktrees/qt-csearch-local-test LOG_DIR=/tmp/qt-csearch-logs \
  reference/scripts/automatic-plan-extension-local/run-prod-readonly.sh          # → :3110
# Postman: import the collection, "No environment", Run collection (in order: folder 1 saves the
# guest response that folders 2–3 compare against).
# or: npx newman@6 run reference/postman/course-search.postman_collection.json
reference/scripts/automatic-plan-extension-local/run-prod-readonly.sh stop
```

Port 3110 is shared with the gsearch and class-tabs beds; only one runs at a time. To pick up new
commits: `git -C ~/Projects/worktrees/qt-csearch-local-test checkout --detach feat/course-search`,
then stop and start again.

**Tokens.** Signed-in requests mint an HS256 JWT in their pre-request script, signed with
`jwt_secret` (the worktree's local `JWT_SECRET`), for `{{user_id}}`. It only verifies on the local
server, so never point `{{base}}` at prod.

## Request

```http
POST {{base}}/api/courses/{{course_id}}/search
Content-Type: application/json
Authorization: Bearer <token>        (optional; the ONLY identity — a body userId is ignored)

{ "query": "percentage", "limit": 10 }
```

Response `{ state, msg, data: { classes, ebooks, tests } }`. `classes` items are class-tabs cards
plus `tab` (`today | upcoming | previous | null`); `ebooks` items are the course's PDFs, exactly as Ebooks-tab entries (key renamed from `coursePdfs` 2026-09-28); `tests`
items are Tests-tab entries.

## What the collection checks

Contract checks run on every 200. The three sections are always present as arrays, each within the
limit. Every class is in this course, with no duplicates. Card fields and watch fields are present,
and an upcoming class keeps the pinned defaults. PDFs never carry `uploadPdf`, a storage key or a
signed URL.

| Folder | Cases |
|---|---|
| 1 Guest | `percentage`, typo `alligation`, word order `mixture part 2`, broad `ra`. A body `userId` of the buyer without a token gives a response **byte-identical** to the guest one. |
| 2 Signed in | A valid token matches the same classes as the guest. `lcm hcf part 1` carries the test account's real state (a resume point). The same query with the id only in the body shows none. Broad `ra` is run at limit 50. |
| 3 Bad tokens | Expired, forged and garbage tokens each get a 200 byte-identical to the guest, never a 401. |
| 4 Each section | `ebook` returns course PDFs. `test` returns `[]` (see below). |
| 5 Limits and errors | No limit gives ≤ 10, `limit: 500` gives ≤ 50, an inactive course gives 200. `"a"`, blank and missing queries give 400, a bad id 400, an unknown course 404. |

Defaults: `course_id` = **Railway Prime Batch (2026-27)** `6a4558e8ebb42f585d9a9f29` (the largest
course). `inactive_course_id` = `6a4558c2ebb42f585d9a8326` (NTPC CBT - 2 & ALP CBT - 2 Classes, status
0). `user_id` = test account `6a7eb7ce543dd0b9881e0a27`.

**Tests are empty on prod.** `coursetests` holds 1 document, and it is inactive. The live Tests tab is
empty for every course too, so `tests: []` is correct until an admin assigns a test to a course.

**Last run 2026-09-28**, prod read-only on `e8d798f30`: 22 requests, 216 assertions, 0 failures.
Average 334 ms, max 652 ms end to end (Mac → prod secondary, so this is not on-box latency; task 05
measures that).
