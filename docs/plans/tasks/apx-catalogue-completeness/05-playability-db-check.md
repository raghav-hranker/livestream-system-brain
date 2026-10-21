# Playability db check

**Type**: AFK
**Blocked by**: 01 — Action page tracer
**Status**: done

**DONE 2026-09-29**: probe at 11:48 UTC. 32,427 active class placements checked: 47 active classes have no video on record (none scheduled in the future) → Fix video rows. 30,959 attached notes and 2,453 course PDFs checked: every one has either a private file (`pdfAsset`) or a legacy public URL; 893 notes rely on the legacy URL only, which the app serves verbatim, so they are checked in task 06, not flagged as missing.

## What to build

For every active class and attached note, check the database record: class has hlsAsset (or a YouTube redirect), note/PDF has pdfAsset. Missing ⇒ Fix video / Fix PDF file rows on the page.

## Acceptance criteria

- [ ] Read-only query; per-course counts on the page
- [ ] Classes with no playable record become Fix video rows
- [ ] PDFs with no pdfAsset become Fix PDF file rows
- [ ] Genetics Class 41 and Plant Tissue Class 47 show up as Fix video (known cases)

## User stories covered

- Stories 18 (PRD numbering)
