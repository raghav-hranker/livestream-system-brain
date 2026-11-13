# AppX saved questions import

Brings a student's saved test questions from AppX (`vidyagram.online/saved-question`) into `savedquestions`, where the
app already reads them. No app or admin change is needed.

Only students with a cached AppX token can be read (about 1,051 of 379,781 paid students on 2026-11-04). A bulk AppX export
would go into the same staging collection and use the same import. Saved quiz questions are left out: none in the sample,
and we have no Quiz model.

## Scripts

Both are in `reference/scripts/`; tests are in `vidyagram-saved-questions.test.cjs`.

- **`vidyagram-saved-questions-capture.cjs`** reads AppX and writes only `apx_vg_saved_question_learners` (one row per
  student) and `apx_vg_saved_question_captures` (one row per student and question, with AppX's full row). No OTPs.
  It stops on HTTP 429 or three refused tokens in a row.
- **`vidyagram-saved-questions-import.cjs`** turns staged rows into `savedquestions`. It only previews unless given
  `--commit --batch <id>`. Each batch is recorded in `apx_vg_saved_question_import_batches`.

## How rows are handled

| Staged row | Result |
|---|---|
| Student and question both found | Insert, tagged `apxSavedQuestionImport.batch` |
| Student already saved the question | Skip, marked `already_saved` |
| Already handled by an earlier batch | Skip, so a question removed here stays removed |
| Question not in our system | Stays staged, reported by test (`unmatched`) |
| Student not found or duplicated, question has no section or topic | Skip, counted |
| AppX stopped listing it (`--refresh` found it gone) | Skip, counted |

The question is matched exactly through `Question.hranker_id = CM-<AppX id>`. AppX gives no saved-at time, so `addedAt`
is the import time; `createdAt` and `_id` step back by listing position to keep AppX's order, since the app's list routes
sort by one or the other. `seriesId` comes through `Series.legacy_id = AppX test id`, and `subjectId` is the question's section.

Run the tests with `VG_BACKEND_ROOT` set to a fresh checkout of `origin/vidyagram-admin` (with `node_modules`): they call
the deployed read routes.

## Running

AppX answers these reads from test-uday and refused them from the prod box, so capture runs there. Run these from your
terminal, since auto mode blocks them. Start small:

```sh
gcloud compute ssh --zone asia-south1-a test-uday --project genial-analogy-477417-r7 --quiet --command 'export PATH=$(ls -d $HOME/.nvm/versions/node/*/bin 2>/dev/null | tail -1):$PATH && VG_APP_ROOT=/home/raghav/vidyagram-nightly-20261019 node - --limit 5' < ~/Projects/system-brain/reference/scripts/vidyagram-saved-questions-capture.cjs
```

Change the node arguments for each later step, and use `vidyagram-saved-questions-import.cjs` for the import steps:

| Step | Script | Arguments |
|---|---|---|
| 1. Try 5 students | capture | `--limit 5` |
| 2. Everyone with a token | capture | none (rerun to pick up new tokens) |
| 3. Preview | import | `--all` |
| 4. Try 3 students, then check them in the app | import | `--sample 3 --commit --batch vg-saved-canary-<date>` |
| 5. Everyone | import | `--all --commit --batch vg-saved-all-<date>` |
| 6. Final pass before launch | capture, then import | `--refresh`, then `--all --commit --batch vg-saved-final-<date>` |

Run commits from webserver2-2 instead of phonetics or test-uday: database connections from phonetics took 3–24 seconds on
2026-11-05. There: `VG_APP_ROOT=/var/www/backend.vidyagramar.com/vidyagram-backend node - --all --commit --batch <id> < script`,
then check with `vidyagram-saved-questions-verify.cjs`.

Before step 5, read in the preview: `nativeRows` (existing saves should use Mongo ids), `uniqueIndexPresent`,
`learnerStates`, and `unmatched`, which names the tests whose questions we lack. Record each commit in the prod data ledger.

## 30-minute capture

A crontab line on the **phonetics** box, user `raghav`, runs `--new-only` every 30 minutes from
`/home/raghav/vidyagram-saved-questions/`, logging to `capture.log` there. It uses `/home/raghav/nodejs-server`'s modules and
the VG env from `/home/raghav/vidyagram-completion-horizontal-20261103/`. Redeploy by copying the script over.

It reads only students never read before, plus earlier failures, and writes only the staging collections. Refused tokens
are not retried until `--refresh`.

## Automatic import

`vidyagram-saved-questions-import-auto.sh` runs from cron on **webserver2-2** (user `hranker`) at :15 and :45, after each
capture, from `/home/hranker/vidyagram-saved-questions/`, logging one JSON line per run to `import-auto.log` there. It calls
the importer with `--auto`, which:

- imports only students whose capture has finished (the learner row says `captured` at or after the row's fetch), so a
  student the capture is still walking waits for the next run;
- names the batch `vg-saved-auto-<UTC minute>` and writes nothing, not even a batch record, when nothing is new;
- refuses more than 5,000 rows at once (log `refused-large`, exit 2), so a `--refresh` or a bulk export is imported by hand.

Installed 2026-11-09; the first run refused a 36,140-row backlog, which was then imported once with `--auto --max-insert 40000`.
To reinstall, from the Mac:

```sh
cd ~/Projects/system-brain/reference/scripts && ssh -i ~/.ssh/hranker-webserver2-2 hranker@148.113.49.18 'mkdir -p -m 700 ~/vidyagram-saved-questions' && scp -i ~/.ssh/hranker-webserver2-2 vidyagram-saved-questions-import.cjs vidyagram-saved-questions-import-auto.sh hranker@148.113.49.18:vidyagram-saved-questions/
ssh -i ~/.ssh/hranker-webserver2-2 hranker@148.113.49.18 '(crontab -l; echo "15,45 * * * * /home/hranker/vidyagram-saved-questions/vidyagram-saved-questions-import-auto.sh") | crontab -'
```

Stop it by removing that crontab line. Remove the line before undoing an auto batch, or the next run imports those rows again.

Phonetics also runs completion workers, so this adds about one AppX call a second to that IP while students are waiting.
Its disk had 408 MB free on 2026-11-04. Stop it by removing the `saved-questions-capture` line from the crontab.

## Undo

```sh
gcloud compute ssh --zone asia-south1-a test-uday --project genial-analogy-477417-r7 --quiet --command 'export PATH=$(ls -d $HOME/.nvm/versions/node/*/bin 2>/dev/null | tail -1):$PATH && VG_APP_ROOT=/home/raghav/vidyagram-nightly-20261019 node - --undo --batch <batch>' < ~/Projects/system-brain/reference/scripts/vidyagram-saved-questions-import.cjs
```

This removes only that batch's rows and clears their staged marks, so they can be imported again.

## Open

- **Questions we lack:** about 30% of the sample came from tests not in our mirrors. Import those tests, or create the
  questions from the staged rows, once the preview names them.
- **Login check:** saved-question routes read and unsave by user id with no login check until `STUDENT_AUTH_GATE` is deployed.
