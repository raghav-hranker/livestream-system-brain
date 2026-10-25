# Certificate status on the course page

**Type**: AFK
**Blocked by**: 01
**Repo**: backend

## What to build

The app can show "Reach 100% to unlock your certificate" and the button from one field, without issuing anything
yet.

- **Eligibility policy (pure).** It takes the facts and returns `issued` (with the certificate), `eligible`, or
  `ineligible` with one reason. The reasons, checked in this order:
  1. `not_enabled`
  2. `not_purchased`
  3. `no_classes`
  4. `incomplete`
  5. `claims_closed`

  An existing certificate beats every reason. The policy does no I/O. Until task 04 adds the model, "existing
  certificate" is always none.
- **Facts reader.**
  - **Progress** comes from the existing course progress pipeline, the same `progressPercentage` the app shows.
    `incomplete` means below 100.
  - **Ever owned** reuses the order matching behind the admin course-purchasers list. It counts direct, plan and
    build orders, active or expired, admin-assigned and AppX-imported. A build counts only if it covers the whole
    course; partial chapter builds don't.
  - A free course skips `not_purchased`.
  - `no_classes` means the course has zero active class placements.
- **Course detail field.** `POST /api/courses/by-id-2` gains
  `certificate: { state, reason?, progress, code?, imageUrl?, pdfUrl?, shareUrl? }`.
  - The student comes from the bearer token (`bearerUserId`, as for the exchange field), never from the body
    `userId`. With no token the field is `null`.
  - The field is `null` when `CERTIFICATES_ENABLED` is off.
- **`GET /api/courses/:id/certificate`** returns the same object. It needs a student token, and returns 404 when the
  feature is off.
- **Config.** Read `CERTIFICATES_ENABLED` and `CERTIFICATE_CLAIMS_OPEN` the way `EXCHANGE_ENABLED` is read: 1, true,
  yes or on. Both default off.

## Acceptance criteria

- [ ] Unit (table): each reason on its own fixture; the first reason wins when several apply; at 99.99 the result is
      `incomplete` and at 100 it is `eligible`; a free course passes without an order; an expired order counts as
      owned; a partial build does not.
- [ ] Integration: a buyer at 100% on a complete course, with claims open, sees `eligible`. Before the course is
      complete they see `not_enabled`. With claims closed they see `claims_closed`.
- [ ] Integration: a non-buyer who ticked every class sees `not_purchased`.
- [ ] Integration: adding a class moves a 100% student to `incomplete`.
- [ ] Integration: `by-id-2` with a body `userId` and no token returns `certificate: null`. With a token, the token
      decides.
- [ ] Integration: with `CERTIFICATES_ENABLED` off, the field is `null` and the GET returns 404.
- [ ] `NO NEW FAILURES` against the backend baseline.

## User stories covered

- Stories 1, 2, 3, 4, 6, 16, 20, 26, 27, 36, 38, 41, 42
