# Dry run for one course, end to end

**Type**: AFK
**Blocked by**: None, can start immediately
**Repo**: backend

## What to build

A read-only command that, for one AppX course or for all of them, works out which picture each section, topic and
sub-topic of the matching Vidyagram course would get, and writes a report. It writes nothing to the database and
fetches nothing from AppX.

- **Matcher (pure, no DB, no network).** Input: one course's mirrored student-tree pages (`apxcatalogtree`) and the
  course's outline rows, each with the AppX row ids of the items placed under it. Output per outline row: either
  `{ level, nodeId, apxFolderId, apxImageUrl }` or a reason (`no folder`, `shared folder`, `folder has no image`).
  Also the image-bearing AppX folders that map to no row.
  - A row's source folder is the deepest folder holding all its items, after climbing past VIDEO/PDF wrapper folders.
  - The match counts only when that folder holds no item filed under another row.
  - The image is the FOLDER row's `thumbnail` (an `http(s)` URL); anything else is "no image".
  - Port the rule from `reference/scripts/vidyagram-folder-image-map.cjs`, including its wrapper fix.
- **Loader.** Builds the matcher input from live data: the AppX tree pages for the course, the import ledger
  (`apxcatalogimports`, AppX row → our class) and the course's active CourseClass placements with their effective
  section / topic / sub-topic (the same effective-taxonomy rule `topic-and-section` uses). PDF items join through the
  PDF ledger and CoursePdf when a course has them (none today; onboarding task 09).
- **Command.** `--dry-run` is the default and the only mode in this task. `COURSE=<apxCourseId>` limits it to one
  course. It writes a JSON + a short Markdown report: rows that would get a picture (per level), rows skipped with
  reason, unmapped AppX images, distinct AppX URLs to re-host. Refuses any DB but `vidyagramdb`.

## Acceptance criteria

- [ ] Matcher unit tests on small hand-built trees cover: topic folder with VIDEO + PDF wrappers maps to the topic; a
      topic whose items all sit in the VIDEO wrapper still maps to the real folder; a folder shared by two topics maps
      to neither; a section maps to its subject folder only when that folder holds nothing else; a folder without a
      `thumbnail` gives "folder has no image"; image-bearing wrappers are reported unmapped.
- [ ] A fixture cut from AppX course 103 maps all 42 topics, each with its picture.
- [ ] Run read-only against prod `vidyagramdb` (secondary reads) with `COURSE=103`: the report matches the fixture,
      plus any folders added since 10-19 (for example "Digital Sum").
- [ ] Full dry run against prod: totals are in line with the offline script's 10-19 numbers (about 2,462 topic,
      58 sub-topic and 104 section pictures; differences explained by data added since).
- [ ] Backend suite: `NO NEW FAILURES` against the base branch.

## User stories covered

- Story 23: dry run lists, per course, what would be set and what maps nowhere.
- Story 28: rows fed by more than one AppX folder get no picture and are listed.
