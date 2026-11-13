# Vidyagram certificates: app team guide

> How the app shows the **certificate line and button** on the course page, the **claim screen**, the
> **certificate view**, **My certificates** and the **certificate ready** push.
>
> Base URL: `https://backend.vidyagramar.com/api`.
>
> Verified against backend branch `feat/vg-certificates` at 50a7d23db on 2026-10-24. The sample bodies come from a real
> local run of the routes on an in-memory database. That run used a test link host; the samples show the production
> host, `https://vidyagram-certificates.hranker.org`, instead. Not on production yet: see section 10.

<!-- Sources: src/controllers/certificateController.ts, src/services/certificate/certificateStatus.service.ts,
     certificateIssue.service.ts, certificateStore.ts, courseCompletePush.service.ts, certificatePolicy.ts,
     src/controllers/courseController.ts (getCourseById2), src/routes/courseRoutes.ts, src/routes/certificateRoutes.ts.
     Samples: src/tests/integration/certificateClaim + certificateStatus integration tests, re-run with captures. -->

---

## 1. The rule in one paragraph

A student can claim a certificate for a course once an admin has marked the course complete and the student's course
progress is 100%. That is the same progress number the app already shows. Classes ticked as done count. For a paid
course the student must have bought it at some point; expired, admin-given and AppX purchases all count. A free course
needs no purchase. The student claims it with one button and picks the name to print. The certificate is drawn once
and never changes. It is a PDF at a public link that the student can share.

The server decides all of this. The app only reads `state` and `reason`.

---

## 2. The course page field: `certificate` on `POST /api/courses/by-id-2`

The course page call the app already makes now has `data.certificate`.

**Send the student's bearer token on this call** (`Authorization: Bearer <token>`). The field is worked out only for
the student named by the token. A body `userId` is ignored for it, because this endpoint is public. With no token, or
an expired or invalid one, the field is `null`.

The field is also `null` while the feature is switched off on the server.

The field takes one of these shapes (real samples):

```json
"certificate": { "state": "ineligible", "reason": "not_enabled" }
```

```json
"certificate": { "state": "ineligible", "reason": "incomplete", "progress": 66.67 }
```

```json
"certificate": { "state": "eligible", "progress": 100 }
```

```json
"certificate": {
  "state": "issued",
  "progress": 100,
  "courseId": "6adc747872cd89ed3dc47b59",
  "code": "VG-QDJA6B99PK",
  "imageUrl": "https://vidyagram-certificates.hranker.org/VG-QDJA6B99PK.png",
  "pdfUrl": "https://vidyagram-certificates.hranker.org/VG-QDJA6B99PK"
}
```

| Field | When present | Meaning |
|---|---|---|
| `state` | always | `issued`, `eligible` or `ineligible` |
| `reason` | only when `ineligible` | one of the codes in section 3 |
| `progress` | every case **except** `ineligible` + `not_enabled` | the course progress, 0 to 100, may have decimals (`66.67`) |
| `code`, `imageUrl`, `pdfUrl` | only when `issued` | the certificate's number and links; `pdfUrl` is the PDF and also the link to share, `imageUrl` the PNG |

`progress` is left out for `not_enabled` because the server skips the progress read on a course that isn't marked
complete. Use the progress bar you already have for that course.

---

## 3. States, reasons, and what the course page shows

The reasons are checked in this order, and the first one that applies is the one you get. An issued certificate
beats every reason, so a student who claimed keeps seeing `issued` even after the admin reopens the course or adds a
class.

The suggested copy is yours to change.

| `certificate` | What the course page shows | English | Hindi |
|---|---|---|---|
| `null` | Nothing about certificates. | n/a | n/a |
| `ineligible`, `not_enabled` | Nothing. The course isn't marked complete yet, so no certificate line at all. | n/a | n/a |
| `ineligible`, `not_purchased` | No button. The page's Buy button already covers this. Optional muted line. | "Buy this course to earn its certificate." | "सर्टिफ़िकेट पाने के लिए यह कोर्स खरीदें।" |
| `ineligible`, `no_classes` | Nothing. The course has no active classes. | n/a | n/a |
| `ineligible`, `incomplete` | The line next to the progress bar. No button. | "Reach 100% to unlock your certificate" | "सर्टिफ़िकेट पाने के लिए 100% पूरा करें" |
| `ineligible`, `claims_closed` | The student is at 100%, but claims aren't open yet. Line, no button. | "Your certificate will be ready to claim soon." | "आपका सर्टिफ़िकेट जल्द ही मिलेगा।" |
| `eligible` | **Get certificate** button. It opens the claim screen (section 4). | "Get certificate" | "सर्टिफ़िकेट पाएँ" |
| `issued` | **View certificate** button. It opens the certificate view (section 6). | "View certificate" | "सर्टिफ़िकेट देखें" |

Rules for the line:

- If you show the progress with the `incomplete` line ("You're at 66%"), **round down**. A student at 99.99 is
  `incomplete`, and "100%" next to "Reach 100%" would confuse them.
- `incomplete` follows the live course. If the admin adds a class, a student who was at 100% drops below it and
  needs the new class. Refresh the course page after the student comes back from a class.
- The 409 errors in section 5 use the same reason codes. Show the same copy there.

---

## 4. The claim screen

### 4a. Open it: `GET /api/courses/:id/certificate`

Send the bearer token. It returns the same object as the course page field, plus `suggestedName`, the name to
pre-fill.

Real sample:

```json
{
  "state": 200,
  "data": {
    "state": "eligible",
    "progress": 100,
    "suggestedName": "Rahul Sharma"
  }
}
```

- `suggestedName` is the profile's first and last name, cleaned the way the claim will print it.
- It is `""` when the profile name is "Guest User", blank, or would fail the name rule (digits, one letter, emoji,
  over 60 characters). Then the field starts empty and the student must type a name.
- Check `data.state` again here. If it is no longer `eligible`, close the screen and show the section 3 state.

### 4b. The name field and the warning

Show the name in an editable field, with this warning under it:

> This name will be printed on your certificate and can't be changed later.
>
> यही नाम आपके सर्टिफ़िकेट पर छपेगा और बाद में बदला नहीं जा सकेगा।

**The name rule.** The server applies it on both preview and claim. You can check it in the app too, but the server
decides.

- The name is cleaned first: Unicode NFC, leading and trailing spaces trimmed, runs of spaces turned into one space.
- After cleaning it must be **2 to 60 characters**, counted as Unicode code points. A Devanagari vowel sign counts
  as one, so "राहुल" is 5.
- It must contain at least one letter.
- It must not be "Guest User" in any capitals or spacing ("guest user", " GUEST   user ").
- Allowed characters:
  - Latin letters, accents included (`Zoë Ångström`);
  - Devanagari letters and vowel signs (`राहुल शर्मा`, `श्री द्विवेदी`);
  - spaces, dots, straight `'` or curly `’` apostrophes, and hyphens (`Anne-Marie J. O'Neil`, `D’Souza`).
- Anything else fails: digits (Latin or Devanagari, so `Rahul123` and `राहुल १२` fail), the danda `।`, emoji, and
  symbols such as `<` `>`.

The printed name is the cleaned one. `"  Rahul   Sharma "` prints as `Rahul Sharma`.

Suggested error copy, for a 400 or for your own check:
"Enter your full name, 2 to 60 letters. Numbers and symbols aren't allowed." /
"अपना पूरा नाम लिखें, 2 से 60 अक्षर। अंक और चिह्न नहीं चलेंगे।"

### 4c. Preview: `POST /api/courses/:id/certificate/preview`

Body `{ "name": "Rahul Sharma" }`, with the bearer token. It stores nothing.

**200** returns the image itself, not JSON:

| Header | Value |
|---|---|
| `Content-Type` | `image/png` |
| `Cache-Control` | `no-store` |

The image is 1123 × 794 px, about 100 KB. It shows the name, the course title, today's date and the word `PREVIEW`
where the certificate number will go. Show it as an image and don't cache it.

The server renders only a couple of certificates at a time, so **don't preview on every keystroke**. Preview when
the screen opens with a non-empty `suggestedName`, and then on a "Preview" tap or after typing stops for about a
second.

**Errors** (JSON, each with a `reason`). The order is fixed: the eligibility check comes before the name check.

| Status | `reason` | When | App action |
|---|---|---|---|
| 400 | `invalid_name` | The name fails the rule | Show the name error under the field. |
| 409 | `already_issued` | This student already has the certificate, for example claimed on another device | Close the screen and open the certificate view. Refresh the course page to get the links. |
| 409 | any reason from section 3 | Eligibility changed since the screen opened | Close the screen and show the section 3 copy. |
| 404 | (none) | Feature off, or unknown course | "Certificates aren't available right now." / "सर्टिफ़िकेट अभी उपलब्ध नहीं हैं।" |
| 401 | (none) | No token, or the token has expired | Refresh the token as usual. |

Real 400 body:

```json
{
  "state": 400,
  "reason": "invalid_name",
  "message": "Enter your name as it should appear: 2 to 60 letters, spaces, dots, apostrophes or hyphens",
  "data": null
}
```

Real 409 body:

```json
{
  "state": 409,
  "reason": "already_issued",
  "message": "A certificate cannot be issued for this course yet",
  "data": null
}
```

The `message` is the same for every 409. Build your copy from `reason`, not from `message`.

---

## 5. Claim: `POST /api/courses/:id/certificate/claim`

The button reads "Claim certificate" / "सर्टिफ़िकेट लें". Body `{ "name": "<the name in the field>" }`, with the
bearer token.

**201, claimed** (real sample):

```json
{
  "state": 201,
  "data": {
    "code": "VG-QDJA6B99PK",
    "courseId": "6adc747872cd89ed3dc47b59",
    "name": "Rahul Sharma",
    "courseTitle": "SSC CGL 2026 Maths Foundation",
    "completionDate": "2026-10-24",
    "imageUrl": "https://vidyagram-certificates.hranker.org/VG-QDJA6B99PK.png",
    "pdfUrl": "https://vidyagram-certificates.hranker.org/VG-QDJA6B99PK"
  }
}
```

- `code` is `VG-` and 10 letters or digits. It never contains I, L, O or U, so it can be read aloud.
- `courseId` is the course the certificate is for.
- `name` is the cleaned name as printed.
- `courseTitle` is the title as printed. It is fixed at claim and doesn't follow later renames.
- `completionDate` is the **claim day** on the India calendar, as `YYYY-MM-DD`. Format it for display.
- `pdfUrl` is the link to share. There is no separate share link.

**200, already claimed.** The body has the same shape and holds the certificate the student already has. **The name
sent is ignored**, even an invalid one. Treat 200 exactly like 201.

```json
{
  "state": 200,
  "data": {
    "code": "VG-QDJA6B99PK",
    "courseId": "6adc747872cd89ed3dc47b59",
    "name": "Rahul Sharma",
    "courseTitle": "SSC CGL 2026 Maths Foundation",
    "completionDate": "2026-10-24",
    "imageUrl": "https://vidyagram-certificates.hranker.org/VG-QDJA6B99PK.png",
    "pdfUrl": "https://vidyagram-certificates.hranker.org/VG-QDJA6B99PK"
  }
}
```

After a 201 or 200, close the claim screen, open the certificate view with this body, and refresh the course page so
it shows `issued`.

**Double taps and dropped networks are safe.** A student gets exactly one certificate per course.

- A second tap after the first finished returns 200 with the same certificate.
- Two taps sent at the same moment: one gets 201, the other 200, and both carry the same `code`.
- If the network drops after the tap, send the same call again. You get 200 with the certificate.

Still, disable the button and show a spinner while the call runs. A claim draws the print-quality files and uploads
them, so it takes longer than most calls.

**Errors:**

| Status | `reason` | When | App action |
|---|---|---|---|
| 400 | `invalid_name` | The name fails the rule (section 4b) | Show the name error. Body as in section 4c. |
| 409 | `not_enabled`, `not_purchased`, `no_classes`, `incomplete` or `claims_closed` | Eligibility changed since the screen opened | Close the screen and show the section 3 copy. |
| 404 | (none) | Feature off, or unknown course | "Certificates aren't available right now." |
| 401 | (none) | No token, or the token has expired | Refresh the token as usual. |
| 500 | (none) | Server error | "Something went wrong. Please try again." Retrying is safe. |

The claim never answers `already_issued`; it answers 200 instead.

Real 409 body:

```json
{
  "state": 409,
  "reason": "not_purchased",
  "message": "A certificate cannot be issued for this course yet",
  "data": null
}
```

---

## 6. The certificate view

Open it from the claim response, from **View certificate** on the course page (the `issued` field), or from a My
certificates row.

| Part | From | Notes |
|---|---|---|
| The certificate | `imageUrl` in an image view | A 3508 × 2480 px PNG (A4 landscape at 300 dpi). Load it downsampled to the screen size. Pinch-zoom is welcome. |
| **View PDF** / "PDF देखें" | `pdfUrl`, opened in the app's existing PDF viewer | A one-page A4 PDF. Public: send no token or other header. **The link has no `.pdf` ending.** The server sends `Content-Type: application/pdf`, so the viewer must go by that, not by the extension. |
| **Share** / "शेयर करें" | `pdfUrl` through the system share sheet | See below. |
| Certificate number | `code` | Optional: "Certificate No. VG-QDJA6B99PK". It is printed on the certificate too. |

**Share.** Send `pdfUrl` as text. Anyone who opens it sees the PDF, with no app or account needed. Suggested text:

> I completed **{courseTitle}** on Vidyagram. See my certificate: {pdfUrl}
>
> मैंने Vidyagram पर **{courseTitle}** पूरा किया। मेरा सर्टिफ़िकेट देखें: {pdfUrl}

If you want the image attached as well, which looks better in WhatsApp, download `imageUrl` to a temporary file and
share the file with the text. The link must stay in the text, because the link is the proof that the certificate is
genuine.

On the course page the `issued` field has no `courseTitle`. Use the course title the page already shows.

**Never build these links yourself.** Always use the URLs from the response. The host will move to
`certificate.vidyagramar.com` later. Old links will keep working, and new responses will carry the new host.

The files never change. You may cache the image and the PDF for as long as you like.

---

## 7. My certificates: `GET /api/certificates/mine`

Send the bearer token. It lists every certificate the student holds, **newest first**, in the claim response's shape.
Put it in the profile as "My certificates" / "मेरे सर्टिफ़िकेट".

Real sample:

```json
{
  "state": 200,
  "data": [
    {
      "code": "VG-QDJA6B99PK",
      "courseId": "6adc747872cd89ed3dc47b59",
      "name": "Rahul Sharma",
      "courseTitle": "SSC CGL 2026 Maths Foundation",
      "completionDate": "2026-10-24",
      "imageUrl": "https://vidyagram-certificates.hranker.org/VG-QDJA6B99PK.png",
      "pdfUrl": "https://vidyagram-certificates.hranker.org/VG-QDJA6B99PK"
    }
  ]
}
```

- Each row shows `imageUrl` as a thumbnail, `courseTitle`, and `completionDate`. A tap opens the certificate view.
- An empty list is `"data": []`. Suggested copy: "No certificates yet. Finish a course to earn one." /
  "अभी कोई सर्टिफ़िकेट नहीं। कोई कोर्स पूरा करके सर्टिफ़िकेट पाएँ।"
- A certificate stays in this list for good. Expired access, a reopened course and later classes don't affect it.
- Each row carries `courseId`, so the certificate view can link back to its course page.
- 404 means the feature is off: hide the menu entry. 401 means refresh the token.

---

## 7b. My courses cards: `certificate` on `POST /api/courses/my-courses`

Every card in `liveCourses` and `recordedCourses` carries the **same `certificate` object as the course page** (section 2):
same states, reasons, `progress` rule and links. Use it to show a "Certificate" badge or button on the card without
opening the course.

- **Send the bearer token.** The student comes from the token. With no token (or an admin token) every card's
  `certificate` is `null`, even though the list itself still loads for a body `userId` from old builds.
- `null` also when the feature switch is off.
- Most cards read `{ "state": "ineligible", "reason": "not_enabled" }` (the course is not marked complete): show nothing.
- `issued` cards carry `courseId`, `code`, `imageUrl`, `pdfUrl`: show the certificate thumbnail or a "View
  certificate" action.
- `eligible` cards: show "Get certificate"; it opens the course page / claim flow.

**Course progress on the card: `progress_percentage`.** Every card also carries `progress_percentage`, a number 0–100
(two decimals) — the same number as the course progress bar and as `certificate.progress`: classes watched (≥ 90%) or
ticked as done, out of the course's active classes. A course with no classes reads `0`. It is `null` without the
student's bearer token. Use it for the progress ring/bar on the card. (The old `classesCompleted`, `watchTime`,
`testsAttempted` and `studyMaterialRead` blocks are placeholders that always read 0 — don't use them.)

```json
{ "_id": "6adc…", "title": "SSC CGL 2026 Maths Foundation", "myRating": null,
  "progress_percentage": 100,
  "certificate": { "state": "eligible", "progress": 100 } }
```

---


## 8. All status codes at a glance

| Route | 200 | 201 | 400 | 401 | 404 | 409 |
|---|---|---|---|---|---|---|
| `POST /courses/by-id-2` | course + `certificate` field | n/a | bad course id | never (no token means `certificate: null`) | course not found | n/a |
| `GET /courses/:id/certificate` | status + `suggestedName` | n/a | n/a | no token | feature off, unknown course | n/a |
| `POST /courses/:id/certificate/preview` | PNG | n/a | `invalid_name` | no token | feature off, unknown course | reason, or `already_issued` |
| `POST /courses/:id/certificate/claim` | already had it | new certificate | `invalid_name` | no token | feature off, unknown course | reason |
| `GET /certificates/mine` | list | n/a | n/a | no token | feature off | n/a |

The 401 body comes from the shared login check and uses `msg`, not `message`:

```json
{ "state": 401, "msg": "Access token required", "data": null }
```

The 404 body:

```json
{ "state": 404, "message": "Not found", "data": null }
```

---

## 9. State of production (2026-10-26)

- **Deployed 2026-10-26** on backend.vidyagramar.com with the feature **on** and claims **open**, so the app team can
  test end to end. The push is **off** (`CERTIFICATE_PUSH_ENABLED=false`).
- Certificates issued now carry a **test signature** ("Test Signatory"). They are test data and will be deleted before
  launch; the real signature replaces it.
- Only the test course the backend team names is marked complete. Use your test student account on it (the course is
  assigned to that account; tick every class to reach 100%).
- Links live at `https://vidyagram-certificates.hranker.org/<code>`.

---

## 11. Checklist for the app

- [ ] Send the bearer token on `POST /api/courses/by-id-2`.
- [ ] Course page: show the line and the button from `certificate` as in section 3. Hide everything for `null`,
      `not_enabled` and `no_classes`. Round the progress down.
- [ ] Claim screen: `GET /api/courses/:id/certificate`, pre-fill `suggestedName` (it may be empty), show the
      "can't be changed later" warning, and preview without calling on every keystroke.
- [ ] Claim: disable the button while the call runs. Treat 201 and 200 the same. Show 400 under the name field. On
      409, close the screen and show the reason's copy. Retry the same call after a network error.
- [ ] Certificate view: `imageUrl` in an image view, **View PDF** opens `pdfUrl` (no `.pdf` ending) in the existing
      PDF viewer, and **Share** sends with the image attached if you want.
- [ ] My certificates in the profile, from `GET /api/certificates/mine`. Hide the entry on 404.
- [ ] `certificate_ready` push: a tap opens the course page for `data.courseId`.
- [ ] Never build certificate links in the app. Use the URLs from the responses.
