# Geometry video repair preview

Before: two already-created current Classes have neither jobs nor ledger nor placements. Old completed jobs reserve course160 source rows193547/193550; their Classes and media must remain unchanged.

After queue: create exactly two pending per-Class jobs using current course161 source rows193541/193549, with source asset equality checked against the current mirrored row. Create two import ledger units, each recording both course placements. Keep both unique indexes and all prior jobs unchanged. The running tenant781 worker may claim these jobs automatically; no worker restart or broad nightly run is needed.

After media completion: insert exactly four CourseClass rows. Course160 rows193547/193550 and course161 rows193541/193549 point to current Classes6adc01b520e78c9f77dbc7b6 /6adc01b820e78c9f77dbc7bd. Both courses use Maths > GEOMETRY, priorities246/247, titles Geometry03/Geometry04 (with original spaces), active/paid. CourseClass.title remains unset. Dates follow newPlacementFields, the existing admin assignment contract. No older Geometry placement is disabled or retitled.

Guards: exactly two known Classes; live source asset keys equal expected; existing canonical taxonomy must exist; no existing current placement, job or ledger before queue; completed jobs and hlsAsset required before placement; transaction prevents partial placement insertion.

Protected backup-before.ejson stores original full two Class docs and old reserved jobs, with original absence of new ledger/placements. preview.ejson enumerates every proposed placement; scoped-plans.ejson captures the four planned occurrences. These files use mode600. Source URLs are not printed.

## Rollback

Do not rollback while either new job is pending/claimed/downloading/uploading/failed, because its active worker could write afterward. Wait for terminal status or coordinate a tenant781-specific cancellation before proceeding. Rollback must compare current repaired documents with the saved post-repair checkpoint and refuse if subsequently edited.

1. In a transaction delete only the four exact IDs recorded in placement-result.ejson, after comparing to placement-inserts.ejson. If placement stage was not reached, delete none.
2. Delete only import-ledger docs with customerId781, the two exact asset keys, and runId repair-video-2026-10-26, after verifying their Class IDs.
3. Delete only the two newly created per-Class jobs, identified by the exact two Class IDs and saved post-repair job IDs. Leave old source160 jobs intact.
4. Restore the original two Class documents from BSON backup only if current documents equal the saved post-repair checkpoint. No other Class or Course is touched.
5. Keep newly copied media objects as unreferenced recoverable data. Do not delete storage objects during rollback.
6. For source rollback, restore only deployed apxCatalogClassCommit.ts from the timestamped remote backup, with SHA256 guard; restore the prior REVISION marker. Never restart or change Quicktricks.

## Regression evidence

The replacement-row test failed before the fix with the exact legacy-source-pair E11000. After the importer chooses an unreserved current representative,45 importer/queue tests pass and tsc --noEmit passes. A regression also proves all-reserved sources are refused before creating a Class; it does not claim every possible replacement has another free source.

Dead jobs classified:131 missing playable URL and52 source404. None is blindly reset or retried in this repair.
