---
tenant: vidyagram
---
# Admin history: what it cannot see

Vidyagram (781) only. Read this before you trust a lookup (`reference/scripts/vidyagram-audit-lookup.js`): "no row"
does not prove "nothing happened". Source: task 14 of the admin audit trail
(`vidyagram/plans/tasks/admin-audit-trail/14-bypass-writes-bulk-and-gaps.md`), audited on the backend at 56e4580bd
plus task 14 (branch `feat/vg-admin-audit-14`). Not deployed until task 18 (deploy wave 3).

## What is covered

- **Every Mongoose write to a policy collection** (`services/audit/policy.ts` `CHANGE_POLICY`) by a recorded actor:
  query updates, replaces and deletes, `save()`, `insertMany`, and `Model.bulkWrite` (and `bulkSave`, which calls it).
  Mongoose 8 fires `bulkWrite` middleware, but its post hook can't be tied to its pre hook, so the plugin wraps the
  call (`plugin.ts` `auditedBulkWrite`). A bulkWrite call gives at most three bulk rows: updates, deletes, inserts
  (upserts included).
- **Driver writes wrapped by hand** (`services/audit/bypassWrite.ts` `recordedWrite`, same policy, same row shapes):
  - placement taxonomy PATCH, Move to…, assign (restored placements), duplicate into a course (shifted placements),
    rename everywhere (place titles): `courseclasses`
  - admin Exchange and the exchange undo (`rewriteOrderGrant`): `orders`. A student exchanging their own order writes
    their own record, so it gets no row.
  - plan-order sync (`applyPlanProductsToOrders`): `orders`
  - APX course ordering and createdAt backfills (`services/apx/*Backfill.ts`): `courses`
- **Bulk sale** writes plans, courses and coupons through Mongoose, so the hook records it, whether run by the cron
  or by an admin's save (`processNow`).

Recorded actors: admin, no-login, job and script always; a student only for deletes, or for a write to a record that
isn't theirs. A delete is recorded even with no actor at all (as `unknown`).

## Gaps

### 1. The AppX nightly sync

`vidyagramNightlySync.ts` runs as a systemd timer on test-uday from a checkout that is not on `origin/vidyagram-admin`.
None of its writes (new classes, course placements, PDFs, renames) are recorded. It stays a gap until its code lands
on the branch and task 12's runner wraps it as `job:vidyagram-nightly`.

### 2. Jobs: counts, not copies

Crons run through task 12's `runJob` (`services/audit/jobRunner.ts`). A job's writes give one `job-summary` row with
counts per `collection:op`, no copies; only its deletes keep a change row with copies. So a job's summary says how many
records changed, never which ones.

Driver writes inside crons are invisible to the hook; each counts itself with `countChange` / `countWriteResult`
(jobRunner.ts). Run by hand as a script, the same code records nothing (the script label covers Mongoose writes only):

| Cron | File | Writes |
|---|---|---|
| apxMigrationCron | `scripts/apxOrdersNewFreeCourseMigration.ts` | `orders` bulkWrite |
| apxMigrationCron, apxOrdersToOrdersSyncCron | `scripts/apxOrdersNewReconcileMigration.ts` | `plans` updateOne and insertOne, `orders` bulkWrite |
| apxOrdersNewToOrdersCron | `scripts/apxOrdersNewToOrdersMigration.ts` | `orders` insertMany (duplicates excluded), two updateMany |
| apxDailyCatchupCron | `scripts/backfillApxVideoAssets.ts` | `classes` bulkWrite |
| planOrderSyncCron | `services/planOrderSync.service.ts` | `orders` updateMany (through `recordedWrite`: counted in the job, copies from a script) |

A bare `runAs('job:…')` with no runner keeps copies (there is no summary to count into).

### 3. Driver writes in one-off scripts

`src/scripts/*` writes through the driver in about 40 places on policy collections. Task 12's `script:<name>` label
covers only their Mongoose writes. A run of any of these leaves no rows; take the backup they offer before a prod run:

- users: `applyCleanIndianMobileUpdates`, `apxUsersDateBackfill`, `apxUsersDeviceBackfill`,
  `archiveDuplicateNoOrderCapturedUsers`, `archiveJunkMalformedInactiveUsers` (deleteMany), `backfillMissingUsersApxIdFromApxUser`,
  `backfillUsersApxIdEmailFromApxUserRaw`, `backfillUsersApxIdEmailFromMap`, `fixMalformedMobileFromApxUser`,
  `mergeBlockedMobileDuplicateUsers`, `mergeDuplicateUsers`, `mergeMobilePrefixDuplicates`, `signupDeviceBackfill`,
  `vidyagramMergeDuplicateMobileUsers`, `apxMergeConflictDuplicateUsers`
- orders: `apxCourseAttachmentsCloneOrdersCreatedAtFix`, `apxOrdersNewQuicktricksStudentCreditsMigration`,
  `apxPurchasesBackfillMissed`, `apxPurchasesMigration`, `apxRematchUnmatchedPurchases`, `apxSkippedPurchasesRetry`,
  `backfillOrdersFromApxTransactions`, `fixCapturedButNotSuccessOrders`, `fixOrderCourseIdItemIdMismatch`,
  `fixOrderItemTypeMismatch`, `fixOrderUserIdApxPhoneMismatch`, `orderDateStringToDateBackfill`, plus the four cron
  scripts above when run by hand
- plans and coupons: `apxCouponsMigration`, `apxPlansMigration`, `apxOrdersNewPlansMigration`, `restoreBulkSaleSnapshot`
  (and the purchase scripts above, which create plans)
- catalogue: `apxCreateMissingCatalogCourses` (courses), `backfillCourseFaculties` (courses), `backfillClassHomeFiling`
  and `recomputeClassSearchNames` (classes)

### 4. Collections outside the policy

Writes to any collection not in `CHANGE_POLICY` are never recorded. Notable ones: `bulksales` and
`bulksaleplansnapshots` (a sale's own bookkeeping, including `migrateLegacyBulkSales`' driver writes),
`planordersyncjobs`, `coursetests`, `ebooks`, `packages`, `series`, `questions`, `assignques`, `feedbacktags`, the
`apx_*` raw collections, and the dashboard's own `dashboard_*` fact and snapshot collections.

### 5. Reads

Only the routes in `SENSITIVE_READS` (policy.ts) get a read row: user list, search and profile, the four exports,
order lists and reads, purchased-users, the admin feedback lists, the passwordless-login path. Every other read is
unrecorded, including the dashboard (`dashboardDailyFacts`, `dashboardSignupReporting`), which only reads
policy collections and writes its own fact collections.

### 6. Partly recorded writes

- **Past the first 200 records.** A bulk row counts every record the write matched but copies only the first 200 by
  `_id`. `--collection --id` finds a record only if it is in a sample.
- **bulkWrite update rows.** The filter is the operations' filters joined with `$or`. The count is the call's total
  from the driver, which includes any operation the policy skipped (a quiet-field update in the same call).
- **Upserts by an `updateMany` query** (not bulkWrite) create records that get no copy.
- **A write that throws** records nothing, even if part of it landed (an unordered bulkWrite or insertMany with a
  duplicate key).
- **`insertMany` with `rawResult`** records nothing (no such call writes a policy collection today).
- **A write in a transaction that aborts** leaves no row, on purpose.

### 7. Outside the backend's code

- direct database edits: mongosh, Compass, any script in system-brain `reference/scripts/` that writes
- other processes that write vidyagramdb: the test-result services (`usertestapp.ts`, `dlqConsumerRunner.ts`: no history import on 2026-10-30), and
  anything outside this repo
- `AUDIT_TRAIL=off` turns every row off

## Re-checking the list

On the backend checkout, every driver write outside tests and scripts (16 hits on 2026-10-30), then the database
handles (12, all reads or non-policy collections), then the scripts the crons run:

```sh
cd src
grep -rnE "\.collection(\(['\"][a-z_]+['\"]\))?\.(insertOne|insertMany|updateOne|updateMany|deleteOne|deleteMany|replaceOne|findOneAnd\w+|bulkWrite)\(" --include=*.ts . | grep -vE "^(\./)?(tests|scripts)/"
grep -rnE "connection\.db|connection\.collection\(|\\\$merge\b|\\\$out\b" --include=*.ts . | grep -vE "^(\./)?(tests|scripts)/"
grep -rn "from '../scripts" cron/
```

Drop `scripts` from the filter to see the one-off scripts too (over 1,100 hits, mostly `apx_*` raw collections). A hit
that writes a `CHANGE_POLICY` collection should be wrapped in `recordedWrite`, count itself with `countChange`
(job-run), or be listed above. Model `bulkWrite` and `insertMany` need nothing: the hook sees them.
