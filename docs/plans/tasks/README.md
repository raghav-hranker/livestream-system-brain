# Tasks: Client Launch v2 — Room-less Streaming System

> Other task sets live in subdirectories: [`secure-pdf-upload/`](./secure-pdf-upload/README.md).

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
| 10 | [Launch acceptance run](10-launch-acceptance-run.md) | HITL | all + production | 02–09 |

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
