# Tasks: Client Launch v2 — Room-less Streaming System

> Other task sets live in subdirectories: [`secure-pdf-upload/`](./secure-pdf-upload/README.md),
> [`secure-video-upload-b2/`](./secure-video-upload-b2/README.md).

Vertical-slice breakdown of [the PRD](../prd-client-launch-v2.md). Each task is a tracer bullet —
a thin, complete, independently-verifiable path — and names its target repo(s) plus the governing
ADR/slice section instead of restating it. The ordered worklist with file-level pointers is
[`slices/client-launch-v2.md`](../../../slices/client-launch-v2.md).

**Branch guard (every task):** verify `git branch --show-current` matches `ACTIVE_BRANCH` in
`repos.manifest` before touching a service repo. Several checkouts hold the old Room-based
architecture.

| # | Task | Type | Repo(s) | Blocked by |
|---|---|---|---|---|
| 01 | [Pin the deployable branch pairing](01-pin-branch-pairing.md) | AFK | all three + brain | None |
| 02 | [StreamStatusReporter: at-least-once retry](02-stream-status-retry.md) | AFK | livestream | 01 |
| 03 | [Write-through status cache + socket-join hydration](03-write-through-status-cache.md) | AFK | livestream | 02 |
| 04 | [StaleStreamSweep: alert on stuck transient statuses](04-stale-stream-sweep.md) | AFK | nodejs-server | 01 |
| 05 | [Private-mode endpoint + repoint the livestream client](05-private-mode-endpoint.md) | AFK | nodejs-server + livestream | 01 |
| 06 | [Freeze the shared-Mongo read contract](06-freeze-read-contract.md) | AFK | nodejs-server + livestream | 01 (soft: after 03) |
| 07 | [Delete the recordings relay and dead setStreamStatus](07-delete-recordings-relay.md) | AFK | livestream | 01 |
| 08 | [Delete the Room model, room routes, and in-repo viewer UI](08-delete-room-era-code.md) | AFK | livestream | 01 |
| 09 | [Fail-fast boot validation for LMS config](09-fail-fast-boot-validation.md) | AFK | livestream | 01 |
| 10 | [Launch acceptance run](10-launch-acceptance-run.md) | HITL | all + production | 02–09, 11–13 |
| 11 | [Private-mode join bootstrap + server-side enforcement](11-private-mode-join-bootstrap-enforcement.md) | AFK | livestream | 05 |
| 12 | [ls viewer: room-less realignment](12-ls-roomless-realignment.md) | AFK | ls | 08, 11 |
| 13 | [Notes move to the LMS](13-notes-move-to-lms.md) | AFK | nodejs-server + ls + livestream | 12 |
| 14 | [Stream-end cleanup dedupe](14-stream-end-cleanup-dedupe.md) | AFK | livestream | — |
| 15 | [Final-segment reconciliation at stream end](15-stream-end-final-segment-reconciliation.md) | AFK | livestream | — |
| 16 | [Post-stop re-finalization guard](16-post-stop-refinalization-guard.md) | AFK | livestream | 14 |
| 17 | [Shared-Redis ownership guard](17-shared-redis-ownership-guard.md) | AFK | livestream | — |

Tasks 15–17 were added 2026-07-27 from the prod acceptance run: 15 fixes the missing-last-segment
VOD 404 (upload mode skips the end-of-stream bulk upload with no reconciliation), 16 closes the
post-TTL Stop re-finalization gap task 14's 900s claim leaves open, and 17 is the ownership guard
that gates the shared-Redis (`REDIS_HOST`) scaling flip.

Tasks 11–12 were added 2026-07-22 from the room-sync design session (see
`secure-video-upload-b2/05-…` execution notes): 11 closes the private-mode late-join and
forged-`userMsg` seams; 12 removes the viewer's last `/room` dependence. Task 13 (same day)
moves the Room-era notes feature off the livestream backend into the LMS — 12's review found
`lib/api/notes.ts` still calling a livestream `/room/…/notes` route that trusts a
client-supplied `userId`.

Parallelism: once 01 lands, tasks 04–09 are all grabbable concurrently; 03 follows 02.
Task 10 is the only human-in-the-loop gate (production branches, DB grants, live OBS run).

## Running tasks with sandcastle

Tasks 02–09 are runnable as sandboxed agents via [sandcastle](https://github.com/mattpocock/sandcastle)
(Docker sandbox, one git worktree per agent, work lands on `sandcastle/task-NN` for review):

```sh
npm run task 02              # spawn the agent(s) for task 02
npm run task 05 -- --merge   # ...and merge into ACTIVE_BRANCH on success
```

The runner (`scripts/sandcastle/run-task.mjs`) enforces the branch guard (host repos must sit on
`ACTIVE_BRANCH` — i.e. task 01 must have landed), inlines each task's governing ADRs into the agent
prompt, and splits cross-repo tasks (05, 06) into one sandboxed leg per repo. One-time setup:
`claude setup-token` → paste into `.sandcastle/.env`. Tasks 01 and 10 are not agent tasks.
