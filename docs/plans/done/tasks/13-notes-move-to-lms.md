# Notes move to the LMS

**Type**: AFK
**Blocked by**: #12 — ls room-less realignment (merged)
**Repo**: nodejs-server + ls + livestream (three legs, in that order)
**Governing docs**: [SYSTEM.md ownership principle — LMS owns content/policy, livestream is the real-time plane](../../../../SYSTEM.md) · decision record: notes-home discussion 2026-07-22

> **Branch guard:** verify `git branch --show-current` matches `ACTIVE_BRANCH` in
> `system-brain/repos.manifest` before reading or changing anything. Ignore `.claude/worktrees/*`.

## Why

Per-class personal notes are LMS content — per-user study artifacts that outlive the live session —
but they live in the livestream backend as a Room-era leftover (`backend/routes/notes.js`, `Note`
model in livestream's Mongo, mounted at `/api/v1/room/:roomId/notes`). Two problems:

1. **Wrong plane.** Nothing about notes is real-time; livestream should own only live-streaming
   concerns (SYSTEM.md ownership table, ADR-0004 lean-greenfield).
2. **No real auth.** The route trusts a client-supplied `userId` (body/query) for ownership —
   anyone can read or delete another user's notes by supplying their id. The LMS has real token
   auth; livestream does not.

Quicktricks is greenfield (zero existing notes), so this is a clean move with **no data migration**.
Existing notes from other clients in livestream's Mongo are out of scope on this branch (ADR-0004:
architecture ships greenfield per client).

**Decisions (2026-07-22):**
- **Text-only v1.** The ls client (`types/notes.ts`) sends only `title?`/`content` as JSON; the old
  route's image/audio upload path is unused by this UI and is dropped with the route, not ported.
  If media notes are ever wanted, that is a new task deciding storage (public R2 media path vs
  documents zone) — do not build it here.
- **Identity from the token, never the payload.** The LMS derives `userId` from the validated
  auth token; `userId` disappears from request bodies/queries. A presented token that carries no
  user identity is rejected (401) — notes require a real user.

## What to build

**Leg 1 — nodejs-server.** A class-scoped notes resource owned by the LMS:

- `Note` model: `userId`, `classId`, `title?`, `content`, timestamps. Indexed for the
  list-by-class-and-user read.
- Routes, following the repo's existing route/controller/serializer conventions and mounted like
  the other viewer-facing resources:
  - `GET  /api/classes/:classId/notes` — the authenticated user's notes for that class
  - `POST /api/classes/:classId/notes` — create (validates the class exists)
  - `PUT  /api/notes/:noteId` · `DELETE /api/notes/:noteId` — owner-only (compared against the
    token identity, 403 otherwise)
- Auth: the same viewer-token validation the entitled read routes use (Auth access token).
  Identity always from the token. No admin surface needed.
- Tests: CRUD happy paths, cross-user access rejected (read/update/delete), tokenless + 
  identityless-token rejected, unknown class 404.

**Leg 2 — ls.** Repoint the client:

- `lib/api/notes.ts`: base URL moves `LIVESTREAM_BACKEND_URL` → `LMS_BASE_URL`; paths move to
  `/api/classes/:classId/notes` + `/api/notes/:noteId`; send the same token the viewer already
  presents to `/playback` (Authorization header); drop `userId` from `CreateNoteRequest` /
  `UpdateNoteRequest` / `deleteNote` (`types/notes.ts`).
- UI components (`components/notes/*`) unchanged apart from no longer threading `userId` into API
  calls. Keep the `id`/`_id` normalization unless the LMS serializer makes it moot.

**Leg 3 — livestream.** Delete the leftover:

- Remove `backend/routes/notes.js`, the `Note` model + `notesSchema` (`backend/db/model.js`), and
  the `notes` mount in `backend/app.js`.
- Remove `uploadMediaToS3` from `backend/lib/fileUpload.js` **only if** notes was its last caller.
- Full suite stays green.

## Acceptance criteria

- [ ] An authenticated viewer can create/list/update/delete their own notes on a class via the LMS; every request without a valid user-bearing token is rejected
- [ ] A request supplying someone else's `userId` has no effect — identity comes only from the token (prove with a test: forged-`userId` payload field is ignored/rejected)
- [ ] ls notes panel works end-to-end against the LMS routes; no request to `LIVESTREAM_BACKEND_URL` for notes remains
- [ ] livestream has no notes route, model, or mount; `/api/v1/room/:classId/notes` on the v2 backend now 404s
- [ ] All three repos' suites green; ls `tsc`/lint/build pass

## User stories covered

- A student takes private notes during a live or recorded class; nobody else can read or delete them, and the notes API lives with the rest of the LMS content.
