# Course class tabs (Today / Upcoming / Previous): local Postman test bed

Manual acceptance for `docs/plans/tasks/course-class-tabs/` against the real
`POST /api/courses/:courseId/class-tabs` route. The route is served by a **local** server running
`feat/course-class-tabs`, which reads **prod data read-only**. The setup copies the global-search
test bed (`global-search-classes.README.md`).

| Piece | Where |
|---|---|
| Collection | `course-class-tabs.postman_collection.json` (generated). `base`, `course_id`, `user_id` and the local `jwt_secret` are collection variables; there is no environment file. |
| Generator (edit cases here) | `reference/scripts/course-class-tabs-local/build-postman.cjs` |
| Code under test | worktree `~/Projects/worktrees/qt-classtabs-local-test`, detached at `feat/course-class-tabs` (last run: `ea66071f7`, tasks 01–05). `node_modules` is symlinked from `../quicktricks-backend-auto-extension`. Its gitignored `.env.development` is a copy of the gsearch bed's: **local-only** secrets, with Redis in the throwaway container `qt-gsearch-redis` (127.0.0.1:6380). |
| Prod read-only runner | the plan-extension runner, pointed at this worktree (see below). `readonly-guard.cjs` blocks every Mongo write, index build and collection creation. Reads go to secondaries and crons are off. |

## Run against prod data (read-only)

```sh
docker start qt-gsearch-redis
QT_AUTOEXT_WORKTREE=/Users/raghav/Projects/worktrees/qt-classtabs-local-test LOG_DIR=/tmp/qt-classtabs-logs \
  reference/scripts/automatic-plan-extension-local/run-prod-readonly.sh          # → :3110
# Postman: import the collection, choose "No environment", then Run collection (in order).
# or: npx newman@6 run reference/postman/course-class-tabs.postman_collection.json
QT_AUTOEXT_WORKTREE=/Users/raghav/Projects/worktrees/qt-classtabs-local-test \
  reference/scripts/automatic-plan-extension-local/run-prod-readonly.sh stop
```

The runner's port is fixed at **3110**, so this bed and the global-search bed can't run at the same time.
Stop one before starting the other; `stop` kills whatever holds 3110. To move the code under test,
run `git -C ~/Projects/worktrees/qt-classtabs-local-test checkout --detach <sha>` and restart the server.

Expected guard noise in `/tmp/qt-classtabs-logs/server-3110.log` is about 170 blocked `createIndex`
calls from **existing boot code**. Nothing from this branch writes, and the endpoint only reads
(`courseclasses`, `classes`, taxonomy, `classprogresses`).

**Tokens.** Signed-in requests mint an HS256 JWT in their pre-request script for `{{user_id}}`,
with `jwt_secret` = the worktree's local `JWT_SECRET`. The token only verifies on the local server, so
never point `{{base}}` at prod. To test another student, change `user_id`.

**IST days** are computed in the test scripts from the Mac's clock. Don't run across IST midnight.

## What the collection checks

**The contract on every response** is a collection-level test script. Every response has
`state` equal to the HTTP status and a string `msg`. On every 200 from `/class-tabs`:
- `data` is `{ classes, nextCursor, totalCount, tabCounts }`, plus `search` only on a searched request.
- Every card has the required fields, and no field outside the today's-classes set plus
  `watchStatus`/`watchTime`/`videoPosition`/`manualCompleted`/`searchMatch`.
- `searchMatch` (`exact`|`similar`) is on every card of a searched response and on no other card.
- No `isCompleted` and no asset (`hlsAsset`/`pdfAsset`/`videoAsset`), even nested.
- `streamStatus` is a known state, null or absent.
- `_id = courseClassId` and `course` is the requested course.
- The placement is eligible (`isActive`, `status` 1).
- `isBlinking` is true only when `streamStatus` is `live`.
- Taxonomy objects are well formed, no card appears twice in a page, and watch fields have valid values.

| Folder | Cases |
|---|---|
| 0 Smoke | one request per tab. Previous with the default limit gives 20; limit 50 (max) and limit 1 (min) → 200 |
| 1 Today | Every card's IST day is today, or the class is Live. Live cards come first, then start ascending, then placement id. `nextCursor` is null. `limit: 1` plus a garbage cursor are ignored (same list). A signed-in request gets the same cards as a guest. **Cross-check against the legacy `todays-classes`:** same cards for the day, with the same field set except the legacy card's `isCompleted`. |
| 2 Upcoming | Every card's IST day is after today and none is Live. Pages are ascending and full whenever `nextCursor` is set. A limit-4 cursor chain with no repeats runs until `nextCursor` is null (max 15 pages). |
| 3 Previous | Every card's IST day is before today, `hasPlayback` is true, and none is Live. The limit-5 scroll chain is newest first within and across pages, with no repeats and full pages. It stops after 6 pages (the course has about 180 at limit 5). |
| 4 Auth | The guest response on Previous (limit 10) is the baseline. These must match it exactly, ignoring watch fields and view counters: a body `userId` (the student), a valid token, a valid token with another user's body `userId`, and expired, forged or garbage tokens. Bad tokens must also give `not_watched`/`0` everywhere. |
| 5 Errors | 400 for a bad tab, a missing tab, a bad watch value, `limit` 0, 51, 2.5 or `"5"` (a string), an empty cursor, a malformed cursor, and a tampered cursor (the payload moved 1 ms, the old MAC kept). 400 "different tab" for a Previous cursor on Upcoming and for the reverse. 400 for a bad course id; 404 for an unknown course. |
| 6 Watch (task 04) | Signed-in `watch=all` puts `watchStatus`/`watchTime` on every card. `partial` means ≥ 60 s; `not_watched` means < 60 s. The test user has real progress. `watched` returns only watched cards. The `partial` and `not_watched` chains contain only matching cards, full pages and no repeats. Today with `partial` returns a subset of the unfiltered list, in the same order; Today with `watched` returns no Live card. A guest with `watched` or `partial` gets `[]` with a null `nextCursor`. A guest with `not_watched` gets the whole tab. Upcoming ignores `watch` (same first page) and is always `not_watched`/`0`. Watch tests are named `[task 04] …` and skip only on a server older than task 04. |
| 7 Search | `search="percentage"` on Previous: a limit-5 chain in date order, no repeats, every `exact` card contains the word, `data.search.query` echoes it, `tabCounts` ≤ the plain tab sizes and `totalCount = tabCounts.previous`. Today with the search is a subset of Today in the same order. `"  PERCENTAGE "` continues the searched chain with its cursor. A blank search equals the folder-4 guest baseline. `"alligation"` labels close spellings `similar`. 400 for a 1-character or non-string search (and over 100 characters); 400 "different search" for a searched cursor with another search or none, and a plain cursor with a search. |

Defaults:
- `course_id` = **Railway Prime Batch (2026-27)** `6a4558e8ebb42f585d9a9f29`. It has daily live classes (6 today at the last run), about 900 playable Previous classes and about 9 scheduled Upcoming ones.
- `user_id` = test account `6a7eb7ce543dd0b9881e0a27`. It owns the course and has real ClassProgress in it: 9 partial Previous classes and 1 partial Today class.

**Real-data caveat for `watched`:** no Class in Railway Prime Batch has a `duration` (0 of 913 placements).
That means only a manual completion can make a card Watched. None of the 1,300 buyers probed on
2026-09-25 has one, so the `watched` requests check an empty list. To see a non-empty `watched`, mark a
class complete for a test user on a writable DB. This bed is read-only.

**Contract updated 2026-09-29** (`totalCount`/`tabCounts`/`manualCompleted`, folder 7 search) — not yet re-run.

**Last run 2026-09-25, 21:30 IST.** Prod read-only on `ea66071f7` (tasks 01–05): 48 requests (54 with chain
repeats), 876 assertions, 0 failures, 0 skipped. Average response 144 ms, max 341 ms end to end
(Mac → prod secondary; not representative of on-box latency). No Live class existed at run time, so
"Live first" held trivially.
