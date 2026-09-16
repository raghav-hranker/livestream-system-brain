# Audit the listener box against the branch

**Type:** HITL  
**Status:** DONE 2026-09-17 (read-only, nothing changed). Result table appended to
[`docs/plans/secure-r2-deployment-staging-2026-09-10.md`](../../secure-r2-deployment-staging-2026-09-10.md)
as "2026-09-17 — Task 00 audit of the transcoder box". **Seven owner decisions (D1–D7) are open and
task 05 stays blocked until they are answered** — the premise of this task was wrong in three ways:
the box is on `feat/apx-passthrough-472` (37 commits AHEAD of the slice branch, which it fully
contains), the shorts queue is served by a release dir running our own unpushed `6af515c` (the
listener WAS activated, 2026-09-11), and the manager checkout carries an unversioned 139-line Lua
dedupe feature.  
**ADR:** [0007](../../../adr/0007-shorts-readiness-via-transcode-callback.md) decision 9

## Why this is a hard gate

`launch/quicktricks-v2` in `repos/video-transcoder` is 5 commits ahead of origin, unpushed:
`9c6b2ef`, `54f26cd`, `d4f1897` (secure R2 intake lane), `6af515c`, `0ace725` (1C token fix). The
2026-09-10 staging record (`docs/plans/secure-r2-deployment-staging-2026-09-10.md`) says the box's
server HEAD stayed at `d8bc18ab…`, the secure-lane image was built and smoke-tested in isolation, and
shared listener → manager dispatch for that lane was **not qualified as deployed**. Deploying task 02
deploys those commits too. Nobody touches the box until we know what it runs.

## What to do

1. On the listener box (`root@178.63.88.34`, `/root/video-transcoder`): record `git rev-parse HEAD`,
   `git status --porcelain`, the pm2 process list, and `sha256sum` of `src/index.ts`,
   `src/intake-routing.js`, `src/intake-message.js`, `gpu-server/job-manager/{manager,secured-guard,secured-clients,redis-client,client-config}.js`.
2. On the GPU box: same for the manager checkout, plus `docker images` for the `video-processor*` /
   `cf-*` tags and which tag pm2 `b2-secure-job-manager` (id 20) spawns.
3. Diff each against `launch/quicktricks-v2` at `0ace725`. Classify every difference as: (a) in the
   5 unpushed commits, (b) local-only edits on the box, (c) drift the other way.
4. Read the live `.env` on both boxes **only for the keys this work touches**: `SECURED_CLIENTS`,
   `TRANSCODER_SECRET_472` (presence only, never the value), `CF_HRANKER_*`, `CF_SECURE_*`,
   `SECURED_API_URL_472`, `STORAGE_PROVIDER`. Note where `SECURED_API_URL_472` and 472's legacy
   `callbackApi` point (predecessor Defect 3: the standby, not prod) and **do not change them**.

## Acceptance criteria

- [ ] A written table per box: file, box hash, branch hash, classification.
- [ ] Any class-(b) or class-(c) difference has a named owner decision before task 05 starts.
- [ ] Confirmed which image tag the manager spawns for `queue:normal` today.
- [ ] Defect 3 status recorded, untouched.
- [ ] Result appended to `docs/plans/secure-r2-deployment-staging-2026-09-10.md` as a dated section.

## Do not

- Restart anything. Change any env. Push the branch. This task is read-only.
- Note: auto mode blocks `ssh` + `.env` reads as credential exploration; the operator runs these
  commands, or grants an `autoMode.allow` entry first.
