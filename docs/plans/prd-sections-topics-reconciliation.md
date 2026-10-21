# Sections and topics reconciliation plan

Status: `ready-for-human`. Nothing in this plan has run. Each phase starts only on an explicit go.

Admins currently pick a section from a list of 683 entries. 32 names appear more than once, and 166 entries hold nothing at all. Under those sections, topics repeat too. 34 topic names appear twice under the same section, and 1,818 topics hold nothing. Admins file classes and questions under the wrong copy, and students sometimes see the same section twice in a course. This plan ends with one entry per name and no empty entries. It does this without changing any student's past test results, practice history or AI tests.

The evidence lives in three files:

- `reference/sections-reconciliation-audit-2026-10-05.md` has the section numbers and file references.
- `reference/section_kinds.csv` is the per-section list.
- `reference/topic_audit.csv` / `.json` is the per-topic list, from 2026-10-06.

## Dry run results (2026-10-06)

The dry run is `reference/scripts/reconcile_dry_run.cjs`, read-only on prod. Its output is `reference/reconcile_dry_run.json` and `_changes.csv`. The team sheet is `reference/sections-topics-dry-run-2026-10-06.xlsx`.

- **No course uses two copies of the same section.** Two independent counts both found 0. So no student sees a doubled tab today, and no tabs or topic rows combine.
- **No test paper holds two copies of one name** (0 found).
- **Changes in total.** 20,997 field changes, with 0 hard stops and 1 warning:
  - 165 empty sections switched off;
  - 1,818 empty topics switched off, if decision B is approved;
  - 39 sections merged away and 3 renamed;
  - 109 topics merged away and 239 moved to the kept section;
  - 5 subtopics merged away and 24 moved;
  - 67 courses with placements whose ids change underneath.
- **The section dropdown ends at 480 entries** (684 − 165 − 39).
- **Stored-name renames limited.** Since nothing combines, stored placement names are renamed only for the three approved spellings: 1,314 placements and 70 course PDFs. The other 1,177 spelling changes are listed as optional and not made.
- **The one warning.** The "Percentage" topic under the Arithmetic copy `…fe4` holds 2 student practice records and merges away. Those 2 records stay on it (rule 2).

## Test usage per copy (2026-10-06)

Probe `reference/scripts/test_copy_usage.cjs` (read-only) wrote `reference/test_copy_usage_tests.csv` (one row per test paper x copy x how it points) and `reference/test_copy_usage_copies.csv` (tests and student history per copy).

- No test paper holds two copies of one name. Different papers point at different copies of the same name.
- **AI tests stamp the exam pattern's own section id** on every new paper (`aiTest.controller.ts:198-215`, :633-668). Patterns are left alone (rule 2), so the copy a pattern names must be kept, or every new AI test lands on a switched-off copy. Pattern copies are General Science `…0f2a`, Logical Reasoning `…0f1b`, General Awareness `…0f19` and Arithmetic `…0fe4`. Those copies hold 15,774, 13,798, 15,335 and 118 AI-generated papers.
- The flagship mocks (RRB Group D Mock Tests, NTPC CBT 2 mocks, 21,879 attempts) point at the class-side copies General Awareness `…8801`, Reasoning `…8333` and Science `…8376`. Reasoning and Science keep those copies. `…8801` merges away and its 76 papers stay on it (rule 2).
- Keeper changes proposed from this data, pending approval: Arithmetic keeps `…0fe4` (AI pattern, 145 papers) instead of "ARITHMETIC" (no tests); Maths keeps "maths" `…1141` (12 "All India Free Test" papers, 154 attempts), renamed "Maths", instead of `…0c0e` (no tests). Every other group's current keeper already holds its tests.
- **Open lead, separate from this plan.** About 31,000 scores and 1.2M answers sit on copies no test paper points at: GENERAL SCIENCE `…334c` (10,318 scores), Logical Reasoning `…281c` (10,317), General Awareness `…d900` (10,302), Computer Knowledge `…0fba` (1,118). The history's section id already differs from its paper's. Guess: the APX attempt import stamped the question's section. If so, per-question stats on those solution pages (`userTestDataController.ts:488-530`) may already read empty. Unverified.

## What changes for whom

- **Admins.** The section dropdown shrinks from 683 entries to about 478, and every name appears once. Each name is one section holding both classes and questions. The topic dropdown under each section loses its empty and repeated topics. The old copies stay in the database, switched off.
- **Students.** See "What students will notice" below. In short, a course that showed "MATHS" and "Maths" shows one tab. Three section names change spelling. Topic order in a merged tab may shift. Nothing else changes.
- **Next engineer.** One section per name and one topic per name within a section. There's a backup file and a restore script for every write.

## What students will notice

This comes from a trace of every student-facing read at backend `29dc69253` and the website checkout, plus the 2026-10-06 data. Every consequence below is either measured or labelled as inferred.

1. **Course page, section tabs.** Where a course shows two tabs for the same name, like "MATHS" and "Maths", the student sees one tab. The website keys tabs by section id (thedhronas `utils/utility.ts:2097`). Topics sharing a name inside that tab become one row, with the percentage combined. Progress is stored per class, so nothing is lost. The merged tab shows the kept section's image and faculty (`courseController.ts:2590`, :2640).
2. **Spelling.** "ADVANCE", "ARITHMETIC" and "E-BOOK" become "Advance", "Arithmetic" and "E-Book" wherever students see the name. That includes the "E-BOOK" section inside the test papers that use it, and saved-question groups. Only these three if the Phase 0 proposal stands.
3. **Topic order.** A merged topic can move within the tab. Order comes from `coursetopics`, one row per course and topic (`courseController.ts:2722`). Rule 6 below keeps the kept topic's order. The Phase 3 dry run lists every course whose order changes.
4. **No change.** All of these stay the same:
   - class cards and class search;
   - PDF lists, apart from a spelling change;
   - ebooks, shorts and global search;
   - test results, solutions, leaderboards, saved and reported questions;
   - AI tests, both app and website.

   App AI tests pick questions only from a fixed list of topics (`aiTest.controller.ts:168-181`, :211-214). Section ids there are only labels. The website AI test is pinned to a section in no merge group (`topicController.ts:368`).
5. **Practice history.** Students' per-topic practice records stay on their topics. In every topic merge the kept topic is the one holding those records. General Awareness carries 52,087 records, all on the question-bank topics we keep. Only 2 records sit on a topic that merges away ("Percentage" under the Arithmetic copy `…fe4`). For those 2 students, "Chapters Covered" might count one chapter twice (inferred).
6. **Briefly stale page.** The public course page builds its first view at most every 12 hours, then refetches on load (`pages/courses/[slug]/[id]/index.tsx:71, 285`). For a moment after a merge a student may see the old tabs. A student with the page open during a merge may see an empty topic list until they reload. The mobile app's caching is unknown, because its source isn't in this workspace.
7. **Later, if nothing is done (inferred).** An admin adding a moved question to an old test paper would make that paper show two sections with the same name. Assigning copies the question's own section id (`series.controller.ts:864-884`), but the paper still uses the old one. Phase 1 closes this.

## The rules this plan follows

1. **Never delete.** Merged-away sections and topics are switched off (`status: 0`). Old records that point at them still find their names, because no code that looks a section up by id checks `status`.
2. **Leave test papers and student history alone.** Test papers are `Series`, `AssignQues`, `TestSectionQuestionMap`, `SeriesQuestionMap` and `AiTestPattern`. Student history is `Scores`, `UserTestData`, `UserQuestionAnswer`, `SavedQuestion`, `ReportQuestion` and `usertopicquestionlogs`. All of these keep their old ids. The solution screen pairs a student's old answers with the current paper by position, so moving a paper's sections can misalign past attempts.
3. **Move content, not history.** Repoint these to the kept section:
   - `Class.section` and `CourseClass.section`, including `apxDisplayPlacements[].section`
   - `Pdf.section` and `Short.section`
   - `Question.sectionId`
   - `Topic.section`

   For merged topics, repoint `Class.topic`, `CourseClass.topic` with `apxDisplayPlacements[].topic`, `Pdf.topic`, `Short.topic`, `Question.topicId` and `SubTopic.topic`.
4. **Change what students see only where approved.** No course combines tabs (dry run), so stored placement names change only for the three approved spellings. Other case differences are listed in the sheet's Optional spellings tab and not made. The rule as first written was: for every placement whose stored section or topic name matches the merge name ignoring case, set it to the kept spelling. The stored names are `CourseClass.sectionName`/`topicName`, `apxDisplayPlacements[].sectionName`/`topicName` and `CoursePdf.sectionName`/`topicName`. Students see these, not the live names. A stored name that does not match is a custom name an admin typed, and it is left alone. The dry run lists those.
5. **Topics with the same name merge, not just move.** A unique index on `{section, topicName}` stops two exact same-name topics sitting under one section (`Topic.ts:99`). The kept topic is the one already under the kept section, because the unique index ignores `status`. Among several candidates, a topic on the AI-test list wins, then the one with the most content and student records. The dry run stops if an AI-test-list topic would merge away, and warns if a merged-away topic holds more student records. Topics with no match move across with their ids unchanged.
6. **Course topic order.** Each `coursetopics` row pointing at a merged-away topic is repointed to the kept topic. If that course already has a row for the kept topic, the kept row and its order win. The merged-away row is left in place, pointing at a switched-off topic, because the unique index `course_1_topic_1_unique` forbids a second row. Nothing is deleted.
7. **Every write is reversible.** Before any write, the script saves every changed field's old value to a backup file on the box. A restore script puts it all back.
8. **One group at a time, checked before the next.**

## Phase 0. Decisions you make before anything runs

- [x] **Spelling of each kept name.** Approved 2026-10-06: ADVANCE → Advance, ARITHMETIC → Arithmetic, E-BOOK → E-Book; every other kept name keeps its spelling. Students will see it. I propose "ADVANCE" becomes "Advance", "ARITHMETIC" becomes "Arithmetic" and "E-BOOK" becomes "E-Book", and the rest keep their current spelling. The list is in Appendix A.
- [x] **Which copy is kept in each group.** Approved 2026-10-06: the copy with the most content (Appendix A). 8 groups keep a question-bank copy (customer 0); that is safe because every section list, dropdown and search accepts customers {472, 1, 0} and student pages look sections up by id. Course tab picture and teacher come from the course, not the section (the Section schema has no `image`/`facultyDetails` and no writer sets them), so the choice cannot change them.
- [x] **Empty sections.** Approved 2026-10-06: switch off the 165 empty sections in Phase 2; "New PDFs (unfiled)" stays on.
- [x] **Agree to leave test papers and student history on old ids** (rule 2). Approved 2026-10-06.
- [ ] **Empty topics.** Should the 1,818 topics that hold nothing be switched off too? They only show in admin topic dropdowns and never on student pages. My recommendation is yes, in Phase 2.

## Phase 1. Close the gaps in the code (backend and admin, small changes)

- [ ] Backend. `/sections/search` and `/topics/search` prefer `status: 1` (`sectionController.ts:480, 511`). Series bulk upload and topic CSV import resolve names through these, and today they take the last match even if it's switched off.
- [ ] Backend. When a question is added to an existing test paper, reuse the paper's own section with the same name instead of the question's section id (`series.controller.ts:864-884`). This prevents the two-same-name-sections case in "What students will notice" item 7.
- [ ] Admin. The section edit page loads the section by id instead of searching the 10 newest (`app/admin/sections/edit/[id]/page.tsx:24`).
- [ ] Backend. Question CSV import (admin "Import questions", `questionController.ts:963-1043`) maps sections from `Section.find({})` by legacy id or name with no status check, last match wins. Prefer the active copy; a match on a switched-off copy follows to the active same-name one. Found 2026-10-06; not yet approved.
- [ ] Backend. Section CSV import (`sectionController.ts:430-440`, API only, no admin caller) matches by name ignoring status and sets status from the row (default active), so it can switch a merged copy back on. Prefer the active copy and never reactivate. Found 2026-10-06; not yet approved.
- [ ] Admin. ClassesDashboard bulk change-section and BulkUploadVideosSheet use the searchable section picker instead of a first-200 plain list.
- [ ] Deploy. The backend goes out by commit, push and box pull. The admin goes out on Vercel by push.
- [ ] Check that each of these works:
  - series bulk upload naming "Computer Knowledge" resolves to the active copy;
  - adding a question to an old paper keeps one section;
  - the edit page opens an old section;
  - the bulk dropdown finds a section beyond the first 200.

## Phase 2. Switch off empty sections and empty topics

- [ ] Dry run. List the 166 empty sections and, if Phase 0 says yes, the 1,818 empty topics. Re-check that each has zero references, including `coursetopics` rows and AI-test list membership. Anything filed since the audit drops out.
  - "Empty" means no classes, PDFs, shorts, questions, test-paper chapters, student records or subtopics.
  - "New PDFs (unfiled)" stays on.
- [ ] Write. Set `status: 0`. The backup is the id lists.
- [ ] Check. The section dropdown drops by 166. Topic dropdowns shrink. Spot-check 3 courses on the website for unchanged tabs and topics.

## Phase 3. Build the merge script and dry-run every group

One script, `reference/scripts/merge_sections.cjs`, takes one section group. It has three modes: dry run, commit and restore. The dry run writes nothing and reports:

- every document and field it would change, with counts;
- topic merges, meaning which topic is kept, which merge away, and the references each one moves;
- topics that move across unchanged;
- `coursetopics` rows repointed, and courses whose topic order changes;
- stored placement names it will rename, and custom names it leaves alone;
- courses where two tabs become one, and courses where one tab would still show the same topic name twice;
- a hard stop if any merged-away topic is on the AI-test list, or any moved question has `custom_type: 'ai-test'`;
- test papers that reference the group (count only, since they're untouched).

Commit mode writes the backup first and re-reads before writing. Restore mode undoes the backup.

- [ ] Write the script and dry-run all 25 groups.
- [ ] You review the 25 reports, a summary table plus one detail file per group.

## Phase 4. Pilot on the smallest group and prove undo works

The pilot group is "Static GK / CA". It has 11 items, 1 topic and no topic collisions.

- [ ] Commit, then check that the admin dropdown shows one copy, the course page on the website shows one tab, and the class and the PDF open.
- [ ] Restore, then check the old state is back field for field.
- [ ] Commit again.

## Phase 5. Merge the remaining 24 groups, smallest first

They run in Appendix A order, one at a time.

- **Sectional tests.** The five "… Sectional Test" groups each merge one "(imported)" topic. Those topics hold questions only.
- **The four big groups go last.** These are Reasoning (15 topic collisions), General Awareness (11), Classes (27, nearly all empty) and Maths (3). They carry the most topic merges.

- [ ] Each group: dry run, commit, check the dropdown, and spot-check one course that used the old copy on the website.
- [ ] After every 5 groups, rerun `section_kinds.cjs` and `topic_audit.cjs`. Confirm the duplicate counts dropped by exactly what was merged.

## Phase 6. Merge repeated topics within one section

These are the 34 pairs that share a name under the same section, such as Maths > "Number System" and "NUMBER SYSTEM". 496 items sit on the smaller copies, and none carry student records. They use the same script with a topic-only mode, the same rules and the same checks.

- [ ] Dry run all 34, then review, commit and check.

## Phase 7. Close out

- [ ] Rerun both audits. Pass when the section dropdown has no repeated names, the empty count is 1 ("New PDFs (unfiled)"), and no section has two active topics with the same name.
- [ ] Record every write and backup file in the prod-data-changes memory and this plan.
- [ ] Out of scope, noted for later. 712 topic names repeat across different sections, mostly per-course folder trees like "Number System" in several batches. Those are not duplicates of each other.

## Appendix A. The 25 section merge groups (from 2026-10-05 data, smallest first)

"Keep" is my default choice. Phase 0 can change it, and Phase 3 rechecks every count.

| # | Name | Keep | Switch off after moving | Moves onto the kept one |
|---|---|---|---|---|
| 1 | static gk / ca | `6a4558c3ebb42f585d9a83fb` "Static GK / CA" (8 class, 0 test, 0 courses) | `6a4558c2ebb42f585d9a8348` "Static Gk / CA" | 1 class, 1 placement, 1 pdf, 1 topics |
| 2 | introduction | `6a8d68ddad4789cb1b01fa1c` "Introduction" (23 class, 0 test, 1 courses) | `6a3d2ac13aed5ba9f3fe6c15` "INTRODUCTION" | 9 class, 5 placement, 2 topics |
| 3 | biology | `6a885af03aed5ba9f3a20f27` "Biology" (0 class, 82 test, 0 courses) | `6a914daa709253fd90707de4` "Biology" | 18 placement, 1 topics |
| 4 | chemistry | `6a885af03aed5ba9f3a20f28` "Chemistry" (0 class, 54 test, 0 courses) | `6a455d36ebb42f585d9cd357` "Chemistry" | 52 placement, 7 topics |
| 5 | e-book | `6a4cdfdf42211ae83977d84d` "E-BOOK" (35 class, 168 test, 0 courses) | `6a946eb629f16f98cfd7caea` "E-Book" | 13 pdf |
| 6 | physics | `6a885af03aed5ba9f3a20f1e` "Physics" (0 class, 177 test, 0 courses) | `6a455d33ebb42f585d9cd1f3` "Physics"<br>`6a885af03aed5ba9f3a20f29` "Physics" | 67 placement, 9 topics<br>10 question, 1 seriesQMap, 8 topics |
| 7 | general knowledge and current affairs | `6a885af03aed5ba9f3a20fa8` "General Knowledge and Current Affairs" (0 class, 220 test, 0 courses) | `6a885af03aed5ba9f3a20f5f` "General Knowledge and Current Affairs" | 40 question |
| 8 | computer | `6a45591cebb42f585d9ac3d3` "Computer" (425 class, 0 test, 4 courses) | `6a885af03aed5ba9f3a20f17` "Computer" | 1 question, 1 topics |
| 9 | current affairs | `6a3d2ac13aed5ba9f3fe6c0c` "Current Affairs" (508 class, 0 test, 7 courses) | `6a885af03aed5ba9f3a20f9c` "Current Affairs" | 2 class, 1 topics |
| 10 | history | `6a455d3eebb42f585d9cd648` "History" (287 class, 0 test, 3 courses) | `6a885af03aed5ba9f3a20f26` "History"<br>`6a916a83e4114180890befde` "HISTORY" | 130 question, 3 topics<br>105 placement, 3 topics |
| 11 | gk/gs weekly sectional test | `6a3d2ac13aed5ba9f3fe6c09` "GK/GS Weekly Sectional Test" (0 class, 593 test, 0 courses) | `6ab434d75b97b9154439eb7d` "GK/GS Weekly Sectional Test" | 150 question, 1 topics |
| 12 | computer knowledge | `6a885af03aed5ba9f3a20fba` "Computer Knowledge" (0 class, 465 test, 0 courses) | `6a885af03aed5ba9f3a20f21` "Computer Knowledge" | 291 question, 7 seriesDetail, 7 seriesQMap, 15 topics |
| 13 | bs & e sectional test | `6a3d2ac13aed5ba9f3fe6c06` "BS & E Sectional Test" (0 class, 653 test, 0 courses) | `6ab434565b97b9154439e2d1` "BS & E Sectional Test" | 135 question, 1 topics |
| 14 | maths sectional test | `6a3d2ac13aed5ba9f3fe6c0a` "Maths Sectional Test" (0 class, 783 test, 0 courses) | `6ab434e25b97b9154439eea9` "Maths Sectional Test" | 92 question, 1 topics |
| 15 | reasoning sectional test | `6a3d2ac13aed5ba9f3fe6c07` "Reasoning Sectional Test" (0 class, 788 test, 0 courses) | `6ab434955b97b9154439e5ed` "Reasoning Sectional Test" | 112 question, 1 topics |
| 16 | science sectional test | `6a3d2ac13aed5ba9f3fe6c08` "Science Sectional Test" (0 class, 840 test, 0 courses) | `6ab434c05b97b9154439e902` "Science Sectional Test" | 84 question, 1 topics |
| 17 | advance | `6a9023049a9d53af06e3bf8e` "ADVANCE" (630 class, 1 test, 3 courses) | `6a9047fb0bcee98f4c7f6696` "Advance" | 1 class, 441 placement, 8 topics |
| 18 | science | `6a4558c2ebb42f585d9a8376` "Science" (727 class, 729 test, 9 courses) | `6ab435085b97b9154439f1a7` "Science"<br>`6a885af03aed5ba9f3a20fa4` "Science" | 117 question, 1 topics<br>80 question, 8 seriesQMap |
| 19 | arithmetic | `6a9023049a9d53af06e3bf8f` "ARITHMETIC" (690 class, 0 test, 4 courses) | `6a9047fb0bcee98f4c7f6697` "Arithmetic"<br>`6a9d0afa3aed5ba9f3f0395d` "Arithmetic"<br>`6a885af03aed5ba9f3a20fe4` "Arithmetic"<br>`6a885af03aed5ba9f3a20f98` "Arithmetic" | 1 class, 491 placement, 14 topics<br>367 question, 2 topics<br>146 question, 29 series, 115 seriesDetail, 29 seriesQMap, 2 aiTest, 2 topics<br>1 class, 1 pdf, 166 question, 1 series, 3 seriesDetail, 1 seriesQMap |
| 20 | classes | `6a4558d6ebb42f585d9a91ab` "Classes" (4913 class, 0 test, 2 courses) | `6a455e7cebb42f585d9d5553` "CLASSES" | 37 class, 29 pdf, 29 topics |
| 21 | reasoning | `6a4558c2ebb42f585d9a8333` "Reasoning" (2735 class, 2553 test, 23 courses) | `6ab42f555c6b06f491007bb0` "Reasoning"<br>`6a455e06ebb42f585d9d27d7` "REASONING"<br>`6a885af03aed5ba9f3a20f86` "Reasoning" | 461 question, 1 topics<br>2 class, 222 placement, 39 topics<br>5 seriesDetail, 1 topics |
| 22 | maths | `6a3d2ac13aed5ba9f3fe6c0e` "Maths" (5727 class, 0 test, 28 courses) | `6a4ca8613e29123ffb5e1141` "maths"<br>`6a885af03aed5ba9f3a20f1f` "Maths"<br>`6a91f62edce17876b773972c` "MATHS" | 338 question, 11 series, 12 seriesDetail, 13 apxSeriesMap, 1 topics<br>177 question, 4 seriesDetail, 8 seriesQMap, 21 topics<br>1 class, 2 placement, 1 topics |
| 23 | general science | `6a885af03aed5ba9f3a20f2a` "General Science" (0 class, 30092 test, 0 courses) | `6a9211ea6708f6e9bcfa334c` "GENERAL SCIENCE"<br>`6a45605debb42f585d9e0e4c` "General Science" | 2231 question, 1 topics<br>327 placement, 8 apxPlacement, 41 topics |
| 24 | logical reasoning | `6a885af03aed5ba9f3a20f1b` "Logical Reasoning" (4 class, 32827 test, 0 courses) | `6a91697d0ec8510cb6e0281c` "Logical Reasoning" | 14 placement, 2317 question, 1 topics |
| 25 | general awareness | `6a885af03aed5ba9f3a20f19` "General Awareness" (0 class, 55467 test, 0 courses) | `6a4558c8ebb42f585d9a8801` "General Awareness"<br>`6ab433b95b97b9154439d900` "General Awareness"<br>`6a455e17ebb42f585d9d2e6c` "GENERAL AWARENESS"<br>`6ab42193f5441565c1f27dfe` "General Awareness" | 199 class, 347 placement, 192 pdf, 2036 question, 25 series, 76 seriesDetail, 13 topics<br>1148 question, 1 topics<br>196 class, 757 placement, 4 apxPlacement, 129 pdf, 10 question, 83 topics<br>2 question |

## Appendix B. Alternatives rejected

- **Separate class and test sections with a new field and filter each dropdown.** This leaves every duplicate row in place. It only hides the other side's copy. It would also have created 5 new rows to split the sections that already hold both.
- **Rewrite test papers and student history to the kept ids.** This is risky for no visible gain. Old attempts pair answers with the paper by position, so merging two sections within one paper would misalign them. Per-question stats would also split between old and new ids, and `SavedQuestion`'s unique index would collide.
- **Delete merged-away copies.** Old scores, saved questions and test papers point at them. Switching them off keeps every name resolvable.

## Appendix C. Risks

- **AI tests.** They pick questions by a fixed topic list, not by section. The dry-run hard stop covers the one way a merge could touch them, a topic on that list being merged away.
- **Topic collisions.** 74 names (156 topics) across the 25 groups, 71 of them with exactly the same spelling. Each needs its topic references moved, which is the largest part of each write.
- **App caching.** It is unknown, because the app source isn't in this workspace. The app should pick up changes on its next fetch (inferred).
- **Admins filing during a merge.** A class filed under an old copy mid-merge would be missed. Run each group's commit right after its dry run, and the commit re-reads before writing.
- **Name lookups outside Phase 1's fix.** The legacy PHP sync and the APX resolver also look up by name. Both are stopped, but the APX catch-up job is only paused by its stop locks. If someone deletes the locks, it can file into or recreate copies. Keep the locks in place until this plan closes.
- **Students' saved-question groups.** These are keyed by the stored section id. A student who saved questions under two copies still sees two groups with the same name. This is left as is (rule 2).
