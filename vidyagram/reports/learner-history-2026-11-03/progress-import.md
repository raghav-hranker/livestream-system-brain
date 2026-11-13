# VG ClassProgress import — 3 November 2026

The user approved a 3-student test, then importing everyone captured if it looked right. Script: `reference/scripts/vidyagram-completion-progress-import.cjs`, 10 isolated tests passing. Run from `migrator`.

## What was written

| Batch | Time (IST) | Rows | Exact ID | Same title and length |
|---|---:|---:|---:|---:|
| `vg-progress-canary-20261103` | 19:28 | 280 | 271 | 9 |
| `vg-progress-all-1-20261103` | 19:29 | 3,999 | 3,730 | 269 |
| `vg-progress-all-2-20261104` | 01:03 (11-04) | 10,602 | 9,878 | 724 |

After the first two batches: 4,353 total `classprogresses`, the same 74 rows without an import tag as before, no duplicate user/class/course keys, and no imported row inside the profile's date window. `fleet500` was still running at 295 OTPs, so captures after 19:29 were not imported then. A rerun with `--all --commit` and a new batch ID picks up later captures and skips existing rows.

### Second pass, 4 November 01:03 IST

The user approved importing everything captured since the first pass. The importer's run filter was widened to include `20261104-*`, because it would otherwise have skipped `fleet2000`; its 10 tests passed afterwards. The pass covered `fleet500` after 19:29, `nohistory50` and `fleet2000`.

Afterwards: 14,955 total `classprogresses`, 14,881 imported rows for 476 learners, the same 74 untagged rows, 0 rejected, 0 inserted beside a session row. A rerun planned 0 inserts. The count of repeated user/class/course keys stayed at 5, unchanged by this pass. 1,398 flags stay out under the same-title rule.

`fleet2000` reached its 600-learner checkpoint at about the same time and stopped with no reads pending, so this pass holds all of its captures: 596 of 600 learners read, 4 failed acquisitions. 1,400 are still queued behind the checkpoint and later captures need another pass. Nothing was checked in the app or through the live API, and the profile date window was not re-run: the markers use the same fixed 2000-01-01 date.

### Automatic import, from 4 November 01:40 IST

The user asked for new students to be imported every 30 minutes. Cron on `migrator` runs `vidyagram-completion-progress-auto.sh`, which uses batches named `vg-progress-auto-<UTC minute>` and writes no batch when nothing is new. The first run, by hand, inserted 4,044 rows (`vg-progress-auto-202611032010`): `fleet2000` had resumed under its own approval after the 01:03 pass. Afterwards: 18,999 total rows, 18,925 imported for 579 learners, the same 74 untagged rows.

`--new-only` reads only captures fetched since the last finished batch, less 10 minutes for clock differences between hosts. A class a student un-marks stays un-marked unless that student is captured again. A pass with `--all` and no `--new-only` still brings un-marked classes back. The run filter now accepts any dated `vg-completion-` run, so a future run ID is imported without a code change. A later `remap` of old captures keeps their `fetchedAt`, so it needs a pass without `--new-only`.

To stop: remove the crontab line. Do that before any undo, or the next run re-adds the batch.

## Row shape

`apxMigrated: true`, `manualCompleted: true`, `duration: 0`, `userStartTime` and `userEndTime` fixed at 2000-01-01, plus `apxCompletionImport: {batch, runId, sourceVideoId, match, importedAt}`. Batch records are in `apx_vg_progress_import_batches`.

- Insert-only. A learner's existing rows are never changed, so undo cannot remove anything the import did not add.
- The old date keeps markers out of every date-windowed reader: the profile chart, streak and tiles, the admin engagement chart, and course analytics.

## Same-title rule

A flag with no exact ID is imported only when its source row is hidden on AppX, the course has exactly one class of that title, and the lengths agree within 5% or 60 seconds. Rows with no catalogue entry, ambiguous titles or differing lengths stay out (395 flags at the time of this batch). Filter these rows with `apxCompletionImport.match: 'same_title_and_length'`.

## 3-student check

Progress used `buildCourseProgressPipeline` from `dist` on `origin/vidyagram-admin` at `3df45658b`, run read-only against production. Before: all at 0%, no rows.

| Student | Course | Progress after | Watched / classes | Imported rows |
|---|---|---:|---:|---:|
| A | `…37e3c` | 1.49% | 5 / 336 | 5 |
| B | `…33fb8` | 6.59% | 62 / 941 | 62 |
| C | `…37569` | 17.83% | 151 / 847 | 151 |
| C | `…37e3c` | 17.26% | 58 / 336 | 58 |
| C | `…38735` | 2.61% | 4 / 153 | 4 |

Every imported row counted as Watched. Profile active days stayed 0 and rows inside the window stayed 0 for all three. A rerun planned 0 inserts.

## Not verified

- Nothing was checked in the app or through the live API. A read-only check on the production web server was refused by the session's permission rules, so the deployed build was not compared with the branch.
- The profile's numbers were checked by running its date filter directly, not by calling the service.

## Known effects

- Videos start from the beginning and watch time stays 0: `videoPosition` ignores `apxMigrated` rows and the source has no resume position.
- The profile's "classes watched" tile and streak do not count imported classes.
- Admin progress reports that do not filter by date (`userController` session and class-watched totals) now include these rows, and `lastWatchedAt` shows the import time.
- A student who un-marks a class deletes the marker. A later import pass would add it back, so run the final pass before launch.
- Certificates: progress can now reach the 100% a claim needs, and the course-complete push audience uses the same rule. Neither happens until an admin marks a course complete. Nothing is issued automatically.
- If `apxClassProgressFromCourseTestDetailMigration` ever runs, its upsert shares the same key and would overwrite `userStartTime`, `userEndTime` and `duration` on markers, keeping the manual flag. Decide this before running it.

## Undo

On `migrator`, with the script on stdin, for each batch:

```sh
VG_APP_ROOT=$dir/runtime VG_ENV_PATH=$dir/.env.development $dir/runtime/node/bin/node - --undo --batch <batch> < vidyagram-completion-progress-import.cjs
```
