# Tasks: LMS-Owned Personal Notes with Media Parity

Vertical-slice breakdown of the [LMS-owned personal-notes PRD](../../prd-lms-owned-personal-notes.md).
Each task is a narrow, independently verifiable tracer bullet. The deployed LMS fork is an explicit
landing target and does not inherit the upstream shared branch automatically.

Before touching a shared-branch service repo, verify its branch against `ACTIVE_BRANCH` in
`repos.manifest`. Production deployment and data coordination happen only in the HITL cutover task.

| # | Task | Type | Status | Blocked by |
|---|---|---|---|---|
| 01 | [Authenticated LMS text-notes tracer](./01-authenticated-lms-text-notes-tracer.md) | AFK | `ready-for-agent` | None |
| 02 | [Private image-note tracer](./02-private-image-note-tracer.md) | AFK | `ready-for-agent` | 01 |
| 03 | [Private audio-note parity](./03-private-audio-note-parity.md) | AFK | `ready-for-agent` | 02 |
| 04 | [Media edit, expiry, deletion, and cleanup](./04-media-lifecycle-and-cleanup.md) | AFK | `ready-for-agent` | 02, 03 |
| 05 | [`ls` viewer notes parity](./05-ls-viewer-notes-parity.md) | AFK | `ready-for-agent` | 04 |
| 06 | [Idempotent legacy-note migration](./06-idempotent-legacy-note-migration.md) | AFK | `ready-for-agent` | 04 |
| 07 | [Production migration and cutover](./07-production-migration-and-cutover.md) | HITL | `ready-for-human` | 05, 06 |
| 08 | [Retire Room-era notes from livestream](./08-retire-room-era-notes.md) | AFK | `ready-for-agent` | 07 |

Tasks 05 and 06 may run in parallel after task 04. Task 08 deliberately remains blocked by the
human production gate: removing the old notes service before migration, viewer cutover, and traffic
verification would create an outage or data-loss window.
