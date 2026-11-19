# PDF-only folders in the Vidyagram course outline

Status 2026-11-19: **deployed, default on** (vidyagram-admin ab56b36c5, pm2 92, 17:20 IST). Folders follow the regular topics
unless the caller sends `includePdfFolders=0`. 5 Sections + 62 Topics created (ids in the system-brain `prod-data-changes` memory);
the 07:00 IST cron adds new ones daily. A folder uses customer 781's Sections only, names compared ignoring case, and the Sections
the course's own classes use come first. A folder sits among its own section's topics, placed by PDF order (AppX order
inside a section), else after that section's last topic, else at the end. Tenant: Vidyagram only. The rest of this doc is the 11-05 build record.

## Goal

A student should be able to reach every course PDF by browsing the course, as in AppX, not only through Ebooks.

## The gap

`GET /api/topic-and-section` builds the topic list from class placements. `GET /api/topics/:topicId/classes` returns `pdfs`, but
only for topics on that list. A PDF filed under a folder with no classes has no screen.

Measured 2026-11-04 from the public APIs (`reference/scripts/vidyagram-topic-pdf-match-public.cjs`):

| | All courses | On sale |
|---|---|---|
| PDFs with no topic screen | 390 of 10,350 | 97 of 1,190 |
| Courses affected | 45 of 104 with PDFs | 11 of 24 with PDFs |

## Decision

The user chose: send the folder as a normal topic whose classes array is empty. This replaces the separate `pdfFolders` list
first recommended here. Course Builder is out of scope, so chapter buyers' access to these PDFs is unchanged.

## What was built

- `GET /api/topic-and-section?courseId=…&includePdfFolders=1` adds one row per folder after the regular topics. Each row has
  every regular key, `classCount: 0`, and a new `pdfCount`. Without the parameter the response doesn't change.
- `GET /api/topics/:topicId/classes` on a folder returns `classes: []` and that folder's `pdfs`.
- A folder needs a Topic record to have an id, and a GET never writes. `ensurePdfFolderTopics` creates the missing Section and
  Topic records and nothing else. It runs from `src/scripts/vidyagramPdfFolderTopics.ts` (dry run by default, `--commit` to write,
  refuses any database but `vidyagramdb`) and from a daily 07:00 IST cron.
- A folder with no Topic record yet is left out of the list. PDFs with a topic but no section name stay in Ebooks only.

## Tested 2026-11-05

Local server on a scratch database seeded from the live public APIs:

| Course | Regular topics | Folders | PDFs on a screen | On two screens |
|---|---|---|---|---|
| UPGK (सारथी बैच) | 6 | Upgk > Printable Practice Workbook (29) | 30 of 30 | 0 |
| RAILWAY EXAMS (no classes) | 0 | RRB NTPC Graduate (1), RRB JE (1) | 2 of 2 | 0 |
| GS Special 4.0 | 33 | GS PLANNER (6), Handwritten Notes PDF (20) | 53 of 53 | 0 |

In all three, regular rows match with and without the parameter, each folder opens with exactly `pdfCount` PDFs, and those items
equal the Ebooks items. Second CLI `--commit` created nothing. Sample: `vidyagram/reports/pdf-folders-sample-response-2026-11-05.json`.

The scratch database holds only records seeded from these courses, so it can't show how many records production needs.

## To check at the production dry run

- **The cron writes on its own.** Once deployed, the next 07:00 IST run creates records with no further step. Deploy and first
  `--commit` are therefore one decision, and the dry run should happen right after the restart.
- **Near-duplicate names.** Matching is exact. If a PDF says `Upgk` and the record is `UPGK`, a second Section is created, and it
  shows in admin dropdowns. Compare the report's `toCreate` names with existing records before `--commit`.
- **Special names.** A placement literally named `All Notes` or `No Topic` would form a folder. None appeared in the top 64
  left-out names on 11-04; `toCreate` lists any others.
- **Ledger.** Record the created ids from `--commit` in `prod-data-changes`.

## Still open

- AppX's own screen for these folders: open UPGK in AppX and confirm "Printable Practice Workbook" is a folder there.
- The app must send `includePdfFolders=1` and handle a topic with no classes. Guide:
  `vidyagram/reference/vidyagram-topic-pdfs-api.md`.
