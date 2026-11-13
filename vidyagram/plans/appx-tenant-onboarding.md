# Onboarding a new AppX tenant

Status: `in-progress`. Tenant = **Vidyagram** (Hranker customer 781, AppX org 2177599, DB `vidyagramdb`, AppX tenant API
`armathsapi.akamai.net.in`). Backend branch `vidyagram-admin` on the fork (worktree `~/Projects/worktrees/vg-backend`,
tip 252c9bcea, pushed), admin branch `vidyagram-admin` (worktree `~/Projects/worktrees/vidyagram-admin-ui`). Phase 0 done
2026-10-13: the session doc is live and the keep-alive checks it every minute (HTTP 200).
Priority 2026-10-13: **catalogue first**. The current AppX login cannot see Purchases/Reports (orders and transactions
return 0 rows), so the commerce mirror waits for a login with those privileges.
Written 2026-10-13 from a read-only survey of `abhi092515/quicktricks-backend` at `origin/quicktricks-admin` 49b7f25bf,
the admin fork, and the 472 notes. Nothing has been run or written.

## What this is

Quicktricks (Hranker customer 472) came off AppX between July and September 2026. This plan reruns that migration for a
second AppX client. It reuses the 472 pipeline. It fixes the session and taxonomy mistakes in code before the first
import, so the new tenant never needs a reconciliation pass.

**Done when** the content audit (`scripts/apx-content-audit/`, extended per Phase 3) reports, for the new tenant:

1. Every enabled AppX item outside a deleted folder is on the platform, with each gap explained in an exceptions file.
2. Zero sections or topics whose names collide after normalising case and whitespace.
3. Zero classes or PDFs filed under a section minted from a raw AppX folder name.
4. Unfiled holding areas contain only items the operator has seen in the review sheet.

## Where the 472 code stands

- The canonical code is `origin/quicktricks-admin`. The local `../quicktricks-backend` checkout is on an old agent branch,
  and `../quicktricks-migrator` is an older side line from a bundle. It is not the newest work.
- The backend is **one tenant per deploy**. `Course` and `Class` carry no customer field. Each client is a branch of the
  fork with its own `src/config/baseConstants.ts` (`CUSTOMER_ID`, `DB_NAME`, `TENANT_KEY`) and its own Mongo DB.
- **vibhagexam** (customer 703, branch `vibhagexam/clientid-upload-prefix`, DB `vibhagexamdb`) already follows this shape.
  It still carries the quicktricks AppX org id `8680775` and the 9 quicktricks `ACTIVE_BATCH_COURSE_IDS`. Copying it as a
  template would copy that bug.
- There is no end-to-end runbook. The pipeline is spread across fork ADRs 0001 to 0018 and the PRDs
  `prd-apx-three-phase-batch-migration.md` and `prd-apx-catalog-migrate.md` in the fork.

### Tenant-specific values a new branch must change

| Value | Where |
|---|---|
| `CUSTOMER_ID`, `TENANT_KEY`, `DB_NAME`, `DOMAIN_URL`, `ADMIN_DASHBOARD_BRANCH` | `src/config/baseConstants.ts` |
| `TENANT_KEY` → customer mapping (Redis key isolation on the shared box) | `src/config/customerRegistry.ts` |
| AppX org id `8680775` | `apxConstants.ts:13` (`APX_USERS_SYNC_ORG_IDS`), plus a literal in 5 scripts |
| AppX tenant API host, site origin, tenant DB name | `apxConstants.ts:53,54,74` |
| `ACTIVE_BATCH_COURSE_IDS` | `services/apx/apxCatchupDriver.ts:33` |
| Teacher name fallback `'Sahil Sir'` | `apxDailyCatchupCron.ts:47`, `services/apx/apxPdfDailyCatchup.ts:49` |
| AI-test topic and section ids | `aiTestExamSectionMap.ts:154`, `topicController.ts:368` |
| Client id `472` | video-transcoder `apx-ingest-container/upload-key.js:18`, `gpu-server/job-manager/client-config.js:133`, `src/index.ts:92,430` |
| Capture path default `/get/allfoldercontent` (now 404s on AppX) | `apxCaptureAll.ts:49-50` |

## The session

Decided 2026-10-13: the existing 472 setup is enough. The operator logs in on the tenant's admin apx-clone page (no
captcha for this client), and the keep-alive cron refreshes the cookie. No new session work before the migration.
Because each tenant has its own DB, the `resolveLiveSession` any-active fallback only sees this tenant's own sessions.

## Start from the reconciled state

Decided 2026-10-13: the new tenant's first import must produce the state the 472 reconciliation reached, not the naive
import that reconciliation repaired. Most of that work lives in `nodejs-server` (branch `quicktricks-prod`, 7 commits
unpushed) and in uncommitted changes in `../nodejs-server-quickstricks`, now snapshotted to the local branch
`backup/nsq-wip-2026-10-13` (working tree untouched). None of the reconciliation tooling is on the fork.

| 472 repair (post-hoc) | Where it lives | Import-time version for the new tenant |
|---|---|---|
| Catalogue reconciliation: per-course Section › Topic › SubTopic, depth-first priority, display placements, free access (29,556 of 32,268 placements) | NS `scripts/apx-course-reconciliation-*` (8623989f … 3a4d4ac5) | Capture the **student-visible tree** (`get/folder_contentsv3`, planner `collectVisibleApxSnapshot` / `deriveApxTaxonomyProposal`). Build writes full placements on first create. Drops a leading generic "Classes" folder, NFC-normalises paths, treats `live_status` 1/2 as awaiting recording. Also removes the deleted-folder and cross-listed gaps |
| Holding-area re-file of PDFs and classes (ADR-0019/0020, leaf creation 119e5281) | NS, partly unpushed | Port `matchChainInTree` into Build's resolver after the policy lookup; keep the refile services as a nightly backstop only |
| Class metadata: `apxTitle`, `free_flag` → `isFree`, `apxScheduledAt`, views, duration (ADR-0015) | NS b5801715 + NSQ uncommitted free_flag diff | Port into `apxPortingService.ts` and `CourseClass.ts` |
| Course description, validity, banners; ordering and createdAt from start dates | bastion scripts; backfill scripts on both lines | Build calls `get_course_by_id` and applies the start-date ordering |
| Test-section drift (9,479 rows soft-deleted) | `fixApxSeriesSectionDrift.ts`, migrator only | `ensureSection` resolves by source key, then same-title section in the same series, then creates; never a global name match |
| YouTube rows in `link` / `live_link` (ADR-0011) | NS `usableClassLink`; fork unpushed 39ded15e7, 03a98ccd2 | Port into the fork's `apxCatchupSelect.ts` |
| Labelling (175 classes by sibling vote, 284 unnamed folders) | bastion scripts | Covered by the visible-tree capture plus `get_content_by_id` names |
| Orphan topics, owner-approved edits | raw mongosh | The canonical tree in the policy file |

**Cut and port.** Cut the tenant branch from `origin/quicktricks-admin` (newer on approved rules, thumbnail re-hosting,
the " (2)" title counter, display-placement schema, commerce and test scripts) after pushing
`feat/apx-catalogue-completeness`. Port the NS pieces above as functions, never as whole files: NS's
`apxPortingService.ts` would revert the counter and thumbnails. ADR numbers 0019/0020 collide between the lines.

**Reusable data.** The policy shape, the generic-folder list, NFC handling, AppX price sentinels (-10 free, -1 stopped
selling, -3 special), and, if the client is in the same SSC/Railway domain, the canonical spellings (Maths › Core Maths,
Reasoning › Verbal Reasoning, GK/GS, Science, Current Affairs). Names only; ids differ.

## Taxonomy rules, encoded rather than remembered

Each rule below is a 472 mistake. The fix goes in code or in the tenant policy file, not in an operator checklist.

1. **Tenant policy as data.** One reviewed file per tenant holds the canonical Section › Topic › SubTopic tree with exact
   spellings, folder rules `(apxCourseId, folderId) → path` with the real AppX `backPath`, test-series section rules
   `(apxTestId, apxSectionId) → section`, an alias list, excluded deleted folders, faculty per course, and category
   defaults. Today the rules are TypeScript (`apxApprovedPlacementPolicy.ts:35-86`) with placeholder source paths, which is
   how the Series rule got mis-targeted.
2. **Never mint a section from a raw folder name.** Build runs the raw resolver before the policy check
   (`apxBuildService.ts:146-171`) and the PDF port uses only the raw mapping (`apxPdfPortService.ts:166`). Policy first;
   unmapped content parks in "New Classes (unfiled)" / "New PDFs (unfiled)".
3. **Normalised, deterministic find-or-create.** Match on a lower-cased, whitespace-collapsed `nameKey`, oldest active
   wins, backed by a unique `{customer_id, nameKey}` index. The AppX resolver is exact-case with an unsorted `findOne`
   today (`apxTaxonomyResolver.ts:86,99`).
4. **Source-key table instead of one `legacy_id`.** Map AppX keys to local ids so a merge never makes an importer re-mint
   the loser.
5. **Scope every taxonomy read and write to the tenant's `customer_id`**, and stop the class pickers serving question-bank
   customers 0 and 1 (`sectionController.ts:123,304,349`).
6. **One tree for classes and tests**, built from the canonical list before either importer runs (the 472 decision).
7. **Create nodes only when content lands in them.** 472 has 167 empty active sections and 1,818 empty topics.
8. **Deleted folders are resolved at capture.** `get_pc4_contents` returns items under deleted folders with
   `enable=1, deleted=0`; only `getFolderPaths` and `get_content_by_id` `backPath` show it. Move the audit's check
   (`scripts/apx-content-audit/audit.cjs`, unpushed commit fdd8cc13f) into capture.
9. **Disabled in AppX means inactive at creation**, for classes as well as courses (`apxPortingService.ts` reads no flag).
10. **Placement ids and name snapshots are written together from the canonical node.** Students see the snapshots.
11. **Course-specific filing lives on `CourseClass`**, never on the shared `Class`.
12. **No teacher fallback.** AppX has no teacher field; faculty comes from the policy file or the run refuses to start.
13. **Indexes before data**, with `partialFilterExpression` instead of `sparse`, built with `commitQuorum: "majority"` and
    checked on the PRIMARY: section/topic `nameKey`, `coursetopics {course, topic}`, `testsectionquestionmaps.seriesId`
    unique, `apx_user.apxId`.
14. **AI-test whitelist built last**, keyed to keeper ids.

## Phases

Each phase ends in a check the next one depends on. Code lands on a branch of the fork cut from `origin/quicktricks-admin`;
the session and taxonomy fixes also benefit 472 and vibhagexam and should merge into the shared line first.

Decided 2026-10-13: data flows first. Steps that only copy AppX into the `apx*` mirror collections start as soon as
the tenant deploy exists. Steps that create platform Courses, Classes, PDFs or Sections wait for the taxonomy code and
the approved policy file.

| # | Phase | Writes to | Ends when |
|---|---|---|---|
| 0 | Tenant identity: customer id, org id, tenant API host, DB, branch, admin branch, transcoder client id | config only | A fresh deploy boots against an empty DB and a human login lands an `apxsessions` row for the new org |
| 1 | Mirror the catalogue (`apxCaptureAll`, with the capture path fixed, plus the student-visible tree) and the raw users / orders / transactions tables | `apx*` mirrors only | Mirror counts match AppX admin counts per course and per table |
| 2 | Taxonomy code (rules 2 to 5, 9 to 13) and the reconciliation ports ("Start from the reconciled state"), in parallel with 1 | code + tests | Resolver tests on mongodb-memory-server: case variants resolve to one node, raw folders never mint, disabled → inactive |
| 3 | Audit dry run over the mirror | report only | Review sheet of every folder → proposed path, deleted folders marked |
| 4 | Policy file | data file | The operator approves the sheet; unmapped folders are either mapped or knowingly parked |
| 5 | Import: Build → Process → ingest → PDFs/notes → ebooks | platform content | Audit predicate items 1 to 4 hold |
| 6 | Commerce: plans → coupons → users → purchases | platform users/orders | Order and user counts reconcile against the mirror |
| 7 | Learner history (OTP token path, ~60 OTPs/hour/IP) | progress, attempts | Separate approval; not started without one |
| 8 | Catch-up until cutover, then stop with locks | all | Stop locks written at cutover |

## Open decisions

0. **Title collisions.** Decided 2026-10-13: counter " (2)", " (3)" (the fork importer's rule). Superseded 2026-10-19: see
   [tasks/appx-tenant-onboarding/07](tasks/appx-tenant-onboarding/07-class-naming-reconcile.md) (topic first, no counter,
   rename after [08](tasks/appx-tenant-onboarding/08-course-import-placements.md) creates the courses).
0b. **Faculty.** Decided 2026-10-13: default teacher name "Vidyagram Team" for every course for now.
0c. **Disabled AppX courses** (46 of 146). Decided 2026-10-13: import them as off-sale (status 0).
0d. **Course category.** Decided 2026-10-13: MainCategory "Vidyagram", Category "All Courses".
0f. **Classes before approval** sit in a holding Section "Vidyagram import (unplaced)"; placement sets the real one.
0g. **Global title collisions** on Class: append the planned topic ("Class 01 · Geometry"), counter only if still duplicate. Superseded 2026-10-19 by task 07.
0e. **Vidyagram folder shape** (decided 2026-10-13 after the first preview): VIDEO/PDF/Videos folders are dropped like
    "Classes"; one-level courses use the course's subject as Section and the folder as Topic; course 66 "testing" comes in
    off-sale; merged name variants take the most-used spelling. Task 03b.
0f. **Wrapper and deep folders** (decided 2026-10-14): teacher folders ("… By X Sir") and batch-name folders are skipped
    (teacher kept as a hint); levels beyond three are joined into the SubTopic name ("Indian Geography – Rivers of
    India"). Task 03c.
0h. **Items AppX refuses every time** (decided 2026-10-14): the course completes with a "couldn't fetch from AppX"
    list instead of failing; someone checks or re-uploads those items later. Task 01e.
1. **Which client.** Is this vibhagexam (703) or a new customer? Needed: Hranker customer id, AppX org id, AppX tenant API
   host (`*.classx.co.in`), student site origin.
2. **Deleted-in-AppX content.** Skip, or import as inactive. Open since 2026-09-28 for 472; recommendation is skip.
3. **Folder-name sections** such as "Classes" or "E-BOOK". Recommendation is never a section; map by the folder below.
4. **Casing convention** for canonical names (for example Title Case).
