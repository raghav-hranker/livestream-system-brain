# Private audio-note parity

**Type:** AFK  
**Status:** `ready-for-agent`  
**User stories:** 6–7, 9, 20, 26–28, 34, 41, 44, 52

## Parent

[PRD: LMS-Owned Personal Notes with Media Parity](../../prd-lms-owned-personal-notes.md)

## What to build

Carry the proven private image-note path through the full audio behavior used by the student viewer.
A student can record or attach an audio note with the current multipart contract, the LMS validates the
actual audio container, stores it as a private `noteMediaAsset`, and returns a freshly signed exact-file
`mediaUrl` that plays through the existing audio control. Media-only audio notes remain supported.

The audio implementation shares the same notes storage, signing, serialization, error, and atomicity
seams as image notes. It must not introduce a second uploader or expose a permanent public audio URL.

## Acceptance criteria

- [ ] The existing student UI can create, list, and play WebM, AAC, MPEG/MP3, WAV, Ogg, and MP4 audio notes through the LMS.
- [ ] Audio-only notes work without requiring additional user-entered text and retain the current user-visible fallback behavior.
- [ ] Audio records persist a private `noteMediaAsset` and derive a fresh exact-file `mediaUrl`; Mongo contains no permanent URL.
- [ ] Declared MIME and actual bytes/container are validated for every supported audio format.
- [ ] Spoofed, empty, unsupported, multiple, and oversized audio files fail before a ready note is created.
- [ ] Upload, persistence, signing, and normalized failure behavior reuse the image-note storage seam.
- [ ] Contract and browser-level tests prove the existing audio element can consume the signed response without custom storage knowledge.

## Blocked by

- [Task 02: Private image-note tracer](./02-private-image-note-tracer.md)
