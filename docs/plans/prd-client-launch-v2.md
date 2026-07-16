# PRD: Client Launch v2 — Room-less Streaming System

## Problem Statement

We are onboarding a new client (quicktricks) onto the video platform. The target architecture — the
Room-less livestream service reporting stream lifecycle to the LMS through a secured webhook, with
signed-URL playback — exists in code but is not deployable as-is: the two services' streaming halves
live on unpaired branches, several client calls target endpoints that were never built (private-mode,
recordings relay), a lost webhook silently strands a class in an unwatchable state forever, and dead
Room-era code still lingers. Deploying today would produce a system that looks correct and fails
silently at its seams.

## Solution

Make the v2 pairing launch-ready: pin the branch pairing so the deployable system is data, not memory;
give the stream-status report at-least-once delivery with owner-side staleness detection; build the one
missing endpoint (private-mode) and repoint its client; freeze and guard the small shared-Mongo read
contract; and delete every dead contract half (Room model and routes, recordings relay, outdated in-repo
viewer UI). The result is a system where every contract has two live ends, every transient state is
bounded in time, and the deployed branch set is recorded in the manifest.

## User Stories

1. As a student, I want the class recording to become playable shortly after the stream ends, so that I can watch what I missed without filing a support ticket.
2. As a student, I want playback to tell me the recording is still processing (rather than erroring), so that I know to come back later.
3. As a student, I want my access to class video to run through signed, short-lived URLs, so that entitled users and only entitled users can watch.
4. As a student joining a live class, I want to see the current stream status immediately on joining, so that I know whether the class is live, reconnecting, or over.
5. As a teacher (host), I want to toggle private mode from the class UI during a live class, so that I can restrict interaction without leaving the stream.
6. As a teacher, I want the private-mode toggle to actually persist on the class record, so that the restriction survives reconnects and reflects in the LMS.
7. As a teacher, I want my stream's lifecycle transitions (preparing, live, reconnecting, processing, ended) reported reliably even if the LMS is briefly down, so that a 40-second deploy window doesn't strand my class.
8. As an LMS admin, I want to set class privacy policy from the LMS UI before or after class, so that policy management stays in the system of record.
9. As an LMS admin, I understand that LMS-side changes are enforced on the next websocket firing but not broadcast to the in-room UI, so that I use the class UI for mid-class changes.
10. As an ops engineer, I want an alert when any class sits in a transient stream status beyond a threshold, so that a lost webhook is detected by monitoring instead of by student complaints.
11. As an ops engineer, I want the livestream service to fail fast at boot when its LMS URL or webhook secret is missing, so that misconfiguration surfaces at deploy time, not at class time.
12. As an ops engineer, I want the deployable branch pairing recorded in the repo manifest, so that "which branches make up the system" has a mechanical answer.
13. As a developer, I want one write path per fact (status via the stream-status reporter, recordings via the transcoder directly, privacy via the private-mode endpoint), so that there is never a second, half-working channel to debug.
14. As a developer, I want the livestream service's direct Mongo reads of the LMS Class frozen to a named two-field contract with a guardrail in the LMS repo, so that an LMS schema rename cannot silently break the livestream service.
15. As a developer, I want the Room model, its routes, and the recordings relay deleted rather than left inert, so that the next session in this codebase cannot mistake dead code for a live contract.
16. As a developer, I want the hot-path stream status served from the livestream service's own write-through cache, so that socket joins don't pay a cross-database round trip for data this service originated.
17. As the new client, I want my deployment to start from a fresh database with no legacy Room documents, so that no migration or backfill risk applies to my launch.
18. As a future maintainer, I want the architectural decisions (delivery semantics, read contract, greenfield policy) recorded as ADRs in the system brain, so that I don't re-litigate or accidentally reverse them.
19. As a viewer on the production UI (separate repo), I want the livestream backend's socket surface unchanged by this work, so that the existing UI integration keeps working without coordinated changes.
20. As a transcoder operator, I want MP4 renditions reported by the video-transcoder directly to the LMS recordings webhook, so that the livestream service is never a relay hop that can drift.

## Implementation Decisions

- **Branch mechanics precede all code work.** The nodejs-server streaming line is fast-forwarded so the
  secure branch includes the stream-status webhook, transcoder-secret middleware, and playback readiness
  gate. One shared branch name is then cut across all three service repos via the sync script, recording
  the pairing in the manifest. The client's production LMS branch receives this line when it is given the
  secure shape.
- **StreamStatusReporter (livestream)** becomes a deep module: a single report call that persists the
  latest pending transition per class in Redis, retries with backoff until acknowledged, drops only on
  explicit 400/401/404, and write-through caches the status locally. Socket-join status hydration reads
  the local cache; the LMS Mongo read remains only as cold-start fallback. Last-write-wins per class is
  safe because the LMS write is a deterministic set (idempotent retries). See ADR-0002.
- **StaleStreamSweep (nodejs-server)**: a periodic job alerting on classes stuck in `preparing`,
  `processing`, or `reconnecting` beyond a threshold. Detection only — no auto-repair, since the LMS
  cannot know the stream's true state. Transient statuses are contractually time-bounded from now on.
- **Private-mode endpoint (nodejs-server)**: a PATCH endpoint guarded by the existing transcoder secret;
  the secret is now the general service-to-LMS write credential (stream-status, recordings, private-mode),
  not webhook-only. The livestream classClient's setPrivateMode is repointed at it; the dead internal-API
  URL and second secret header are removed. `isPrivate` is dual-writable: LMS UI directly (policy), class
  UI via this endpoint (live).
- **Read contract (ADR-0003)**: the livestream service reads the LMS `classes` collection directly,
  frozen to exactly `isPrivate` (routine, LMS-owned) and `streamStatus` (recovery fallback only). The LMS
  Class schema carries a comment naming the livestream service as a direct-Mongo reader; a small contract
  test guards the field names/types. The livestream DB user should be read-only on that collection.
- **Deletions (livestream)**: the Room model and schema, the unmounted room routes, the recordings relay
  (callback route, attachRecording, callback-endpoint plumbing), the dead setStreamStatus client method,
  and the outdated in-repo viewer UI. MP4 reporting is video-transcoder → LMS direct; the livestream
  service is enqueue-only in the retranscode arc.
- **Enum**: the stream lifecycle vocabulary is the LMS's five-value set (preparing, live, reconnecting,
  processing, ended); `undefined` is legitimate for classes never touched by the lifecycle.
- **Greenfield (ADR-0004)**: this ships to the new client only, fresh DB; no Room data migration, no
  backports to old deployments. Livestream code is client-generic, deployed one instance per client;
  true multi-tenancy is a recorded future seam (clientId routing), not built now.

## Testing Decisions

- A good test exercises external behavior through the module's public interface — what is sent, stored,
  or returned — never internal call order or private state. HTTP and Redis are mocked at the boundary.
- **StreamStatusReporter**: retry-until-2xx behavior, drop-on-4xx behavior, latest-transition-per-class
  overwrite semantics, write-through cache population, cold-start fallback. Prior art: the existing
  streamStatusUpdater unit tests on the v2 branch (mocked axios), to be extended rather than replaced.
- **StaleStreamSweep**: the stale-class query — threshold edges, only transient statuses match, undefined
  streamStatus excluded, terminal statuses excluded.
- **Private-mode endpoint**: rejects without/with wrong secret, persists isPrivate, rejects malformed
  payloads. Prior art: the stream-status webhook and playback controller tests in the LMS repo.
- **ClassClient (slimmed)**: projection returns exactly the two contract fields; setPrivateMode targets
  the new endpoint with the transcoder-secret header.
- The LMS-side **contract test** (field names/types of the frozen read contract) doubles as the read
  contract's regression guard.

## Out of Scope

- **Old client deployments** — they do not use this system (ADR-0004); no fixes or backports to the old
  Room-based branches, including their known unauthenticated routes.
- **Redis optimizations** from the old livestream branch (15 commits) — wanted later; triage separately.
- **Server-side isChat gate** — chat-disabled classes are hidden client-side only; revisit if it matters.
- **VOD chat replay** — no such feature exists or is planned; if ever wanted, the stream-start anchor
  must be captured at stream time (it cannot be backfilled).
- **True multi-tenancy** (one livestream instance, many LMSes) — recorded seam, not built until a second
  tenant is real.
- **Per-client deployment/env provisioning matrix** — deliberately deferred.
- **The production viewer UI** (separate repo) — no changes; this work must not alter the socket surface
  it consumes.

## Further Notes

- Governing documents in the system brain: ADR-0002 (at-least-once stream-status), ADR-0003 (frozen
  shared-Mongo read contract), ADR-0004 (greenfield per client), `slices/client-launch-v2.md` (ordered
  worklist with file-level pointers and the end-to-end test), plus the updated `SYSTEM.md` contract table
  and `GLOSSARY.md` (isLive semantics, LMS-is-not-real-time boundary rule, widened transcoder-secret
  scope).
- The end-to-end acceptance run (from the slice file): stream a class on the launch branch; verify the
  playback gate transitions 425→200 with a signed URL; kill the LMS for 60 seconds mid-`ended` and
  confirm the retry lands the transition after restart; toggle private mode from the class UI and confirm
  persistence plus room broadcast.
- Issue breakdown should reference this PRD by path; each task names its target repo and links the
  governing ADR/slice section rather than restating it.
