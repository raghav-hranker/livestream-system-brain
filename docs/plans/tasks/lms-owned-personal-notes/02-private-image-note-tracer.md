# Private image-note tracer

**Type:** AFK  
**Status:** `ready-for-agent`  
**User stories:** 5, 7–8, 27–28, 34–35, 39–44, 52, 56

## Parent

[PRD: LMS-Owned Personal Notes with Media Parity](../../prd-lms-owned-personal-notes.md)

## What to build

Extend the LMS text tracer into one complete private image-note path. A student submits the existing
multipart image note from the student viewer, the LMS validates and stores the bytes in the logical
`notes` zone on private B2, persists an opaque `noteMediaAsset`, and returns an exact-file signed Bunny
URL in the compatibility `mediaUrl` field. The existing notes panel renders the image without learning
bucket names, object keys, credentials, or a new UI contract.

Introduce the storage decision at the point it becomes executable: add the shared `noteMediaAsset` and
logical `notes` vocabulary and record any ADR required to distinguish personal-note media from PDF
documents. Reuse or extract the LMS's established private-storage and exact-file-signing seams rather
than embedding provider behavior in notes controllers.

## Acceptance criteria

- [ ] The existing student UI can create and immediately render a JPEG, PNG, GIF, or WebP note through the LMS compatibility route.
- [ ] A media-only image note is accepted, while a note with neither content nor valid media is rejected.
- [ ] The LMS persists only a logical `noteMediaAsset` with opaque server-generated key, MIME type, real byte size, and optional checksum.
- [ ] The stored key contains no user ID, class ID, title, or original filename, and no permanent fetchable URL is stored in Mongo.
- [ ] List and create responses mint exact-file signed `mediaUrl` values that cannot authorize a sibling object.
- [ ] MIME spoofing, invalid signatures, empty files, multiple attachments, unsupported images, and files over the configured limit fail before a ready note is published.
- [ ] Storage or database failure cannot return a half-ready note; any post-upload orphan is recorded for cleanup.
- [ ] Shared vocabulary/decision documentation distinguishes personal note media from class-attached PDF notes.

## Blocked by

- [Task 01: Authenticated LMS text-notes tracer](./01-authenticated-lms-text-notes-tracer.md)
