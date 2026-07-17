# Per-file retry, idempotent completion, target refresh

**Type**: AFK
**Blocked by**: #4 — One-file bulk happy path

## What to build

Failure recovery that never duplicates and never retransmits what already succeeded. Retrying a pending
or retryable-failed file is simply a fresh call to `upload-target` — there is no separate retry command —
and the same call transparently covers an expired presigned credential (the 403-from-B2 case), so the
admin never recreates the batch. Completion is replay-safe: session+file identity carries a unique
constraint, repeating `complete` after success returns the same `pdfId`, and concurrent completion
attempts for one file cannot create duplicate `Pdf` records. Completed files are not retryable; the UI
offers retry only on failed/expired-credential files and re-uploads only that file's bytes.

## Acceptance criteria

- [ ] Retry on a failed file requests a fresh `upload-target`, re-uploads only that file, and can complete successfully; completed siblings untouched
- [ ] Expired presigned URL: `PUT` fails, retry mints a fresh target for the same file, upload succeeds — no batch recreation
- [ ] `upload-target` on a `completed` file (or otherwise wrong state) is rejected with a clear error code
- [ ] Repeating `complete` after success returns the same `pdfId`; DB shows exactly one record (unique constraint on session+file identity proven by a duplicate-insert test)
- [ ] Concurrent `complete` calls for one file: exactly one record, both callers converge on the same `pdfId`
- [ ] Delayed response / double click in the UI cannot create duplicates (frontend treats complete as idempotent)

## User stories covered

- Story 15: retry only a failed file
- Story 16: retries are idempotent, no duplicate records
- Story 17: expired upload credential refreshed automatically on retry
