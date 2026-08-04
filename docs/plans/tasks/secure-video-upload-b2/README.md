# Tasks: Secure video upload to B2 (quicktricks)

Tracer-bullet breakdown of [the PRD](../../prd-secure-video-upload-b2.md), governed by
admin-dashboard [ADR 0004](../../../../../admin-dashboard/docs/adr/0004-video-uploads-move-to-b2-multipart.md)
(*Video uploads move to B2 through the existing multipart routes*, partially superseding
ADR 0001). Everything lands on the shared slice branch — check `ACTIVE_BRANCH` in
`repos.manifest` before touching a repo.

Code changes live only in **admin-dashboard**; the transcoder and nodejs-server legs are
env/infra registration. The deferred `/b2/webhook` auth gap is a recorded risk (ADR 0004),
not a task here.

| # | Task | Type | Repo(s) | Blocked by |
|---|---|---|---|---|
| 01 | [B2 multipart tracer spike](../../done/tasks/secure-video-upload-b2/01-b2-multipart-tracer-spike.md) | HITL | infra + brain | None |
| 02 | [B2 storage module + unit tests](../../done/tasks/secure-video-upload-b2/02-b2-storage-module.md) | AFK | admin-dashboard | None (parallel to 01) |
| 03 | [Route flip + contract tests](../../done/tasks/secure-video-upload-b2/03-route-flip-contract-tests.md) | AFK | admin-dashboard | 02 |
| 04 | [Secured-customer registration (472)](../../done/tasks/secure-video-upload-b2/04-secured-registration.md) | HITL | video-transcoder + nodejs-server env | 01 |
| 05 | [Config repoint + single-upload E2E](../../done/tasks/secure-video-upload-b2/05-config-repoint-single-e2e.md) | HITL | admin-dashboard + ls | 03, 04 |
| 06 | [Bulk E2E + prerecorded-arc smoke](../../done/tasks/secure-video-upload-b2/06-bulk-e2e-smoke.md) | HITL | all | 05 |
| 07 | [Repoint processing-state read path to B2](07-processing-panel-b2-repoint.md) | AFK | admin-dashboard | None (follow-up from 06) |

**Status 2026-07-22: tasks 01–06 DONE** — full slice verified E2E (single + bulk, signed
playback, unsigned 403, failure isolation). 07 is the one open follow-up: the
ProcessingVideos read path (`/api/uploads`) still lists the old `tempvideos-selectionway`
bucket, so post-upload processing/failed states are invisible in the dashboard.

Parallelism: 01 and 02 start together; 03 follows 02; 04 follows 01; 05–06 are the serial
assembly at the end. 01 carries the slice's one real unknown (browser multipart against B2
needs the CORS rule to **expose `ETag`** on part PUTs) — prove it before stacking code on it.

**Blocked note:** the admin-dashboard worktree currently has unresolved merge conflicts from
the PDF track (`BulkUploadPdfsSheet.tsx` + test). Resolve before committing tasks 02/03.
