# StaleStreamSweep: alert on stuck transient statuses

**Type**: AFK
**Blocked by**: #01 — Pin the deployable branch pairing
**Repo**: nodejs-server
**Governing docs**: [PRD](../../prd-client-launch-v2.md) · [ADR-0002](../../../adr/0002-stream-status-at-least-once.md) · [slice § Build 3](../../../../slices/client-launch-v2.md)

> **Branch guard:** verify `git branch --show-current` matches `ACTIVE_BRANCH` in
> `system-brain/repos.manifest` before reading or changing anything. Ignore `.claude/worktrees/*`.

## What to build

The owner-side half of at-least-once delivery (ADR-0002 layer 2): a periodic job in nodejs-server that
alerts when any class sits in a *transient* stream status — `preparing`, `processing`, or
`reconnecting` — beyond a threshold. Detection only, no auto-repair: the LMS cannot know the stream's
true state. This makes transient statuses contractually time-bounded — a lost webhook is detected by
monitoring instead of by student complaints. End-to-end effect: a class stuck at `processing` past the
threshold produces an ops-visible alert.

## Acceptance criteria

- [ ] Periodic sweep queries classes whose transient status has exceeded the threshold and emits an alert (log/notification channel per repo convention)
- [ ] Only `preparing`, `processing`, `reconnecting` match; terminal statuses (`live`, `ended`) and `undefined` streamStatus (classes never touched by the lifecycle) are excluded
- [ ] No write/auto-repair of any class document
- [ ] Tests cover the stale-class query: threshold edges, transient-only matching, undefined excluded, terminal excluded (per PRD testing decisions)

## User stories covered

- Story 2: playback can honestly say "still processing" because processing is now time-bounded and monitored
- Story 10: ops alert when a class sits in a transient status beyond a threshold
