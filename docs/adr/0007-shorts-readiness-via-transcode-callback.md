---
status: accepted
date: 2026-09-16
supersedes: ADR-0006 decisions 1 (video-transcoder unchanged) and 4 (readiness from status.json + HEAD)
---

# Shorts readiness is reported by the transcoder through a job-complete callback; the job profile is a per-(intake queue, client) fact

ADR-0006 put shorts on the public transcode lane and left readiness to the admin browser: poll
`status.json`, `HEAD` the playlist, PATCH `videoStatus`. The first real upload (2026-09-16, short
`6aaa7238…`, client 472) showed both halves of that were wrong in ways only a real job could surface.
This ADR keeps 0006's core decision, **shorts are public objects with no token**, and replaces the two
decisions that failed.

## What the first upload proved

The playlist was perfect and public within 25 seconds. The job was recorded as **failed**, and the
admin dialog obediently marked the working short `failed`.

Root cause, from source: the slice and ADR-0006 treated "the unsecure lane" as **one** decision. It is
two, made in two places:

| Decision | Chosen by | Source |
|---|---|---|
| storage / CDN routing | which **intake bucket** fired the event | `src/intake-routing.js`, `src/index.ts` |
| **reporting contract** | the **client's** secured flag | `gpu-server/job-manager/secured-clients.js` |

Client 472 is correctly in `SECURED_CLIENTS`, because its real classes are secured. So a short routes to
the public bucket as designed and then reports through the *secured* contract:
`PUT /api/classes/{shortId}/stream-status` 404s, the call is deliberately fatal, the job exits 1.

The proposed manager-only fix (stop injecting the secret for public-intake jobs) **does not work
either**: the unsecure branch swallows the class-link 404 but then sends the unsecure recordings report,
`POST /api/classes/recordings-prerecorded`, which on the fork sits behind `requireTranscoderSecret` and
401s. That call is also unwrapped. Both existing contracts fail for a shortId, because **the transcoder
has no LMS subject to address**: a shortId is not a classId, and nothing in either contract can say
"there is no class here".

Blast radius of leaving it, verified: no retry storm and no GPU-slot drift, but every short poisons
the `videos` doc, increments the client's lifetime `failed` counter permanently, and leaves
`status.json: failed` as the lane's durable verdict, so 472's failure-rate signal becomes noise.

The browser-as-writer half failed independently: the only writer of `ready` is an open dialog with a
30-minute timeout, and GPU queue waits of 45 minutes were observed. Close the tab and the short is
`processing` forever (the predecessor handoff's Defect 2).

## Decisions

1. **The transcoder learns a per-(intake queue, client) job profile, not a product.** The listener
   stamps `job.config.profile` from flat env, one variable per fact per client, following the existing
   `SECURED_API_URL_<clientId>` convention. Each queue definition carries an `envPrefix`
   (`CF_BACKUP`, `CF_HRANKER`, `CF_SECURE`, …); one pure resolver reads
   `${prefix}_REPORT_CALLBACK_URL_<clientId>` and `${prefix}_MP4_RENDITIONS_<clientId>` for **every**
   queue. A client with no profile on a queue gets today's behaviour byte for byte. No code path
   branches on a queue name, a bucket name, or the word "shorts". The profile's vocabulary is what the
   job *does*: `reporting`, `mp4`, later `hls.renditions`.

2. **Reporting is a contract with three kinds, and the profile can name one.** `secured` (stream-status
   + secured recordings, secret required), `unsecure` (class-link + unsecure recordings), and the new
   `callback`: one generic job-complete `POST` to the profile's URL. The container's reporter module
   owns the selection; `index.js` stops branching on `SECURED`. `secured`/`unsecure` stay exactly as
   they are.

3. **The callback is generic and zone-free.** Body:
   `{ jobId, clientId, roomId, status: 'processed'|'failed', outputs: { hls: { key } }, durationSec, error }`.
   `key` is bucket-relative and there is **no `bucket` field**: the zone is implied by the endpoint the
   URL names, so the transcoder learns neither a physical bucket nor an LMS zone alias. It is signed with
   the client's existing transcoder secret (`TRANSCODER_SECRET_<clientId>` ⇄ the LMS's
   `TRANSCODER_WEBHOOK_SECRET`), which the glossary already defines as the general service→LMS write
   credential. A rejected callback is **fatal to the job**, exactly like stream-status: a job whose
   report was refused did not fulfil its contract, and `status.json: failed` is then honest.

4. **The guard stays the single spawn decision.** `evaluateSecuredSpawn(clientId, env, { required,
   reporting })` gains three rows: `callback` with the client's secret present ⇒ allow, emit
   `REPORTING=callback`, `REPORT_CALLBACK_URL`, `TRANSCODER_SECRET`, never `SECURED=true`; `callback`
   with no secret ⇒ refuse loudly; `callback` on a job whose intake lane requires secured reporting
   (`config.secured: true`) ⇒ refuse as a contradiction. Membership in `SECURED_CLIENTS` is irrelevant
   to a callback job: that list answers which *class*-reporting contract a client is on.

5. **Shorts' profile is `reporting: callback` and `mp4: false`.** Four MP4 download renditions nobody
   reads are GPU time and public objects for nothing. `MP4_RENDITIONS=false` guards
   `processMp4ToMp4Formats` in the container. The rendition ladder keeps the default; the field's home
   is established for a later product decision.

6. **The LMS is the single writer of `Short.videoStatus`.** New route
   `POST /api/shorts/transcode-complete` behind `requireTranscoderSecret`: look up the Short by
   `roomId` (404 ⇒ non-retryable ⇒ the job fails visibly, correct for a deleted short), check the
   reported key equals the derived `videoAsset.key` and set `videoAsset` when the admin's `sourceKey`
   PATCH has not happened yet, flip `videoStatus`, persist `durationSec` and the error, treat a repeat
   report as a 200 no-op. The admin's `{ videoStatus }` PATCH arm is **removed** after acceptance; a
   failed short is fixed by re-uploading, which is a fresh job and a fresh callback.

7. **A 24-hour sweeper covers the never-ran case only.** Per ADR-0002 a push needs a reconciler behind
   it: shorts in `processing` with no report for `SHORTS_TRANSCODE_DEADLINE_HOURS` (default 24) become
   `failed` with reason "No transcode report received". Its **only verb is "give up"**: it never HEADs
   the playlist or promotes to `ready`, because that would reinstate the second writer of truth.
   Evidence beats guess: a late `processed` callback overrules a swept `failed`; the reverse never
   happens. 24 hours because a real transcode failure reports itself within seconds through the
   `failed` callback, so the deadline's only cost is how long an admin waits to learn about a job that
   silently vanished, while a short deadline kills healthy queued jobs on paper.

8. **The admin dashboard shrinks to upload, attach, display.** The dialog uploads, PATCHes
   `{ sourceKey }`, then polls `GET /api/shorts/{id}`. The `/api/shorts_transcode` route, the
   `status.json` read and the playlist HEAD are deleted; Vercel no longer needs to *read* the intake
   bucket. Defect 2 disappears rather than being patched.

9. **Rollout is audit-gated and absent-means-today at every hop.** Hard gate: diff the listener box
   against `launch/quicktricks-v2` before any deploy (the branch is 5 commits ahead, unpushed, and
   those commits are the secure R2 lane whose shared dispatch was never qualified as deployed). Then
   LMS → container image → manager → listener + env → admin → acceptance (one short re-upload, one 472
   class through the private lane) → remove the PATCH arm. The stacked secure-lane commits go live with
   it, on purpose. The encoder's wrong class-report base (predecessor Defect 3) is a **separate**,
   explicitly approved env change, not folded in.

## Considered and rejected

- **LMS-side reconciler as the writer (HEAD the public URL, promote to `ready`).** Zero coupling and
  the LMS owns its state, but it infers what the producer could simply say, cannot distinguish "queued"
  from "encoder died", and has nowhere to put "which renditions exist" once shorts get their own
  ladder. Kept as the shape of the sweeper's *give-up* half only.
- **Browser stays the writer, fix the read side.** Makes the product correct in one reader and leaves
  the system lying about itself. The code exists in a worktree and is discarded.
- **Manager-only: public intake ⇒ no secret.** Moves the failure from a 404 to a 401 (see above).
- **Make the LMS accept stream-status for a shortId.** Puts shorts back inside the content-protection
  seam 0006 removed them from.
- **Remove 472 from `SECURED_CLIENTS`.** Unsecures their real classes.
- **Blanket try/catch around the secured report.** Silently breaks `hlsAsset` for every secured class.
- **Extend the admin PATCH to also accept the secret.** Two credential kinds on one route already hit
  by admins; a three-arm union.
- **A generic `/api/media-jobs/complete` dispatching by subject.** Premature: one subject.
- **A separate per-queue callback secret.** A second secret to provision and rotate on two boxes for a
  write the transcoder secret already governs.
- **Carry `bucket: 'shorts'` in the callback.** Teaches the transcoder an LMS zone alias and the
  product word.
- **Hard-code the profile on the hranker queue / `CF_HRANKER_*` without a client suffix.** Narrows a
  multi-tenant seam to one tenant; a second tenant on the same public intake would inherit 472's LMS.

## Consequences

- The transcoder is edited, in three deploy units, for the first time in the shorts work. It remains
  product-ignorant; the widened contract is the **job profile**, which any tenant can use.
- The transcoder secret's scope widens to a shorts write (same widening chat-moderation accepted).
- The two-axes framing (storage lane vs reporting contract vs processing profile) must land in the
  glossary and the transcoder's `CONTEXT.md`, or the conflation recurs.
- Deferred, deliberately: a shorts rendition ladder; a `started` callback for two-phase deadlines;
  skipping MP4s for any other lane; the scoped R2 token for Vercel's upload credential.
- Tasks: [`docs/plans/tasks/shorts-transcode-callback/`](../plans/tasks/shorts-transcode-callback/README.md).
