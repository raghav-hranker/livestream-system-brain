# Run the conversion on prod, deploy the switch-over

**Type**: HITL
**Blocked by**: #02 — Deploy the Free fix · #04 — PDF page and PDFs list · #05 — The place decides Free

## What to build

PRD D13, sequencing step 2. Order matters: **conversion first, then deploy**. Running the conversion
before the rule change is harmless (the old OR still holds); deploying first would lock the 14 PDFs.

1. Dry run against prod; show the user the planned rows (expected 14 PDFs, 41 course placements,
   1 class attachment, 0 batch rows). Wait for a clear yes.
2. `--commit` with the backup file saved to `reference/scripts/` in system-brain (and on the box).
3. Read back: every converted place free, `Pdf.isFree` count 0; student listing for two affected
   courses unchanged.
4. Deploy backend (04 + 05) and admin (04) together; check a non-buyer still opens one of the 8 books
   in two batches, and that unticking it in one batch locks it there only (then restore).

## Acceptance criteria

- [ ] User approved the dry-run rows before `--commit`.
- [ ] Backup file committed; restore command written next to it.
- [ ] `Pdf.isFree` true count is 0 in prod; affected students see no change.
- [ ] Deployed; commit ids recorded in the README and memory.

## User stories covered

- 40, 42 (verified in production)
