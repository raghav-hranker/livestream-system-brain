# Claim, preview and My certificates

**Type**: AFK
**Blocked by**: 02, 03
**Repo**: backend + system-brain (index script)

## What to build

An eligible student previews and claims a certificate. The files are drawn once, stored in R2, and listed in the
student's profile.

- **Certificate model.** A new `certificates` collection with these fields:
  - `code`
  - `userId`
  - `courseId`
  - `name`
  - `courseTitle` (frozen)
  - `completionDate`
  - `issuedAt`
  - the `signatory` snapshot
  - `templateVersion`
  - `pdfKey` and `imageKey`

  The schema declares unique indexes on `code` and on (`userId`, `courseId`), but prod builds them only through the
  script below.
- **Code.** `VG-` plus 10 characters drawn with `crypto.randomInt` from Crockford base32 (no I, L, O or U). A
  duplicate-key error on `code` redraws.
- **Store.** It writes `<code>` (the PDF) and `<code>.png` to the certificates bucket.
  - It uses its own S3 client from `CERTIFICATE_R2_ENDPOINT`, `CERTIFICATE_R2_BUCKET`, `CERTIFICATE_R2_ACCESS_KEY_ID`
    and `CERTIFICATE_R2_SECRET_ACCESS_KEY`. The existing upload helper targets B2 and must not be reused.
  - The PDF is stored with `Content-Type: application/pdf`, `Content-Disposition: inline;
    filename=Vidyagram_Certificate.pdf` and `Cache-Control: public, max-age=31536000, immutable`. The PNG gets the
    same cache header.
  - Links are `<CERTIFICATE_BASE_URL>/<code>` and `<CERTIFICATE_BASE_URL>/<code>.png`.
  - Tests use an in-memory fake store behind the same interface.
- **Signatory config.** `CERTIFICATE_SIGNATURE` is `on` or `off`, with `CERTIFICATE_SIGNATORY_NAME` and
  `CERTIFICATE_SIGNATORY_TITLE`. Off gives `signatory: null`.
- **Name rule.**
  - Trimmed, 2–60 characters.
  - Not "Guest User" in any letter case.
  - Letters (Latin or Devanagari), spaces, dots, apostrophes and hyphens only.
  - Anything else is 400 `invalid_name`.
  - The status object gains `suggestedName`: the profile's first and last name, or empty when the profile says
    "Guest User" or is blank. The app pre-fills the field with it.
- **`POST /api/courses/:id/certificate/preview`** with `{ name }` returns an `image/png` at preview scale and stores
  nothing. It is allowed only when the student is `eligible`; otherwise it returns 409 with the reason.
- **`POST /api/courses/:id/certificate/claim`** with `{ name }`:
  - If the policy says `issued`, it returns 200 with the existing certificate and ignores the name.
  - If the student is eligible, it validates the name, draws a code, renders at print scale, uploads both files,
    then inserts the record, and returns 201.
  - A duplicate (`userId`, `courseId`) on insert means a racing claim won. It returns that claim's certificate with
    200 and leaves this call's uploaded files behind.
  - Otherwise it returns 409 with the reason.
  - The completion date is the claim day in IST.
  - The body is `{ code, name, courseTitle, completionDate, imageUrl, pdfUrl, shareUrl }`.
- **`GET /api/certificates/mine`** returns the student's certificates, newest first, in the same shape.
- **The status field and GET** now fill `code`, `imageUrl`, `pdfUrl` and `shareUrl` when a certificate is `issued`.
- **Index script.** Add `reference/scripts/vidyagram-certificate-indexes.cjs`, modelled on
  `vidyagram-feedback-indexes.cjs`. It is dry-run by default, uses `commitQuorum: 'majority'` and refuses any
  database other than `vidyagramdb`. Do not run it against prod; task 06 does that.

All student routes take the user from the token and return 404 when `CERTIFICATES_ENABLED` is off.

## Acceptance criteria

- [ ] Integration: an eligible student claims and gets 201. The record is stored, and the fake store holds both
      keys with the right content type and disposition.
- [ ] Integration: a second claim with a different name returns 200 with the same code and the original name.
- [ ] Integration: two concurrent claims leave one record, and both calls return the same code.
- [ ] Integration: "Guest User", "guest user", "x" and a 61-character name each return 400 `invalid_name`.
- [ ] Integration: a `not_purchased` student gets 409 on both preview and claim.
- [ ] Integration: preview returns a PNG and writes nothing to the store or the collection.
- [ ] Integration: after the course is reopened, the student still sees `issued` with the links, and
      `/certificates/mine` lists the certificate.
- [ ] Unit: codes match `^VG-[0-9A-HJKMNP-TV-Z]{10}$`. A forced duplicate redraws.
- [ ] Index script: a dry run against a local copy prints the two indexes and refuses a quicktricks database name.
- [ ] `NO NEW FAILURES` against the backend baseline.

## User stories covered

- Stories 7, 8, 9, 11, 12, 13, 14, 15, 17, 18, 19, 21, 22, 23, 24, 25, 34, 35, 37, 40
