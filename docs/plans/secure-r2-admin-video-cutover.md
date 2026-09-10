# Secure R2 admin video cutover

Status: implemented locally, 2026-09-10. Production configuration, image deployment and live end-to-end verification remain pending.

## Agreed scope

- Existing B2 files have already been copied to mirror buckets by the owner. This work covers new uploads and outputs, not historical migration.
- Uploads may remain paused until cutover and verification finish. Check for outstanding B2 uploads/jobs before switching; absence of new uploads does not establish an empty backlog.
- The secured project's lane is R2 `tempvideos-recorded-v2` → `recordedvideos-hranker-v2`, in the secure playback account.
- Non-v2 buckets belong to public Cloudflare projects and are a separate lane.
- One shared listener polls separate queues for the public and secured lanes. Each lane has explicit source/destination bucket and account/credential configuration; separate listener processes are not required.
- R2 is the active provider for this lane. Preserve existing bounded operation retries and manual recovery of failed jobs. No automatic B2 fallback, dual writes, or new whole-job automatic retry system.
- Include two failure-handling corrections: do not acknowledge transient intake failures before successful Redis submission, and propagate worker pipeline failures as unsuccessful container exits even if writing the failure status itself fails.

## Proposed implementation boundaries

- Admin: preserve multipart upload UX and object keys; configure a server-only private R2 video-upload client and retarget multipart routes and upload-status reads together.
- Intake: use a distinct object-created queue for the secured intake bucket. Resolve output storage from the lane and secured LMS reporting from the customer configuration. No output-bucket notifications into intake.
- Apply lane-specific storage clients to source inspection, processing-status reads/writes, and job submission. Current intake source/status helpers still use a global S3 client, even though job submission carries queue-specific credentials. Validate the event bucket against the configured intake bucket.
- Worker: retain authenticated stream-status and recordings reports. The source-MP4 worker already branches on `SECURED` independently of its S3 dialect; verify the deployed image carries this code.
- Playback: retain logical `recorded` asset references and the existing secure Cloudflare mint. Verify new HLS and MP4 outputs through their actual access paths.
- Cutover: verify the old backlog is drained, enable the new pipeline, test an admin upload end to end, then reopen uploads.

The agreed design retains the existing multipart experience, secured reporting contracts, and playback authorization. Implementation details below are acceptance requirements, not a broader redesign of those systems.

## Implementation sequence and acceptance

1. Inventory actual deployed listener/worker versions and selected admin/LMS deployment. Confirm secure account, queue, bucket permissions and notification wiring without logging credentials. Check that migration did not leave old object-created messages queued for replay.
2. Add the secure lane to the shared listener with explicit expected intake bucket, output bucket, endpoint and credentials. Missing secure configuration must fail closed rather than inherit public defaults. Preserve public lanes' existing destinations and reporting behavior.
3. Apply lane-specific clients to all source and status operations. Select the secured customer's LMS base correctly (avoid appending `/api` twice); retain the GPU manager's per-customer secret guard. Reject unexpected source buckets and exclude status objects from transcode submission.
4. Preserve bounded storage/report retries and manual job recovery. Correct intake acknowledgement on transient failure and worker exit status. The enqueue/ack boundary can redeliver after an ambiguous outcome: review existing duplicate handling and require a focused regression check so the correction does not introduce uncontrolled duplicate jobs. Queue retry/dead-letter settings must be recorded in the runbook.
5. Retarget admin multipart create, part signing, completion and status listing to the private secure R2 intake bucket. Keep video credentials server-only and separate from public asset upload configuration. Verify browser CORS and preserve existing upload response contracts and keys.
6. Verify deployed worker image supports secured source-video HLS and MP4 reporting on R2. Confirm the recorded playback mint and MP4 access path address the secure output bucket through the selected Cloudflare setup.
7. With uploads paused and prior B2 jobs drained, deploy and run one end-to-end admin upload. Verify source → queue → Redis → HLS/MP4 → authenticated LMS reports → entitled playback/download. Verify unsigned and wrong-scope playback requests are denied. Verify public lane routing remains unchanged. Reopen uploads only after these checks pass.

## Focused failure checks

- Redis submission failure does not silently consume the source event.
- Failed transcode or exhausted secured callback retries produces a failed manager job, not completed.
- Missing secured customer secret refuses processing; no unsecure reporting fallback.
- Manual recovery uses the original R2 lane and exact source key after the cause is fixed; document how status markers are handled for replay.

## Operational details to resolve during implementation

These do not change the agreed topology: actual queue identifier and retry/dead-letter settings; deployed versions and process names; exact env variable names; existing backlog and duplicate handling; the concrete manual recovery command. No historical recopy or automatic provider switching is required.

## Authoritative references

- [Existing admin multipart decision](../../../quicktricks-admin/docs/adr/0004-video-uploads-move-to-b2-multipart.md)
- [Transcoder lane vocabulary](../../repos/video-transcoder/CONTEXT.md#storage-routing)
- [Secured prerecorded contract](../../slices/secured-prerecorded-playback.md)
- [Media stack slice](../../slices/media-stack-r2-cloudflare.md)
- [LMS origin/CDN decision](../../../quicktricks-backend/docs/adr/0020-single-r2-origin-dual-cdn.md)

Local checkout inspection is evidence of available code, not proof of deployed configuration.

## Implementation record

- Transcoder commit `d4f1897`: shared branch from `repos.manifest`; explicit secure lane,
  lane-specific storage clients, required secured reporting, atomic event deduplication,
  retryable intake failures and unsuccessful worker exit on pipeline failure.
- Admin commit `b995ad2`: isolated fork worktree `/private/tmp/quicktricks-admin-secure-r2`,
  branch `feat/secure-r2-video-intake`, based on `94d5a01`. Existing dirty admin checkout
  was not edited. Video routes use the new private R2 module; status listing paginates
  and joins by full source key.
- [Transcoder configuration and cutover runbook](../../repos/video-transcoder/docs/plans/secure-r2-admin-video-cutover.md)
  is authoritative for service env and manual recovery. The admin worktree carries
  `docs/adr/0005-secure-r2-video-intake.md` with its four required upload env variables.
- Validation: transcoder build passes; full suite 202/202. Admin multipart contract
  5/5; library suite 120/120. Full admin typecheck reproduces the unchanged baseline
  output exactly. Full admin UI run: 101 passed / 8 failed. The unchanged revision
  reproduces 5 failures in the same unrelated files; focused rerun counts vary
  (24 passed / 9 failed on the implementation). Do not treat the full UI suite as
  green or claim every failure was reproduced identically. No affected upload
  tests failed. Local evidence: `/private/tmp/secure-r2-transcoder-tests.log`,
  `/private/tmp/secure-r2-admin-tests.log`, `/private/tmp/secure-r2-admin-lib-tests.log`,
  `/private/tmp/secure-r2-admin-typecheck.log` and corresponding baseline logs.
- Branch sync was attempted; it stopped because the live service's shared branch
  is already checked out at `/Users/raghav/Projects/worktrees/livestream-notes-signing`.
  The touched transcoder is already on the shared branch; the admin deploy fork uses
  the documented fork exception. No live-service checkout was forced or edited.
- No remote configuration, production queue, image, or deployment was changed.

### Shared-server reconciliation — 2026-09-10

After read-only investigation of `178.63.88.34`, the user authorized carrying its
production changes into the secure-intake candidate. Transcoder commit `6af515c`
preserves those changes and adds compatibility coverage; provenance, fixes and
release boundaries are recorded in the authoritative
[transcoder runbook](../../repos/video-transcoder/docs/plans/secure-r2-admin-video-cutover.md#shared-server-changes-carried-into-the-release-candidate-2026-09-10).

Build passed and full transcoder suite passed **218/218, zero failures or skips**.
Log: `/private/tmp/secure-r2-merged-tests.log`. The candidate was committed locally;
no push, production image build, configuration change or process restart occurred.
The admin commit and its previously recorded validation caveats are unchanged.

The [server investigation](secure-r2-deployment-investigation-2026-09-10.md) remains
the point-in-time operational inventory. Its pending compatibility-test section
is superseded by the new service runbook record; runtime deployment/canary gates
are still pending. Shared-branch sync again stopped at the already-occupied live
worktree; the touched transcoder remains on the manifest branch, and no other
worktree was forced or switched.
