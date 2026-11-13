# 02 — Harden the users / orders / transactions mirror scripts (Vidyagram)

Status: `ready-for-agent`. Repo: `abhi092515/quicktricks-backend`, branch `fix/vg-commerce-mirror` (off `vidyagram-admin`
252c9bcea), worktree `~/Projects/worktrees/vg-commerce-mirror`. Plan: [../../appx-tenant-onboarding.md](../../appx-tenant-onboarding.md).

## Why

A read-only audit (2026-10-13) found these scripts safe for small trials but not for multi-hour runs on a new tenant:
`src/scripts/apxUserRawMigration.ts`, `apxOrdersNewRawMigration.ts`, `apxTransactionsRawMigration.ts`,
`apxOrdersNewRawDayWiseGapFill.ts`, `apxTransactionsRawDayWiseGapFill.ts`.

Facts: Vidyagram AppX shows 2,291,761 users; orders and transactions currently return 0 rows (permission or no sales;
the user is checking). AppX sets an anonymous `ci_session` on every response, so **never capture Set-Cookie and never
write `apxsessions`**; the box keep-alive is the only writer.

## Changes, smallest first

1. Gap-fills honour `APX_FORCE_IPV4=true` (they hardcode `family: 6`).
2. Every script connects with `{ dbName: DB_NAME }` from `src/config/baseConstants.ts` and refuses to run when the URI's
   DB differs (mirror the check in `src/config/db.ts`).
3. Re-read the session (`apxsessions {orgId, isActive: {$ne:false}}`) before every page / request instead of only after a
   failure. When none is active, stop with a clear message instead of retrying forever (users script :320-331 and the
   gap-fill equivalents).
4. Users: `--list-only` mode that mirrors only `search_users_list` rows (no per-user `get_userfulldt`), and make `--limit`
   count list rows in that mode (today it counts analytics fetches only, so `--skip-analytics` ignores it).
5. Dry-run output prints counts and ids only, never full rows (student PII).
6. Optional if small: `mongoose.set('autoIndex', false)` in these scripts so the users run does not create platform
   collections in a mirror-only step.

## Tests

Unit tests where the scripts already have seams; otherwise extract the session-resolve and DB-name check into a small
helper with tests (wrong DB refuses; no active session stops; session re-read per call picks up a rotated id).

## Trial (allowed)

`npm run migrate:apx-user-raw -- --list-only --limit=200` against `vidyagramdb`, then report the `apx_user` count and the
`apxsessions` doc's isActive/lastHttpStatus (print nothing else from it). Never print user rows.

## Done when

Tests pass, `tsc --noEmit` shows no new errors, the trial writes exactly the limited rows, the session is still active,
commits are local on `fix/vg-commerce-mirror` (not pushed, no dist rebuild).
