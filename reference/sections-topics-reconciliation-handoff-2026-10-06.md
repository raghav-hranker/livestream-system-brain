# Handoff: sections and topics reconciliation (2026-10-06)

Status: research and dry run done. **Nothing has been written to prod.** No code is changed, and nothing is committed or pushed. Every file below is untracked in system-brain.

## Intent

The admin section list (`sections` collection, LMS quicktricks-backend) is full of duplicate and empty entries. Topics under sections have the same problem. The goal is one entry per name, no empty entries, and no change to students' past tests or history. The user wants to keep digging before committing to any step, and wants everything shown to their team first.

## Read these first

| File | What it is |
|---|---|
| `docs/plans/prd-sections-topics-reconciliation.md` | The plan: rules, phases, decisions, dry-run results, the 25 merge groups (Appendix A), alternatives, risks |
| `reference/sections-topics-dry-run-2026-10-06.xlsx` | Team sheet. Every one of the 20,997 changes the cleanup would make, in 13 tabs. Start at "Read me" |
| `reference/sections-reconciliation-audit-2026-10-05.md` | First audit. Which screens show sections, who creates them, what references them, with file:line |
| `reference/section_kinds.csv` / `.json` | All 703 sections tagged class / test / both / empty |
| `reference/topic_audit.csv` / `.json` | All 4,205 topics, with usage counts and predicted clashes |
| `reference/reconcile_dry_run.json` / `_changes.csv` | Raw dry-run output behind the sheet |

The scripts are in `reference/scripts/`. All of them are read-only:

- `taxonomy_dupes.cjs` finds duplicate names with usage counts.
- `section_kinds.cjs` tags every section class / test / both / empty.
- `topic_audit.cjs` audits topics and predicts clashes.
- `reconcile_dry_run.cjs` runs the full plan as a dry run.

The sheet builder is `build_reconcile_sheet.py`. Run it with `python3 -m venv /tmp/v && /tmp/v/bin/pip install openpyxl`, because openpyxl isn't installed system-wide.

## Decisions made by the user

1. **Merge by name, all of it.** One section per name holds both classes and test questions. Splitting into a "class" list and a "test" list was rejected, because it removes no duplicates.
2. **No more imports are coming.** So there's no need to fix the importers first. The APX catch-up is still only paused by its stop locks; see the apx-catchup-stopped memory.
3. **Spellings approved.** ADVANCE becomes Advance, ARITHMETIC becomes Arithmetic, and E-BOOK becomes E-Book. Every other kept name keeps its spelling.
4. **Leave old tests and student history on the old ids.** That covers Series, AssignQues, TestSectionQuestionMap, SeriesQuestionMap, AiTestPattern, Scores, UserTestData, UserQuestionAnswer, SavedQuestion, ReportQuestion and usertopicquestionlogs.

## Decisions still open

- **A.** Keep the copy with the most content in each group. See the sheet's Sections tab, or plan Appendix A.
- **B.** Switch off the 1,818 empty topics, yes or no.
- **C.** Make none of the 1,177 optional spelling changes. That's the default.

## Facts established, with evidence

- **Duplicates are an admin problem, not a student one.** No course uses two copies of the same section. The dry run measured this two ways and both gave 0. The dropdown goes 684 → 480 after the cleanup.
- **No test paper holds two copies of one name** (dry run: 0).
- **The section dropdown shows customers {472, 1, 0}** and status 1, with no dedupe (`sectionController.ts:349-362`). That's why question-bank sections, from the 08-21 import (customers 0/1) and the 09-23 import (472), sit next to class sections.
- **AI tests choose questions by a hardcoded topic-id list,** `AI_TEST_SUBJECT_TOPIC_IDS` in `src/config/aiTestExamSectionMap.ts`, about 40 ids. They never choose by section (`aiTest.controller.ts:168-214`). The script hard-stops if a listed topic would merge away. It didn't.
- **Students see stored names on placements,** not the live names: `CourseClass.sectionName/topicName`, `apxDisplayPlacements[].sectionName/topicName` and `CoursePdf.sectionName/topicName` (`courseClassTaxonomy.ts:96`, `coursePdfNames.ts:31-40`). The rename is limited to the three approved spellings: 1,314 placements and 70 course PDFs.
- **Unique indexes ignore `status`.** They are `{section, topicName}` on topics (`Topic.ts:99`) and `{topic, subTopicName}` on subtopics (`SubTopic.ts:94`). So when topics clash, the copy already in the kept section is the one kept.
- **One course-topic row per course and topic** (`course_1_topic_1_unique`). Dry run: 4 rows are repointed and none conflict.
- **Name lookups that ignore status** are `/sections/search` (series bulk upload keeps the last match), topic CSV import, phpSync and the APX resolver. Phase 1 fixes the first two.
- **The website's solution screen pairs old answers with the paper by position** (thedhronas `pages/user/solution-details/[testId]/index.tsx:644-646`). That's why test papers are left alone.
- **The one warning.** The "Percentage" topic `6a885c143aed5ba9f3a21772` under the Arithmetic copy `…fe4` has 2 student practice records and merges away. The records stay on it.

## How to run things (gotchas)

- **Prod reads are blocked for the agent by auto mode.** The user runs each box command with `!`. Pattern:
  - `scp -i ~/.ssh/hranker-webserver2-2 <script> hranker@148.113.49.18:/home/hranker/`
  - then `ssh ... "export PATH=/home/hranker/.nvm/versions/node/v22.22.2/bin:\$PATH; cd /var/www/backend.quicktricksbysahilsir.com/quicktricks-backend && NODE_PATH=$D/node_modules DOTENV_CONFIG_PATH=.env.development OUT=/home/hranker/<name> node /home/hranker/<script>"`
  - then `scp` each output file back by name. Remote `{a,b}` braces don't expand.
- **Local checkouts are stale.** Read the deployed code instead. For the backend, run `git fetch git@raghav-hranker:abhi092515/quicktricks-backend.git quicktricks-admin` and read `FETCH_HEAD`; it was `29dc69253` on 10-06. For the admin, read `origin/quicktricks-admin`; it was `9fa335c`/`4c8d85f`.
- **zsh quirk.** zsh treats `$R:src` as a history modifier, so always write `"${R}:src/..."`.
- **The dry run is a snapshot.** Rerun `reconcile_dry_run.cjs` before any write, because admins keep filing content.

## Next steps

1. Get A, B and C from the user.
2. Phase 1 code fixes in the backend and admin forks. These need deploys, which means asking first.
3. Then Phase 2 (switch off empties) through Phase 7, per the plan. Every write needs a dry-run rerun, a backup file, a restore script, and the user's explicit go.
4. The commit and restore modes of the merge script are **not written yet**. Commit mode should apply exactly the rows in `_changes.csv` after re-checking each `from` value.

## Leads for digging further (not yet investigated)

- **712 topic names repeat across different sections.** These are out of scope. Most are probably per-course folder trees, but that's unchecked.
- **Which importer minted the 09-23 batch.** It's 9 question-only sections with "X (imported)" topics, and the source wasn't found. The repair scripts `repairSeries758WrongQuestions.ts` and `repairApxSeriesCustomer0Questions.ts` match its behaviour, with no name check.
- **The 495 custom names.** Admins typed course folder names that differ from the section name, such as "Pdf (ALL Ebook Pdfs)" under "Classes". Is that intended?
- **The "Classes" and "E-BOOK" sections are folder names, not subjects.** Should they exist at all?
- **Subtopics haven't been audited on their own** beyond the clashes the merges cause.
- **The mobile app's caching is unknown,** because its source isn't in this workspace.
- **The 1,818 empty topics.** Spot-check a sample before decision B.
- **The section dropdown includes customer 0/1 sections on purpose.** Should question-bank sections ever show on class forms?
