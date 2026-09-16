# LMS: transcode-complete endpoint + 24h sweeper

**Type:** AFK  
**Status:** `ready-for-agent`  
**ADR:** [0007](../../../adr/0007-shorts-readiness-via-transcode-callback.md) decisions 3, 6, 7

## Repo

`quicktricks-backend`, worktree off `origin/quicktricks-admin` (contains the shorts work `f5a0b4ab7`:
`src/routes/shortRoutes.ts`, `src/controllers/shortController.ts` → `attachShortVideo`,
`src/schemas/shortSchemas.ts`, `src/models/Short.ts`, `src/types/assetRef.ts`).

## What to build

1. **Route** `POST /api/shorts/transcode-complete`, middleware `requireTranscoderSecret`
   (`src/middleware/transcoderSecretMiddleware.ts`, compares against `TRANSCODER_WEBHOOK_SECRET`).
   Registered in `shortRoutes.ts` **before** `/:id` routes so the literal path is not swallowed.
2. **Schema** (zod, strict): the ADR-0007 body. `status` ∈ `processed | failed`; `outputs.hls.key`
   required when `processed`, bucket-relative (reject a leading `/` and any `bucket` field, since a
   zone alias must never arrive on the wire); `durationSec` optional non-negative integer; `error`
   optional string, only meaningful with `failed`; `jobId`, `clientId` strings, echoed into the log.
3. **Handler** in `shortController.ts`:
   - `roomId` must be a valid ObjectId and resolve to a Short, else 404 (`ReportError` non-retryable on
     the transcoder side ⇒ the job fails visibly; correct for a deleted short).
   - `processed`: derive the expected key with the same helper `attachShortVideo` uses
     (`{clientId}/{shortId}/hls/master.m3u8`). Reported key ≠ derived key ⇒ 409. If `videoAsset` is
     absent, set it to `{ bucket: 'shorts', key }` (typed `PublicAssetRef`), so the callback is a
     sufficient writer even when the admin's `sourceKey` PATCH has not landed. Set
     `videoStatus='ready'`, `videoDurationSec`, clear `videoError`.
   - `failed`: `videoStatus='failed'`, `videoError = error ?? 'Transcode failed'`.
   - **Idempotent**: same status again ⇒ 200 with the serialized Short, no write.
   - **Evidence beats guess**: `processed` always overrules a `failed` written by the sweeper (see 4).
     A `failed` callback after `ready` is logged and ignored (the bytes are demonstrably there).
   - Response `{ state: 200, data: serializeShort(...) }`; `link` populated proves the derivation.
4. **Model**: `videoDurationSec?: number`, `videoError?: string`, `videoAttachedAt?: Date` (set when
   `sourceKey` attaches or when the callback sets `videoAsset`; the sweeper's clock).
5. **Sweeper**: mirror the existing `staleStreamSweep` (registered from `src/app.ts`, tests in
   `src/tests/staleStreamSweep.test.ts`). Hourly: `videoStatus='processing'` and
   `videoAttachedAt < now - SHORTS_TRANSCODE_DEADLINE_HOURS` (env, default `24`) ⇒ `failed`,
   `videoError='No transcode report received'`. It never reads the CDN and never writes `ready`.
   Single-instance guard the same way the stream sweep does (pm2 runs one process; keep whatever lock
   it uses).

## Acceptance criteria

- [ ] Missing / wrong secret ⇒ 401 with the existing `Unauthorized.` body; nothing written.
- [ ] Unknown `roomId` ⇒ 404. Key mismatch ⇒ 409. Body with `bucket` ⇒ 400.
- [ ] `processed` on a Short with no `videoAsset` sets asset + `ready` in one request; response `link`
      is `SHORTS_PUBLIC_BASE_URL/{key}`.
- [ ] Repeat `processed` ⇒ 200, no second write (assert `updatedAt` unchanged).
- [ ] `processed` after sweeper `failed` ⇒ `ready`. `failed` after `ready` ⇒ stays `ready`.
- [ ] Sweeper test: 25h-old processing ⇒ failed; 23h-old ⇒ untouched; `ready` rows untouched.
- [ ] `npm test` green in the worktree; `tsc` clean (the box builds from `dist`, tracked).

## Do not

- Touch `attachShortVideo`'s `{ videoStatus }` arm here (task 07 removes it after acceptance).
- Add any HEAD/GET to the CDN anywhere in the LMS for shorts.
- Reuse `stream-status` or `recordings-prerecorded` code paths; shorts stay outside that seam.
