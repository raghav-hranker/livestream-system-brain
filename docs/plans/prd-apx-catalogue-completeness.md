# PRD: AppX catalogue completeness (QuickTricks, customer 472)

Status: `ready-for-agent` · Owner repo: `quicktricks-backend` (fork, production LMS; see SYSTEM.md → "Deployment note")
Decisions: grilling session 2026-09-29 (memory `apx-catalogue-completeness`). Prior audit: `outputs/apx-content-audit-2026-09-28-v2/`.

## Problem Statement

QuickTricks moved its catalogue from AppX to our platform. Students complain that **videos don't play and PDFs are
missing**. The current audit compares listings by video key and says only 10 classes and 4 notes are missing, but that
number is a floor, not a proof:

- 2,378 rows can't be matched at all. 1,315 AppX classes have an empty video link, and 747 notes sit under them.
- 2,919 platform rows show as "platform only", and many of them are probably the same items seen from the other side.
- The notes porter never reads an AppX class's second PDF (`pdf_link2`), so every second PDF in the catalogue is missing.
- The audit checks only whether an item is listed, not whether it plays. A class can be listed with no video on record, or
  with a record pointing to a file that doesn't exist.
- Nobody has compared AppX buyers against platform access.

The operator can't act on the current report. It lists findings, not what to do. It only arrives after a 27-minute
all-courses run, and it mixes deleted-in-AppX noise with real gaps.

## Solution

A course-by-course completeness pass that turns the audit into an **action list**. Each missing item gets exactly one
action, and the operator approves rows by ticking them. Tools then bring in exactly the approved rows: dry-run first,
then commit, then a re-audit of that course to show the rows have cleared.

- **Actions:** Attach PDF · Add existing class to course · Import class · Fix video · Fix PDF file · Review match.
- **Status:** AppX-disabled items come in **inactive**. AppX-deleted items are not acted on. They go in a separate report
  that the operator compares by hand.
- **Progress:** results appear course by course, busiest courses first, so the operator can start approving before the
  whole catalogue finishes.
- **Approval:** a private page with an Approve tick on every row, plus an xlsx with an Approve column. A row is approved
  if either says so. The dry-run list shown before each write is the final gate.
- **Users:** a separate comparison reports, per course, how many AppX buyers with valid access have none on the platform.
  It shows counts only; the per-person list stays on the box.

## User Stories

1. As the operator, I want each missing item to show one plain action, so that I know what to do without reading audit definitions.
2. As the operator, I want courses ordered by number of buyers, so that the most-watched gaps are fixed first.
3. As the operator, I want each course's results to appear as soon as that course is audited, so that I don't wait for the whole catalogue.
4. As the operator, I want a progress indicator (courses done / total), so that I know how far the pass has got.
5. As the operator, I want to approve rows by ticking them on a page, so that approving is quick.
6. As the operator, I want the same rows in an xlsx with an Approve column, so that I can work offline or share with the content team.
7. As the operator, I want a row approved in either place to count, so that I never have to reconcile the two by hand.
8. As the operator, I want to see the exact dry-run list before anything is written, so that nothing reaches production without my say-so.
9. As the operator, I want each batch followed by a re-audit of that course, so that I can see the rows actually cleared.
10. As the operator, I want AppX classes that are disabled to come in inactive, so that the catalogue is complete without exposing content AppX hid.
11. As the operator, I want AppX-deleted items in a separate report, so that they don't clutter the action list.
12. As the operator, I want the deleted report to say whether each item is already on the platform in another course, so that I don't treat cross-listed items as missing.
13. As the operator, I want the deleted report grouped by course and deleted folder with a summary tab, so that I can compare it quickly against AppX.
14. As the operator, I want unresolved AppX classes matched by title within their course, so that the "missing" count reflects reality.
15. As the operator, I want ambiguous title matches (duplicate titles) marked "Review match", so that they aren't silently guessed.
16. As the operator, I want AppX classes with no video link shown as info rather than an action, so that I don't try to import something that has no video.
17. As the operator, I want every AppX class's notes, both PDFs, checked against the matched platform class, so that missing PDFs are found catalogue-wide.
18. As the operator, I want classes with no video on record flagged "Fix video", so that "video not playing" complaints are caught before students report them.
19. As the operator, I want video and PDF files checked in storage for items that have a record, so that records pointing to nothing are caught.
20. As the operator, I want the storage check to run on the busiest courses first, so that the slow check pays off early.
21. As the operator, I want an AppX class that is already on the platform in another course to be offered as "Add existing class to course", so that we don't transcode it twice.
22. As the operator, I want a genuinely new class imported with its video ingested, so that it plays like migrated classes do.
23. As the operator, I want the second PDF (`pdf_link2`) ported, so that classes with two notes are complete.
24. As the operator, I want re-running any import to create no duplicates, so that retries are safe.
25. As the operator, I want imports to leave the permanent catch-up stop locks untouched, so that the scheduled chains stay off.
26. As the operator, I want the 3 known unattached PDFs (ADVERBS-05, POLLUTION, Human Reproduction Pt 2) done first as a test run, so that the method is proven on something small.
27. As the operator, I want per-course counts of AppX buyers with valid access and no platform access, so that I can grant access to everyone who paid.
28. As the operator, I want expired AppX purchases, disabled-but-unexpired purchases, unmatched users and ambiguous users counted separately, so that the gap count is honest.
29. As the operator, I want the users report to state how fresh the local AppX purchase copy is, so that I know whether it's safe to act on.
30. As the operator, I want no names, phones or emails in any report, page or xlsx, so that personal data never leaves the box.
31. As the operator, I want the parked status mismatches kept on record without being touched, so that they can be decided later.
32. As the operator, I want the action list to show each item's AppX state (enabled/disabled), so that I know whether the import will be active or inactive.
33. As a student who bought a course, I want every class and note the course had on AppX to be there and to play, so that I get what I paid for.

## Implementation Decisions

Everything lives in the fork, beside the committed read-only audit (`scripts/apx-content-audit/`). New write tools live
with the existing AppX porters. Modules:

- **Title matcher (pure, deep).** Input: one course+kind's unresolved AppX rows, platform-only rows and unresolved
  platform rows, each with title and folder position. Output: matched pairs, ambiguous groups and leftovers. Titles are
  compared after folding case and whitespace. A title appearing exactly once on each side is a match. Titles appearing
  more than once on either side are tried by folder position, and anything still uncertain becomes ambiguous. It knows
  nothing about AppX or Mongo.
- **Action classifier (pure, deep).** Input: one course's comparison (key and title matches), note comparison (both PDF
  slots), playability facts, AppX state, and a cross-course presence index. Output: action rows, each with exactly one of
  the six actions or an info marker (no video link in AppX, deleted in AppX). This is the single place that decides what
  an item needs.
- **Cross-course index.** Maps an asset key to every platform course and class that holds it. Used for the "Add existing
  class to course" action and the deleted report's "in another course" column.
- **Playability probe.**
  - Layer 1 reads the database: a class is playable-on-record if it has an `hlsAsset` (or a YouTube redirect), and a note
    or PDF if it has a `pdfAsset`.
  - Layer 2 takes an injected fetcher and sends header requests for the HLS master and PDF object through the same
    signing path playback uses. It is rate-limited and ordered by buyers.
- **Course-by-course runner.** The audit writes one result file per course as it finishes, plus a progress file
  (done/total/current, errors). A run can resume after a failure. `--course-id` still runs a single course.
- **Publishers.**
  - The action-list page is private and holds its rows in the page's shared database. Each finished course's rows are
    upserted there, so the page fills in as the run progresses. Approve ticks are stored per row id.
  - The xlsx exporter writes an action-list workbook with an Approve column, and a separate deleted-in-AppX workbook with
    one tab per group and a summary tab.
- **Approval reader.** Merges page ticks and xlsx Approve cells into one approved set, keyed by a stable row id: AppX
  course + AppX row id + action + PDF slot.
- **Notes porter changes.**
  - Also read `pdf_link2`, keyed so it can't duplicate `pdf_link`.
  - Set status at creation from the AppX state.
  - Accept an explicit approved-row list.
  - Keep dry-run as the default.
- **Targeted class importer (new).**
  - Reads approved Import class / Add existing class to course rows.
  - Reuses the existing class-creation and ingest-job code.
  - Sets status at creation from the AppX state, linking an existing class where one exists.
  - Dry-run by default; writes only with `--commit`.
  - Takes no catch-up lock and never touches the stop locks.
- **Fix actions.** Fix video re-enqueues the video ingest for that class. Fix PDF file re-ports that PDF's bytes. Both
  go through the approved-row list.
- **Users comparison (separate tool).**
  - Source: the local AppX purchase copy (`apx_orders_new`).
  - People are linked through the existing AppX user map, then the existing email/phone buyer resolution.
  - Access is worked out by the same rules the app uses (successful, enabled, unexpired order, direct or via plan).
  - Groups per course: has access / gap / AppX expired / AppX disabled-unexpired / no platform user / ambiguous user /
    item not mapped to a course.
  - Outputs counts only; the per-person gap list stays on the box. Grants use the existing purchase backfill, with approval.
- **Order of work:**
  1. the 3 known PDFs;
  2. all Attach PDF rows;
  3. Fix video and Fix PDF file;
  4. Add existing class to course;
  5. Import class;
  6. user grants.

  Every batch goes dry-run → approval → commit → re-audit of the affected courses.
- **Preconditions:** a live AppX session (the operator logs in with the OTP) is needed for AppX reads and PDF downloads.
  Building and testing the modules above doesn't need it, and neither does publishing results already fetched.

## Testing Decisions

- Test external behaviour through each module's interface: rows in, pairs or actions out. Don't test internals.
- Tests run with `node --test`, fixtures inline, like the existing `audit.test.cjs`.
- **Title matcher:**
  - a unique pair matches;
  - a duplicate title becomes ambiguous;
  - folder position resolves duplicates;
  - case and whitespace are folded;
  - a PDF title never matches a class.
- **Action classifier:** one test per action and info marker, including:
  - a disabled AppX item gives an action with the inactive target;
  - an item deleted in AppX never produces an action;
  - an item in another course gives Add existing, not Import;
  - a class with a record but no stored file gives Fix video.
- **Approval reader:** union semantics, and stable row ids.
- **Porter/importer changes:** idempotency (a second dry-run after commit plans zero writes), status-at-creation, and
  `pdf_link2` keying. Test against the injected persistence seams the porters already use; where none exists, add one
  rather than hitting Mongo.
- **Users comparison:** each group from fixture purchases/orders, including plan-based access and `expireDate`-null never expiring.

## Out of Scope

- Changing platform status on existing items. The status mismatches are parked; see `reference/apx-status-mismatches-2026-09-28.md`.
- Acting on AppX-deleted items (report only).
- Re-enabling the scheduled AppX catch-up chains or removing their stop locks.
- Standalone ebooks (11/11 already matched) and test series / packages.
- Logging in to AppX. The operator does it.
- Duration-based matching (neither side records duration today).

## Further Notes

- The AppX listing `get_pc4_contents` returns items under deleted folders, so visibility must use the folder check the
  audit already implements. See memory `apx-deleted-folder-content`.
- An inactive course is still watchable by its buyers (memory `inactive-course-keeps-buyer-access`), so gaps in inactive
  courses count. The priority is by buyers, not course status.
- AppX session death shows as 307 → /login. A course hit by it is marked incomplete and retried on its own.
