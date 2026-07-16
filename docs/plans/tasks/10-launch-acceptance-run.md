# Launch acceptance run

**Type**: HITL
**Blocked by**: #02–#09 — all code slices (which all sit behind #01)
**Repos**: all three + production environment
**Governing docs**: [PRD](../prd-client-launch-v2.md) · [slice § End-to-end test + Branch mechanics step 1](../../../slices/client-launch-v2.md) · [ADR-0003 guardrails](../../adr/0003-livestream-reads-class-via-shared-mongo.md) · [ADR-0004](../../adr/0004-architecture-ships-greenfield-per-client.md)

> **Branch guard:** verify every repo sits on `ACTIVE_BRANCH` per `system-brain/repos.manifest`
> (`./scripts/sync-branches.sh status`) before starting the run.

## What to do

The human-in-the-loop launch gate: give the client's production surfaces the secure shape, then prove
the whole arc live.

**Production-surface steps (human access required):**

1. Land the full streaming line (through slice 10B, not just `feature/secure-classes`) on the client's
   production LMS branch `quicktricks-prod`.
2. Provision the livestream service's Mongo user as **read-only** on the LMS `classes` collection
   (ADR-0003 guardrail).
3. Confirm the client deployment starts from a fresh DB — no Room documents, no backfill (ADR-0004).

**End-to-end acceptance run (from the slice file):**

Stream a class on the launch branch: OBS in → `preparing`→`live` visible via `/playback` transitions
(425→200 with signed URL) → kill nodejs-server for ~60s mid-`ended` → confirm the retry lands the
transition after restart (no stuck `processing`) → toggle private mode from the class UI → confirm
`Class.isPrivate` flips in the LMS and the room receives `privateModeUpdate`.

If anything fails, consult the slice file's failure-surface cheatsheet before debugging blind.

## Acceptance criteria

- [ ] `quicktricks-prod` carries the full streaming line (stream-status endpoint, secret middleware, playback gate, private-mode endpoint, sweep)
- [ ] Livestream DB user is read-only on `classes` (a write attempt from that user fails)
- [ ] Fresh client DB verified: zero Room documents, no migration/backfill executed
- [ ] Playback gate transitions 425→200 with a signed URL as the stream goes live/ends
- [ ] The 60-second LMS kill mid-`ended` is recovered by the producer retry — class reaches `ended`, `/playback` 200s, no stuck `processing`
- [ ] Private-mode toggle from the class UI persists and broadcasts `privateModeUpdate` to the room
- [ ] Governing docs (ADRs 0002–0004, slice file, SYSTEM/GLOSSARY updates) are committed in the system brain

## User stories covered

- Stories 1–7 (proven live end-to-end), 17 (fresh DB), 18 (ADRs recorded and committed)
