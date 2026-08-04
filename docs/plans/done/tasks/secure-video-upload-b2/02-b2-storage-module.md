# B2 storage module + unit tests

**Type**: AFK
**Blocked by**: None — can run parallel to #1 (consume its recorded quirks if already available)

## What to build

The slice's one deep module, in admin-dashboard: a B2-targeted storage module exposing the
same four operations the multipart routes already consume from the R2 module —

- create multipart upload (returns `uploadId` + `fileKey`)
- presign a part-upload URL (`uploadId`, `partNumber`)
- complete the multipart upload (parts + ETags)
- list the upload bucket under a customer prefix, merging each file's sibling
  `status.json` into a per-file `processed` flag (the uploads-SSE contract)

against B2's S3-compatible endpoint. Server-only env: `B2_S3_ENDPOINT`,
`B2_VIDEO_UPLOAD_BUCKET`, `B2_VIDEO_UPLOAD_KEY_ID`, `B2_VIDEO_UPLOAD_KEY_SECRET` — **fail
loudly when any is unset** (same posture as the Streamer secret; no fallback to the R2
client, ever). The R2 module is not touched; its other consumers (editorial media, generic
uploads, PDF delete) keep working unchanged.

Document the new envs in `.env.example`.

## Acceptance criteria

- [ ] Module exposes the four operations with signatures the routes can adopt as a pure import swap
- [ ] Any missing env var → loud throw naming the variable; no silent R2 fallback path exists
- [ ] Key shape preserved: `{customerId}/{classId}/{sanitized-filename}`
- [ ] Unit tests (`node --test`, no network, env injected per test — jwt.test.ts precedent): fail-loud per env var; endpoint/bucket/key targeting; part-URL presigning against fixed creds; listing merges `status.json` → `processed`
- [ ] R2 module untouched; existing suites still pass

## User stories covered

- Story 12: misconfigured deploy fails loudly instead of silently reverting to R2
- Story 13: image/editorial R2 surfaces undisturbed
- Story 15: storage swap isolated behind one module with an unchanged interface
