# Tasks: Change faculty, duplicate with courses, rename with aliases

State: ready-for-agent (01–02, 04–06, 08–12) · ready-for-human (03, 07, 13)
PRD: [`prd-class-faculty-duplicate-rename.md`](../../prd-class-faculty-duplicate-rename.md). Tasks cite its
sections instead of restating them. Mockups: faculty https://claude.ai/artifact/XBQiVGYJfDWf8LTBgxRrQY,
duplicate/rename/aliases https://claude.ai/artifact/TEEAjaAEeWm8KfgmeBS26i.

Three features, each deployable alone, built in this order: A (faculty), B (duplicate), C (rename).

| # | Task | Type | Blocked by |
|---|------|------|------------|
| 01 | Change faculty from the row ⋯ | AFK | None |
| 02 | Faculty in Bulk edit | AFK | 01 |
| 03 | Deploy faculty | HITL | 01, 02 |
| 04 | Duplicate on the Classes page with pre-ticked courses | AFK (high) | None |
| 05 | Add other courses in the Duplicate dialog | AFK | 04 |
| 06 | Duplicate from the Assign Classes row ⋯ | AFK | 04 |
| 07 | Deploy duplicate | HITL | 04, 05, 06 |
| 08 | Rename in this course only | AFK (high) | None |
| 09 | Rename everywhere | AFK | 08 |
| 09b | Rename a class shown in two places renames only the clicked place | AFK | 09 |
| 10 | Admin search finds every name | AFK | 09 |
| 09c | "Everywhere" also renames apxTitle and place titles that copied the class title | AFK | 10 |
| 11 | "Also known as" chips | AFK | 09 |
| 12 | Live classes by course shows the course's name | wontfix | None |
| 13 | Deploy rename and aliases | HITL | 08–12 |

## Working-copy rules

- **Base.** Every feature branch was cut on 2026-10-12 from `origin/quicktricks-admin`: backend
  `f41b15314`, admin `ccba8bc`.
- **Integration worktrees** (only the orchestrator merges into them), under `~/Projects/worktrees/`:

  | Feature | Prefix | Branch (both forks) | Tasks |
  |---------|--------|---------------------|-------|
  | A | `qt-faculty` | `feat/class-faculty` | 01–03 |
  | B | `qt-dupcourses` | `feat/class-duplicate-courses` | 04–07 |
  | C | `qt-rename` | `feat/class-rename-aliases` | 08–13 |

- **Task worktrees.** `scripts/qt-tasks.sh mkwt <prefix> NN` makes `<prefix>-{backend,admin}-NN` on
  `<branch>-NN`. Merge with `merge <prefix> NN` and remove with `rmwt <prefix> NN`.
- **node_modules** is symlinked. The backend links to `qt-backend-playback-cdn/node_modules`, which has
  `exceljs` and `ffmpeg-static`. The admin links to `~/Projects/quicktricks-admin/node_modules`. Never run
  `npm install`.
- **Tests.** Run `scripts/qt-tasks.sh suites <worktree> /Users/raghav/Projects/system-brain/docs/plans/tasks/class-faculty-duplicate-rename/baseline-<side>.txt` (absolute path: a relative one compares against nothing).
  It must print `NO NEW FAILURES`. How to run, read and write tests is in
  [`reference/quicktricks-testing.md`](../../../../reference/quicktricks-testing.md).
- **Commits.** Use the work email. No co-author trailers. No `dist/` changes in AFK tasks. The deploy tasks
  build the dist surgically (memory `quicktricks-backend-dist-deploy`).
- **Prod.** Transactions need `startPrimarySession()`, because the prod URI is `secondaryPreferred` and
  Mongo refuses a transaction on a non-primary read preference. The integration harness connects the
  same way.

## Progress

- 01 merged into `feat/class-faculty`: backend `5cf7d10c1`, admin `164ece4`. Adds `GET /api/admin/classes/:classId/courses` (course titles of a class), which 04 may reuse.
- 08 merged into `feat/class-rename-aliases`: backend `569192e95`, admin `ebb54a9`. Known gap: rows shown in two places (`apxDisplayPlacements` listings) display the listing's own title in the outline, so a course rename does not show on those rows (09 decides). Legacy PATCH already sent the admin token from both admin hooks.
- 02 merged into `feat/class-faculty`: backend `88014ac41` (dryRun on the faculty route), admin `a6928ab` (FacultyPicker shared by the row dialog and Bulk edit).
- 04 merged into `feat/class-duplicate-courses`: backend `7744e539e`, admin `4ea0880`. Routes `GET /api/admin/classes/:classId/placements`, `POST /api/admin/classes/:classId/duplicate` (multipart + courseIds). Numbering reuses the move's `reshuffleTopicPriorities`; `createClass` split into `prepareNewClass`. Dialog `components/admin/DuplicateClassDialog.tsx` (wraps ClassFormDialog). Duplicate does not call recompute yet (13 adds it if C merges later).
- 06 merged (admin `0e533c2`, backend unchanged): row ⋯ Duplicate… fetches the class via `fetchClass` and reuses DuplicateClassDialog; menu merge with A/C: one separator, then Change faculty…, Rename…, Duplicate…. BannedUsersDashboard "returns to page 1" is flaky (passes solo).
- 05 merged: backend `26f19a6f7`, admin `a52cdca`. Added courses = last + filed where the class is, not Free, class status; refused (400) when the copy has no topic.
- 09 merged: backend `48f531a24`, admin `9ae556d`. `PUT /api/admin/classes/:classId/title {title, clearCourseId?}`; class form title edit goes through renameEverywhere in one transaction. Stored oldTitles keep names a course also shows; `resolveClassNames` returns `removableOldTitles` + `shownNames` for 11. Rows in two places: renameInCourse wrote EVERY place title (09b narrows this to the clicked place).
- **03 DEPLOYED 2026-10-12 ~14:19 IST.** Backend pushed `3cda81cce..4542e1a0e` (merge of origin + feature A + dist `3d21ef9ce`); box `f41b15314..4542e1a0e` ff, dist tarred, pm2 27 restarted (online). The pull also shipped the client's `8ad6d9652` + `3cda81cce` (trending top-3) that the box had not pulled yet. Smoke: `POST /api/admin/classes/faculty` and `GET /api/admin/classes/:id/courses` answer 401 without a token. Admin pushed `e7022bb..95a14f6` (Vercel quicktricks-admin). Rollback: box `git reset --hard 3cda81cce && pm2 restart 27`. Feature B merged suites: NO NEW FAILURES both sides.
- 11 merged: backend `3228135f5`, admin `c19d2d5`. `GET /api/admin/classes/:classId/names`, `DELETE /api/admin/classes/:classId/old-titles {name}` (409 title/shown, 404 unknown). Chips only in edit mode.
- 09b merged: backend `d905d6a71`, admin `5c77044`. Place rename via `listingId` (= apxClassId). **Student-visible change to check before 13:** `courseClassTaxonomy` display stage now shows the course name (`CourseClass.title`) ahead of `apxTitle`/class title for a place with no title of its own; count prod rows where that changes before deploying. Open: place titles equal to the old class title do not follow an Everywhere rename (09c after 10).
- 03 admin LIVE: Vercel quicktricks-admin success on `95a14f6`; the live assign-classes page chunk contains "Change faculty" / "In every course these classes are in". Real-admin change on prod not done yet.
- 10 merged: backend `b11bee24c`, admin `ebfbc68`; npm script `recompute:class-search-names` added by the orchestrator. Script: dry run default, `--commit --backup <file>`, `--restore <file>`. Gaps: AppX sync writes apxTitle without recompute (script repairs); placements whose `class` is a string id are not counted (check count on prod before 13).
- B prepared for deploy (07): merged origin `4542e1a0e`/`95a14f6` (faculty live) into feat/class-duplicate-courses; conflicts in adminClassPickerRoutes.ts and AssignedClassesView.tsx resolved keeping both (menu: Change faculty…, Duplicate…). Dist `cf2bc1250` (8 files, compiled tests 28/28). Admin test order fix `c6c0bbb`. Suites: backend NO NEW FAILURES; admin only that order test (now fixed, file 108/108).
- 09c merged: backend `fa646b9fc`, admin `a21f7bc`. renameEverywhere rewrites apxTitle copies + place-title copies (by key, driver updateMany; inactive placements too) and returns placementsFollowed/placesRenamed. RISK for 13: apxClassStatusSync.ts:234-236 (apxDailyCatchupCron) resets apxTitle to APX's title — confirm the manual-stop locks are still in place before deploying.
- Checked 2026-10-12 (read-only): both APX stop locks still in prod `distributedlocks` (expires 2099) and `APX_DAILY_CATCHUP_DISABLED=1` in the box env, so the apxTitle reset in apxClassStatusSync will not run. Feature C is fully built (08, 09, 09b, 09c, 10, 11); deploy 13 waits for B (duplicate needs the recompute call after B merges into C).
- **07 DEPLOYED 2026-10-12 ~15:28 IST.** Backend `4542e1a0e..cf2bc1250` pushed, box ff + dist tar + pm2 27 restart (online); placements/duplicate routes 401 without token. Admin `95a14f6..c6c0bbb`, Vercel success, live chunk has "Also put it in these courses" on /admin/classes and assign-classes. Rollback: box `git reset --hard 4542e1a0e && pm2 restart 27`. Real duplicate on prod not done yet.
- **13 DEPLOYED 2026-10-12 ~15:55 IST.** Backend `cf2bc1250..b9f106992` (dist rebuild of 29 files, compiled tests 101/101), box ff + dist tar + pm2 27 restart; new routes + legacy PATCH answer 401 without a token; class-tabs 200. Admin `c6c0bbb..b2141c8`. Recompute DRY RUN on box: 8,289 classes, all 8,289 get search names for the first time, 0 old titles pruned; backup `~/class-search-names-dryrun-20261012.json` on the box. `--commit` waits for the user. Rollback: box `git reset --hard cf2bc1250 && pm2 restart 27`.
- 13 admin LIVE: Vercel success on `b2141c8`; live chunks on assign-classes and /admin/classes contain "Only in this course" / "Also known as". Recompute --commit still waiting on the user (optional: imported names mostly overlap title words).
