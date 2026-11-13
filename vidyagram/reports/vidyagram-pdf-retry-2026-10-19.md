# Vidyagram admin-cookie retry — 19 October 2026

Starting verified totals: **9,325 recovered source identities**, **7,675 distinct PDF records**, **889 missing source identities** against the captured 10,214-file target. No PDF importer was active.

The maintained admin signer remained throttled on a fresh test. The user then supplied a new admin session cookie. It was saved only on the bastion in an owner-readable file (mode 600); its value is not included here. A live test successfully signed and downloaded a 2,741,307-byte remaining PDF with a valid `%PDF-` header.

Started a detached recovery using that supplied cookie, the existing 2.5-second signing gap, concurrency 1, exclusive import lock, resumable ledger and bounded throttling backoff. After the admin pass, the supervisor runs attachment-only reconciliation. Saved PDFs are not fetched again.

- Script: `/home/opc/vidyagram/recovery5-2026-10-19.sh`
- Console log: `/home/opc/vidyagram/logs/pdf-recovery5-2026-10-19/run.log`
- Admin CSV, coverage and final summary: `/home/opc/vidyagram/logs/pdf-recovery5-2026-10-19-admin`
- Attachment results: `/home/opc/vidyagram/logs/pdf-recovery5-2026-10-19-attachments`
- Live tab: `PDF admin summary`; counters restart for this pass. The captured target and cumulative saved counts have not been reset.

This records a started recovery; the final summary and ledger determine the outcome.

## Verified result

At 06:36 UTC on 19 October the pass had finished: **397/397 selected files fetched**, 353 new PDF records, 44 same-hash reuses, 362 attachments, zero fetch failures and no throttling. Cumulative database totals: **9,722 recovered source identities**, **8,028 distinct PDF records**. The attachment pass checked all 9,722 saved identities; 6 remain pending note variants. No importer was active.

Scope discrepancy remains unresolved: the pass's coverage file reports `planned: 5189`, `previouslyImported: 9325`, `remaining: 397`, rather than the previous full target of 10,214 and remainder of 889. Thus the cumulative total is still 492 below the original target; do not report the whole migration complete. All 146 course capture documents still say `full-2026-10-13`/`done`. Most raw rows retain that run, but 188 have `lastSeenRunId: daily-2026-10-18`; all 10,390 tree pages and 9,366 content documents retain the full run. These observations alone do not establish the reason for the smaller plan. Read-only reconciliation is needed before another import scope is chosen.
