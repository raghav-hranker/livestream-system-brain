# Slice: client-launch-v2 — launch-readiness of the Room-less pairing

**Goal:** the v2 system (Room-less livestream ⇄ slice-07+ nodejs-server) is deployable for the next
onboarded client with no dead contracts and the agreed reliability layers in place.

**Why it's a slice:** every item below either crosses the stream-status / private-mode / read-contract
boundary or removes a half of a contract whose other half never existed. Decisions behind it:
`docs/adr/0002` (at-least-once delivery), `docs/adr/0003` (frozen Mongo read contract),
`docs/adr/0004` (greenfield per client). Vocabulary: `GLOSSARY.md`. Wiring: `SYSTEM.md`.

## Branch mechanics (do this first)

1. **Within nodejs-server:** fast-forward `feature/secure-classes` onto the `claude/wonderful-napier`
   tip. It is a strict ancestor (0 ahead / 25 behind) — a pure `git merge --ff-only`, no conflicts.
   Without slices 07–10B the deployed server has **no** stream-status endpoint and every livestream
   status write 404s with no Room fallback. The actual deploy branch for this client is
   **`quicktricks-prod`** — it does NOT have the secure shape yet; land the full streaming line
   (through slice 10B, not just `feature/secure-classes`) when giving it that shape.
2. **Across repos:** cut ONE shared branch name (per `BRANCHES.md` discipline) at the deployable tips —
   livestream `livestream-v2`, nodejs-server the fast-forwarded tip, video-transcoder its secured-contract
   branch — via `./scripts/sync-branches.sh <launch-branch>`, so `repos.manifest` records the pairing as
   data. Never deploy the halves by branch-name memory.
3. **Branch guard on every task:** both service repos carry many worktrees and per-client branches, and
   several checkouts hold the *old* (Room-based) architecture. Every issue/task body starts with:
   *verify `git branch --show-current` matches `ACTIVE_BRANCH` in `../system-brain/repos.manifest` before
   reading or changing anything* — an agent on the wrong checkout will confidently describe the wrong
   system (this exact mistake happened during the evaluation that produced this slice). Ignore
   `.claude/worktrees/*` duplicates when searching.

## Build (the hops, in order)

1. **livestream — stream-status retry** (`docs/adr/0002` layer 1): persist latest pending transition per
   class in Redis, retry with backoff, drop only on 400/401/404 — `backend/lib/streamStatusUpdater.js`.
2. **livestream — write-through streamStatus cache** (`docs/adr/0003`): stash the status in Redis whenever
   the webhook fires; `joinRoom`'s `streamUpdate` emit reads the local copy; Mongo read becomes cold-start
   fallback only — `backend/lib/streamStatusUpdater.js`, `backend/rtmpserver-2.js` (joinRoom).
3. **nodejs-server — staleness sweep** (`docs/adr/0002` layer 2): periodic alert on classes stuck in
   `preparing`/`processing`/`reconnecting` beyond threshold. Detection only, no auto-repair.
4. **nodejs-server — real private-mode endpoint** (SYSTEM.md contract table, *planned* row):
   `PATCH /api/classes/:classId/private-mode` behind `requireTranscoderSecret`; repoint
   `classClient.setPrivateMode` at it (kill the dead `/api/internal/...` URL + `x-internal-secret` header).
5. **nodejs-server — read-contract guardrails** (`docs/adr/0003`): comment on the Class schema naming
   livestream as direct-Mongo reader of `isPrivate` + `streamStatus`; contract test recommended, not
   required; livestream's DB user read-only on `classes`.
6. **livestream — shrink `classClient.getClass`** to `.select('streamStatus isPrivate')`.

## Delete (dead code sentenced during review — remove on the launch branch)

- `backend/routes/room.js` (unmounted) and the `Room` model + `roomSchema` in `backend/db/model.js`.
- The recordings relay: `POST /recording` + legacy GET in `backend/routes/recording.js`,
  `classClient.attachRecording`, and the `CALLBACK_API_ENDPOINT` plumbing in `backend/lib/ecs.js` —
  MP4 reporting is video-transcoder → LMS direct (SYSTEM.md, RETRANSCODE arc). Livestream is enqueue-only.
- `classClient.setStreamStatus` (superseded by `streamStatusUpdater`; targets a URL that never existed).
- `ui/` viewer pages that bootstrap from `GET /api/v1/room/:roomId` — the in-repo `ui/` is outdated and
  unused; the production viewer is a **separate UI repo** already connected to the livestream backend.

## Deferred (noted, out of scope for launch)

- **Redis optimizations from `fix/roster-host-gate-rra`** (livestream, 15 commits absent from
  `livestream-v2`): wanted later; triage which apply to code v2 kept. Do consciously, not by memory.
- **Server-side `isChat` gate:** the LMS frontend hides the chat box, but the livestream socket accepts
  messages regardless of `isChat`. Cosmetic-only today; revisit if chat-disabled classes matter.
- **Chat replay anchor:** there is no VOD chat-replay feature and none is planned. If it is ever wanted,
  the actual-stream-start anchor (or per-message offset) must be captured **at stream time** — the old
  `Room.startTimestamp` is dead on v2 and absolute message timestamps cannot be aligned retroactively.

## End-to-end test

Stream a class on the launch branch: OBS in → `preparing`→`live` visible via `/playback` transitions
(425→200 with signed URL) → kill nodejs-server for 60s mid-`ended` → confirm the retry lands the
transition after restart (no stuck `processing`) → toggle private mode from the class UI → confirm the
LMS `Class.isPrivate` flips and the room gets `privateModeUpdate`.

## Failure-surface cheatsheet

- Status writes 404 + logs "no retry" → nodejs-server branch predates slice 09 (branch mechanics step 1).
- Class stuck at `processing`, `/playback` 425 forever → retry layer (Build 1) or sweep (Build 3) missing.
- Private toggle throws → `classClient` still pointing at `/api/internal/...` (Build 4).
- Viewer joins see no status → write-through cache not populated and Mongo fallback failing (Build 2).
