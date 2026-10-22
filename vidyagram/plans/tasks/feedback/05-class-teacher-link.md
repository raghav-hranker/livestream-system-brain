# Class teacher link

**Type**: AFK
**Blocked by**: 01 (only the re-snapshot script needs the `Feedback` model)
**Repo**: backend + admin

## What to build

Every class can carry a real teacher id, so class ratings roll up to teachers.

Backend:
- `Class.facultyId` (ObjectId, ref `FacultyDetails`, optional), included in class read projections.
- The admin "Change faculty" action (`controllers/adminClassFacultyController.ts`) writes `facultyId` and
  `teacherName` together. Class create and update accept `facultyId`.
- The class registry entry's `facultyIds` returns `[class.facultyId]` when set, else `[]`.
- Backfill script under `scripts/` with a `vidyagram-` prefix: match each class's trimmed `teacherName`
  to exactly one `FacultyDetails.name`. Dry-run by default, printing matched count, unmatched names with
  class counts, and ambiguous names. `--commit` writes `facultyId` only where it is unset.
- Re-snapshot script: for class feedback rows, set `facultyIds` from the class's current `facultyId`.
  Dry-run by default, `--commit` to write. Safe to re-run.

Admin: the class form's faculty picker sends `facultyId`; the class list shows the linked teacher.

## Acceptance criteria

- [ ] Integration: "Change faculty" sets both fields; a class read returns `facultyId`.
- [ ] Integration: a class feedback row written after the link carries `facultyIds = [facultyId]`.
- [ ] Script test: dry-run writes nothing and lists unmatched and ambiguous names; `--commit` fills only
      unset classes; a second `--commit` changes nothing.
- [ ] Script test: re-snapshot fills `facultyIds` on an older row; a second run changes nothing.
- [ ] Dry-run output of the backfill against the local copy of `vidyagramdb` saved in the report, so the
      user sees the unmatched list before task 12.
- [ ] Admin component test: the picker sends `facultyId`.
- [ ] `NO NEW FAILURES` against both baselines.

## User stories covered

- Groundwork for stories 11 and 18
