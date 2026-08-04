# Route flip + contract tests

**Type**: AFK
**Blocked by**: #2

## What to build

The wholesale flip (ADR 0004): the three multipart routes (create, part-url, completions)
plus the uploads-SSE route switch their storage import from the R2 module to the B2 module.
No per-request bucket dispatch — on this branch these routes serve only video uploads and
the deploy is single-tenant.

Completions changes shape deliberately: it returns the object key and **no public URL**
(the intake bucket is private; the old R2 public-URL computation and the vestigial PDF
special-case go away). The upload store already tolerates an absent `location`/`url`.

Contract tests (mocking the B2 module) pin the JSON wire shapes the browser uploader
depends on, so a future refactor cannot silently break it:

- create → `{ uploadId, fileKey }`
- part-url → `{ signedUrl }`
- completions → key present, no public URL field expected
- SSE payload → file list with per-file `processed`

## Acceptance criteria

- [ ] All four routes import the B2 module; no route retains an R2 code path
- [ ] Completions returns the key, returns no public URL, and the single + bulk upload UIs complete without error against a mocked/live module
- [ ] Contract tests cover the four shapes above with the B2 module mocked
- [ ] Grep proof: no remaining reference to the R2 module or R2 env in the multipart route tree
- [ ] Existing admin test suites still pass

## User stories covered

- Story 3: upload UX (progress, retry, abort) unchanged through the swap
- Story 4: chunked multipart with per-part retry preserved
- Story 5: processing status via SSE keeps updating
- Story 6: permanent failures surface as errors, not silent success
