# Cross course index and deleted report

**Type**: AFK
**Blocked by**: 01 — Action page tracer
**Status**: done

**DONE 2026-09-29 (title-based)**: the index is a same-title search across every platform course, because the audit keeps no AppX video keys. Of 525 classes deleted in AppX and absent from their course: 462 play elsewhere on the platform, 9 exist without video, 54 are not on the platform. Of the 10 Import class rows, 3 are already in the same course by title (now info) and 7 remain (a talk-show clip plus 6 Static GK classes whose only platform copy has no video and no course). `deleted-in-appx.xlsx` in `outputs/apx-catalogue-completeness/`. Key-exact re-check folds into task 07.

## What to build

Build an asset-key index over every platform course. An AppX item missing from its course but present in another course becomes Add existing class to course. Produce the deleted-in-AppX workbook (one tab per group, per-course summary, 'in another course' column).

## Acceptance criteria

- [ ] Index maps asset key → platform courses and classes (read-only prod query, counts and ids only)
- [ ] Import class rows whose asset is elsewhere on the platform become Add existing class to course
- [ ] deleted-in-appx.xlsx: still on platform / not in this course / notes, plus summary
- [ ] No personal data in outputs

## User stories covered

- Stories 11–13, 21 (PRD numbering)
