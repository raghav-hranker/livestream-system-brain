# Three known pdfs

**Type**: HITL
**Blocked by**: 02 — xlsx and approval reader
**Status**: blocked

**BLOCKED 2026-09-30**: notes porter run in commit mode twice (with and without the clear-PDF fix a7355283d) — all 4 placements refused by the validity gate. Diagnosis: ADVERBS-05 AppX file has its first 384 KB zeroed at source; Human Reproduction Pt 2 does not decrypt with AppX's key (v1, 16-byte); POLLUTION returns an empty body. Unrecoverable from AppX → teacher re-upload via admin.

## What to build

Extend the notes porter to take an explicit approved-row list and set status at creation from the AppX state; attach the 3 known PDFs (AppX rows 19187, 19186, 24323, 32672). Dry-run → approval → commit → re-audit of courses 36, 39, 66, 82.

## Acceptance criteria

- [ ] Porter accepts approved row ids; dry-run default; --commit writes
- [ ] Second dry-run after commit plans zero writes
- [ ] Re-audit shows the 4 Attach PDF rows cleared

## User stories covered

- Stories 8–10, 24–26 (PRD numbering)
