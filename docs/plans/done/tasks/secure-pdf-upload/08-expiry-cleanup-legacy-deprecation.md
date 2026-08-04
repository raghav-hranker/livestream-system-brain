# Expiry, cleanup, config knobs + legacy bulk deprecation

**Type**: AFK
**Blocked by**: #4 — One-file bulk happy path

## What to build

Sessions end predictably and leave no waste. An incomplete session accepts uploads/finalization for
24 hours, then its non-completed files and the session expire; completed session history stays queryable
for seven days for reconciliation. A cleanup process expires stale files/sessions and removes B2 objects
that belong to abandoned sessions **and are not referenced by any PDF record** — it must never delete an
object a record points to. Upload limits, credential TTL, and retention windows are server-configurable
so production tuning needs no code change. The UI shows expired files distinctly in the batch summary.

This slice also retires the legacy URL-based bulk path: after checking for remaining callers, the old
`BulkUploadPdfsSheet` URL flow and `app/api/pdfs/bulk-create/route.ts` are removed (or hard-deprecated
if a caller is found — surface it rather than silently breaking it).

## Acceptance criteria

- [ ] Work against an incomplete session past 24 h is rejected (`expired` states); completed session history queryable for 7 days
- [ ] Cleanup removes objects from abandoned sessions with no referencing PDF record; objects referenced by any record are provably never deleted (test the guard)
- [ ] TTL (15 min), limits (100 / 50 MiB / 2 GiB), and retention (24 h / 7 d) all read from server configuration
- [ ] Expired files appear distinctly in the UI batch summary and are not silently retryable
- [ ] Legacy URL-based bulk-create route removed or hard-deprecated after a caller check; no frontend code path reaches it
- [ ] Existing signed-read regression seam still green (serializer leak tests, signer golden vectors)

## User stories covered

- Story 22: abandoned sessions expire predictably
- Story 32: abandoned uploaded objects cleaned after a defined retention window
- Story 33: upload limits and credential lifetimes configurable
- Story 25 (closes): secure delivery cannot regress through authoring tools — no URL-based create path remains
