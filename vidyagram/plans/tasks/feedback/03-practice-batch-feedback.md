# Practice batch feedback

**Type**: AFK
**Blocked by**: 02
**Repo**: backend + admin

## What to build

A student who bought a practice batch can rate the batch itself, and the classes, PDFs and tests in it
with `parent: { kind: 'practiceBatch', id }`.

Backend, registry only:
- `practiceBatch` entry: `authorizePracticeBatchAccess` with `mongoPracticeBatchAuthorizationDeps`; no
  `parent`; `facultyIds` `[]`; `consumed` always true.
- The `class`, `pdf` and `test` entries accept a practice batch parent: the item must be placed via
  `PracticeBatchClass`, `PracticeBatchPdf` or `PracticeBatchTest`, then the practice batch rule applies.
  Keep the per-parent rule in one place inside the registry (a small parent table, not a branch per kind).
- `consumed` for a PDF in a batch also counts a `DocumentRead` of kind practice-batch-pdf.

Admin: the list page shows the parent (course or practice batch title) on each row.

## Acceptance criteria

- [ ] Integration: a batch buyer rates the batch; a non-buyer gets 403; an expired order gets 403.
- [ ] Integration: a buyer rates a test placed in the batch with `parent: practiceBatch`; a non-buyer
      gets 403; a test not placed in that batch is refused.
- [ ] Integration: a class rated first through a course and then through a batch keeps one row, and
      `parent` holds the batch.
- [ ] Integration: practice batch tags are accepted on a batch and refused on a course.
- [ ] Admin component test: the parent title renders on a row.
- [ ] `NO NEW FAILURES` against both baselines.

## User stories covered

- Stories 1 (practice batch and its content), 3, 16
