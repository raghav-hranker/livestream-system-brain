# Idempotent legacy-note migration

**Type:** AFK  
**Status:** `ready-for-agent`  
**User stories:** 19–20, 47–50

## Parent

[PRD: LMS-Owned Personal Notes with Media Parity](../../prd-lms-owned-personal-notes.md)

## What to build

Build an operational tracer that audits and migrates legacy personal notes from livestream Mongo and
the old notes-media bucket into LMS Notes and the private `notes` zone. It supports dry-run and commit
modes, is safe to resume, preserves ownership/class association/content/title/media type/timestamps and
identifiers where feasible, verifies copied bytes, and emits a privacy-safe reconciliation report.

Every source record reaches one explicit outcome: migrated, already migrated, deliberately skipped
with reason, or quarantined with a retryable error. Re-running the tool cannot duplicate records or
objects. The tool must prove a zero-row result rather than relying on the original greenfield
assumption.

## Acceptance criteria

- [ ] Dry-run reports source record counts grouped by relevant class/media state without writing LMS records or objects.
- [ ] Commit mode migrates text-only, image, and audio notes into the final LMS schema and private storage contract.
- [ ] Migrated records preserve user/class ownership, title/content, media type, timestamps, and source identifier where feasible.
- [ ] Copied media is verified by byte length and checksum/sample validation before the target record is declared migrated.
- [ ] Repeated or resumed runs are idempotent and do not duplicate Notes or media objects.
- [ ] Every source row appears in reconciliation as migrated, already migrated, skipped with reason, or quarantined with retryable error.
- [ ] Reports and logs redact note content, user-identifying paths, credentials, bearer tokens, and signed URLs.
- [ ] Tests exercise mixed fixtures, missing objects, corrupt media, duplicate execution, partial failure, and recovery through the real migration seam.

## Blocked by

- [Task 04: Media edit, expiry, deletion, and cleanup](./04-media-lifecycle-and-cleanup.md)
