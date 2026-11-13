# Backend class timing deployment — 2026-09-11

User authorized backend deployment and explicitly excluded the student website.
Decision record: [backend ADR 0021](../../quicktricks-backend/docs/adr/0021-stream-derived-class-timing.md).

## Released

- Production branch: `quicktricks-admin`.
- Previous production HEAD: `8e06875ffbd07211af3c398bf907c9348e0d2e10`.
- Source implementation rebased onto that exact production HEAD: `2993d002f`.
- Compiled runtime artifacts/release HEAD: `f2bd15685598ebc3c2b835f5fce6a915fb38cd25`.
- Pushed production branch to `abhi092515/quicktricks-backend` after deployment.
- Host: `148.113.49.18`; checkout
  `/var/www/backend.quicktricksbysahilsir.com/quicktricks-backend`.
- Restarted only PM2 `quicktricks-backend` (ID 27), new PID `1097864`.
- Production working tree clean after release.

## Verification

- Exact production-based source passed all 73 focused regression tests.
- Standard `npm run build` passed. `build:prod` references a missing
  `tsconfig.prod.json`; used the standard build instead. Only the seven changed
  runtime modules and their maps were included, preserving other production
  artifacts and the server's existing chat changes.
- Localhost and public course API both returned HTTP 200 after restart.
- 140 listed classes have isBlinking equal to streamStatus live; all 140 retained
  their pre-deployment assignment dates in the before/after response comparison.
- Public topic listing returned HTTP 200 and its class indicators were checked.
- No production assignment creation or artificial live/processing transition was
  performed. End-to-end lifecycle mutation was verified in isolated regression
  tests; the next real broadcast exercises it in production.

## Scope and rollback

Student website commit remains local and was not pushed, merged, or deployed.
Its existing class_link badge gate remains unchanged at the user's request.
Admin isLive labels, existing historical assignment dates, and livestream retry
behavior remain unchanged. No historical backfill was run.

Production rollback branch `rollback/class-timing-20260911` retains the previous
HEAD. The deployment script guarded the original branch/HEAD and clean worktree,
then fast-forwarded the source plus compiled artifacts. It included health-check
rollback; that path was not needed. For a later rollback, revert the two release
commits in reverse order and restart only the backend; do not rewind unrelated
subsequent changes. Already-captured optional timestamps need no destructive
schema rollback.

Evidence: `/private/tmp/class-timing-release-tests.log`,
`/private/tmp/class-timing-release-build.log`, before/after JSON snapshots in
`/private/tmp/class-timing-{before,after}.json`, topic snapshot
`/private/tmp/class-timing-topic-after.json`; server
`/tmp/class-timing-pm2-restart.log` and `/tmp/class-timing-smoke.json`.

## First real broadcast verification

After the user reported assignment times not updating, read-only inspection of
newest class `test 7` (`6aa3e84563ba17b82d756786`) showed successful propagation:
assignment created 11:39:22.016 UTC; actualStartedAt and assignment startDate both
11:44:45.431 UTC, with matching actualStartAppliedAt. Public course API also returned
that start, streamStatus live, and isBlinking true. End remained IST day-end while
live, as intended. No repair/data mutation was performed.

The inspected admin hook retains query freshness for five minutes, disables
window-focus refetch, and has no polling interval. A stale open assignment screen
is consistent with the report; a full page refresh should show the API's value.
This is source-based UI diagnosis, not a live-browser reproduction.
