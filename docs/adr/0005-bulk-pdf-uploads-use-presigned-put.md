---
status: accepted
---

# Bulk PDF uploads use server-owned sessions and presigned B2 PUTs

Secure PDF creation crosses the admin-dashboard and nodejs-server seam. Single-file create and
replacement remain ordinary admin-authenticated multipart requests through nodejs-server, which is
simple and bounded. Bulk upload does not send one large multipart request through Node: the backend
owns a persistent PDF upload session, generates every private-B2 object key, and issues short-lived,
single-object presigned `PUT` credentials just in time. The browser uploads each file directly to B2;
the backend verifies the expected object before idempotently creating the `Pdf`/`pdfAsset` record.
Partial success is preserved, and the browser is never the source of truth for completion state.

## Considered options

- **One giant multipart request through Node — rejected.** The existing PDF route buffers files in
  memory; batch size would translate directly into Node memory pressure, request/proxy timeouts, poor
  progress reporting, and all-or-nothing retry.
- **One backend-proxied request per bulk file — retained as a possible small-batch fallback, not the
  primary bulk design.** It bounds memory when streamed but doubles bandwidth through Node and keeps
  the application server in the data path for an admin workload that object storage can accept
  directly.
- **Permanent B2 credentials in the browser — rejected.** The browser receives only a method-, key-,
  and time-bounded presigned credential; bucket credentials remain server-only.
- **Browser presigned form `POST` — rejected.** Backblaze's S3-compatible interface supports
  presigned upload URLs but not browser presigned `POST`; the contract uses `PUT`.

## Consequences

- Upload-session state, idempotent completion, expiry, abandoned-object cleanup, and B2 CORS become
  explicit cross-repository contracts.
- A presigned URL is short-lived and restricted to one object, but is not assumed to be literally
  single-use; database idempotency and server verification provide the replay-safe completion rule.
- Bulk v1 does not depend on browser-supplied content hashes. Object keys are opaque and
  server-generated; SHA-256 remains optional operational metadata, not a delivery-security
  requirement.
- The existing signed-read architecture is unchanged: completed records contain a private
  `pdfAsset`, listings expose no fetchable URL, and Preview/Download still mint exact-file Document
  URL tokens through nodejs-server.
