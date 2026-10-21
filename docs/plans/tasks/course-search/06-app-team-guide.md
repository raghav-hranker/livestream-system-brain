# App-team guide + Postman test bed

**Type**: HITL
**Blocked by**: 01, 02, 03, 04 (the contract must be final)

## What to build

A guide the app team (`hranker-com/sahil_sir_quick_tricks`, read-only for us) can build the
course-screen search from, plus a prod read-only Postman collection.

- **Guide** (`system-brain/reference/course-search-app-guide.md`): the endpoint, the request,
  the three sections, and for each which **existing card** renders it (class-tabs card, Ebooks
  `PdfItem`, Tests `SeriesItem`). The `tab` field, and what to do with `null` (no Play; "not
  available yet"). How each result opens: `/classes/:id/playback`,
  `/classes/:id/pdfs/:pdfId/access`, `/courses/:id/pdfs/:pdfId/access`, the existing test flow.
  Minimum 2 characters, debounce, `limit`, the `Authorization` header as the only identity.
  The "Ebooks" label maps to `coursePdfs`.
- **Postman**: copy the global search pattern (`reference/postman/global-search-classes.README.md`
  and its generator) into a `course-search` collection: guest, signed-in, short query (400),
  unknown course (404), inactive course (200), each section alone.

## Acceptance criteria

- [ ] Guide written, and every field it names checked against a real prod response.
- [ ] Postman collection generated and run once against prod (read-only), results noted.
- [ ] Sent to the app team; the handoff noted in the task README.

## User stories covered

- Story 32: the app reuses its existing cards
