# Vidyagram daily sync: upstream API denial — 19 October 2026

Initial diagnosis around 12:08–12:12 IST is preserved below. **Update: the daily runner is deployed on working GCP egress and today’s recovery is running; see the recovery section.**

## Reproduced failure

`GET https://armathsapi.akamai.net.in/get/folder_contentsv3?course_id=3&parent_id=-1&start=-1`

The existing sync headers return HTTP 403 with a 134-byte HTML denial page, rather than the expected JSON row array. The same request with Vidyagram website Origin/Referer also returns 403, from both the OCI migration host and the local network. A request using an existing cached Vidyagram student session also returns the same HTML 403. No credentials were printed or changed.

The public Vidyagram website still uses this API hostname. Its normal Paid Courses navigation independently produces HTTP 403 on `get/folder_courses` and `get/coursecategories`, including the browser's CORS preflight requests. Observed response headers include `via: 1.1 google`; the hostname alone does not establish which infrastructure component generated the denial.

This establishes API denial on the tested browser/network paths and the migration worker. It does not establish a general provider outage or identify the rule responsible. The user reports that their website works; a successful fresh request still needs comparison. The initial conclusion that provider intervention is necessarily the only remedy was too strong.

## Existing run state

The OCI runner is `/home/opc/vidyagram/nightly-run.sh`, checkout `/home/opc/vidyagram/nightly`, revision `0a9a82ce09b06d890cb4c5b1e0ca87a34755ed82`.

`daily-2026-10-18` is already marked `failed`. Its stored failure says it was stopped at course 79 because every course received HTTP 403 and the mirror was restored to `full-2026-10-13`. Capture failed; downstream classes, reconciliation, requeue, PDFs, thumbnails, durations and placement remain pending. No nightly distributed lock was present when inspected.

The inspected user's crontab contains the other APX PDF catch-up job, but no Vidyagram nightly runner entry; root has no crontab. This alone does not rule out an external scheduler. Do not install a duplicate schedule without resolving its intended owner.

## Required recovery

Compare a successful fresh website request with the denied requests before choosing a remedy. If access depends on a provider rule, request supported access or an approved replacement address from AppX. The provider can reproduce using the public Vidyagram Paid Courses page, without receiving any private session data. A local cookie refresh or repeated full-catalogue run is not a demonstrated remedy.

After the provider change, first verify the root folder endpoint returns HTTP 200 and a JSON `data` array from the OCI worker. Then run the existing locked nightly runner and verify capture and downstream results. Keep the restored full mirror in place until a fresh capture succeeds. No sync code, schedules, source records, credentials or CDN rules were changed during this diagnosis.

## Follow-up: working website comparison, around 12:35 IST

The user supplied `https://www.vidyagram.online/new-courses/85/content?activeTab=Content`. The original Chrome tab displayed course folders. Its inspection connection could not attach, so its successful request was not captured and the original tab was not refreshed.

A separate fresh tab in the same signed-in Chrome profile displayed the course title but no loaded folder contents. Captured requests use:

`/get/folder_contentsv3?course_id=85&parent_id=-1&windowsapp=false&start=0`

The browser's OPTIONS preflight with Origin `https://www.vidyagram.online` received HTTP 403, `fromDiskCache: false`, with the same 134-byte HTML response. The completion API preflight also received 403. This failure precedes transmission of the authenticated GET and cannot be attributed to the student's token by this observation. A direct request using the www website Origin/Referer also failed.

The displayed folders in the original tab are not proof of a fresh successful request; they could have loaded earlier. Conversely, the fresh tab's failure is not proof that every user's website fails. Await a fresh successful request or the device/network on which it succeeds. No repair or production configuration change has been made.

## Recovery deployed: GCP, 19 October 2026

A later simultaneous comparison returned HTTP 200 locally and HTTP 403 from the original OCI bastion. Started existing stopped OCI `vidyagram-ingest-4` (`130.210.15.171`) for a bounded probe; it also returned HTTP 403 and was returned to **STOPPED**, verified through OCI. GCP `test-uday` returned HTTP 200 / API 200 with valid folder rows. This supports a network/egress-dependent denial; it does not identify the provider's exact rule or prove that request volume caused it.

Moved the nightly runner to an isolated directory on existing GCP `test-uday`:

- Source: `/home/raghav/vidyagram-nightly-20261019`, based on `f79842940` plus serial API pacing.
- State and logs: `/home/raghav/vidyagram-nightly/logs`.
- Service: `vidyagram-nightly-gcp.service`; timer: `vidyagram-nightly-gcp.timer`.
- Daily schedule: **02:30 IST**; next after deployment is **20 October 2026 at 02:30 IST**.
- Both CMS and student folder requests are paced at one second; concurrent folder callers share one serial queue, including after connection errors. This limits request bursts; it cannot guarantee that the provider will not block the route.
- A read-only preflight verifies the target DB, maintained session, authenticated CMS course listing and student root listing before the actual sync begins. A denied preflight stops the run before catalogue writes.
- Host flock plus the existing shared distributed lock prevent duplicate runs. Service has a 7-hour timeout, 2 GiB memory limit, one CPU quota, and private files/logs.
- Included the existing `f79842940` capture fix: failed attempts keep the prior completed catalogue authoritative.

Verification: the new pacing regression failed on the old code (three concurrent calls) and passed after the fix. All **82** targeted pacing, HTTP-source, capture and nightly integration tests passed, including the reproduced 10-18 all-403 incident and capture promotion/crash cases. The pacing test also passed on the deployed GCP runtime.

Production preflight on GCP passed: `vidyagramdb`, maintained session live, CMS returned one requested row and student root returned one folder row. Baseline: 10,553 Classes and 8,028 PDFs. Copied only existing migration DB/storage configuration; no session or credential values were logged, and the temporary local environment file was removed.

Started `daily-2026-10-19` at **12:46:33 IST**. Verified the run acquired its lock, seeded 38 missing PDF title snapshots, and enumerated all 147 AppX courses. This is an active recovery, not a completed catalogue/import result; final state comes from `apxnightlysyncruns` and the run log.

Reproducible runner, preflight and service/timer files are under `reference/scripts/vidyagram-nightly-*`. Source pacing edits and regression test are in the existing `~/Projects/worktrees/vg-nightly-sync` checkout and are not committed yet. No unrelated backend, transcoder, completion worker or old OCI schedule was changed. The old OCI nightly cron was absent when inspected.

Live capture verification after startup: **803 rows and 139 tree pages staged** under `daily-2026-10-19`; course 3 actively capturing, zero completed courses and zero failed courses at this checkpoint. These are staged capture counts, not imported Class/PDF counts. They verify successful real student-tree traversal through GCP after the OCI denial. The run continues under systemd beyond this diagnostic turn. Reproducible pacing diff (including its regression test): `reference/scripts/vidyagram-nightly-api-pacing.patch`.

## Faster pace enabled at 13:22 IST

At the user's request to speed up the sync, a read-only GCP pilot fetched 16 known course-85 folders at a serial **250 ms** gap. All 16 succeeded in **5,661 ms**, with no retry or failure. Changed the nightly capture's CMS and student gaps from 1,000 ms to 250 ms; the shared student queue still permits only one request at a time. This removes 75% of deliberate waiting, not 75% of all run time, and a short pilot cannot establish indefinite provider acceptance.

All **22** pacing/nightly integration checks passed for the updated settings. Stopped the prior worker through its service, verified MainPID=0, and removed exactly its own distributed lock by key and matching run instanceId. Preserved manual-stop and other-worker locks. Restarted **the same `daily-2026-10-19` run** at 13:22:06 IST; confirmed successful preflight, lock acquisition and course enumeration under revision `f79842940 + serial-api-pacing-250ms-2026-10-19`. Completed course captures are skipped; the interrupted course resumes from staged rows/pages. Timer remains enabled. The full run is still active, and its overall ETA should be revised from observed progress rather than the small pilot alone.
