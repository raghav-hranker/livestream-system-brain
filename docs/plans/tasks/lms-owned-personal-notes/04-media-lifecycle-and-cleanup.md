# Media edit, expiry, deletion, and cleanup

**Type:** AFK  
**Status:** `ready-for-agent`  
**User stories:** 11–13, 28, 44–46, 49, 52–54

## Parent

[PRD: LMS-Owned Personal Notes with Media Parity](../../prd-lms-owned-personal-notes.md)

## What to build

Complete the private attachment lifecycle after image and audio creation. Editing note title or text
preserves the existing asset exactly. Every create, list, or update serialization mints a fresh signed
URL with the configured lifetime, so a list reload recovers a long-open class screen after expiry.
Deleting an owned note removes user access immediately and then removes its private object; provider
failure produces durable, idempotent cleanup work that survives restart and is visible through safe
operational metrics.

Exercise the lifecycle through the real LMS API and existing student notes UI, including a forced
storage-deletion failure and subsequent successful cleanup. Logs and metrics report outcomes and
backlog counts without exposing note contents, identities, tokens, signed URLs, or storage secrets.

## Acceptance criteria

- [ ] Editing title or content preserves the note's `noteMediaAsset` byte-for-byte and returns a fresh signed `mediaUrl`.
- [ ] Reloading the notes list after URL expiry produces a newly valid exact-file URL for image and audio rendering.
- [ ] Deleting a note makes it unavailable to the owner immediately even when object deletion fails.
- [ ] Failed object deletion creates durable retryable cleanup work that survives process restart and is safe to execute repeatedly.
- [ ] Cleanup removes only the intended unreferenced object and records a stable success/failure outcome.
- [ ] Storage URL lifetime, upload size, and cleanup retry behavior are configurable without code changes.
- [ ] Structured metrics cover CRUD, validation, upload, signing, and cleanup backlog without logging private content or credentials.
- [ ] End-to-end tests force expiry and provider failure through public module/API seams rather than asserting helper call order.

## Blocked by

- [Task 02: Private image-note tracer](./02-private-image-note-tracer.md)
- [Task 03: Private audio-note parity](./03-private-audio-note-parity.md)
