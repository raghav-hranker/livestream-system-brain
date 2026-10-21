# PRD: LMS-Owned Personal Notes with Media Parity

**Status:** `ready-for-agent`

## Problem Statement

Students can create personal notes while watching a live or recorded class, but the production notes system still belongs to the livestream/socket service as a Room-era leftover. Note metadata is stored in livestream Mongo, image and audio files are uploaded with livestream storage credentials, and the API trusts a client-supplied `userId` when selecting or mutating notes. Personal study artifacts are durable LMS content, not real-time streaming state, and a caller must not be able to claim another user's identity in a request.

An earlier migration implemented an LMS-owned, authenticated, text-only notes resource on isolated task branches. That implementation was never merged into the active branches or the deployed QuickTricks LMS. It also removed image/audio support and introduced response-shape differences that do not match the existing frontend clients. Blindly merging it would therefore break current functionality.

The system needs to complete the ownership move without changing what students can do or forcing frontend call sites onto a new notes contract. Both current viewer surfaces must continue to create, list, edit, and delete notes; image and audio notes must remain usable; and frontend integrations should only need to repoint their notes API base and use the LMS authentication mechanism they already use for protected class content.

## Solution

Make the LMS the durable owner of personal-note metadata, authorization, media storage, and media delivery. The LMS will expose canonical class-scoped notes routes and legacy-compatible aliases backed by the same notes module. The aliases will preserve the existing paths, multipart field names, response envelopes, and user-visible behavior so current frontend call sites do not change.

Every operation will require a valid user-bearing LMS Auth access token. Ownership will be derived exclusively from the validated token; any legacy `userId` supplied in a body or query will be ignored or rejected. The frontend notes adapters will switch from the socket base to the LMS base and centrally attach the same LMS bearer token already used for protected playback and document access.

Text and metadata will live in an LMS `Note` record. Image and audio bytes will live in a private logical `notes` storage zone backed by B2. The record will store an opaque asset reference rather than a permanent URL. Create and list responses will mint fresh exact-file signed Bunny URLs into the compatibility `mediaUrl` field, allowing the existing image and audio elements to keep working without learning storage details.

Before cutover, production data will be audited and, if present, copied from livestream Mongo and the old media bucket into the LMS and private notes zone. The LMS will be deployed first, existing data reconciled, both viewers repointed, and production traffic verified before the livestream notes routes, model, and uploader are removed.

## User Stories

1. As a student, I want to create a text note during a live class, so that I can record an idea without leaving the class screen.
2. As a student, I want to create a text note during a recorded class, so that the same study workflow works after the live session ends.
3. As a student, I want to give a note an optional title, so that I can recognize it later.
4. As a student, I want an untitled text note to receive a useful automatic title, so that my notes list remains understandable.
5. As a student, I want to attach an image to a note, so that I can preserve a diagram, screenshot, or handwritten explanation.
6. As a student, I want to attach an audio recording to a note, so that I can capture an explanation faster than typing it.
7. As a student, I want to create a media note without additional text, so that an image or recording can stand on its own.
8. As a student, I want image notes to display directly in the notes panel, so that moving storage services does not change how I use them.
9. As a student, I want audio notes to play directly in the notes panel, so that moving storage services does not change how I use them.
10. As a student, I want my notes listed newest-updated first, so that recently edited work remains easy to find.
11. As a student, I want to edit a note's text and title, so that I can improve it after the class.
12. As a student, I want a text edit to preserve an existing image or audio attachment, so that changing words cannot accidentally destroy media.
13. As a student, I want to delete a note, so that it disappears immediately from my account.
14. As a student, I want my notes to remain available after a livestream ends, so that they behave as lasting study artifacts rather than room state.
15. As a student, I want notes for one class separated from notes for another class, so that each class has its own study context.
16. As a student, I want only my account to list or change my notes, so that personal study material remains private.
17. As a student, I want a terminated login session to lose notes access, so that an old device cannot continue reading my private notes.
18. As a student, I want invalid or expired authentication to produce a clear failure rather than silently saving under the wrong identity.
19. As a student, I want existing notes preserved during the migration, so that the architectural cleanup does not erase my work.
20. As a student, I want existing images and audio to remain viewable after migration, so that old notes are not degraded to text-only records.
21. As a student, I want notes to keep working in both current class viewers, so that the experience is consistent regardless of which frontend I entered through.
22. As a frontend developer, I want the existing notes paths and request fields accepted by the LMS, so that I do not have to rewrite notes UI components.
23. As a frontend developer, I want the existing notes response envelopes preserved on compatibility routes, so that current parsers do not break at cutover.
24. As a frontend developer, I want to change the notes service base without changing chat, polls, or socket configuration, so that only the feature being migrated moves to the LMS.
25. As a frontend developer, I want authentication attached inside the shared notes adapter, so that individual components do not thread tokens through every interaction.
26. As a frontend developer, I want JSON text creation and multipart media creation both supported, so that the two existing viewer clients can share one backend capability.
27. As a frontend developer, I want a ready-to-render `mediaUrl` in note responses, so that ordinary image and audio elements do not need custom authenticated download code.
28. As a frontend developer, I want signed media URLs refreshed whenever notes are fetched, so that persisted notes do not depend on stale URLs.
29. As an integration developer, I want canonical LMS routes in addition to compatibility aliases, so that new clients can use class-oriented vocabulary without perpetuating Room terminology.
30. As an integration developer, I want both route families backed by one domain module, so that authentication, storage, and behavior cannot drift.
31. As the business, I want personal notes owned by the LMS, so that durable study content lives with the rest of the student's learning state.
32. As the business, I want the livestream service to return to real-time responsibilities only, so that unrelated content features do not expand its security and storage surface.
33. As the business, I want existing frontend behavior preserved, so that the migration does not impose product regressions on students.
34. As the business, I want image and audio parity included at launch, so that a technical migration does not remove a currently advertised capability.
35. As the business, I want note media stored privately, so that a permanent public URL cannot bypass user ownership.
36. As the business, I want old client-supplied `userId` values to have no authority, so that one student cannot impersonate another by editing a request.
37. As the business, I want the old service retired only after production acceptance, so that the cutover remains reversible.
38. As a security engineer, I want note ownership derived from a validated Auth access token, so that identity has one trustworthy source.
39. As a security engineer, I want exact-file media credentials, so that access to one note attachment cannot unlock sibling objects.
40. As a security engineer, I want storage keys opaque and server-generated, so that user IDs, class IDs, and filenames do not leak through object paths.
41. As a security engineer, I want the backend to validate actual media bytes as well as claimed MIME type, so that renamed or spoofed files are rejected.
42. As a security engineer, I want B2 credentials and physical bucket details to remain server-only, so that browser code receives no durable storage authority.
43. As an operations engineer, I want note media isolated under a logical storage zone, so that credentials, hosts, and physical buckets can change without rewriting database records.
44. As an operations engineer, I want media limits and signed-URL lifetime configurable, so that production can be tuned without code changes.
45. As an operations engineer, I want failed object cleanup retried durably, so that deletion failures do not create unbounded orphan storage.
46. As an operations engineer, I want logs and metrics for note CRUD, upload failures, signing failures, and cleanup backlog, so that production problems can be diagnosed without reading private content.
47. As an operations engineer, I want a count-and-hash migration reconciliation, so that I can prove which source records and objects were transferred.
48. As an operations engineer, I want a rollback window for the old collection and objects, so that a cutover fault does not require reconstructing deleted data.
49. As a support engineer, I want stable error categories for authentication, validation, missing classes, missing notes, storage failures, and expired media, so that user reports can be triaged consistently.
50. As a support engineer, I want migrated notes to retain timestamps and identifiers where feasible, so that reports can be correlated across the cutover.
51. As a developer, I want storage, signing, persistence, authorization, and serialization hidden behind one notes module, so that controllers remain thin and provider details do not leak across the LMS.
52. As a developer, I want failed uploads to avoid creating half-ready note records, so that database state never advertises missing media.
53. As a developer, I want a text-only update to leave its asset reference byte-for-byte unchanged, so that metadata changes are safe.
54. As a developer, I want compatibility-contract tests shared across LMS and frontend adapters, so that path, payload, and response drift fails before deployment.
55. As a developer, I want the isolated task-branch work treated as prior art rather than a merge assumption, so that current production changes and missing functionality are reconciled deliberately.
56. As a future maintainer, I want personal notes distinguished from class-attached PDF notes, so that the two features do not accidentally share models, permissions, or serializers.

## Implementation Decisions

- **Ownership boundary.** Personal notes are LMS content. The LMS owns note metadata, identity enforcement, media assets, signed delivery, deletion, and migration state. The livestream service is not a persistence or media proxy after cutover.
- **One cross-repository vertical slice.** Upstream LMS, deployed LMS fork, both viewer clients, and livestream retirement are coordinated parts of one capability. A repository leg is not complete merely because its local tests pass.
- **Canonical resource model.** A note belongs to one authenticated user and one LMS `Class`. It carries an optional title, optional content when media exists, timestamps, and at most one optional media asset.
- **Personal notes are not PDF notes.** Class-attached study PDFs continue to use the existing `Pdf` and `pdfAsset` contracts. Personal note attachments use a distinct `noteMediaAsset` contract and logical `notes` zone.
- **Asset-reference invariant.** A note media asset contains logical bucket `notes`, opaque key, validated MIME type, real byte size, and optional SHA-256. It never contains a provider credential, physical bucket name, CDN host, permanent URL, entitlement result, or expiry.
- **Private storage.** The logical `notes` zone is backed by private B2 storage. It may share the physical private-assets bucket with the `documents` zone while using a separate object prefix and independent configuration where operational isolation is useful. It does not use public R2 or the live HLS origin.
- **Opaque object keys.** The server generates random keys under the notes zone. New keys contain no user ID, class ID, title, or original filename.
- **Exact-file signed delivery.** The LMS mints an exact-file Bunny credential for each attachment. A signed URL for one object cannot grant directory or sibling-object access.
- **Compatibility `mediaUrl`.** Database records store only `noteMediaAsset`. API serializers derive a fresh signed URL and expose it as `mediaUrl` so existing `<img>` and `<audio>` rendering continues unchanged.
- **Media URL lifetime.** Note-media URL lifetime is configurable and defaults to six hours, long enough for a typical class screen while keeping copied-link exposure bounded. Every list/create/update response mints a fresh URL. Reloading the list is the supported re-mint operation after expiry.
- **Canonical LMS routes.** New clients use class-scoped list/create routes and note-scoped update/delete routes under the standard LMS API namespace.
- **Compatibility aliases.** The LMS also mounts the existing `/api/v1/room/:classId/notes` and `/api/v1/notes/:noteId` shapes as aliases. “Room” is wire compatibility only; it does not create a Room domain model or restore livestream ownership.
- **One implementation behind both route families.** Canonical and compatibility routes share authorization, validation, persistence, storage, signing, cleanup, and migration code. Only request/response adaptation differs.
- **Response compatibility.** Compatibility list returns top-level `{notes}`; create and update return `{message,note}`; delete returns `{message}`. Canonical routes use the standard LMS response envelope. Note serialization preserves the fields existing clients consume, including normalized `id`, title, content, media fields, class ID, and timestamps.
- **Dual input forms.** Create accepts JSON for text notes and multipart form data for text/image/audio notes. Compatibility multipart field names remain `title`, `content`, `image`, `audio`, and legacy `userId`.
- **Identity source.** A valid LMS Auth access token is required for every notes operation. Ownership is derived only from its user-bearing identity. Streamer-only or identityless tokens are rejected. A body/query `userId` is ignored or rejected and never influences selection, creation, update, or deletion.
- **Frontend compatibility interpretation.** UI components and call sites retain their existing method, path, payload, and response assumptions. The shared notes adapter changes its notes base and centrally attaches the existing LMS bearer token. No anonymous compatibility mode is introduced.
- **Feature-specific base.** The student client changes only the notes helper's base. Global socket, chat, poll, presence, and media-history bases remain pointed at the livestream service.
- **Class validation.** Creating or listing notes requires a real LMS Class. Note-by-ID mutations resolve the stored class and owner. This PRD does not add a new purchase-entitlement rule that could make a student's own durable notes disappear when course access changes.
- **Ordering and titles.** Lists are sorted by `updatedAt` descending. When title is absent and text exists, the first line or first 50 characters supplies the title, matching current behavior.
- **Media parity.** Supported images are JPEG, PNG, GIF, and WebP. Supported audio is WebM, AAC, MPEG/MP3, WAV, Ogg, and MP4 audio. A note has at most one attachment.
- **Media-only notes.** Content may be empty when a valid image or audio file is present. A note with neither content nor media is rejected.
- **Upload limit.** The default maximum attachment size remains 100 MiB for behavioral parity and is server-configurable. The server enforces the real byte count, not only declared metadata.
- **Content validation.** The LMS validates declared MIME, extension where useful, and actual file signature/container before publishing a note. Browser-provided MIME and filename are untrusted.
- **Atomic create.** Media validation and storage complete before the ready Note record is created. A database failure after object upload records durable cleanup work; no response advertises a usable note until persistence succeeds.
- **Update semantics.** Update changes title/content only and preserves any media asset. Media replacement and multiple attachments are not added by this migration.
- **Delete semantics.** Owner-authorized deletion removes the Note record and user access immediately, then attempts object deletion. Failure creates durable retryable cleanup work and does not restore the note.
- **Storage module boundary.** B2 configuration, upload, deletion, opaque key generation, checksum calculation, Bunny signing, and normalized provider errors live behind a server-side interface. Controllers do not know provider credentials or physical topology.
- **Migration audit supersedes the zero-data assumption.** Production remained on the old system after the earlier task, so current source records and objects must be counted before cutover. Zero migration work is allowed only when backed by recorded evidence.
- **Migration fidelity.** Backfill preserves user ownership, class association, text, title, media type, created/updated timestamps, and note identifiers where feasible. Media is copied into the private notes zone and represented by a new asset reference rather than carrying forward a permanent URL.
- **Migration reconciliation.** Each source row ends as migrated, deliberately skipped with a reason, or quarantined with a retryable error. Counts and sampled hashes/byte lengths are recorded without logging note content, tokens, or credentials.
- **Cutover consistency.** Perform an initial copy, temporarily stop legacy note writes for a short final-delta reconciliation, switch both viewers to the LMS, and reopen writes against the LMS. The maintenance window and rollback trigger are explicit in the launch runbook.
- **Rollback retention.** Old Mongo records and bucket objects remain untouched for a defined rollback window after successful cutover. Initial deployment does not destructively remove production data.
- **Safe deployment order.** LMS capability and configuration deploy first; migration and reconciliation follow; viewer adapters repoint next; production acceptance and old-route traffic observation follow; livestream deletion lands last.
- **Branch landing.** Upstream slice work follows the active shared branch discipline. Production LMS changes are explicitly ported to its independent deploy-fork branch; the deploy fork is never silently assumed to follow the shared branch.
- **Legacy LMS proxy retirement.** The production LMS's current Room-note proxy is replaced by real LMS-owned compatibility handlers. It must not continue forwarding writes to livestream after cutover.
- **Livestream retirement.** Once production traffic reaches zero and rollback criteria are satisfied, remove the notes route, Note model, route mount, and notes-specific uploader usage from livestream. Shared chat-media upload behavior remains untouched.
- **Observability and privacy.** Emit structured counts and failure codes for CRUD, validation, storage, signing, migration, and cleanup backlog. Do not log note text, raw audio/image bytes, bearer tokens, signed URLs, storage credentials, or personally identifying object paths.

## Testing Decisions

- A good test asserts externally visible behavior at the highest stable seam: HTTP status and response shape, persisted note/asset outcome, signed object access, frontend-observable rendering contract, migration reconciliation, and production cutover behavior. Tests do not pin private helper order or provider SDK call choreography.
- **LMS HTTP seam:** exercise canonical and compatibility routes through the real routing and authentication chains. Assert CRUD, both response envelopes, identity derivation, class validation, sorting, title generation, and stable error behavior.
- **Authorization seam:** prove tokenless, invalid, expired, identityless, and terminated-session requests fail. Prove a forged `userId` cannot read, create for, update, or delete as another user.
- **Notes module seam:** use injected persistence and storage adapters to test atomic create, asset preservation on text update, immediate access removal on delete, normalized failures, and durable cleanup scheduling.
- **Media-storage seam:** test opaque key generation, physical/logical bucket separation, supported signatures, actual size enforcement, checksums, exact-file signing, configurable expiry, provider failures, and object deletion through the module interface.
- **Compatibility-contract seam:** run the same captured request/response examples against LMS aliases and both frontend adapters. Contract drift in paths, multipart fields, note serialization, or envelopes must fail before merge.
- **`ls` adapter seam:** prove requests use the LMS base and viewer Auth token, parse both expected envelopes during transition, omit authoritative `userId`, and leave socket/chat traffic unchanged.
- **Student-client adapter seam:** prove existing note call sites remain unchanged while the shared adapter uses the LMS notes base plus authenticated fetch for JSON, multipart, and delete requests. Assert the global socket base is not repointed.
- **Browser media seam:** render returned image/audio signed URLs in the existing notes UI, verify successful load/play, and verify a fresh notes fetch produces a usable URL after expiry.
- **Migration seam:** run the migration against captured source records and a fake/private storage adapter. Assert idempotency, preserved metadata/timestamps, object-copy verification, explicit quarantine, and reconciliation totals.
- **Deletion/cleanup seam:** prove a deleted note becomes inaccessible even when object deletion fails, cleanup work survives restart, repeated cleanup is safe, and only the intended unreferenced object is removed.
- **Regression seam:** existing playback, PDF signed delivery, chat media, polls, socket connection, and live HLS tests remain green, proving notes did not absorb or repoint unrelated contracts.
- **Production acceptance seam:** after LMS deployment and data reconciliation, exercise text/image/audio create, list, update, and delete through both viewer surfaces; verify signed media delivery; verify old socket notes traffic reaches zero before removal.
- Backend media cases include JPEG, PNG, GIF, WebP, WebM, AAC, MP3/MPEG, WAV, Ogg, and MP4 audio; MIME spoofing, invalid signatures, empty bytes, multiple files, unsupported formats, and files above the configured limit are rejected before a ready Note is published.
- Response tests verify that Mongo/storage references, physical bucket names, permanent URLs, credentials, and sibling-unlocking token scopes never leak through canonical or compatibility serializers.
- Prior art is the LMS's injected-dependency signed-access modules, exact-file signer golden vectors, private document-storage tests, thin-controller tests, session-aware authentication tests, and existing frontend authenticated-fetch adapters. Extend these seams rather than creating implementation-coupled suites.

## Out of Scope

- Class-attached PDF notes, PDF migration, PDF upload sessions, or changes to the `Pdf.pdfAsset` contract.
- Chat attachments, chat media history, polls, presence, realtime-token behavior, live HLS, recordings, or playback contracts.
- Video attachments, arbitrary files, rich text, handwriting tools, transcription, waveform processing, media editing, or more than one attachment per note.
- Replacing or removing an attachment during note update; this migration preserves the existing attachment while editing text/title.
- A new notes UI, visual redesign, changed component hierarchy, or new end-user workflow.
- Permanent public delivery, public R2 storage, or storing signed/permanent URLs in Mongo.
- Bulk direct-to-B2 browser upload sessions; one personal note carries at most one bounded attachment through the LMS.
- A new class-purchase entitlement policy for accessing a user's existing personal notes.
- Immediate deletion of old Mongo records or old bucket objects at cutover. Destructive cleanup happens only after the rollback window under a separately verified runbook.
- Refactoring unrelated livestream storage, chat-media upload, or global frontend base constants.
- Assuming or changing the physical production bucket name without deployment-environment verification.

## Further Notes

- The earlier text-only task and its original decisions are recorded in [`docs/plans/done/tasks/13-notes-move-to-lms.md`](./done/tasks/13-notes-move-to-lms.md). Its isolated commits are prior art, not evidence of deployment.
- Whole-system ownership and deploy-fork rules come from [`SYSTEM.md`](../../SYSTEM.md), [`GLOSSARY.md`](../../GLOSSARY.md), [`BRANCHES.md`](../../BRANCHES.md), and [`repos.manifest`](../../repos.manifest).
- Exact-file token rationale and logical-versus-physical storage-zone vocabulary are established by the deployed LMS's documents-zone ADR. This PRD applies those principles to a distinct personal-note media zone rather than changing the PDF contract.
- Before implementation issues are generated, add the `noteMediaAsset` and logical `notes` zone terms to the shared domain vocabulary and record any new storage-zone decision as an ADR if the existing exact-file decision does not fully cover it.
- The task should be decomposed into thin vertical slices only after this PRD: LMS text tracer, private image tracer, audio parity, compatibility routes, both frontend adapters, production-data migration, production acceptance, and livestream retirement.
