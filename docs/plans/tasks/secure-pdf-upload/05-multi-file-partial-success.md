# Multi-file bulk: bounded concurrency, partial success, limits

**Type**: AFK
**Blocked by**: #4 — One-file bulk happy path

## What to build

The bulk sheet handles a real batch. The frontend upload coordinator queues all selected files and
uploads at most three concurrently (frontend-configurable, invisible to the server contract), reporting
per-file and aggregate progress through the derived presentation states. Files finalize independently:
one failed file never rolls back, blocks, or retransmits a completed file, and the batch ends in an
explicit summary of completed / failed / expired files — a report, not a transaction. Server-side,
session creation enforces the configurable limits (100 files, 50 MiB per file, 2 GiB declared total)
and rejects an oversized batch **before** issuing any upload target, so no bandwidth is spent on a
doomed operation.

## Acceptance criteria

- [ ] At most 3 concurrent browser uploads; remaining files queue; value tunable in frontend config without server changes
- [ ] Per-file progress (browser upload vs server finalization vs complete) and aggregate batch progress are visible and accurate
- [ ] Mixed batch (valid + invalid + interrupted): failures leave completed files untouched; every completed record Previews via the admin signer
- [ ] Final summary lists completed, failed, and expired files with per-file error codes
- [ ] Session exceeding 100 files, a file over 50 MiB, or declared total over 2 GiB → rejected at session create, before any target is issued, with a clear error
- [ ] Limits read from server configuration, not literals scattered through code
- [ ] Coordinator seam tests cover queueing, concurrency of three, progress, cancellation, and partial success via contract fakes

## User stories covered

- Story 12: aggregate and per-file progress
- Story 13: only a small number of files uploading concurrently
- Story 14: one failed file leaves successful files untouched
- Story 20: explicit final summary of completed, failed, expired
- Story 21: oversized batches rejected before uploading begins
