# Metadata-only edit + file replacement

**Type**: AFK
**Blocked by**: #1 — Secure single create, end to end

## What to build

`PUT /api/pdfs/:id` gets two coherent behaviors. Metadata-only update (no file part) edits catalogue
fields and preserves the current `pdfAsset` untouched — the admin never re-selects the file for a small
correction. Supplying a replacement file stores a new private object through the document-storage module
and atomically swaps `pdfAsset` to it; the previous object is **not** synchronously deleted (assets may
be shared — reference-aware GC is separate work). Replacing a **legacy** record (public `uploadPdf` only,
no asset) moves it to `ready` on private storage, so ordinary editing finishes the migration naturally.
The admin-dashboard edit form sends no file unless one is chosen, and renders the updated derived state.

## Acceptance criteria

- [ ] Metadata-only update: catalogue fields change, `pdfAsset` byte-for-byte unchanged, no upload occurs
- [ ] Replacement on a ready record: new private B2 object, `pdfAsset` swapped atomically, old object still present in B2
- [ ] Replacement on a legacy record: record becomes `ready` with a valid `pdfAsset`; legacy `uploadPdf` value untouched (kept for rollback, serializers still omit it)
- [ ] Replacement file goes through the same validation chain as create (size, MIME, `%PDF-` signature) before any record change
- [ ] Concurrent-update behavior covered by tests; the previous object is never blindly deleted
- [ ] Signed admin `/access` mint on a replaced record serves the **new** bytes
- [ ] Edit form: file input optional; no-file submit produces a metadata-only request

## User stories covered

- Story 5: edit metadata without selecting the file again
- Story 6: replace the file on an existing PDF
- Story 7: replacing a legacy PDF makes the record ready on private storage
## Execution notes — 2026-07-20

Merged in both repos (nodejs-server `116449d0`+`2661e290` under merge `d4b3963b`; admin-dashboard
`0a47184` under merge `8ad9f78` — leg commit rewritten once to strip a Co-Authored-By trailer, runner
now instructs agents not to add them). nodejs-server 435/435, admin-dashboard vitest + 36/36 green.
**Backend integrated acceptance PASSED on phonetics** (part of `upload-accept-checks.js`):
metadata-only edit preserves `pdfAsset` byte-for-byte; replacement swaps to a new key, previous B2
object retained, admin mint serves the new bytes. Admin form behavior (optional file input,
metadata-only submit) covered by the leg's component/hook tests.
