# B2 presigned PUT + CORS spike

**Type**: HITL
**Blocked by**: None — can run parallel to #1

## What to build

A thin, disposable proof that the bulk architecture's riskiest assumption holds: a browser can `PUT`
bytes directly to the private `hranker-private-assets` bucket using a short-lived, single-object
presigned S3 `PUT` minted server-side, and the bucket stays otherwise private. Configure B2 CORS for
the explicitly-listed admin-dashboard origins (`PUT` + required headers only — no list/delete, no public
read); presign a 15-minute single-object `PUT` from a server-side script using the existing B2
credentials; upload a real PDF from a browser page with progress; then verify the object landed
(`HeadObject`) and that unsigned Bunny/B2 reads still 403.

HITL because it needs B2 account/console configuration and a decision on the exact origin list.
This is the PRD's "small real-B2 test outside ordinary CI" — its output is a verified CORS rule set and
a known-good presigning recipe that slice #4 codifies, plus notes on any B2 S3-endpoint quirks.

## Acceptance criteria

- [ ] B2 CORS rules accept `PUT` from the configured admin origins with only required headers; documented in the task notes
- [ ] Browser `PUT` with a valid presigned URL succeeds and reports upload progress (XHR)
- [ ] `PUT` after the 15-minute TTL, `PUT` to a different key, and any non-`PUT` method with the same credential all fail
- [ ] Unsigned read of the uploaded object (Bunny documents zone and direct B2) → 403; bucket remains private
- [ ] No durable B2 credential ever reaches the browser; presigning happens server-side only
- [ ] Findings recorded (endpoint quirks, exact CORS JSON, header requirements) for slice #4 to consume

## User stories covered

- Story 26: browser unable to choose a bucket or arbitrary object key
- Story 27: upload credentials limited to one method, one object, a short time
- Story 28: B2 account credentials remain server-only
- Story 30: unsigned reads remain forbidden

## Execution notes — 2026-07-17

Pre-spike credential audit:

- The `phonetics` test VM has the Bunny documents-zone read/signing variables but no B2 write
  variables, so task 01 cannot yet run its deployed create acceptance there.
- An older B2 key exists on `test-uday`, but `b2_authorize_account` reports that it is not bucket- or
  prefix-restricted and includes account-wide key/bucket administration and deletion capabilities.
  It must **not** be copied to `phonetics` or used by the upload service.
- Create a server-only application key restricted to the physical bucket
  `hranker-private-assets`, preferably to the `pdfs/` prefix, with only the capabilities needed by
  the upload design. Task 01 needs object write; task 04 completion additionally needs object
  metadata/read-range verification. Do not grant key management, bucket management, or deletion.
- Install the safe key on `phonetics` as `B2_ACCESS_KEY_ID` and `B2_SECRET_ACCESS_KEY`, plus
  `B2_S3_ENDPOINT` (or `B2_ENDPOINT`) and `B2_REGION`. `B2_DOCUMENTS_BUCKET` may be set explicitly;
  otherwise the backend defaults it to `hranker-private-assets`. The deploy script must preserve
  these variables across redeploys.

Still awaiting the HITL origin decision: record the exact production/admin preview origins before
changing B2 CORS. Do not use `*`.

## Key strategy (settled 2026-07-20)

Everything for this client lives on **B2** (no R2). One app key per **consumer × bucket × purpose**,
named `<consumer>-<bucket/zone>-<purpose>[-<env>]` (e.g. `lms-private-assets-pdf-upload-phonetics`).
B2 app keys can scope to at most one bucket, which enforces the split. Rules:

- Master key: password manager only, used solely to create/revoke app keys. Never on a server.
- No `deleteFiles`, key-management, or bucket-management capability on any server-held key.
  GC/cleanup jobs get a short-lived (`--duration`) ops key minted for the occasion.
- The **public assets bucket** (images/banners; bucket set to public) gets its own key too —
  e.g. `lms-public-assets-image-upload-<env>`, scoped to that bucket, `writeFiles,readFiles,listFiles`.
  Public readability is a bucket property; the write key stays as narrow as the private one.
- Per-environment keys (`-phonetics` vs `-prod`) so a test box can be revoked without touching prod.
- Key IDs (not secrets) are recorded here as minted, so the console key list stays auditable.
- After the restricted upload key works: **delete the account-wide key from test-uday**.

Mint for task 01/04:
`b2 key create --bucket hranker-private-assets --name-prefix pdfs/ lms-private-assets-pdf-upload-phonetics listFiles,readFiles,writeFiles`

## Execution notes — 2026-07-20 (key minted)

`lms-private-assets-pdf-upload-phonetics` minted via the B2 native API from test-uday (account key
never left that box): keyId `0052b3cdedeb6890000000005`, bucket `hranker-private-assets`, prefix
`pdfs/`, caps `listFiles,readFiles,writeFiles`. Installed on phonetics in `~/.quicktricks-lms-secrets`
(the file the deploy script preserves) as `B2_ACCESS_KEY_ID`/`B2_SECRET_ACCESS_KEY` +
`B2_S3_ENDPOINT=https://s3.us-east-005.backblazeb2.com`, `B2_REGION=us-east-005`,
`B2_DOCUMENTS_BUCKET`. Verified working by the task-01/02 integrated acceptance.

**Still pending (the actual spike):** the admin-dashboard production/preview origin list and the B2
CORS rule for browser `PUT` (task 04 gate) — and, once confident, deleting the account-wide key from
test-uday (a prod `-prod` upload key must be minted before prod deploy).

## Execution notes — 2026-07-20 (spike complete: CORS + browser PUT verified)

**Origin decision (user):** `http://localhost:3000` only for now — the dashboard runs locally against
the phonetics tunnel. The prod origin gets added to the same rule alongside the `-prod` key mint,
which is already a pre-prod-deploy step.

**CORS rule applied** via native `b2_update_bucket` from test-uday (account key never left the box;
bucket had **no** pre-existing rules). Bucket `hranker-private-assets` (`allPrivate`), exact rule:

```json
[{
  "corsRuleName": "adminDashboardPdfPut",
  "allowedOrigins": ["http://localhost:3000"],
  "allowedOperations": ["s3_put"],
  "allowedHeaders": ["content-type"],
  "exposeHeaders": ["etag"],
  "maxAgeSeconds": 3600
}]
```

**All acceptance criteria verified:**

- Preflight from `http://localhost:3000` → 200, `allow-methods: PUT`, `allow-headers: content-type`,
  `max-age: 3600`. Preflight from a foreign origin → 403.
- Real browser XHR `PUT` (Chrome, page on `localhost:3000`, real `%PDF-` blob) → **200 + ETag**, XHR
  upload-progress events fired. Presigned server-side on phonetics with the restricted upload key.
- Expired URL (1s TTL) → 401 `UnauthorizedAccess`. Same signature on a different key → 403
  `SignatureDoesNotMatch`. `GET`/`DELETE` with the PUT credential → 403 (method is signed).
- Server-side `HeadObject` OK (209 bytes, `application/pdf`), range-read confirms `%PDF-` magic.
- Unsigned reads denied: direct B2 → 401, Bunny documents zone (`hranker-private-assets.b-cdn.net`) → 403.
- No durable credential ever reached the browser; only the 15-min single-object URL did.

**Findings for task 04 (the presigning recipe):**

1. **Payload hash must be `UNSIGNED-PAYLOAD`.** A hand-rolled `@smithy/signature-v4` `presign()`
   defaults the payload hash to the empty-body SHA → every `PUT` with a body fails 403
   `SignatureDoesNotMatch`. Use `@aws-sdk/s3-request-presigner` (it sets
   `X-Amz-Content-Sha256=UNSIGNED-PAYLOAD`, hoisted into the query, `SignedHeaders=host`,
   content-type unsigned) — do not hand-roll.
2. **B2 error responses carry no CORS headers** → the browser sees an opaque failure (`status 0`),
   and XHR upload progress hits 100% *before* the failure surfaces. Client rule: progress is not
   success; only the completion status is truth; treat opaque failures as retryable with a **fresh**
   upload-target (the browser cannot distinguish expired vs transient).
3. Virtual-host-style URL (`<bucket>.s3.us-east-005.backblazeb2.com`) works with B2 + presigning.
4. `content-type` stays unsigned but the browser still sends it — the CORS rule must (and does)
   allow it. Only `etag` needs exposing for the client to read the upload result.
5. Spike object left at `pdfs/UPLOADCHECK-cors-spike.pdf` (UPLOADCHECK fixture convention; the
   upload key has no delete capability, by design).

**Remaining (deferred, pre-prod):** add the prod origin to the CORS rule; mint the `-prod` upload
key; delete the account-wide key from test-uday.

## Execution notes — 2026-07-20 (decision: no separate `-prod` upload key)

**User decision, overriding the per-environment-key rule above for this client:** no separate
`-prod` upload key will be minted. The existing `lms-private-assets-pdf-upload-phonetics` key
(keyId `0052b3cdedeb6890000000005`) serves production too. The pre-prod checklist therefore
shrinks to:

1. Add the production dashboard origin to the `adminDashboardPdfPut` CORS rule.
2. Delete the account-wide key from test-uday.

The `-env` suffix in the key name is now historical — treat the key as the single upload
credential for `hranker-private-assets`/`pdfs/`, not as phonetics-scoped.
