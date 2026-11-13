# Vidyagram intake lane — 2026-10-21

Status: listener built/tested/committed locally; Cloudflare credentials, notification and CORS prepared and verified.
Credential compatibility blocker resolved by a new two-bucket job key. **Not deployed**; nothing pushed; Vercel env untouched.
Queue-token transcript exposure is recorded below; token remains active pending Raghav’s decision.

## Created in Cloudflare

Account: **Deepaksharma7933@gmail.com's Account**, `1ff6f2000c9aa34ca2ec88c066af092a`.
Used Deepak (Work) Chrome profile. No quicktricks/Hranker resource was changed or used for a job.

| Resource | Name / ID | Verified state |
|---|---|---|
| R2 bucket | `tempvideos-vidyagram` | Created Oct 21; APAC location hint and actual location; Standard; public access disabled; initially empty |
| Queue | `vidyagram-intake` / `55c141b1ad5f4cb99d4410e7df1eb4a9` | Created Oct 21; active after HTTP Pull consumer saved |
| Consumer | HTTP Pull | Form submitted with batch 10, max retries 3, retry delay 0, no DLQ selected; consumer visibly saved |
| Visibility | 30 seconds | Listener request explicitly sends 30000 ms on this lane; legacy lanes keep 60000 ms |
| Event notification | `40b10727-8454-4441-adde-9e3961198abc` | Created 2026-10-21 12:25 UTC by Raghav with `wrangler r2 bucket notification create tempvideos-vidyagram --event-type object-create --queue vidyagram-intake` (dashboard picker was empty). Verified with `wrangler r2 bucket notification list`: queue `vidyagram-intake`, all prefixes/suffixes, PutObject/CompleteMultipartUpload/CopyObject. The container's own `status.json` writes also fire it; the listener acks and drops those (`src/intake-message.js:40-43`) |
| Listener intake token | `vidyagram-listener-intake-read` | Created after explicit confirmation; Active; Object Read only on `tempvideos-vidyagram` only |
| Admin intake token | `vidyagram-admin-intake-upload` | Created after explicit confirmation of Object Read & Write (upload + list/status reads); Active; `tempvideos-vidyagram` only |
| Queue API token | `vidyagram-intake-queue` | Created after explicit approval: only Account → Queues → Edit, only Deepak account. Pull/ack verified. Account-wide queue scope expressly approved; no existing queue settings changed |
| New job token | `vidyagram-transcode-job` | Created after explicit approval: Object Read & Write on exactly `tempvideos-vidyagram` and `recordedvideos-vidyagram`, Forever, no IP filter; PUT/GET/DELETE verified in both |
| Existing output token | `vidyagram-ingest` | Verified Active, Object Read & Write, restricted to `recordedvideos-vidyagram`; unchanged |

No lifecycle for originals was added. Cloudflare automatically created its default multipart-abort rule
(unfinished multipart uploads after seven days); this is not an originals-expiration rule and was left alone.
CORS set 2026-10-21 (wrangler, mirrors `tempvideos-recorded-v2`'s rule): origin `https://admin.vidyagramar.com`, method PUT, headers *, expose ETag, max-age 3600. The admin browser PUTs presigned UploadPart URLs straight to R2 (`lib/video-storage.ts:125`) and reads each part's ETag, so ETag must be exposed.

Secret handling: `/Users/raghav/Projects/system-brain/.env.development` verified gitignored and set to **0600**.
Both new token values and S3 credentials were saved immediately without printing their values.
Listener credentials: `CF_VIDYAGRAM_ACCESS_KEY_ID`, `CF_VIDYAGRAM_SECRET_ACCESS_KEY`,
`CF_VIDYAGRAM_INTAKE_API_TOKEN`. Admin credentials: `R2_VIDEO_UPLOAD_KEY_ID`,
`R2_VIDEO_UPLOAD_KEY_SECRET`, `VIDYAGRAM_ADMIN_INTAKE_API_TOKEN`; proposed endpoint/bucket
also staged locally. Vercel env unchanged. `CF_VIDYAGRAM_API_TOKEN` now contains the queue token.
`CF_VIDYAGRAM_OUTPUT_ACCESS_KEY_ID` / `CF_VIDYAGRAM_OUTPUT_SECRET_ACCESS_KEY` now contain the
new two-bucket job key, replacing the former output-only CF aliases. Its token value is stored as
`VIDYAGRAM_TRANSCODE_JOB_API_TOKEN`. `CF_VIDYAGRAM_INTAKE_API_TOKEN` is unchanged: it is the
R2 listener read token’s API-token value, **not** the Cloudflare Queues token.

[Bucket proof](vidyagram-intake-bucket-2026-10-21.png) ·
[Verified token scopes, no secrets](vidyagram-intake-tokens-2026-10-21.png) ·
[Empty notification queue picker](vidyagram-notification-empty-queues-2026-10-21.png) ·
[Queue-token account scope](vidyagram-queue-token-scope-2026-10-21.png).

The empty dashboard notification picker was subsequently bypassed by Raghav using Wrangler;
notification and CORS are now complete as recorded above and notification delivery passed below.

[New job-token scope proof (no secrets)](vidyagram-job-token-created-2026-10-21.png).

## New credentials and live key checks — 2026-10-21

Created during this run, **18:03–18:11 IST (12:33–12:41 UTC)**; the dashboard displays the creation
date only, so exact token-creation seconds were not captured. Explicit confirmation received for both scopes.
Before any replacement, copied the env with preserved permissions to
`.env.development.bak-20261021-180349` (0600); both env and backup are gitignored.
No pre-existing Cloudflare token was modified; `vidyagram-ingest` remains available to mirror workers.

Verified **18:11:25–18:11:37 IST** using a scratch Node script loading credentials from the env file
and the repo’s S3 SDK. No credentials on command lines. Results:

| Check | Result |
|---|---|
| Job key PUT → GET → DELETE `781/_keycheck/probe.txt`, intake | PASS |
| Job key PUT → GET → DELETE same key, Vidyagram output | PASS |
| Listener read key GET intake probe | PASS |
| Listener read key PUT intake probe | Denied, HTTP 403 as required |
| Job key HeadBucket on `recordedvideos-hranker-v2` | Denied, HTTP 403; no object read/write there |
| PUT `781/_keycheck/status.json` → R2 notification → queue pull | Message received: yes |
| Ack exactly that status message’s lease | Ack OK |
| List `781/_keycheck/` in both Vidyagram buckets after cleanup | Empty in both |

Only the matching status message was acknowledged. Other messages encountered during pull were left
unacknowledged as instructed; the intake probe’s object-create event may remain/retry after its object
was deleted. The buckets are clean; no claim is made that the queue was emptied.

**Queue cleanup check (later, 2026-10-21):** a scratch script pulled `vidyagram-intake` with `CF_VIDYAGRAM_API_TOKEN`
(batch 10, visibility 30 s), set to ack only `781/_keycheck/*` messages and leave anything else. Three pulls ~5 s
apart returned no messages: nothing acked, nothing left. Inferred: the leftover probe events had used their 3
deliveries during the earlier checks and were dropped (no DLQ). Queue token kept as is (Raghav's decision).

**Credential exposure incident:** the new queue-token value inadvertently appeared once in a tool result
because the dashboard used it as a button label. No secret screenshot was taken and the value is not
repeated in this report. Informed Raghav immediately and asked permission to revoke/replace this new token;
he asked why. Explained that the saved tool transcript is an extra copy outside the secrets file.
No revocation was authorized or performed. The token remains active and was used for the originally
requested successful verification. Raghav’s decision on replacement remains outstanding.

## Code and validation

Repo `raghav-hranker/video-transcoder`, worktree `~/Projects/worktrees/vt-vg-upload-lane`,
branch `feat/vg-upload-lane`, **f721759**, author `raghavsharma@hranker.com`, no co-author trailer.
Clean worktree after commit. No push. Changes replace 40fd792's per-client output override with an opt-in
`CF_VIDYAGRAM` lane, independent intake credentials and 30-second visibility.
Per-repo details: worktree `CONTEXT.md`, “Vidyagram dedicated intake”.

`npm test`: **482 passed**, zero failed. `npm run build` passed; tracked `dist/index.js` committed.
The count changed from 486 because seven override tests were replaced by three dedicated-lane tests.
Real listener assertions cover Vidyagram output credentials/bucket/endpoint/CDN/API/secured flag,
intake read credentials, 1080p/HLS-only profile, batch 10/30-second visibility/queue identity,
and non-781 rejection before source read, Redis submission or acknowledgement.
All five existing lane types are compared against the actual compiled 40fd792 listener and routing;
legacy jobs match with Vidyagram absent and enabled (timestamps excluded).
Negative proof: temporarily substituting the output credentials for intake credentials makes the
isolated Vidyagram test fail (`vg-ingest` versus `vg-intake-read`); restored before full green suite.
`git diff --check` passed. `container/` equals release 5a4cf9b; no rebuild performed.

## Container credential compatibility — resolved without container changes

The unchanged manager passes one credential pair for intake reads/status writes and output uploads.
The former output-only `vidyagram-ingest` alias was unsuitable for this. The new dedicated
`vidyagram-transcode-job` key has exactly the two required Vidyagram buckets, and passed the actual
S3 operations on both. `CF_VIDYAGRAM_OUTPUT_*` now holds this key. No image rebuild or container
change is needed for this credential issue. A real encode/playback acceptance test is still future work.
Do not activate the listener/admin path or restart the manager in this task.

## Approved scope decisions

Raghav approved the queue token’s unavoidable account-wide scope with only Queues Edit on the named account.
All other queues and tokens remain unchanged; verification pulled/acked only `vidyagram-intake`.
Raghav also previously approved the admin intake Object Read & Write token, needed for file/status listing.
The listener uses its separate Object Read only intake key.

## Admin inspection (no code or environment changes)

Vercel **vidyagram-admin**, team `raghav-sharmas-projects-330d4c84`, production branch `vidyagram-admin`.
Vercel Domains visibly maps `admin.vidyagramar.com` to Production with Valid Configuration.
[Project domains](https://vercel.com/raghav-sharmas-projects-330d4c84/vidyagram-admin/settings/domains).

`~/Projects/worktrees/vidyagram-admin-ui/lib/video-storage.ts` requires these four vars with no fallback:

| Variable | Proposed value |
|---|---|
| `R2_VIDEO_UPLOAD_ENDPOINT` | `https://1ff6f2000c9aa34ca2ec88c066af092a.r2.cloudflarestorage.com` |
| `R2_VIDEO_UPLOAD_BUCKET` | `tempvideos-vidyagram` |
| `R2_VIDEO_UPLOAD_KEY_ID` | Dedicated admin intake key, created and saved locally |
| `R2_VIDEO_UPLOAD_KEY_SECRET` | Dedicated admin intake secret, created and saved locally |

Class key is `<customerId>/<classId>/<filename>`; customer 781 remains unchanged.
`lib/video-storage.ts` also performs `ListObjectsV2`/`GetObject` for intake listing/status.
Shorts use `lib/shorts-storage.ts` and `SHORTS_UPLOAD_ENDPOINT`, `SHORTS_UPLOAD_BUCKET`,
`SHORTS_UPLOAD_KEY_ID`, `SHORTS_UPLOAD_KEY_SECRET`; distinct public intake contract, out of scope.
Actual deployed shorts env values were not read/changed.

The full gated deployment checklist is in `slices/hls-1080p.md`, “Vidyagram (781) upload lane”.

## Deployment and acceptance — 2026-10-21 (evening)

Deployed after Raghav allowed GPU-box and webserver2-2 access. Full live state, rollback commands and the acceptance
checklist are in `slices/hls-1080p.md` → "Vidyagram (781) upload lane (DEPLOYED 2026-10-21)". Summary:

- Branch `feat/vg-upload-lane` f721759 pushed (explicit refspec; local upstream was the release branch).
- Listener pm2 20 on `/root/releases/vg-upload-f721759` (13:49Z). Manager pm2 13 restarted 14:26:14Z with 781 secured +
  `TRANSCODER_SECRET_781`. Five 1C jobs orphaned and finalized by `finalize-orphans.js`.
- Vercel `vidyagram-admin` Production: the four `R2_VIDEO_UPLOAD_*` vars were not set before; added, live from `iz4qim160`.
- A leftover `781/_keycheck/probe.txt` event from the key checks became a junk job (the secured lanes never read the source).
  Removed from `queue:critical`; payload kept at `releases/vg-upload-f721759/removed-probe-job.json`.
- One `vidyagram-intake` pull returned `Method Not Allowed` (first minute); never repeated.
- Test upload v5.mp4 → class "test": 5 rungs incl. 1080p in recordedvideos-vidyagram, hlsAsset set, signed playback 200,
  nothing in quicktricks buckets. **Job ends FAILED** on the `recordings-prerecorded` 400 (empty output, MP4 off).
