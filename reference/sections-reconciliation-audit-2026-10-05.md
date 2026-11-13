# Sections reconciliation audit (prod, 2026-10-05, read-only)

The data comes from `reference/scripts/taxonomy_dupes.cjs`, run on the prod box on 2026-10-05. The raw JSON is on the box at `~/taxonomy_dupes_2026-10-05.json`. The code was read on `origin/quicktricks-admin` in both forks: backend `0e7516ef5` and admin `a20d6ec`/`9fa335c`. This audit supersedes the section half of `taxonomy-dupes-2026-09-22.md`. No writes were made.

## The numbers

- **Totals.** 703 sections exist and 684 are active. The 09-22 count was 691.
- **Duplicates.** 33 names (case- and whitespace-folded) are shared by 85 sections.
- **What users see.** The admin section picker shows 80 of those sections, under 32 names. For 24 of the names, two or more options read exactly the same, byte for byte.
- **Still growing.** 9 new duplicates were minted on 2026-09-23 between 18:59 and 20:22Z, all holding questions only. They are General Awareness ×2, Reasoning, Science and five "… Sectional Test" sections, each with an "X (imported)" topic. This audit does not identify the importer. The two repair scripts below match its signature.
- **No orphans.** No topic points at a missing section, and no subtopic points at a missing topic.

## Root cause

One `sections` collection serves two unrelated trees.

- **Class catalog.** Holds classes, course placements, PDFs and shorts. Its sections were mostly APX course folders, created 06-25, 07-01, 08-27 and 08-28 with customer 472.
- **Question bank and test series.** Holds questions, series and seriesquestionmaps. It came from the 08-21 batch (customer 0 and 1) and the 09-23 batch (customer 472).

`GET /sections/dropdown` returns both trees: `customer_id ∈ {472, 1, 0}`, `status: 1`, no dedupe (`sectionController.ts:349-362`). Every picker labels a row by `sectionName` alone (`components/async-select.tsx:103`). Duplicate kinds by section: 25 catalog, 33 question bank, 11 holding both, 7 empty shells (only an empty topic) and 9 empty.

Creators disagree on what "the same section" means:

| Creator | Lookup before creating |
|---|---|
| Admin create/update (`sectionController.ts:61`, :224) | Case-insensitive name, all customers, inactive docs included |
| APX resolver `findOrCreateSection` (`services/apx/apxTaxonomyResolver.ts:85`) | Exact case-sensitive name; `findOne` with no sort picks an arbitrary duplicate |
| `remigrateAffectedSeriesLight.ts:264`, `apxPackagesMigration.ts:829` | `legacy_id`, then exact name |
| `repairSeries758WrongQuestions.ts:219`, `repairApxSeriesCustomer0Questions.ts:205` | `{legacy_id, customer_id: 472}` only, no name check |
| `phpSyncController.ts:188` | `legacy_id`+customer, then exact `{sectionName, customer_id}` |

`{sectionName, customer_id}` is not unique (`models/Section.ts:81`).

## What users hit

1. **Identical options in every section picker.** ClassForm, PdfForm, TopicForm, QuestionForm, SeriesForm, ShortsForm, ApxBulkMigrate, series assign/view-questions, QuestionsDashboard, BulkUploadPdfsSheet and the Courses – New `PlacePicker` all show them. Maths appears 4 times, Arithmetic 5 and General Awareness 5. This is how Class 123/124 got filed under the question-bank "Logical Reasoning" on 2026-09-22.
2. **Topics disappear.** The topic list scopes to the exact section id (`topicController.ts:337`). Pick the wrong "Maths" and that Maths's 151 topics are not offered.
3. **Students see duplicate tabs.** The website's class section tabs are keyed by section id (thedhronas `utils/utility.ts:2098`, from `/topic-and-section` grouping at `courseController.ts:2625`). Two same-named sections in one course render as two tabs. PDF chips merge by exact name string instead (`utility.ts:2976`), so case variants like "Static GK / CA" and "Static Gk / CA" still split.
4. **Some sections can't be reached.**
   - **200-row cap.** `ClassesDashboard` bulk change-section (`:498`) and `BulkUploadVideosSheet` (`:64`, :549, :647) fetch one page of 200 into a plain Select, out of 684 active sections. The 2026-09-17 note about `useTaxonomyData` is stale. On origin no consumer reads its `sections`, and ApxBulkMigrate uses AsyncSelect for section.
   - **Edit page.** `app/admin/sections/edit/[id]` finds the section inside `useSections()`, which returns only the 10 newest. Older duplicates cannot be renamed apart from the admin.
5. **Imports pick at random.** APX ports and series bulk upload (`series/bulk-upload/[id]/page.tsx:469`, last match wins) file content under whichever duplicate the query returns. That keeps the duplicates in use.

## What a merge has to repoint

- **ObjectId references.** `Class.section`, `CourseClass.section` and `apxDisplayPlacements[].section`, `Pdf.section`, `Question.sectionId`, `Series.sectionId` with `section_details[]` and `section_cutoff_details[]`, `SeriesQuestionMap.section_id`, `Topic.section`, `Short.section`, `AiTestPattern.sections[]`, `ApxSeriesSectionMap.localSectionId`, `LearnLibraryTag.sourceSectionId`, and `TestSeriesViewSection.cbt1/cbt2` (which also stores a name copy).
- **String ids.** `SavedQuestion.sectionId`, `ReportQuestion.sectionId`, `AssignQues.section_id` and `PdfUploadSession.section`. Probably also inside `TestSectionQuestionMap.test`, `UserTestData.allSections` and `Scores.sectional_data` (inferred, not opened).
- **Hardcoded ids.** `topicController.ts:368` (`AI_SECTION_ID`), `config/aiTestExamSectionMap.ts` and `scripts/seedTopicsFromCsv.ts:22`.
- **Name snapshots.** `CourseClass.sectionName`, and `CoursePdf.sectionName` / `overrideSectionName`.
- **`legacy_id` trap.** A section holds one `legacy_id`. After a merge, the legacy-id-first creators re-mint the loser on their next run unless they get an alias map (inferred).
- **Index risk (inferred, not checked on prod).** The unique sparse `{legacy_id, customer_id}` index still indexes docs that lack `legacy_id` (see the compound-sparse-index-trap memory). If that holds, a second admin-created section for customer 472 would fail with E11000.

## Recommended order

1. **Stop new duplicates.** Make the APX resolver case-insensitive and deterministic (oldest active wins). Give the two repair scripts a name check. Then find the 09-23 importer.
2. **Hide the dead weight, reversibly.** Set the 9 empty and 7 empty-shell sections to `status: 0`. Nothing references them, so this changes no student view.
3. **Separate the trees before merging.** Add a scope to Section (catalog or question bank) from the reference counts above. Class, PDF and shorts pickers then ask for catalog sections, and question and series pickers ask for question-bank ones. This removes most visible duplicates with no repointing.
4. **Merge only true same-tree duplicates.** Do it per group, dry-run first, using the repoint list above. There are 12 catalog names with more than one catalog-bearing section: Advance, Arithmetic ×3, Classes, Current Affairs, E-Book, General Awareness, History, Introduction, Logical Reasoning, Maths, Reasoning and Static GK / CA. Several are per-course APX folders, such as "ADVANCE" (legacy 3208) and "Advance" (legacy 3212), which may be deliberate per-course trees. Decide each one against the courses it serves.
5. **UI.** Fix the section edit page and the two 200-cap plain Selects. Show a disambiguating hint (tree, or usage count) until step 4 is done.

## Per-section table

`kind` comes from reference counts:
- `catalog` means class, courseclass, PDF or short.
- `qbank` means question, series, seriesqmap or apxmap.
- `mixed` means both.
- `shell` means an empty topic only.

"proposed" is a heuristic that marks the largest node in each tree as survivor. It is not a decision. `courses` is the number of distinct courses with a CourseClass placement in that section.

| name | id | as stored | status | cust | created | kind | references | proposed |
|---|---|---|---|---|---|---|---|---|
| advance | `6a9023049a9d53af06e3bf8e` | ADVANCE | 1 | 472 | 2026-08-27 | mixed | class 1, courseclass 628, pdf 1, question 1, courses 3, childTopics 15 | catalog survivor |
| advance | `6a9047fb0bcee98f4c7f6696` | Advance | 1 | 472 | 2026-08-27 | catalog | class 1, courseclass 441, courses 2, childTopics 8 | merge candidate, check courses |
| arithmetic | `6a9023049a9d53af06e3bf8f` | ARITHMETIC | 1 | 472 | 2026-08-27 | catalog | class 4, courseclass 686, courses 4, childTopics 25 | merge candidate, check courses |
| arithmetic | `6a9047fb0bcee98f4c7f6697` | Arithmetic | 1 | 472 | 2026-08-27 | catalog | class 1, courseclass 491, courses 3, childTopics 14 | merge candidate, check courses |
| arithmetic | `6a9d0afa3aed5ba9f3f0395d` | Arithmetic | 1 | 0 | 2026-09-06 | qbank | question 367, childTopics 2 | merge into question-bank survivor |
| arithmetic | `6a885af03aed5ba9f3a20fe4` | Arithmetic | 1 | 0 | 2026-08-21 | qbank | question 146, series 28, seriesqmap 28, childTopics 2 | question-bank survivor |
| arithmetic | `6a885af03aed5ba9f3a20f98` | Arithmetic | 1 | 1 | 2026-08-21 | mixed | class 1, pdf 1, question 166, series 1, seriesqmap 1 | catalog survivor |
| biology | `6a885af03aed5ba9f3a20f27` | Biology | 1 | 0 | 2026-08-21 | qbank | question 78, series 1, seriesqmap 2, childTopics 38 | keep (question-bank tree) |
| biology | `6a914daa709253fd90707de4` | Biology | 1 | 472 | 2026-08-28 | catalog | courseclass 18, courses 1, childTopics 1 | keep (catalog tree) |
| bs & e sectional test | `6a3d2ac13aed5ba9f3fe6c06` | BS & E Sectional Test | 1 | 472 | 2026-06-25 | qbank | question 585, series 34, childTopics 1 | question-bank survivor |
| bs & e sectional test | `6ab434565b97b9154439e2d1` | BS & E Sectional Test | 1 | 472 | 2026-09-23 | qbank | question 135, childTopics 1 | merge into question-bank survivor |
| chemistry | `6a885af03aed5ba9f3a20f28` | Chemistry | 1 | 0 | 2026-08-21 | qbank | question 53, seriesqmap 1, childTopics 3 | keep (question-bank tree) |
| chemistry | `6a455d36ebb42f585d9cd357` | Chemistry | 1 | 472 | 2026-07-01 | catalog | courseclass 52, courses 2, childTopics 7 | keep (catalog tree) |
| classes | `6a4558d6ebb42f585d9a91ab` | Classes | 1 | 472 | 2026-07-01 | catalog | class 1951, courseclass 2, pdf 2958, courses 2, childTopics 344 | catalog survivor |
| classes | `6a455e7cebb42f585d9d5553` | CLASSES | 1 | 472 | 2026-07-01 | catalog | class 37, pdf 29, childTopics 29 | merge candidate, check courses |
| computer | `6a45591cebb42f585d9ac3d3` | Computer | 1 | 472 | 2026-07-01 | catalog | class 97, courseclass 250, pdf 78, courses 4, childTopics 11 | keep (catalog tree) |
| computer | `6a885af03aed5ba9f3a20f17` | Computer | 1 | 0 | 2026-08-21 | qbank | question 1, childTopics 1 | keep (question-bank tree) |
| computer | `6a885af03aed5ba9f3a20f84` | Computer | 1 | 0 | 2026-08-21 | shell | childTopics 1 | deactivate (move empty topic) |
| computer knowledge | `6a885af03aed5ba9f3a20fba` | Computer Knowledge | 1 | 0 | 2026-08-21 | qbank | question 465, childTopics 1 | merge into question-bank survivor |
| computer knowledge | `6a885af03aed5ba9f3a20f21` | Computer Knowledge | 1 | 0 | 2026-08-21 | qbank | question 291, seriesqmap 7, childTopics 15 | question-bank survivor |
| computer knowledge | `6a885af03aed5ba9f3a20fb0` | Computer Knowledge | 0 | 0 | 2026-08-21 | qbank | question 20 | merge into question-bank survivor |
| computer knowledge | `6a885af03aed5ba9f3a20fae` | Computer Knowledge | 0 | 0 | 2026-08-21 | empty | nothing | deactivate |
| computer knowledge | `6a885af03aed5ba9f3a20faf` | Computer Knowledge | 0 | 0 | 2026-08-21 | empty | nothing | deactivate |
| current affairs | `6a3d2ac13aed5ba9f3fe6c0c` | Current Affairs | 1 | 472 | 2026-06-25 | catalog | class 231, courseclass 253, pdf 24, courses 7, childTopics 3 | catalog survivor |
| current affairs | `6a885af03aed5ba9f3a20f9c` | Current Affairs | 1 | 0 | 2026-08-21 | catalog | class 2, childTopics 1 | merge candidate, check courses |
| e-book | `6a4cdfdf42211ae83977d84d` | E-BOOK | 1 | 472 | 2026-07-07 | mixed | pdf 35, question 130, series 13, apxmap 12, childTopics 7 | catalog survivor |
| e-book | `6a946eb629f16f98cfd7caea` | E-Book | 1 | 472 | 2026-08-30 | catalog | pdf 13 | merge candidate, check courses |
| english | `6a4d1f003e29123ffb5eb0e5` | English | 1 | 472 | 2026-07-07 | mixed | class 121, courseclass 244, question 775, series 10, apxmap 30, courses 2, childTopics 2 | keep (catalog tree) |
| english | `6a885af03aed5ba9f3a20f85` | English | 1 | 0 | 2026-08-21 | shell | childTopics 1 | deactivate (move empty topic) |
| general awareness | `6a885af03aed5ba9f3a20f19` | General Awareness | 1 | 0 | 2026-08-21 | qbank | question 11919, series 14283, seriesqmap 14881, childTopics 138 | question-bank survivor |
| general awareness | `6a4558c8ebb42f585d9a8801` | General Awareness | 1 | 472 | 2026-07-01 | mixed | class 199, courseclass 347, pdf 192, question 2036, series 25, courses 5, childTopics 13 | catalog survivor |
| general awareness | `6ab433b95b97b9154439d900` | General Awareness | 1 | 472 | 2026-09-23 | qbank | question 1148, childTopics 1 | merge into question-bank survivor |
| general awareness | `6a455e17ebb42f585d9d2e6c` | GENERAL AWARENESS | 1 | 472 | 2026-07-01 | mixed | class 196, courseclass 757, pdf 129, question 10, courses 1, childTopics 83 | merge candidate, check courses |
| general awareness | `6ab42193f5441565c1f27dfe` | General Awareness | 1 | 0 | 2026-09-23 | qbank | question 2 | merge into question-bank survivor |
| general knowledge and current affairs | `6a885af03aed5ba9f3a20fa8` | General Knowledge and Current Affairs | 1 | 0 | 2026-08-21 | qbank | question 220, childTopics 1 | merge into question-bank survivor |
| general knowledge and current affairs | `6a885af03aed5ba9f3a20f5f` | General Knowledge and Current Affairs | 1 | 0 | 2026-08-21 | qbank | question 40 | question-bank survivor |
| general science | `6a885af03aed5ba9f3a20f2a` | General Science | 1 | 0 | 2026-08-21 | qbank | question 2891, series 6181, seriesqmap 6243, childTopics 3 | question-bank survivor |
| general science | `6a9211ea6708f6e9bcfa334c` | GENERAL SCIENCE | 1 | 472 | 2026-08-28 | qbank | question 2221, childTopics 1 | merge into question-bank survivor |
| general science | `6a45605debb42f585d9e0e4c` | General Science | 1 | 472 | 2026-07-01 | catalog | courseclass 327, courses 1, childTopics 41 | keep (catalog tree) |
| gk/gs weekly sectional test | `6a3d2ac13aed5ba9f3fe6c09` | GK/GS Weekly Sectional Test | 1 | 472 | 2026-06-25 | qbank | question 525, series 34, childTopics 1 | question-bank survivor |
| gk/gs weekly sectional test | `6ab434d75b97b9154439eb7d` | GK/GS Weekly Sectional Test | 1 | 472 | 2026-09-23 | qbank | question 150, childTopics 1 | merge into question-bank survivor |
| history | `6a455d3eebb42f585d9cd648` | History | 1 | 472 | 2026-07-01 | catalog | courseclass 287, courses 3, childTopics 8 | catalog survivor |
| history | `6a885af03aed5ba9f3a20f26` | History | 1 | 0 | 2026-08-21 | qbank | question 130, childTopics 3 | keep (question-bank tree) |
| history | `6a916a83e4114180890befde` | HISTORY | 1 | 472 | 2026-08-28 | catalog | courseclass 105, courses 1, childTopics 3 | merge candidate, check courses |
| introduction | `6a8d68ddad4789cb1b01fa1c` | Introduction | 1 | 472 | 2026-08-25 | catalog | class 19, courseclass 4, courses 1, childTopics 1 | merge candidate, check courses |
| introduction | `6a3d2ac13aed5ba9f3fe6c15` | INTRODUCTION | 1 | 472 | 2026-06-25 | catalog | class 9, courseclass 5, courses 4, childTopics 2 | catalog survivor |
| logical reasoning | `6a885af03aed5ba9f3a20f1b` | Logical Reasoning | 1 | 0 | 2026-08-21 | mixed | pdf 4, question 11987, series 3841, seriesqmap 4151, childTopics 131 | catalog survivor |
| logical reasoning | `6a91697d0ec8510cb6e0281c` | Logical Reasoning | 1 | 472 | 2026-08-28 | mixed | courseclass 14, question 2277, courses 1, childTopics 1 | merge candidate, check courses |
| maths | `6a3d2ac13aed5ba9f3fe6c0e` | Maths | 1 | 472 | 2026-06-25 | catalog | class 1228, courseclass 3960, pdf 538, courses 28, childTopics 151 | catalog survivor |
| maths | `6a4ca8613e29123ffb5e1141` | maths | 1 | 472 | 2026-07-07 | qbank | question 338, series 11, apxmap 13, childTopics 1 | question-bank survivor |
| maths | `6a885af03aed5ba9f3a20f1f` | Maths | 1 | 0 | 2026-08-21 | qbank | question 177, seriesqmap 8, childTopics 21 | merge into question-bank survivor |
| maths | `6a91f62edce17876b773972c` | MATHS | 1 | 472 | 2026-08-28 | catalog | class 1, courseclass 2, courses 1, childTopics 1 | merge candidate, check courses |
| maths sectional test | `6a3d2ac13aed5ba9f3fe6c0a` | Maths Sectional Test | 1 | 472 | 2026-06-25 | qbank | question 703, series 40, childTopics 1 | question-bank survivor |
| maths sectional test | `6ab434e25b97b9154439eea9` | Maths Sectional Test | 1 | 472 | 2026-09-23 | qbank | question 92, childTopics 1 | merge into question-bank survivor |
| miscellaneous | `6a9047fb0bcee98f4c7f6698` | Miscellaneous | 1 | 472 | 2026-08-27 | catalog | courseclass 195, courses 2, childTopics 4 | keep (catalog tree) |
| miscellaneous | `6aad1a2cea342a1e027519b3` | Miscellaneous | 1 | 0 | 2026-08-27 | shell | childTopics 1 | deactivate (move empty topic) |
| physics | `6a885af03aed5ba9f3a20f1e` | Physics | 1 | 0 | 2026-08-21 | qbank | question 165, seriesqmap 1, childTopics 17 | question-bank survivor |
| physics | `6a455d33ebb42f585d9cd1f3` | Physics | 1 | 472 | 2026-07-01 | catalog | courseclass 67, courses 2, childTopics 9 | keep (catalog tree) |
| physics | `6a885af03aed5ba9f3a20f29` | Physics | 1 | 0 | 2026-08-21 | qbank | question 10, seriesqmap 1, childTopics 8 | merge into question-bank survivor |
| quantitative aptitude | `6a885af03aed5ba9f3a20f1a` | Quantitative Aptitude | 1 | 0 | 2026-08-21 | mixed | courseclass 1, pdf 2, question 14392, series 6493, seriesqmap 7136, courses 1, childTopics 61 | keep (catalog tree) |
| quantitative aptitude | `6a71d830a7507c01f2c3f4d7` | Quantitative Aptitude | 1 | 695 | 2026-08-04 | shell | childTopics 1 | deactivate (move empty topic) |
| reasoning | `6a4558c2ebb42f585d9a8333` | Reasoning | 1 | 472 | 2026-07-01 | mixed | class 627, courseclass 1580, pdf 527, question 2379, series 69, courses 23, childTopics 72 | catalog survivor |
| reasoning | `6ab42f555c6b06f491007bb0` | Reasoning | 1 | 472 | 2026-09-23 | qbank | question 461, childTopics 1 | keep (question-bank tree) |
| reasoning | `6a455e06ebb42f585d9d27d7` | REASONING | 1 | 472 | 2026-07-01 | catalog | class 2, courseclass 222, courses 1, childTopics 39 | merge candidate, check courses |
| reasoning | `6a885af03aed5ba9f3a20f86` | Reasoning | 1 | 0 | 2026-08-21 | shell | childTopics 1 | deactivate (move empty topic) |
| reasoning classes | `6a455ea3ebb42f585d9d6383` | Reasoning Classes | 1 | 472 | 2026-07-01 | catalog | class 22, courseclass 719, pdf 10, courses 4, childTopics 46 | keep (catalog tree) |
| reasoning classes | `6a455ef2ebb42f585d9d8203` | REASONING CLASSES | 1 | 472 | 2026-07-01 | empty | nothing | deactivate |
| reasoning sectional test | `6a3d2ac13aed5ba9f3fe6c07` | Reasoning Sectional Test | 1 | 472 | 2026-06-25 | qbank | question 706, series 41, childTopics 1 | question-bank survivor |
| reasoning sectional test | `6ab434955b97b9154439e5ed` | Reasoning Sectional Test | 1 | 472 | 2026-09-23 | qbank | question 112, childTopics 1 | merge into question-bank survivor |
| science | `6a4558c2ebb42f585d9a8376` | Science | 1 | 472 | 2026-07-01 | mixed | class 215, courseclass 429, pdf 81, question 694, series 2, courses 9, childTopics 38 | keep (catalog tree) |
| science | `6ab435085b97b9154439f1a7` | Science | 1 | 472 | 2026-09-23 | qbank | question 117, childTopics 1 | merge into question-bank survivor |
| science | `6a885af03aed5ba9f3a20fa4` | Science | 1 | 0 | 2026-08-21 | qbank | question 80, seriesqmap 8 | question-bank survivor |
| science sectional test | `6a3d2ac13aed5ba9f3fe6c08` | Science Sectional Test | 1 | 472 | 2026-06-25 | qbank | question 756, series 42, childTopics 1 | question-bank survivor |
| science sectional test | `6ab434c05b97b9154439e902` | Science Sectional Test | 1 | 472 | 2026-09-23 | qbank | question 84, childTopics 1 | merge into question-bank survivor |
| section iii | `6a885af03aed5ba9f3a20f74` | Section III | 1 | 0 | 2026-08-21 | empty | nothing | deactivate |
| section iii | `6a885af03aed5ba9f3a20f75` | Section III | 1 | 0 | 2026-08-21 | empty | nothing | deactivate |
| static gk | `6a455d42ebb42f585d9cd77b` | Static GK | 1 | 472 | 2026-07-01 | catalog | class 79, courseclass 198, pdf 2, courses 3, childTopics 1 | keep (catalog tree) |
| static gk | `6a3d2ac13aed5ba9f3fe6c0b` | STATIC GK | 1 | 472 | 2026-06-25 | empty | nothing | deactivate |
| static gk / ca | `6a4558c3ebb42f585d9a83fb` | Static GK / CA | 1 | 472 | 2026-07-01 | catalog | class 4, pdf 4 | merge candidate, check courses |
| static gk / ca | `6a4558c2ebb42f585d9a8348` | Static Gk / CA | 1 | 472 | 2026-07-01 | catalog | class 1, courseclass 1, pdf 1, courses 1, childTopics 1 | catalog survivor |
| statistics | `6a885af03aed5ba9f3a20f63` | Statistics | 1 | 0 | 2026-08-21 | empty | nothing | deactivate |
| statistics | `6a885af03aed5ba9f3a20f62` | Statistics | 1 | 0 | 2026-08-21 | shell | childTopics 1 | deactivate (move empty topic) |
| statistics | `6a885af03aed5ba9f3a20f61` | Statistics | 1 | 0 | 2026-08-21 | empty | nothing | deactivate |
| test | `6a3d2ac13aed5ba9f3fe6c04` | test | 1 | 472 | 2026-06-25 | empty | nothing | deactivate |
| test | `6a885af03aed5ba9f3a20f97` | Test | 1 | 0 | 2026-08-21 | shell | childTopics 1 | deactivate (move empty topic) |

## Class vs test split, all 703 sections (2026-10-05)

`reference/scripts/section_kinds.cjs` tags every section from what references it. The output is `reference/section_kinds.csv` / `.json`.

| kind | active | inactive |
|---|---|---|
| class | 241 | 1 |
| class (stray tests) | 3 | 0 |
| test | 258 | 4 |
| test (stray classes) | 5 | 0 |
| both | 10 | 1 |
| empty | 167 | 13 |

- **Empty sections.** 167 active sections hold nothing. Together they make up a quarter of the 683 rows the picker shows today. 138 of them come from the 2026-08-21 question-bank import, and 98 carry only empty topics (593 in total). "New PDFs (unfiled)" is empty right now, but it is an import holding area. Keep it active.
- **Real "both" sections.** Only five hold substantial content on both sides: Reasoning (2,735 class / 2,553 test), Science (727 / 729), General Awareness 6a4558c8 (738 / 2,137), English (365 / 846) and E-BOOK (35 PDFs / 168 test). The other six "both" rows are one-item misfiles: DEMO CLASS, Formula Revision, Number System Sectional Test-1, SCIENCE EXPECTED QUESTIONS TEST, Testing-1 and UPSC CSAT 2025.
- **Picker size after the split.** This assumes empty sections are hidden and "both" sections show in both pickers. The class picker would have 254 rows with 11 duplicated names, and the test picker 273 rows with 15, against 683 rows and 32 names today. The remaining duplicates are merges within one side.
