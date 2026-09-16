# Tasks: Shorts readiness via transcode callback

Vertical-slice breakdown of [ADR-0007](../../../adr/0007-shorts-readiness-via-transcode-callback.md).
Each task is a tracer bullet with its own acceptance criteria and names the governing ADR decision
instead of restating it. Read the ADR first; it holds the decision table, the callback body and the
rejected options, none of which are repeated here.

**Working-copy rules.**
- `video-transcoder`: `repos/video-transcoder` on `launch/quicktricks-v2` (manifest `ACTIVE_BRANCH`).
  Shared multi-tenant infrastructure: every change must be absent-means-today, pure where it decides,
  and covered by `npm test` (`node --test "test/**/*.test.js"`).
- LMS: the **fork** `quicktricks-backend`, branch `quicktricks-admin` = prod. Land from a worktree off
  `origin/quicktricks-admin` (the shorts work is `f5a0b4ab7`, already on that branch). Deploy is
  commit → push → pull on the prod box, never patch. No co-author trailers.
- Admin: the **fork** `quicktricks-admin`, worktree off `origin/quicktricks-admin`
  (local `../quicktricks-admin` is a stale scratch checkout). Discard the uncommitted read-side fix in
  `~/Projects/worktrees/qt-admin-shorts`.

| # | Task | Type | Repo(s) | Blocked by |
|---|---|---|---|---|
| 00 | [Audit the listener box against the branch](00-audit-listener-deploy-state.md) — **DONE 2026-09-17; D1–D7 open** | HITL | video-transcoder + listener box | — |
| 01 | [LMS: transcode-complete endpoint + 24h sweeper](01-lms-transcode-complete-endpoint.md) | AFK | quicktricks-backend | — |
| 02 | [Listener: per-(queue, client) job profile](02-listener-job-profile.md) | AFK | video-transcoder `src/` | — |
| 03 | [Manager: profile → container env, guard rows](03-manager-profile-env.md) | AFK | video-transcoder `gpu-server/` | 02 (shape only) |
| 04 | [Container: reporter owns the contract; callback; MP4 skip](04-container-callback-reporter.md) | AFK | video-transcoder `container/` | 03 (env names only) |
| 05 | [Deploy in order + acceptance run](05-deploy-and-acceptance.md) — **BLOCKED on D1–D7; the deploy plan in this file is wrong, see the audit** | HITL | all + production | 00–04 |
| 06 | [Admin: dialog polls the LMS; delete the R2 read path](06-admin-dialog-lms-polling.md) — **code done `614de12`, unpushed** | AFK | quicktricks-admin | 01 |
| 07 | [Remove the admin `videoStatus` PATCH arm](07-remove-admin-status-arm.md) | AFK | quicktricks-backend | 05, 06 |
| 08 | [Docs: two axes land in glossary, SYSTEM, slice, transcoder CONTEXT](08-docs-two-axes.md) | AFK | brain + video-transcoder | 05 |

Order of deploys is fixed by the ADR (decision 9) and by 05. Tasks 01–04 can be built in parallel
because every new input is absent-means-today; 02→03→04 share only the field and env **names**:

```
job.config.profile = { reporting?: { kind: 'callback', url }, mp4?: false }
container env:       REPORTING=callback  REPORT_CALLBACK_URL=…  TRANSCODER_SECRET=…  MP4_RENDITIONS=false
```
