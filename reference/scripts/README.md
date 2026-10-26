# reference/scripts — index

One line per script. **Reuse before rewriting**: grep this file first. Hosts, users and keys are in [`../hosts.md`](../hosts.md).
Unless marked **writes**, a script is read-only. Data files (`*.json`, `*.csv`) beside the scripts are backups or inputs named in `prod-data-changes`.

## Prod health and API (quicktricks, webserver2-2)
- `qt-health.sh [--save]` — one-call health check from the Mac: box, pm2, API 5xx, rs0, stuck notifications; ends in a verdict. Runs daily via `com.hranker.qt-health.plist`.
- `ops-supervisor-audit.sh [webserver|encoder]` — read-only: Redis/pm2 systemd units and Restart= policy, pm2 boot unit, per-app max_memory_restart and restart counts. Step 1 of `docs/plans/ops-console.md`.
- `api_failure_probe.sh` — "APIs are failing" probe of the prod API logs.
- `api_stall_probe.sh` — zoom into one time window of the API logs.
- `api_request_rate_sample.sh` — run ON the box; samples the request log for N seconds.
- `test_flow_5xx_probe.sh` — 5xx and >30 s responses on the test-taking routes.
- `mongo-top.js` / `mongo-live.js` — `$top`, `currentOp`, `rs.status`; live view of one rs0 member.
- `login_sessions_probe.js` — login-session probe (auto-logout is client-side).
- `notification_duplicate_probe.js` — duplicate / stuck-sending notifications.
- `qt_socket_redis_probe.sh` / `qt_socket_redis_traffic.sh` — quicktricks-socket Redis Cloud probe and who moves bytes through it.
- `dashboard_hourly.js` — today's revenue vs the 7-day hourly norm.
- `search-usage.js` — global search usage report.
- `why_unpaid.js` — why `/api/courses/by-id-2` says `is_buy=0` for a user+course.
- `offer_pockets.js` — size the "holds X, never bought Y" pockets.
- `plan_extension_probe.js` — plan-extension probe, run on the box.

## Playback and media
- `qt-playback-check.cjs` — check a class's hlsAsset from the LMS checkout on the box.
- `playback_walk.cjs` / `playback_host_check.cjs` — mint an admin preview and walk master → child → segment; call `/playback` in-process.
- `playback_client_split_sample.sh` — run ON the box as root; sample access logs by client.
- `playback_cdn_pilot.cjs` — **writes**: route chosen classes through Bunny (pilot; undo in `prod-data-changes`).
- `hls_segment_bench.cjs` — compare CDNs on segment fetch times.
- `hls_frag_stats_console.js` — paste into DevTools on a playing class page.
- `qt-vod-recover.cjs` — **writes**: replay the encoder's end-of-stream finalize for a stranded class.
- `finish561.js <classId>...` — **writes**: SelectionWay (561) stranded classes; rebuilds VOD playlists from storage when local segments are gone, then Room ended+vodPath, class_link PUT, MP4 job. Run on livestream-cpu-new from `~/livestream/backend`. Header lists the two extra steps for classes stuck in `reconnecting`.

## Prod data edits (all **write**; dry-run by default; ledger = `prod-data-changes`)
- `set_course_priority.js`, `set_plan_duration.js`, `set_short_zero_priority.js`, `set_course_price_from_plans.js` — set one field across a collection.
- `apple_plans_to_consumable.cjs` — switch plan IAP product ids to the consumable.
- `reassign_pdf_teacher.js` — move content off a faculty name the picker cannot offer.
- `qhub_repair.js` — Q-Hub ghost repair; run from the backend checkout on the box.
- `plan_extension_seed.js` / `plan_extension_backdate.js` — seed or toggle a lapsed test order.

## Taxonomy / sections reconciliation (read-only audits)
- `reconcile_dry_run.cjs` — dry run of the sections-topics reconciliation PRD.
- `taxonomy_dupes.cjs`, `taxonomy_usage.cjs`, `section_kinds.cjs`, `topic_audit.cjs`, `keeper_display_probe.cjs`, `test_copy_usage.cjs` — duplicates, usage, kinds, collisions, keeper display, test copies.
- `build_reconcile_sheet.py` — build the reconciliation spreadsheet.

## AppX migration
- `vidyagram-import-raw-order-verify.cjs [snapshot-dir]` — offline independent traversal of captured AppX tree pages; checks visible placement priority and gone-row suffix ordering.
- `vidyagram-import-structure-verify.cjs [snapshot-dir]` — offline read-only course taxonomy, filing and priority audit from exported JSON; saves structure findings and student sample comparisons.
- `apx_teacher_audit.js` — does APX supply a per-asset teacher.
- `apx-completion-fleet.sh` (Mac), `apx-completion-pilot.sh` (box), `apx-completion-supervisor.sh`, `*.service` — manual-completion OTP fleet (done 09-29; stopped via manual-stop locks).
- `vidyagram-nightly-gcp-run.sh`, `vidyagram-nightly-preflight.cjs`, `vidyagram-nightly-gcp.service`, `vidyagram-nightly-gcp.timer` — **writes**: dedicated Vidyagram nightly sync on GCP test-uday at 02:30 IST; preflight and shared lock protect the run; `vidyagram-nightly-api-pacing.patch` records the deployed source change.
- `vidyagram-box-setup.sh` — Vidyagram backend on webserver2-2, Part A (no sudo).
- `vidyagram-set-apx-session.cjs` — **writes**: replace the stored AppX cookie with one from a browser.
- `vidyagram-ingest-worker.sh`, `vidyagram-bastion-overnight.sh`, `vidyagram-bastion-pdf-env.sh` — OCI bastion video/PDF mirror runs.
- `vidyagram-ingest-status.cjs`, `vidyagram-progress-sheet.js` — migration progress; the sheet refreshes every few minutes.
- `vidyagram-student-pdf.cjs`, `vidyagram-pdf-sheet-reconcile.cjs` (+ `.test.cjs`) — PDF import from the bastion checkout.
- `vidyagram-class-title-dryrun.cjs` — read-only, no DB: replays the class import's title rule over a catalogue preview dir and compares the topic-first and bare-first rules; writes `class-titles.csv` + `batch-labels.csv` (task appx-tenant-onboarding/07).
- `vidyagram-course-description-lines.js` — **writes** (MODE=commit; default dry): mongosh, converts imported courses' AppX HTML `fullDescription` into plain `description` lines and unsets `fullDescription`, backup first. Run 10-19 on 111 courses.
- `vidyagram-course-builder-e2e.mjs <backend .env.localpreview> <admin.token> [--keep | --clean]` — **writes LOCAL Mongo only** (127.0.0.1:27037): Course Builder end to end against the local backend :5914; pricing via quote + checkout, access by HTTP for granted builds, listings. Adds invented data tagged `e2eRun` and removes it. 74 checks, 74/74 on 10-20.
- `vidyagram-appx-course-report.js` — read-only mongosh: one row per AppX course (title, on/off, price/mrp, classes and PDFs AppX lists vs Courses/CourseClass rows/PDFs we imported); OUT=report.json.

## Local harnesses (`*-local/`)
- `automatic-plan-extension-local/`, `course-class-tabs-local/`, `course-search-local/`, `global-search-classes-local/` — Postman builders and seeds for the matching PRD.
- `course-timetable-audit-2026-09-29/` — `updateCourse` bodies recovered from the pm2 log.

- `vidyagram-import-verify-snapshot.cjs` — read-only local-tunnel snapshot for the 2026-10-19 course import audit; output under outputs/vidyagram-import-verify-2026-10-19/.
- `vidyagram-import-verify-plan.cjs` — read-only rebuild of daily-2026-10-19 plans plus course 96 fallback, for the import audit.
- `vidyagram-import-verify-qt.cjs` — read-only Quicktricks collection/sample discovery for import audit.

- `vidyagram-import-verify-placement.cjs` — read-only offline CourseClass metadata and Class timestamp/title audit over saved snapshots.
- `vidyagram-import-verify-metadata.cjs` — offline course metadata and placeholder comparison against captured plans/backups.
- `vidyagram-certificate-indexes.cjs [--commit]` — **writes with --commit**: builds the two unique `certificates` indexes (`code`; `userId`+`courseId`, the claim-race guard) on vidyagramdb with `commitQuorum: 'majority'`; refuses any other DB before connecting; prints rs0 member health and refuses to build while one is unhealthy; dry run lists what is missing. Run on webserver2-2 from the Vidyagram checkout before claims open (certificates task 06). Not run yet.
- `vidyagram-certificates-cloudflare-wizard.sh` — interactive wizard for whoever holds the Hranker Cloudflare account: R2 bucket `vidyagram-certificates` (APAC), custom domain `vidyagram-certificates.hranker.org` with r2.dev off, the `X-Robots-Tag: noindex, nofollow` response-header rule, a bucket-only Object Read & Write token, the `CERTIFICATE_*` box env lines, then key-free curls (random code 404, root does not list). Writes no file and never takes a secret; the keys go from Cloudflare straight into the box env (certificates task 06). Not run yet.
- `vidyagram-certificates-e2e-seed.cjs <local mongo uri> <out.json>` — seeds a SCRATCH local Mongo (refuses non-localhost) for the by-hand certificates check: a test admin (generated password, no mobile so no OTP), a paid course with 3 classes, a buyer who ticked all and one who ticked one; writes the admin login and student tokens to <out.json> (mode 600). Needs `JWT_SECRET` = the local backend's. Used 2026-10-24 with docker `mongo:7` + `adobe/s3mock`.
- `vidyagram-mycourses-invoice-smoke.cjs` — read-only (refuses any DB but vidyagramdb), except that my-courses itself makes a missing invoice PDF: mints admin + student tokens in memory, calls :4100 my-courses for up to 5 own-checkout buyers and one AppX buyer, checks each `invoiceDownloadUrl` equals the stored `invoiceUrl` and serves a PDF, student token = admin links, no token and AppX = null. Run on webserver2-2 from the Vidyagram checkout: `node - < script`. 10-26: 6/6 PASS (1 own-checkout buyer, 2 linked cards).
- `explore_test_series_plans_probe.cjs` — read-only: lists plans flagged `isExploreTestSeries` plus the two fixed explore ids; run from the backend checkout on the box with `URI=$MONGO_URI` (needs its mongoose).
