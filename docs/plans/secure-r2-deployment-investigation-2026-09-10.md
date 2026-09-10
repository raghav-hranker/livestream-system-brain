# Secure R2 deployment investigation — 2026-09-10

Follow-up: the user subsequently authorized reconciling production changes into
the candidate. This is complete in transcoder commit `6af515c`, with build and
218/218 tests passing. The original observations below are retained as historical
evidence; the pending local compatibility-work section is superseded by the
[service release record](../../repos/video-transcoder/docs/plans/secure-r2-admin-video-cutover.md#shared-server-changes-carried-into-the-release-candidate-2026-09-10).
Production deployment and live canaries remain pending.

Read-only investigation of `root@178.63.88.34`, authorized for preparation steps
1–4 and 6. **Not ready to deploy. No production files, queues, images, processes,
or Redis job state were changed.**

Design and implementation: [cutover plan](secure-r2-admin-video-cutover.md).
Service configuration and recovery remain authoritative in the
[transcoder runbook](../../repos/video-transcoder/docs/plans/secure-r2-admin-video-cutover.md).
This record describes deployment observations, not new service definitions.

## Evidence and limits

Sanitized audit output and audit scripts are in
`/private/tmp/secure-r2-deployment-audit/` (`runtime.jsonl`, `storage.jsonl`).
Remote source copies there support the code comparison. Secrets were used only
inside the server for authenticated reads and were not printed.

Configuration is reconstructed from PM2 launch environment plus the appropriate
current dotenv file, respecting `ENV_FILE`; it is not a dump of a Node process's
post-startup environment. Files may have changed since these long-lived processes
started. Running containers independently confirm actual storage/image choices
for their jobs. Queue/counter snapshots are live observations, not an atomic
maintenance-window inventory. Cloudflare messages were not pulled or acknowledged.

## 1. Actual deployment inventory

| Component | Observed state |
|---|---|
| Host | Ubuntu 24.04; uptime 213 days; root filesystem 84% used, 275 GB free at initial sample |
| GPU | RTX 4000 SFF Ada, 20 GB; initial sample 55% utilization |
| R2 listener | PM2 `video-listener`, PID 722921, `/root/video-transcoder/dist/index.js`, cwd `/root/video-transcoder`, `.env`, R2, port 3003 |
| B2 listener | PM2 `b2-video-listener`, PID 72347, same script/cwd, `ENV_FILE=.env.b2`, B2, port 3011 |
| Shared manager | PM2 `b2-secure-job-manager`, PID 1974163, `/root/video-transcoder/gpu-server/job-manager/manager.js`; handles observed R2 jobs despite its name |
| Stats | PM2 `vid-transcoder-stats-server`, PID 586518, same manager directory |
| Inactive managers | PM2 `job-manager` and `b2-job-manager` stopped; do not accidentally enable additional consumers |
| Other active workloads | Multiple live-stream services, two APX ingest containers, regional ingest bridge; this is not a dedicated idle VOD host |
| Admin/LMS | Not identified as deployed services on this host; their actual releases/hosting still require separate discovery |

Server Git checkout: branch `feat/apx-passthrough-472`, HEAD `d8bc18a`.
Modified tracked files include `dist/index.js`, `gpu-server/job-manager/redis-client.js`
and `apx-ingest-container/mirror-deps.js`; operational scripts are also untracked.
Do not replace this checkout with the local feature branch or reset it.

Local implementation remains `d4f1897` in the transcoder and `b995ad2` in the
isolated admin worktree; both were clean when checked. The server's revision is
not available in the local object database. Comparing copied source files shows
that a whole-directory deployment would discard client tuning and claim-time
deduplication. The local manager also includes the separate 1C normalization
change, absent from the server manager; include its compatibility scope if shipping it.

### Images

Observed local Docker image IDs (not published registry digests):

| Image reference | Image ID |
|---|---|
| `video-processor:latest` | `sha256:156cbf90c834b4b5900beceee130d6028d4caaa1a30f8208fd2468a6c3300b71` |
| `hls-to-mp4-processor:latest` | `sha256:5159ea2679db10d8b2cb21aa8cd9ae3660806fb0aca19db0afaf26f90b4a6511` |
| `video-processor-b2-secure:v2` / `:latest` | `sha256:0f11d27be3ba3f5e1563e2966f3fb8ec5a39b804252e9cc74a0d54d63bfeb940` |
| `hls-to-mp4-b2-secure:latest` | `sha256:a30c413b442e496d77a876c78b0171f84c27fba04c4eaca5158d90aafc5f6ac0` |
| `apx-ingest:r2-mirror-20260910` | `sha256:b200cef59858fcd0433fa2b74fc423a12158b61a83fb669657a057aca22e8005` |

The manager's reconstructed configuration contains `VIDEO_PROCESSOR_R2_IMAGE=video-processor:v2`,
which was not present in the image inventory. Actual queued source jobs select
`video-processor:latest` themselves, so changing the manager variable alone does
not establish which worker runs. Preserve these IDs and pin the listener's new
source-worker image explicitly. Do not move shared `latest` tags.

### Queues and active work

All four configured R2 queues returned successful Cloudflare detail reads:

| Account/lane | Queue ID | Input bucket | Max retries | Retry delay |
|---|---|---|---|---|
| Primary selectionway | `a0493affa22e403298237547dcd100ec` | `tempvideos-selectionway` | 3 | 0 s |
| Primary hranker | `3cd781ca04474fd7a0476bcc5c32172f` | `tempvideos-hranker` | 3 | 3 s |
| Mirror selectionway | `130c1314608e415bb4f9b16d9761aae1` | `tempvideos-selectionway` | 3 | 0 s |
| Mirror hranker | `0890629d0e5f42f6b9acee47ee3116cc` | `tempvideos-hranker` | 5 | 3 s |

Primary account: `025b7cddaf43305b7f846a9a51c125fb`.
Mirror account: `1ff6f2000c9aa34ca2ec88c066af092a`.
All returned HTTP-pull consumers have batch size 10, visibility timeout 30 s,
and queue retention 345600 s. No dead-letter destination appeared in the returned
consumer configuration. Exhausted-message handling still needs explicit verification.
These reads do not establish backlog counts or multipart notification rules.
No secure queue configuration was found in the inspected listener configuration;
this does not prove the secure Cloudflare account has no queue.

Initial Redis snapshot: **61 normal-priority jobs, all client 168**; other priority
lists empty. Five jobs counted as processing; seven IDs in `processing:jobs`.
Four source containers for 168 and one 1C container were active at the first sample.
Subsequent sampling showed another source job start, confirming active processing.
Two extra IDs report worker `drain-c19877f285ca-w1`, including an older job
`job-1788244004362-168-138179`. A local `/proc` scan found no matching drain process.
Do not label or delete those records as stale without checking external worker
ownership and the corresponding outputs/reporting.

## 2. Compatibility evidence and remaining work

Read-only checks passed:

- Both primary and mirror credentials can list both intake buckets and HEAD sampled
  objects, including existing status objects. This establishes sampled read access,
  not complete GET/write/output-bucket permission coverage.
- Redis reports AOF enabled, last AOF write status OK, `noeviction`, zero evicted keys,
  and about 1.87 GB used. ACL DRYRUN allowed EVAL, SET and RPUSH for the audited user.
  No enqueue was executed. Check EXISTS and exact production key scope as part of
  complete preflight; this read-only check does not establish the service's persistence SLA.
- Existing queue ownership, producers and HTTP-pull settings were read successfully.

**Expanded regression tests have not been implemented or run in this investigation.**
Prior local test results remain those in the implementation record. Required next
coverage must exercise actual listener job assembly and mocked external boundaries,
not just the pure routing helper:

1. Primary and mirror lanes, PHP and public Node.js clients, secure lane off/on;
   compare source/status client, destination, worker image, priority, processing
   flags, callback base and secured guard against the deployed behavior.
2. Concurrent same-filename inputs across lanes; source/status credentials and
   local media-probe temporary paths remain isolated.
3. Successful Redis enqueue followed by failed acknowledgement and redelivery;
   exactly one submission. Combine the new event dedupe with the server's existing
   claim-time dedupe and old queued jobs. Assess same-bucket names across accounts:
   the server's source dedupe key contains provider/bucket/key but not account.
4. Retryable storage errors, malformed events, failed status markers, worker/report
   failure and manual recovery. Include every consumer of a rebuilt image.
5. If the manager's 1C normalization is included, exercise current public and secured
   1C job shapes against the retained worker images.

## 3. Concrete deployment risks

- **Shutdown/startup:** deployed manager waits at most two minutes before stopping
  remaining containers. PM2 has no explicit `kill_timeout` in the inspected record.
  Manager startup resets processing counters and deletes `processing:jobs` and
  `processing:dedupe`. A rolling restart with active or external workers is unsafe.
- **Production-only behavior:** preserve claim-time dedupe and release of its keys;
  preserve client 168's 4/day, 6/night limit and client 472's 6/day, 8/night limit,
  plus other client-config differences. Reconcile source instead of copying local files over it.
- **Customer 472 reporting:** manager registry includes `408,472` with secrets present.
  The public listener's 472 callback base is `/api`-suffixed; secured dispatch is
  per-customer. The B2 listener's current file routes 472 to `http://34.126.210.209:5100`.
  Verify all active 472 producers and the actual secured callback composition;
  do not infer that new secure-lane configuration fixes existing public/B2 jobs.
- **Customer 695:** B2 intake declares 695 secured, but the manager registry does
  not include it (although a secret exists). Determine whether that old intake is
  still used before upgrading the required-secured guard; do not silently change
  its registration or reporting base as part of this cutover.
- **Intake transition:** queued/running jobs predate event dedupe. Cloudflare backlogs,
  old B2 deliveries and external drain records are unresolved. Empty Redis alone
  will not prove intake is drained.
- **Worker selection:** existing jobs embed mutable tags. Preserve old images and
  never retag shared latest while queued consumers remain.
- **Secure infrastructure:** queue ID, notification, secure-account credentials,
  output access and admin CORS remain pending verification/configuration elsewhere.

## 4 and 6. Proposed rollout and rollback order

This is an ordered preparation plan, not an executable release yet. Missing release
artifacts, external ownership and compatibility evidence are explicit gates.

1. Produce an isolated candidate by reconciling the observed server changes with
   the secure-intake patch. Preserve client tuning/dedupe. Choose explicitly whether
   to include the separate 1C normalization. Build/test the candidate offline.
2. Build the source-MP4 worker under a unique release tag, record image ID and
   published digest if applicable, and retain previous images. Stage complete
   listener build output, manager dependencies and private configuration. Do not
   run the manager for preflight: startup mutates Redis state.
3. Resolve admin/LMS deployment locations and actual origin/CDN/report contracts.
   Prepare the admin fork landing without including the original checkout's unrelated edits.
4. Complete the secure queue/notification prerequisite from the handoff in the secure
   account, with bounded retry/dead-letter handling and assessed historical backlog.
   Keep secure uploads paused. Do not reuse either public hranker queue.
5. Establish a coordinated quiet window for **all affected producers**, including
   APX and live 1C submitters. Let existing intake deliveries and Redis jobs drain.
   Once upstream work and in-flight intake are accounted for, stop affected intake
   consumers and recheck queues. Do not simply stop the shared manager with work running.
6. Require no active manager containers, no external drain ownership, reconciled
   processing records/counters, and empty or explicitly reconciled affected queues.
   Capture a private code/config/PM2 rollback snapshot and immutable worker IDs.
7. Switch the manager to the compatibility-tested candidate after the drain.
   Keep stats API/module compatibility in the release plan. Start the R2 listener
   with explicit worker pin and validated secure lane. Preserve the B2 listener's
   isolated environment; if it shares replaced build files, include it explicitly
   in compatibility testing and controlled restart scope. Never use `pm2 restart all`.
8. Deploy the admin upload change last, keeping general uploads paused. Controlled
   canaries must use dedicated classes: multipart completion → correct queue → one
   Redis job → source-worker outputs → secured reports → playback/download. Repeat
   representative existing-lane canaries and check denied unsigned/wrong-scope access.
9. Reopen producers/uploads gradually only after all canaries pass. Observe each
   lane's queue backlog, retry/exhaustion signals, Redis wait/processing counts,
   container exit/failure status, callback results and output origin. Establish a
   numerical observation window using actual canary duration before the rollout.

**Stop criteria:** wrong account/bucket/report base, cross-lane dedupe/collision,
unexpected job multiplication, secure guard refusal, failed callback, unreadable
output, restart/preflight failure, unexplained queue growth, or untracked active work.

**Rollback:** pause affected intake/producers, account for candidate in-flight jobs,
then restore the captured server code/config and exact previous image references
after draining. Keep secure admin uploads paused and the secure R2 backlog retained
if the previous listener cannot process it. Existing R2 public processing can resume
under its saved release. Do not redirect secure uploads to B2, remove secure R2
objects, clear queue-wide dedupe, or blindly replay source history. Previously
completed secure outputs remain on R2; verify their LMS/CDN references separately.

## Next deliverable

A reconciled release candidate and the expanded compatibility evidence above,
followed by final commands/artifact identities for this host. Production deployment
remains gated on that work, queue configuration, producer coordination, and verified
admin/LMS targets. This investigation does not establish regression-free operation.
