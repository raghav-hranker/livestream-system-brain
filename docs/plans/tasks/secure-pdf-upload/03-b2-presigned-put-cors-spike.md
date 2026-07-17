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
