# PRD: Secure video upload to B2 (quicktricks)

Companion to admin-dashboard ADR 0004 (*Video uploads move to B2 through the existing
multipart routes*), which records the architecture decision and its rationale. This PRD
covers the launch slice for quicktricks (customer 472) on `launch/quicktricks-v2`.

## Problem Statement

As a quicktricks admin I upload recorded class videos through the admin dashboard, but
they land in Cloudflare R2 — the unauthenticated serving combo. From there the
transcoder reports them over the unsecure LMS callbacks: no transcoder secret, no
`Class.hlsAsset`, no signed playback. The result is that a video I upload today is
publicly fetchable at the CDN and can never be played through the protected viewer arc
we are launching (Go Live → `ls` viewer → `/playback`). The secured pipeline exists
end-to-end — but only for objects that arrive in the B2 intake lane, which the admin
cannot reach.

## Solution

Admin video uploads (single and bulk) land in the private B2 intake bucket
`tempvideos-recorded-v2` instead of R2. Nothing about the admin's upload experience
changes — same dialogs, same chunked multipart upload with progress, retry and abort —
only the storage destination underneath moves. Once the bucket's event notifications
point at the transcoder listener and quicktricks is registered as a secured customer,
every uploaded video flows through the secured lane automatically: transcode → secured
stream-status webhook → `Class.hlsAsset` → signed playback in the `ls` viewer. Uploaded
sources and their renditions are never publicly fetchable.

## User Stories

1. As a quicktricks admin, I want a video I upload to a class to become playable through the protected viewer, so that entitled students can watch it with signed URLs.
2. As a quicktricks admin, I want to bulk-upload a batch of videos and have each one create its class and enter the pipeline, so that I can migrate a course's worth of content in one sitting.
3. As a quicktricks admin, I want upload progress, per-file retry, and abort to keep working exactly as they do today, so that the storage change is invisible to my workflow.
4. As a quicktricks admin, I want a multi-GB upload to survive a flaky connection by retrying individual chunks, so that I don't restart a 4 GB file from zero.
5. As a quicktricks admin, I want the dashboard's processing status to update as the transcoder works through my uploads, so that I know when a video is ready without asking anyone.
6. As a quicktricks admin, I want a clear error if an upload fails permanently, so that I know to retry rather than assuming the video is processing.
7. As a student, I want uploaded class videos served only through short-lived signed URLs, so that my course's content isn't scrapeable from a public CDN path.
8. As a content owner, I want the raw uploaded source files to live in a private bucket, so that originals are never publicly fetchable even before transcoding.
9. As a platform operator, I want uploads to enter the secured transcoder lane, so that HLS is reported via the authenticated stream-status webhook and sets `Class.hlsAsset`.
10. As a platform operator, I want MP4 renditions reported through the secured recordings webhook, so that the recorded set on the class is written by an authenticated caller.
11. As a platform operator, I want the upload storage credential scoped to the single intake bucket with no delete capability, so that a leaked admin-server env cannot touch other buckets or destroy data.
12. As a platform operator, I want the admin's server to fail loudly at upload time when B2 env is missing, so that a misconfigured deploy cannot silently fall back to the unauthenticated R2 path.
13. As a platform operator, I want images and editorial media to stay on their existing public R2 path, so that moving videos does not disturb unrelated upload surfaces.
14. As a platform operator, I want previously uploaded R2 videos left untouched, so that existing classes keep playing while new uploads take the secured lane.
15. As a developer, I want the storage swap isolated behind one module with an unchanged interface, so that the upload UI, store, and uploader need no changes and the R2 client remains for its other consumers.
16. As a developer, I want the deferred webhook-authentication gap recorded as a risk, so that the fast-follow hardening isn't forgotten once launch pressure passes.
17. As a quicktricks admin, I want class rooms synced to the quicktricks livestream backend (not another tenant's), so that go-live and VOD viewing resolve against my deployment.

## Implementation Decisions

- **Architecture (ADR 0004):** keep the admin's existing presigned-multipart machinery
  (uploader → repo-local multipart API routes) and swap only the storage client under
  it. The PDF pattern (nodejs-server minting presigned PUTs) was rejected for videos:
  multi-GB files need multipart with per-part retry, which the admin already has and
  nodejs-server would have to grow from scratch.
- **The B2 storage module** is the one deep module: it exposes the same four
  operations the routes already consume — create multipart upload, presign a part
  URL, complete the upload, and list the upload bucket with per-file processed state —
  against B2's S3-compatible endpoint. Its interface is a mirror of the existing R2
  module's, so the routes' swap is an import change.
- **Fail-loud env seam:** the module validates its env (endpoint, bucket, key id, key
  secret) and throws when unset — no fallback to the R2 client, mirroring the
  Streamer-secret hardening posture.
- **Wholesale flip, no dispatch:** on this branch the multipart routes serve only
  video uploads and the deploy is single-tenant (quicktricks), so the routes switch
  to the B2 module unconditionally. The R2 module stays untouched for editorial
  media, generic uploads, and legacy PDF deletion.
- **Key shape is preserved:** `{customerId}/{classId}/{filename}` — already exactly
  what the transcoder intake parses as `<clientId>/<roomId>/<file>`.
- **Completion returns the object key and no public URL** (the intake bucket is
  private). The upload store already tolerates an absent URL, and room-sync sends
  only class ids and status.
- **Processing status keeps its existing contract:** the transcoder writes
  `status.json` beside each source key in the intake bucket; the SSE polling route
  surfaces it. No new status plumbing.
- **Credential scheme** (settled in the PDF slice): one app key per
  consumer × bucket × purpose — `admin-tempvideos-recorded-v2-video-upload-<env>`,
  scoped to the intake bucket, `listFiles,readFiles,writeFiles`, no delete, held only
  in the admin's server env.
- **Livestream backend base URL** is repointed from the toppers host to the
  quicktricks livestream backend on this branch (used by room-sync on class
  create/update and by both upload flows).
- **Infra wiring (not code):** CORS on the intake bucket for browser part-PUTs from
  the admin origins; B2 event notifications on the bucket targeting the transcoder
  listener's webhook; transcoder env registration of 472 as secured
  (`SECURED_B2_CLIENTS`, `SECURED_API_URL_472` set to the scheme+host base — the
  fallback would double the `/api` prefix — plus `SECURED_CLIENTS` and
  `TRANSCODER_SECRET_472` on the GPU server, matching nodejs-server's webhook secret).

## Testing Decisions

- Good tests assert external behavior at a module's interface — request/response
  shapes, error behavior, produced URLs — never internal call sequences or SDK
  wiring details.
- **The B2 storage module gets unit tests** (the deep module): fail-loud on each
  missing env var; endpoint/bucket/key targeting; part-URL presigning against fixed
  credentials; listing merges `status.json` into the per-file processed flag. No
  network — SDK boundary mocked or presigning asserted structurally.
- **The multipart routes get thin contract tests** with the B2 module mocked,
  pinning the JSON request/response shapes the browser uploader depends on
  (create → uploadId/fileKey; part-url → signedUrl; completions → key, no public
  URL), so a future refactor cannot silently break the uploader's wire contract.
- Prior art: the Streamer-token tests (`node --test`, no network, env injected per
  test) from the streamer-auth port.
- The end-to-end proof stays manual: the launch smoke test (upload → webhook →
  `hlsAsset` → signed playback) exercises the full arc including infra.

## Out of Scope

- Migrating previously uploaded R2 videos or decommissioning the R2 lane.
- Webhook authentication on the transcoder's B2 event listener — **deferred with a
  recorded risk** (ADR 0004): the endpoint verifies no HMAC signature today;
  mitigate by firewalling/obscurity until a fast-follow adds verification.
- The nodejs-server-as-control-plane consolidation (PDF-pattern parity) for videos.
- Admin MP4 downloads (deprioritized separately).
- The PDF upload track (tasks 05–08) and any change to image/editorial uploads.
- Multi-tenant bucket routing in the admin (branch-per-tenant config stands).

## Further Notes

- The secured lane only fires for objects created in the B2 intake bucket — an
  upload that lands anywhere else silently takes the unsecure path. The fail-loud
  env seam exists precisely to make that failure impossible to miss.
- Verify at wiring time (not assumable from code): the intake bucket's CORS rule,
  its event-notification target, and that the transcoder listener's webhook server
  is enabled (it only starts when B2 credentials are configured on the listener box).
- The admin repo currently has unresolved merge conflicts from the PDF track;
  nothing can be committed there until those are resolved.
