# PRD: Vidyagram certificate of completion

Status: ready-for-agent, drafted 2026-10-23 from the grilling session of the same day (Q1–Q21 below).
Vidyagram only (backend branch `vidyagram-admin`, admin branch `vidyagram-admin`). Nothing here ships to quicktricks.

## Problem Statement

A Vidyagram student finishes a course and has nothing to show for it. There is no certificate, nothing to share with
family or put on a CV, and no way for anyone else to check that the student really did the course. Other course
platforms students use (Udemy, Coursera, AlgoExpert) hand out a certificate at the end, and Vidyagram's courses are long,
paid courses that students do finish.

The Vidyagram team wants to reward completion with a certificate that looks official, that students can share, and
that cannot be faked by editing a PDF, without adding a new rule students have to understand.

## Solution

When an admin marks a course as complete, every student who bought that course and has reached 100% on its
progress bar can claim a certificate in the app.

- The course page already shows the progress bar. Next to it the app shows "Reach 100% to unlock your certificate".
  At 100%, once the course is marked complete, a "Get certificate" button appears.
- The claim screen previews the certificate with the student's name and says the name can't be changed later. The
  student confirms or edits the name, then claims.
- The certificate is a one-page A4 landscape PDF in the "Classic ivory" design: ivory paper, a double gold border, the
  Vidyagram seal, "Certificate of Completion", the name, the course title, the completion date, one signature block
  and a certificate number such as `VG-7K3Q9XMD2P`. Names and course titles can be in Hindi or English.
- The certificate is drawn once, when it is claimed, and never changes afterwards.
- Every certificate has a public link that opens the PDF, like AlgoExpert's
  `certificate.algoexpert.io/<code>`. A student shares that link from the app. Anyone who opens it sees the
  certificate from a Vidyagram-controlled address, which is the proof that it is genuine.
- A "My certificates" list in the student's profile keeps every certificate easy to find.

## User Stories

1. As a student, I want the course page to tell me what unlocks a certificate, so that I know what to aim for.
2. As a student, I want the certificate rule to use the same progress bar I already see, so that there is only one
   number to understand.
3. As a student, I want ticking a class as done to count the same way it counts on the progress bar, so that the two
   never disagree.
4. As a student in a course that is still running, I want no certificate yet, so that a certificate means the whole
   course was finished.
5. As a student at 100% when the course is marked complete, I want a push notification saying my certificate is
   ready, so that I don't miss it.
6. As a student who reaches 100% after the course was marked complete, I want the "Get certificate" button to appear
   on the course page, so that I can claim it straight away.
7. As a student, I want to claim the certificate myself with one button, so that it is issued when I choose.
8. As a student, I want the claim screen to show my name as it will appear, so that I can fix a typo before it is
   printed.
9. As a student whose profile says "Guest User" or has no name, I want to be asked for my real name before claiming,
   so that my certificate doesn't say "Guest User".
10. As a student, I want to write my name in Hindi if I prefer, so that the certificate shows it the way I write it.
11. As a student, I want a clear warning that the name can't be changed after claiming, so that I check it carefully.
12. As a student, I want the claim to work even if I tap twice or my network drops, so that I end up with exactly one
    certificate.
13. As a student, I want to see my certificate in the app straight after claiming, so that I can look at it at once.
14. As a student, I want to open the PDF from the app, so that I can save or print it.
15. As a student, I want a Share button that sends a link, so that family, friends or an employer can see it.
16. As a student whose access to the course has expired, I want to still claim the certificate I earned, so that
    expiry doesn't take my achievement away.
17. As a student, I want a "My certificates" list in my profile, so that I can find old certificates after a course
    leaves my home screen.
18. As a student, I want my certificate to stay the same forever, so that what I shared once still shows the same
    thing later.
19. As a student, I want my certificate to keep working if the admin later adds a bonus class, so that I don't lose
    it.
20. As a student who hasn't claimed yet when a class is added, I want the progress bar to show the new class, so that
    I know I need it for the certificate.
21. As a person who receives the link, I want it to open the certificate PDF directly, so that I don't need an app or
    an account.
22. As a person who receives the link, I want it to come from a Vidyagram or Hranker address, so that I can trust it
    isn't a forged PDF.
23. As a person who mistypes a code, I want a "not found" response, so that I know the code is wrong.
24. As a student, I don't want my certificate to show up in Google searches for my name, so that sharing a link in a
    chat doesn't make it public on the web.
25. As a student, I don't want anyone to reach my certificate by guessing codes, so that only people I share it with
    can see it.
26. As a student who never bought a paid course, I want no certificate for it even if I ticked every class, so that
    certificates mean something for everyone.
27. As a student of a free course that the admin marked complete, I want to be able to claim, so that free courses
    can reward completion too.
28. As an admin, I want a "Course complete" switch on each course, off by default, so that certificates only start
    when I say the course is finished.
29. As an admin, I want to see when and by whom a course was marked complete, so that I can answer questions about
    it.
30. As an admin, I want to be able to switch "Course complete" off again if I flipped it by mistake, so that no more
    certificates are claimed for that course.
31. As an admin, I want switching it off to leave already-issued certificates alone, so that students never lose a
    certificate.
32. As an admin, I want a warning when I add a class to a course marked complete, so that I know students who
    haven't claimed will now need it.
33. As an admin, I want the push to go out only the first time I mark a course complete, so that toggling the switch
    doesn't spam students.
34. As the Vidyagram team, I want claims to stay closed until the real signature is checked or the signature block is
    dropped, so that no certificate is ever issued with test values.
35. As the Vidyagram team, I want the signatory's name and title in config, so that we can set or change them without
    a code change.
36. As the Vidyagram team, I want a kill switch for the whole feature, so that we can hide it instantly if something
    goes wrong.
37. As the Vidyagram team, I want the link's base address in config, so that we can move from the `hranker.org`
    address to `certificate.vidyagramar.com` later without breaking old links.
38. As a developer, I want the eligibility rule in one pure function that takes facts and returns a state and a
    reason, so that it is easy to test and to change.
39. As a developer, I want the certificate drawing in one module that takes the printed fields and returns the PDF
    and image, so that the design can be tested and changed in one place.
40. As a developer, I want issuing to be idempotent per student and course, so that retries and races can't create
    two certificates.
41. As an app developer, I want one field on the course detail response that drives the progress line and the
    button, so that the course page needs no extra request.
42. As an app developer, I want a stable `reason` code when a student can't claim, so that the app can show its own
    copy.
43. As an app developer, I want a written guide for the field and the routes, so that I can build the screens without
    reading backend code.

## Implementation Decisions

### Rules settled in the grilling session

- **Q1 Tenant.** Vidyagram only.
- **Q2 Verifiable.** Every certificate has a unique code and a public link.
- **Q3 Completion.** The course's existing progress percentage must be exactly 100. That is the number the app
  already shows: Watched classes over active class placements, where Watched follows the shared Watch status rule
  (≥90% of the class length watched, or ticked as done). Ticks count. The user accepted that a student can tick
  through a course to earn a certificate; the certificate says Vidyagram issued it, not that every class was watched.
- **Q6 Course complete.** A course issues certificates only after an admin marks it complete. This switch is
  also the per-course opt-in (Q4). A course is never "complete" by inference from its class dates.
- **Q5 Claimed.** The student claims; nothing is issued automatically.
- **Q7 Classes added later.** Issued certificates are permanent. Unclaimed students follow the live progress, so a
  new class is required. The admin sees a warning when adding a class to a complete course.
- **Q8 / Q16 Name.** The student confirms or edits the name at claim. "Guest User" or a blank name blocks the claim.
  The name is frozen at claim and is never corrected afterwards, by anyone.
- **Q9 Expired access.** It doesn't block claiming.
- **Q21 Purchase.** For a paid course the student must have owned it at some point: any successful order that
  granted the course, including expired, admin-assigned and AppX-imported orders. A free course needs no order.
- **Q12 / Q17 Content.** English labels. Names and course titles may contain Devanagari. One signature block with the
  signatory in config, test values for now. No QR code and no web address printed on the certificate.
- **Q18 Frozen.** The PDF and image are drawn once at claim and stored, never redrawn. Claims stay closed until the
  signature is final.
- **Q19 Link.** The link is the PDF itself, AlgoExpert-style. There is no verify web page and no link-preview tags.
  The app shares the link, and optionally the image.
- **Q10 / Q20 Hosting.** The files live in a new public R2 bucket in the existing Hranker Cloudflare account, on the
  custom domain `vidyagram-certificates.hranker.org`. A Vercel forwarding rule for `certificate.vidyagramar.com` may
  be added later. Because the backend builds every link from one base-address setting, that change needs no code or
  app release, and old links keep working.
- **Public by design.** Anyone with the link can open the PDF. Codes are random and unguessable, the bucket cannot be
  listed through its domain, and a Cloudflare rule on the hostname adds a "do not index" header. A certificate is
  withdrawn only by deleting its files.
- **Q15 Push.** The first time a course is marked complete, one push goes to the students who are already eligible.
  There is no push per student afterwards.
- **Q14 Admin.** Version 1 has only the switch and the add-class warning. The Certificates tab is out of scope.
- **Design A, Classic ivory.** Chosen from the three prototype designs.
- **Naming: "Course complete".** Renamed from "Batch complete" on 2026-10-24. The admin UI has no "batch" vocabulary for
  courses, so the switch, fields and route say "course complete".

### Modules

**Certificate eligibility policy (deep, pure).** One function decides whether a student can claim.

Its input:
- the course: whether the course is marked complete, whether it is free, and its active class count;
- the student: whether they ever owned the course and their progress percentage;
- whether a certificate already exists for this student and course;
- whether claims are open.

Its output is one of three states:
- `issued`, carrying the existing certificate;
- `eligible`;
- `ineligible`, with one `reason`.

Reasons are a closed set, checked in a fixed order so the first one wins:
1. `not_enabled` (the course is not marked complete)
2. `not_purchased`
3. `no_classes`
4. `incomplete`
5. `claims_closed`

An existing certificate wins over every reason, including `not_enabled` after the switch is turned off. The name
check happens at claim time, not here. The policy does no I/O.

**Eligibility facts reader.** Given a user and a course, it returns the facts above.
- **Progress** reuses the existing course progress pipeline, so the number matches the app's progress bar exactly.
- **Ever owned** reuses the order matching behind the admin course-purchasers list (direct, plan and build orders,
  active or expired). A Course Builder build counts only if it covers the whole course; a partial build of some
  chapters does not.
- The user is always taken from the login token, never from the request body.

**Certificate renderer (deep).** It takes `{ name, courseTitle, completionDate, code, signatory | null }` and returns
`{ pdf, png }`.
- One SVG template holds the Classic ivory design. `sharp` turns it into a 300 dpi PNG, and the PDF is a single A4
  landscape page wrapping that image. The design therefore exists once, and the PDF and image always match. The
  trade-off is that the PDF's text cannot be selected.
- The fonts ship with the backend, all under the SIL Open Font License: Cinzel, Cormorant Garamond, Great Vibes,
  Noto Serif Devanagari and Inter. The renderer never relies on system fonts.
- Names written in Devanagari use Noto Serif Devanagari instead of the script font, which has no Devanagari letters.
- Long names shrink, and long course titles wrap to two lines.
- The signature block is omitted when `signatory` is null.
- The template carries a version number, which is stored on each certificate.

**Certificate store.** It writes `<code>` (the PDF) and `<code>.png` to the certificates bucket.
- The PDF is stored with `Content-Type: application/pdf`, `Content-Disposition: inline;
  filename=Vidyagram_Certificate.pdf` and an immutable cache header.
- It has its own S3 client and settings. The existing upload helper targets the B2 bucket and must not be reused.
- It builds public links as `<CERTIFICATE_BASE_URL>/<code>`.

**Certificate issue service.**
- `status(userId, courseId)` loads the facts and runs the policy.
- `preview(userId, courseId, name)` renders a low-resolution PNG with the given name and stores nothing. It is only
  allowed when the student is `eligible`.
- `claim(userId, courseId, name)` runs the policy. If a certificate exists, it returns that one and ignores the name.
  If the student is eligible, it:
  1. validates the name: trimmed, 2–60 characters, not "Guest User";
  2. draws a code;
  3. renders the files;
  4. uploads them;
  5. inserts the record.

  A unique index on (user, course) makes a racing second claim fail its insert. That claim then returns the winner's
  certificate. The loser's uploaded files are left behind, which is accepted.

**Certificate model.** This is a new collection in `vidyagramdb`, holding:
- `code` (unique)
- `userId`
- `courseId`
- `name`
- `courseTitle` (frozen at claim)
- `completionDate`
- `issuedAt`
- `signatory` snapshot
- `templateVersion`
- `pdfKey` and `imageKey`

The unique indexes on `code` and on (`userId`, `courseId`) are built by a script, as the feedback indexes were,
because autoIndex never builds on the prod cluster.

**Certificate code.** `VG-` followed by 10 characters drawn with a cryptographic random generator from Crockford
base32. That alphabet has no I, L, O or U, so codes can be read aloud and retyped. A duplicate redraws.

**Course-complete switch.**
- Courses gain `certificate: { courseCompleteAt, courseCompleteBy, notifiedAt }`. All three are empty by default.
- An admin-only route turns the switch on or off.
- Turning it on for the first time (`notifiedAt` empty) queues the push and sets `notifiedAt`.
- Turning it off clears `courseCompleteAt` but keeps `notifiedAt`, so turning it on again sends no second push.

**Course-complete push.**
- The audience is the course's owners whose progress is 100% and who hold no certificate.
- It must be computed in one aggregation over class progress for the course, not one progress pipeline per buyer,
  because per-buyer pipelines are the kind of load that has caused heap crashes before.
- It is sent through the existing FCM delivery path. The message reads "Your certificate for <course> is ready".

**Admin surfaces (prototype variant C plus the B badge).**
- **Assign Classes page** (the Courses – New outline). A banner sits at the top.
  - While the course is in progress it reads "Course in progress" and has a "Mark course complete" button.
  - Once the course is marked complete the banner turns amber: "Course complete — certificates open", "Marked since <date>
    by <admin>", and a "Reopen course" button. It stays visible while classes are added.
- **Confirm dialogs.** Both directions confirm first.
  - The first switch-on says students already at 100% will get one push. A later switch-on says no push will be
    sent.
  - Reopening says no new certificates can be claimed, and that issued ones stay valid.
- **Add-class warning.** Adding a class to a course marked complete asks for confirmation first: students who haven't
  claimed will need it, and issued certificates are unaffected. The check runs on the course data in the
  frontend and needs no new route. It covers every admin flow that adds a class placement to a course.
- **Courses list.** Courses – New shows a read-only gold "Course complete" badge under the title of a complete
  course.

### Routes and wire shapes

The course detail response the app already reads (`POST /api/courses/by-id-2`) gains a `certificate` field. That
route is public, so the student must come from the bearer token, as with the exchange field, and never from the body
`userId`. Without a token the field is `null`.

```
certificate: {
  state: 'issued' | 'eligible' | 'ineligible',
  reason?: 'not_enabled' | 'not_purchased' | 'no_classes' | 'incomplete' | 'claims_closed',
  progress?: number,   // left out for ineligible/not_enabled: those courses skip the progress read
  code?, imageUrl?, pdfUrl?
}
```

- The field is `null` when `CERTIFICATES_ENABLED` is off.
- For courses not marked complete it carries `state: 'ineligible'` and `reason: 'not_enabled'`. The app uses
  that to decide whether to show the "Reach 100%" line at all.
- `pdfUrl` is the PDF and also the link the app shares; `imageUrl` is the PNG. (`shareUrl` was dropped on 2026-10-26 as a duplicate of `pdfUrl`.)

Student routes. All of them take the user from the login token and return 404 when the feature is off.

- `GET /api/courses/:id/certificate` returns the same object as the course detail field, plus `suggestedName`. That
  is the profile name, or empty when the profile says "Guest User" or is blank, and the claim screen pre-fills with
  it.
- `POST /api/courses/:id/certificate/preview` with `{ name }` returns `image/png`. It returns 409 with the `reason`
  when the student isn't eligible, and 400 `invalid_name`.
- `POST /api/courses/:id/certificate/claim` with `{ name }`:
  - returns 201 with `{ code, courseId, name, courseTitle, completionDate, imageUrl, pdfUrl }`;
  - returns 200 with the same body when a certificate already exists;
  - returns 409 with the `reason` when the student isn't eligible, and 400 `invalid_name`.
- `GET /api/certificates/mine` returns every certificate the student holds, newest first.

Admin route:
- `PUT /api/admin/courses/:id/course-complete` with `{ complete: boolean }` returns the course's `certificate` block.

### Config

| Setting | Meaning |
|---|---|
| `CERTIFICATES_ENABLED` | Default `false`. The kill switch: when off, the field is `null` and the student routes 404. |
| `CERTIFICATE_CLAIMS_OPEN` | Default `false`. Turned on only when the signature is final. |
| `CERTIFICATE_PUSH_ENABLED` | Default `false`, and **off at launch** (the user's decision on 2026-10-25). The course-complete push goes out only when this, `CERTIFICATES_ENABLED` and `CERTIFICATE_CLAIMS_OPEN` are all on. Otherwise `notifiedAt` stays empty, so a later reopen followed by marking the course complete sends it once. |
| `CERTIFICATE_RENDER_CONCURRENCY` | Default 2. The maximum number of certificate renders running at once. |
| `CERTIFICATE_SIGNATURE` | `on` or `off`. |
| `CERTIFICATE_SIGNATORY_NAME` | Test values until the real signatory is confirmed. |
| `CERTIFICATE_SIGNATORY_TITLE` | Test values until the real signatory is confirmed. |
| `CERTIFICATE_BASE_URL` | `https://vidyagram-certificates.hranker.org` now; `https://certificate.vidyagramar.com` once the Vercel forwarding rule exists. |
| `CERTIFICATE_R2_*` | The certificates bucket's endpoint, bucket name and keys. |

## Testing Decisions

A good test drives the public route, the pure policy through its one entry point, or the renderer through its one
call. It asserts what a student, a link opener or an admin observes: the response, the stored certificate and the
files written. It does not assert on query shapes or private helpers.

**Policy unit tests** (table-driven):
- Each `reason` fires on its own fixture.
- When several reasons apply, the first in the fixed order wins.
- An existing certificate wins over every reason.
- At 99.99% the student is `incomplete`; at 100 they are `eligible`.
- A free course needs no purchase. An expired order still counts as owned.

**Renderer tests:**
- Fixtures: an English name, a Devanagari name, a 40-character name, a long two-line Hindi course title, and no
  signature.
- Each produces a one-page A4 landscape PDF and a PNG of the expected size.
- Each PNG is compared against a stored reference image within a small pixel tolerance, so a font that silently
  falls back to boxes fails the test.

**Backend integration tests** on in-memory Mongo, through the real routes:
- A buyer at 100% on a complete course claims and gets 201. The record is stored, and the fake store holds both
  files.
- A second claim returns 200 with the same code and ignores the new name.
- Two concurrent claims leave exactly one certificate.
- "Guest User" and a blank name return 400 `invalid_name`.
- A non-buyer at 100% gets 409 `not_purchased`. An expired buyer can claim.
- A course that isn't complete returns 409 `not_enabled`. With claims closed, the response is 409 `claims_closed`.
- Adding a class after the switch moves an unclaimed student to `incomplete` and leaves an issued certificate
  untouched.
- Reopening the course keeps the issued certificate visible as `issued`.
- The course detail response carries the field, and the field is `null` with the feature off.
- A request body `userId` is ignored, and the token decides.
- The admin route needs an admin token.
- Switching on queues one push the first time and none on a second switch-on.

**Admin component tests:**
- The Assign Classes banner shows both states. "Mark course complete" and "Reopen course" each confirm, then call the
  route.
- The first switch-on dialog mentions the push; a later one does not.
- Assigning a class to a complete course shows the confirm dialog, and Cancel adds nothing.
- The Courses list shows the badge only for complete courses.

**Prior art:**
- The exchange policy and the plan-upgrade offer tests for pure policy tables.
- The `src/tests/integration` suites for real routes on in-memory Mongo.
- The feedback PRD's integration list for style.

## Out of Scope

- A verify web page, link-preview tags and the Vercel forwarding rule for `certificate.vidyagramar.com`. These can be
  added later without changing issued certificates.
- A QR code or printed web address on the certificate.
- The admin Certificates tab: issued list, eligible-but-unclaimed count and name correction.
- Correcting a name after claiming, and revoking a certificate. Deleting the files by hand is the only withdrawal.
- Requiring tests, PDFs or real watch time beyond the progress bar.
- Per-course certificate designs, faculty names on the certificate, and course hours or class counts.
- A push per student when they reach 100% after the course is marked complete.
- quicktricks.

## Further Notes

- **Prototypes.**
  - [`../prototypes/certificate-q19/index.html`](../prototypes/certificate-q19/index.html) compares what the link
    serves. Variant A, link = PDF, won, with sharing left to the app.
  - [`../prototypes/certificate-design/index.html`](../prototypes/certificate-design/index.html) shows the three
    designs. Design A, Classic ivory, won. Its SVG is the starting point for the renderer template.
  - [`../prototypes/certificate-batch-switch/index.html`](../prototypes/certificate-batch-switch/index.html) shows
    three places for the admin switch. Variant C won (a banner on Assign Classes), plus variant B's read-only badge
    in the Courses list. Its dialog wording is the copy to use.
- **Reference.** AlgoExpert's certificate link, checked 2026-10-23:
  - it returns the PDF inline from their own app server, with an issue-time creation date and a 10-character code;
  - unknown codes return "not found";
  - the PDF was rendered by headless Chromium from HTML, and the signatures are typed in a handwriting font.

  We copy the shape but render with `sharp`, because a headless browser on the shared webserver2-2 is a memory risk.
- **Hindi check, 2026-10-23.** Both `sharp` (from an SVG) and `pdfkit` shaped joined Devanagari letters correctly on
  macOS with a system font: रा, र्मा, क्ष, त्रि, श्री, द्वि. This disproves the earlier worry that `pdfkit` can't. The
  remaining risk is font loading on the Linux box, so the renderer task must prove the bundled fonts render there.
  The renderer's reference-image tests run in a Debian container that matches the box.
- **Logo.** The only logo is the 512×512 PNG used by the admin. It is enough for the 140 px seal in Classic ivory. A
  higher-resolution or vector logo from Vidyagram would make the print sharper.
- **Mark-complete is unauthenticated.** The class mark-complete routes take `userId` from the request body. Anyone
  can therefore tick classes for any account, which is why Q21 requires a purchase. The student auth gate
  (`feat/vg-student-auth-gate`, not deployed) closes this for real.
- **Ops before launch.** These happen outside the code:
  - create the bucket in the Hranker Cloudflare account and attach `vidyagram-certificates.hranker.org`;
  - add the "do not index" response-header rule for that hostname;
  - create an R2 token limited to the bucket;
  - run the index script on `vidyagramdb`;
  - set the real signatory, then open claims.
