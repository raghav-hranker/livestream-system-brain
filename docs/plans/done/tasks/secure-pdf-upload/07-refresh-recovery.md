# Refresh recovery (persisted session reload)

**Type**: AFK
**Blocked by**: #4 — One-file bulk happy path

## What to build

A browser refresh mid-batch loses nothing the server has confirmed. On reload, the bulk sheet fetches
`GET /api/admin/pdf-upload-sessions/:sessionId` and rebuilds per-file state from the server-authoritative
answer: file metadata, states, error codes, and completed `pdfId`s. The frontend reconciles its local
file selection against server state via `clientFileId` — it never reconstructs completion from browser
storage. A file whose plain `PUT` was interrupted mid-transfer simply restarts (fresh target); completed
files stay completed and are not re-uploaded. Presigned URLs remain absent from any persisted state, so
recovery never resurrects a credential.

## Acceptance criteria

- [ ] Refresh mid-batch: completed files render as completed with working record links; in-flight files return to a retryable state; no completed file re-uploads
- [ ] Per-file states, error codes, and `pdfId`s on reload come solely from the session GET, not browser storage
- [ ] Local files reconcile to server files via `clientFileId`; files the server never saw are surfaced, not silently dropped
- [ ] An interrupted partial `PUT` restarts cleanly with a fresh target
- [ ] Presigned URLs appear nowhere in React Query persistence, browser storage, analytics, or logs (asserted by test)
- [ ] Session GET response is sanitized: states/errors/pdfIds, no upload URLs, no raw storage references

## User stories covered

- Story 18: reload an in-progress bulk session without losing server-confirmed state
- Story 19: completed PDF identifiers returned per file
- Story 31: per-file error codes and persisted session state for support diagnosis
