# Bulk E2E + prerecorded-arc smoke

**Type**: HITL
**Blocked by**: #5

## What to build

No new code — the closing acceptance run. A real bulk batch through the sheet, plus the
prerecorded-arc smoke test the launch handoff calls for.

**Bulk run:** select several MP4s in the bulk-upload sheet → classes created against
nodejs-server → rooms batch-created in the quicktricks livestream backend → all files
upload concurrently with per-file progress → every object lands in
`tempvideos-recorded-v2` → each fires the webhook independently → all reach `hlsAsset` +
MP4 sets → each plays in the `ls` viewer. Kill one file mid-upload to prove per-file
retry/failure isolation: the batch's other files must complete unaffected.

**Smoke checklist (prerecorded arc):** one class from the batch, verified end to end —
`hlsAsset` present and pointing at the recorded bucket, `/playback` mints, plays signed,
unsigned fetch 403s, recordings set present. This closes the "upload videos" half of the
launch goal; the live-arc smoke (OBS → ended → Go Live) remains part of the launch
wrap-up, not this slice.

## Acceptance criteria

- [ ] Bulk batch: N files → N classes, N rooms, N processed videos, zero manual assists
- [ ] One deliberately interrupted file retries or fails alone; siblings complete
- [ ] Every batch class plays signed in the `ls` viewer; spot-check unsigned 403
- [ ] SSE reflects each file's processing state independently
- [ ] Results + any quirks recorded here; deviations become follow-up tasks, not silent fixes

## User stories covered

- Story 2: a course's worth of content migrated in one sitting
- Story 5: per-file processing visibility
- Story 6: clear per-file failure, no silent loss
- Story 10: recordings reported securely for every file
- Story 17: rooms in the right tenant's backend
