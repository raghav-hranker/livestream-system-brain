# Vidyagram certificates: tasks

PRD: [`../../prd-vidyagram-certificates.md`](../../prd-vidyagram-certificates.md).

Prototypes:
- [what the link serves](../../../prototypes/certificate-q19/index.html)
- [certificate design](../../../prototypes/certificate-design/index.html): design A won
- [admin switch](../../../prototypes/certificate-batch-switch/index.html): variant C won, plus B's badge

Repos: the Vidyagram backend (fork of quicktricks-backend, branch `vidyagram-admin`) and the Vidyagram admin (fork
of quicktricks-admin, branch `vidyagram-admin`). The app team builds the student screens from the guide in task 06.
Nothing here touches quicktricks.

| # | Task | Type | Blocked by |
|---|---|---|---|
| 01 | [Course-complete switch](01-course-complete-switch.md) | AFK | None |
| 02 | [Certificate renderer and bundled fonts](02-certificate-renderer.md) | AFK | None |
| 03 | [Certificate status on the course page](03-certificate-status.md) | AFK | 01 |
| 04 | [Claim, preview and My certificates](04-claim-and-my-certificates.md) | AFK | 02, 03 |
| 05 | [Course-complete push](05-course-complete-push.md) | AFK | 01, 03 |
| 06 | [Ops, app guide and prod deploy](06-ops-app-guide-and-deploy.md) | HITL | 01 to 05 |

Order: 01 and 02 run in parallel. Then 03. Then 04 and 05 in parallel. Then 06.

The Cloudflare part of 06 (bucket, domain, noindex rule, token) has no code dependency. It can be done early by
whoever has the Hranker Cloudflare account.

**Done:**
- **02** (2026-10-24): backend 3e0acd52b, merged as cf9466807. The renderer gave 14/14 in the
  `node:22-bookworm-slim` container with 0.000% pixel difference from the references, and `NO NEW FAILURES`.
  A print render takes about 135–185 ms and adds about 240 MB of memory.

- **01** (2026-10-24): backend cb8fee26b, 17ce6d639 and ff927ac81, merged as e466f2b08. Admin 7aa7405 and 21f479a,
  merged as 92e6d35. `NO NEW FAILURES` on both sides. A review sent it back once: the first version added
  `optionalAuthenticateToken` to the public `GET /api/courses/search`, which would put a session read and write on
  every app search. That was reverted, and pickers now use the admin-only
  `POST /api/admin/courses/course-complete-status`.

- **Integration heads** after 01 and 02: backend e466f2b08, admin 92e6d35, both on `feat/vg-certificates`. Both
  suites give `NO NEW FAILURES`. Nothing has been pushed.

- **03** (2026-10-24): backend b498f6bf5 and 0e039b9eb, merged as 641531426, which is the new integration head.
  `NO NEW FAILURES`. A review sent it back once: a course not marked complete now returns `not_enabled` after the
  course read alone, with no progress, order or placement read. A database-call test proves it.

- **04** (2026-10-24): backend 011f73deb, merged as dfe0c2a7c. `NO NEW FAILURES`. It added the index script
  `reference/scripts/vidyagram-certificate-indexes.cjs`, dry-run by default. It builds `code` and
  (`userId`, `courseId`) as unique indexes and refuses a quicktricks database.
- **05** (2026-10-24): backend 4cd222654, merged as 8603ce509. `NO NEW FAILURES`. The audience is one aggregation
  and took 167 ms for 5,000 owners in-memory. A test proves it equals task 03's `eligible` set on 18 kinds of
  student.
- **04b follow-up** (2026-10-24): backend 09067e9ed, 21f40d9d5, 4a13fd2d1 and ce4636eb5, merged as 50a7d23db.
  - It adds a render concurrency cap, `CERTIFICATE_RENDER_CONCURRENCY` (default 2, FIFO, shared by preview and
    print).
  - The audience now reads holders through the Certificate model.
  - One placement loader, `coursePlacements.ts`, serves both the status and the audience.
  - `suggestedName` now passes the claim's name rule.
  - It also fixed a type error in a test file that the 04/05 merge had introduced.
- **Banner wording** (2026-10-25): admin f27388a. It reads "Marked complete on <date> by <admin>".
- **04c** (2026-10-25): backend 710cf3bc8 and 42a3b509d, merged as 80cd85177; admin 8689429, merged as 2d2c4bc.
  - A new `CERTIFICATE_PUSH_ENABLED` flag is off by default and stays off at launch, as the user decided.
  - The push goes out only when the feature is on, claims are open and the push flag is on. Otherwise `notifiedAt`
    stays empty.
  - `firstTime` now means "a push was queued". Admin reads get `pushOnComplete`.
  - `courseId` is now on the claim 201 and 200 bodies, the `mine` rows and the issued status.
  - The admin dialog promises a push only when `pushOnComplete` is true.
  - Checked locally in the browser: no push was sent, and `notifiedAt` stayed empty.
  - **Date-dependent test:** `currentAffairs` "weekly list never shows the running week" fails on Sundays at the
    base too. Ignore it in Sunday suite runs.
- **06, Cloudflare part** (2026-10-26): done. The bucket and custom domain were made with wrangler. The noindex
  rule and the bucket-only token were made in the dashboard. 8 env lines are on the box, with all switches false and
  no restart. A key test from the box passed. See `vidyagram/reports/vidyagram-certificates-r2-setup-2026-10-26.md`.
- **05m, my-courses** (2026-10-26): backend b6d355a77. Every my-courses card gets the `certificate` field. It is read in
  one batch and taken only from the student's token, so it is null without one. Upstream had already switched
  my-courses to the token in 5dd85b900, and that was kept as is.
- **Upstream merged** 2026-10-26: backend e6f0df401, admin 3d58210. The suites gave `NO NEW FAILURES`. The admin's
  `.next/types` tsc line comes from the local dev server and is not source.
- **DEPLOYED 2026-10-26:**
  - **Indexes.** `code_1` and `userId_1_courseId_1` were built on `vidyagramdb`.
  - **Backend.** The dist commit is 8a5137351, pushed to `origin/vidyagram-admin` as a87e74506..8a5137351.
    - On the box: `git pull`, then `pm2 restart 92 --update-env`.
    - The dist backup is `~/vidyagram-dist-before-certificates-20261026-1445.tgz`, and the env backup is
      `.env.development.bak-flags-*`.
    - The flags are `CERTIFICATES_ENABLED=true` and `CERTIFICATE_CLAIMS_OPEN=true`, as the user decided because the
      app isn't live yet. `CERTIFICATE_PUSH_ENABLED=false`.
    - A print render on the Linux box takes 458 ms, with Hindi correct.
    - Rollback: `git reset --hard a87e74506 && pm2 restart 92 --update-env`, and set the flags back to false.
  - **Admin.** Pushed as 2ba76f9..3d58210, which starts the Vercel production build.
- **shareUrl dropped** (2026-10-26, the user's decision; it duplicated `pdfUrl`): source a7f0e031d, then merged with another session's invoice work (9716d1d5b) as a480017a7, then dist 7f822df58. Pushed and deployed with pm2 92 restarted. The suites gave `NO NEW FAILURES`.
- **progress_percentage on my-courses** (2026-10-26, asked for by the app team): source feba52f54, dist ad06377b2. It was pushed and deployed with pm2 92 restarted. One batched progress aggregation feeds both `progress_percentage` and the certificate statuses. It is token-only and null without a token. Live check: Mobile Video Editing shows 100 and the other cards 0, the request takes about 0.35 s, and no token gives null. The 2 new `dashboardAccounting` failures come from upstream and fail at 57812d2e8 too.
- **Integration heads now:** backend 80cd85177, admin 2d2c4bc.
- **Earlier heads, after 01–05:** backend 50a7d23db, admin 92e6d35. The backend suites give `NO NEW FAILURES`.
  Nothing has been pushed. Only task 06 is left, and it needs the user.

What 04 and 05 leave for task 06:
- **Index before claims.** The (`userId`, `courseId`) unique index is the double-claim guard. Run the index script
  on `vidyagramdb` **before** `CERTIFICATE_CLAIMS_OPEN` goes on.
- **Bucket settings.** With `CERTIFICATE_R2_*` unset, an eligible claim returns 500 ("bucket not configured"). The
  R2 client (`region: 'auto'`, `forcePathStyle`) has never sent a real request, so the smoke claim is its first.
- **Orphaned files.** A losing racer leaves `<code>` and `<code>.png` in the bucket with no record. This is
  accepted.
- **Push stays silent while the feature is off.** With `CERTIFICATES_ENABLED` off, a switch-on saves but sends
  nothing, and `notifiedAt` stays empty. The admin dialog still says a push goes out, which is a pre-launch
  quirk only. The push has no Notification record, so it doesn't appear in the admin notification history.
- **`notificationTokenDelivery.service.ts`** gained an optional `targetRules` (a 4-line change) on the
  plan-broadcast path.

What 03 leaves for later tasks:
- **Certificate lookup (task 04).** It goes at the `const existing = null;` seam in `readCertificateFacts`
  (`certificateStatus.service.ts`), before the early return, so `issued` beats `not_enabled` after a reopen.
  `IssuedCertificate` is `{ code, imageUrl, pdfUrl, shareUrl }`.
- **Wire shape.** `progress` is left out only for `ineligible` / `not_enabled`. `reason` is present only when
  `ineligible`, and the URL fields only when `issued`. The GET returns `{ state: 200, data }`. `suggestedName` is
  not added yet; task 04 adds it.
- **Building blocks for task 05.** `everOwnedWholeCourse` (pure) is in `certificatePolicy.ts`. A build counts only
  if the student's builds, unioned, open every active placement. Deactivated plans count, by way of
  `findPlansGrantingCourse(...).all`. `courseOrdersMatch(courseId, planIds)` is exported from
  `coursePurchasers.service.ts`. Task 05's audience must agree with these.
- **Config.** `getCertificateConfig()` and `resetCertificateConfig()` are in `src/config/certificates.ts`.

What 01 leaves for later tasks:
- **Admin snapshot.** `certificate.courseCompleteBy` is `{ id, name }`, not a bare id.
- **Response shape.** The PUT returns `data: { certificate, firstTime }`. A repeat call is a no-op with
  `firstTime: false`. The on and off writes check the current state, so two racing switch-ons give one `firstTime`.
  `notifiedAt` is never written yet, and **task 05 must set it** in the switch-on update.
- **Which reads carry the block.** Admin reads do: `GET /api/courses`, `/api/admin/courses/filter`, and
  `/courses/:id` with an admin token. Student reads and `/courses/search` don't. Duplicating a course drops it.
- **Deploy order (task 06).** The admin calls the new status route before every picker add and adds nothing if the
  call fails, so the backend must deploy first.
- **Not checked in a browser.** The warning dialog opening over another open dialog (Manage courses, and the
  bulk-upload sheet on the old Assign Classes screen) is untested visually.

What 02 leaves for later tasks:
- **Import order (task 04).** `renderCertificate` lives in `src/services/certificate/certificateRenderer.ts`. When
  it is imported, it sets `FONTCONFIG_FILE` to the bundled `fonts.conf` and `PANGOCAIRO_BACKEND=fontconfig`.
  Fontconfig reads its config once per process, so the module must be imported at boot (through the route chain)
  before any other sharp text render. The bundled config includes `/etc/fonts/fonts.conf`, so other SVG renders
  keep their system fonts.
- **Signatory shape (task 04).** It is `{ name, title } | null`. `formatCompletionDate` prints the IST calendar day.
- **Deploy (task 06).** The fonts, `fonts.conf` and the logo live in `src/assets/certificate/`. `copyAssets.js`
  copies them on a full build, but the surgical dist build may not, so check that `dist/src/assets/certificate/`
  exists on the box.
- **Linux check.** `node scripts/certificate-render-linux.mjs [out-dir]` reruns the container check, which needs
  Docker running.

## Working copies

These are cut when execution starts, as for the exchange tasks:
- Integration worktrees on branch `feat/vg-certificates`, cut from `origin/vidyagram-admin`:
  `~/Projects/worktrees/vg-certificates-backend` and `~/Projects/worktrees/vg-certificates-admin`.
- Per-task worktrees come from `scripts/qt-tasks.sh mkwt vg-certificates <NN>`. Merge back with
  `scripts/qt-tasks.sh merge vg-certificates <NN>`.
- `node_modules` is a symlink to the integration worktree's. Never install, except that task 02 may add the
  `sharp` and `pdfkit` versions already in the lockfile; both are already dependencies.
- Nothing is pushed or deployed from these tasks, and no real database or bucket is written to, except in task 06
  with the user present.
- The admin `config.ts` must never be committed pointing at localhost.
- Commit as raghavsharma@hranker.com. No co-author trailers.

## Test baselines

Before any task starts, write `baseline-backend.txt` and `baseline-admin.txt` in this folder with
`scripts/qt-tasks.sh suites <integration worktree>`. Before reporting, each task runs
`scripts/qt-tasks.sh suites <worktree> vidyagram/plans/tasks/certificates/baseline-<side>.txt`, which must print
`NO NEW FAILURES`.
