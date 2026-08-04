# Tasks: Secure PDF upload — single + bulk

> **Status (2026-07-21): code complete.** Tasks 01–08 merged + integrated on the slice branch in
> both repos; local suites green. Remaining: HITL deploy-to-phonetics + browser E2E (task-04
> pattern); branches local-only, not pushed. Kept in place as history — task 03 holds the settled
> B2 credential/CORS scheme that ADR 0004 (admin-dashboard) and the video-upload slice reference.

Tracer-bullet breakdown of [the PRD](../../prd-secure-pdf-upload.md), governed by
[ADR 0005](../../../adr/0005-bulk-pdf-uploads-use-presigned-put.md). The cross-repo wiring map and
failure cheatsheet is [`slices/secure-pdf-upload.md`](../../../../slices/secure-pdf-upload.md).

Each slice is cross-repo — a nodejs-server leg + an admin-dashboard leg off the base branches named in
the slice playbook (`launch/quicktricks-v2` in both; the admin-dashboard worktree carries unrelated APX
changes — preserve them) — and is done only when its integrated acceptance scenario passes end to end.

| # | Task | Type | Blocked by |
|---|---|---|---|
| 01 | [Secure single create, end to end](../../done/tasks/secure-pdf-upload/01-secure-single-create.md) | AFK | None |
| 02 | [Metadata-only edit + file replacement](../../done/tasks/secure-pdf-upload/02-metadata-edit-and-replacement.md) | AFK | 01 |
| 03 | [B2 presigned PUT + CORS spike](../../done/tasks/secure-pdf-upload/03-b2-presigned-put-cors-spike.md) | HITL | None (parallel to 01) |
| 04 | [One-file bulk happy path (session control plane)](../../done/tasks/secure-pdf-upload/04-one-file-bulk-session.md) | AFK | 01, 03 |
| 05 | [Multi-file bulk: concurrency, partial success, limits](../../done/tasks/secure-pdf-upload/05-multi-file-partial-success.md) | AFK | 04 |
| 06 | [Per-file retry, idempotent completion, target refresh](../../done/tasks/secure-pdf-upload/06-retry-idempotency-target-refresh.md) | AFK | 04 |
| 07 | [Refresh recovery (persisted session reload)](../../done/tasks/secure-pdf-upload/07-refresh-recovery.md) | AFK | 04 |
| 08 | [Expiry, cleanup, config knobs + legacy bulk deprecation](../../done/tasks/secure-pdf-upload/08-expiry-cleanup-legacy-deprecation.md) | AFK | 04 |

Parallelism: 01 and 03 can start together; 05–08 are siblings unlocked by 04 and grabbable
independently. 03 is the only human-in-the-loop gate (B2 console CORS config + origin decision).
