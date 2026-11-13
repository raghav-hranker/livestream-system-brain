# Vidyagram PDF recovery retry — 18 October 2026

User requested another admin-cookie sync, or an update if already complete.

## Verified starting state

- Captured target: 10,214 source file identities.
- Recovered: **8,832 source identities**, represented by **7,231 distinct PDF records**.
- Missing: **1,382 source identities**.
- Last alternate-cookie run recovered 499 files (169 new PDFs, 330 same-hash reuses), then stopped on signer throttling. Its attachment pass checked all 8,832 saved identities; 10 remained pending note variants.
- No PDF recovery worker was active when checked.

## Session preflight

The maintained Vidyagram admin session was active, with latest keepalive HTTP 200. It signed and downloaded a remaining 2,840,907-byte PDF with a valid `%PDF-` header.

The saved alternate cookie returned a login redirect (HTTP 307 / `SessionLost`), so it was not used for the new run. No credentials, signed URLs, or encryption keys were printed or added to this record.

## Restart

Started a detached recovery under the existing exclusive PDF-import lock, using the maintained database session. `APX_SIGNER_SESSION_FILE` is explicitly empty so the expired alternate file cannot be selected. The runner keeps the 2.5-second signing gap, concurrency 1, bounded throttle backoff and stop behavior, and skips existing PDF records.

- Supervisor script: `/home/opc/vidyagram/recovery4-2026-10-18.sh`
- Console log: `/home/opc/vidyagram/logs/pdf-recovery4-2026-10-18/run.log`
- Admin CSV, coverage and final summary: `/home/opc/vidyagram/logs/pdf-recovery4-2026-10-18-admin`
- Follow-up attachment reconciliation: `/home/opc/vidyagram/logs/pdf-recovery4-2026-10-18-attachments`
- Sheet: `PDF admin summary` during the admin pass, `PDF summary` for the final saved-file attachment check. Counters describe each pass, not cumulative unique PDF counts.

This is a running retry, not a completed recovery. Final outcomes come from the ledger and summary files.
