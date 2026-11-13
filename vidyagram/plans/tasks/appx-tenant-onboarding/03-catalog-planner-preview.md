# 03 — Catalogue planner and preview sheet (Vidyagram)

Status: `ready-for-agent`. Repo: `abhi092515/quicktricks-backend`, branch `feat/vg-catalog-planner` (off
`feat/vg-catalog-mirror` 5bdea4285), worktree `~/Projects/worktrees/vg-catalog-planner`.
Plan: [../../appx-tenant-onboarding.md](../../appx-tenant-onboarding.md) — read "Start from the reconciled state" and
"Taxonomy rules" first. Depends on task 01 (mirror collections `apxcatalogcourses/rows/tree/content`, see
`src/services/apx/apxCatalogCapture.ts` for the exact document shapes).

## Goal

A **pure, read-only planner** that turns the mirror into the reconciled target state per course, plus a review sheet
the operator approves before anything is created. No writes to any DB collection. Task 04 (later) makes Build consume
the approved plan.

## Planner output (one plan per course, JSON)

- `course`: apxCourseId, title, enabled → `status` (enable=0 → off-sale), price sentinel handling (-10 free, -1 stopped
  selling → status 0 and not free, -3 special), description (`detail.description`), validity (`validity` +
  `validity_type`), image (`detail.image`), start/end dates. Flag anything unparseable.
- `outline`: Section › Topic › SubTopic nodes in display order, each with its items (class or PDF) in order.
- `items`: per pc4 row that is visible: rowId, kind (VIDEO / LIVE_STREAM recorded / PDF), title after collision rule,
  free flag (from the visible tree's `free_flag`; free wins if any placement is free), placement (section/topic/subTopic
  names + priority = depth-first rank in the visible tree), asset key, YouTube link from `link` or `live_link`.
- `excluded`: rows not imported and why (deleted / folder deleted / folder disabled / disabled → imported inactive
  instead, per decision below / live or upcoming with no recording).
- `unfiled`: visible items whose folder path cannot be mapped; never invent a section for them.
- `sharedItems`: rows placed in several courses (one Class, one placement per course).

## Rules (from the 472 reconciliation; do not re-derive)

- Taxonomy comes from the **student-visible tree** path, using the logic of nodejs-server
  `quicktricks-prod:scripts/apx-course-reconciliation-planner.mjs` `deriveApxTaxonomyProposal`: drop "Home" and a
  leading generic "Classes" folder; first meaningful folder = Section; up to two more levels = Topic, SubTopic; deeper
  paths go to `unfiled` with the full path. Port it as TypeScript with its tests
  (`apx-course-reconciliation-planner.test.mjs`).
- Names: NFC-normalise, replace U+00A0 with a space, collapse whitespace, trim. Two names that differ only by case or
  spacing are the **same node**; the display spelling is the first one seen in depth-first order across the catalogue.
  Report every merged variant.
- Order: depth-first rank in the visible tree (API order), per course.
- Titles: identical titles within one course get " (2)", " (3)" in order (decided 2026-10-13).
- Disabled-in-AppX items and courses are planned as **inactive**, not dropped. Deleted / under a deleted folder are
  excluded.
- Free: `free_flag` from the visible tree; a row free in any placement is free.
- Faculty: decided 2026-10-13, default "Vidyagram Team" for every course (`--faculty-default`), overridable per course
  with `--faculty <json>`. Never fall back to any other name.

## Review sheet

`src/scripts/apxCatalogPlan.ts [--courses …] [--run full-2026-10-13] --out <dir>` reads the mirror (filter on
`lastSeenRunId == capture.runId`), runs the planner, and writes to `<dir>`:
- `plan-<course>.json` per course and `plan-summary.json`;
- `vidyagram-catalogue-preview.xlsx` with sheets: **Courses** (one row per course: title, status, price, items,
  sections, unfiled, excluded, Approve column), **Outline** (course, section, topic, subtopic, item order, title, kind,
  free), **Unfiled**, **Excluded**, **Name merges** (variants → chosen spelling), **Shared items**.
Use the xlsx library already in the repo if there is one; otherwise write CSVs per sheet and say so.

Never print or write `pdf_encryption_key`, cookies, or raw links beyond the item's own asset key/URL host.

## Tests

Pure unit tests on fixtures built from real mirror shapes: path derivation (Home, generic Classes, depth > 3 →
unfiled), name merging across case/NBSP/NFC, depth-first order, title counter, free-wins, disabled → inactive,
deleted → excluded, shared item across two courses, price sentinels. Show each test fails without its rule.

## Run (allowed)

Read-only run over the courses already `done` in run `full-2026-10-13` (the capture may still be running; plan only
done courses). Write the output to `~/Projects/system-brain/outputs/vidyagram-catalogue-preview-<date>/`. Report:
courses planned, total items, sections/topics/subtopics, unfiled and excluded counts, the top name merges, and 3
courses whose outline looks most suspicious.

## Done when

Tests pass, `tsc --noEmit` clean of new errors, the read-only run produced the sheet, no DB writes happened, commits are
local on `feat/vg-catalog-planner` (not pushed).
