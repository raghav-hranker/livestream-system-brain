# `ls` viewer notes parity

**Type:** AFK  
**Status:** `ready-for-agent`  
**User stories:** 21–30, 33–34, 54

## Parent

[PRD: LMS-Owned Personal Notes with Media Parity](../../prd-lms-owned-personal-notes.md)

## What to build

Give the `ls` class viewer the same complete LMS-owned text, image, and audio notes lifecycle already
proven in the student viewer. Its shared notes adapter uses the LMS base and the same user-bearing Auth
access token used for protected LMS requests, while all socket and real-time behavior remains pointed
at livestream. Existing notes call sites and visible text behavior remain compatible; the notes UI can
also create/render the media types promised by this PRD.

Use the shared compatibility examples to ensure `ls`, the student viewer, and both LMS route families
agree on paths, multipart fields, envelopes, note IDs, and signed `mediaUrl` behavior.

## Acceptance criteria

- [ ] An authenticated `ls` user can create, list, edit, and delete text notes against the LMS without supplying authoritative `userId` data.
- [ ] The `ls` notes UI can create and render the supported image and audio notes with behavior matching the student viewer.
- [ ] Its notes adapter attaches the existing LMS Auth access token and handles the documented compatibility/canonical envelopes during transition.
- [ ] Only the notes API base changes; chat, polls, presence, realtime-token exchange, and socket connection remain on their established services.
- [ ] Expired media recovers through a notes refresh and a text edit never clears an existing attachment.
- [ ] Shared contract tests run against both viewer adapters and fail on path, payload, envelope, or serialization drift.
- [ ] Existing `ls` playback, chat, and socket tests remain green.

## Blocked by

- [Task 04: Media edit, expiry, deletion, and cleanup](./04-media-lifecycle-and-cleanup.md)
