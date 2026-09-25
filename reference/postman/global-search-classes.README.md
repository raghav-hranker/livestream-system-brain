# Global search — classes section: local Postman test bed (tasks 01–03)

Manual acceptance for `docs/plans/tasks/global-search-classes/` over the real `/api/search` routes,
served by a **local** server running `feat/global-search-classes`, reading either **prod data
(read-only)** or a local seed.

| Piece | Where |
|---|---|
| Collection | `global-search-classes.postman_collection.json` (generated; `base`, `user_id`, queries and the local `jwt_secret` are collection variables — no environment file) |
| Generator (edit cases here) | `reference/scripts/global-search-classes-local/build-postman.cjs` |
| Code under test | worktree `~/Projects/worktrees/qt-gsearch-local-test`, detached at `feat/global-search-classes` (node_modules symlinked from `../quicktricks-backend-auto-extension`); its gitignored `.env.development` holds **local-only** secrets and points Redis at the throwaway container `qt-gsearch-redis` (127.0.0.1:6380) |
| Prod read-only runner | the plan-extension runner, pointed at this worktree (below): `readonly-guard.cjs` blocks every Mongo write / index build / collection creation, reads go to secondaries, crons off, `ENFORCE_ORDER_EXPIRY` unset as on the box |
| Local seed (optional) | `reference/scripts/global-search-classes-local/seed.js` + `run-servers.sh` (3110 expiry off / 3111 on, db `qt_gsearch_test`) — fixtures written, **not yet run through the collection** |

## Run against prod data (read-only)

```sh
docker start qt-gsearch-redis
QT_AUTOEXT_WORKTREE=/Users/raghav/Projects/worktrees/qt-gsearch-local-test LOG_DIR=/tmp/qt-gsearch-logs \
  reference/scripts/automatic-plan-extension-local/run-prod-readonly.sh          # → :3110
# Postman: import the collection, "No environment", Run collection (in order).
# or: npx newman@6 run reference/postman/global-search-classes.postman_collection.json
QT_AUTOEXT_WORKTREE=/Users/raghav/Projects/worktrees/qt-gsearch-local-test \
  reference/scripts/automatic-plan-extension-local/run-prod-readonly.sh stop
```

The runner also preloads the Razorpay stub and sets the plan-extension switch — harmless here, search
touches neither. Expected guard noise in `/tmp/qt-gsearch-logs/server-3110.log`: blocked `insertOne` on
`searchlogs` / `searchclicklogs` (fire-and-forget, responses unaffected) and ~170 blocked `createIndex`
calls that **existing boot code** issues explicitly — nothing from this branch.

**Tokens.** Signed-in requests mint an HS256 JWT in their pre-request script with `jwt_secret` = the
worktree's local `JWT_SECRET`, for `{{user_id}}`. That only verifies on the local server — never
point `{{base}}` at prod. To test another student, change `user_id` (and `query_owned` to a query whose
classes sit in a course they bought).

## What the collection checks

Contract checks, true on any data, applied to every search response:
sections in order with `classes` after `courses` · ≤ `limit` classes, no duplicates · envelope
(`type:'class'`, `deepLink:/classes/<id>`) · no `isLive` / asset in `meta` · `streamStatus` known or null ·
booleans · every class has ≥ 1 attached course with the full field set, none twice · an inactive course
only when bought · `canPlay` = class free ∨ any course free/bought · courses ordered purchased → free → rest.

| Folder | Cases |
|---|---|
| 0 | capsules: `all, courses, …`; "Classes" only when the server has `SEARCH_CLASSES_CAPSULE_ENABLED=true` (off by default) |
| 1 Guest | no token, **body `userId` = the buyer** ⇒ nothing purchased, no inactive course; typo (`alligation`), words in any order (`mixture part 2`), another query |
| 2 Signed in | valid token for `user_id` ⇒ a purchased course appears, and every class carrying one is playable |
| 3 Bad tokens | expired / forged / garbage ⇒ 200 and **byte-identical** to the guest response |
| 4 | click `type:'class'` ⇒ 204; trending ⇒ `classes: []` |

Defaults: `user_id` = test account `6a7eb7ce543dd0b9881e0a27` (owns Railway Prime Batch 2026-27),
`query_owned` = `mixture`.

**Last run 2026-09-25**, prod read-only on `1b50b9d42` (tasks 01–03 + perf fix): 12 requests,
156 assertions, 0 failures. Avg response 329 ms / max 642 ms end to end (Mac → prod secondary, all
seven sections; not representative of on-box latency).
