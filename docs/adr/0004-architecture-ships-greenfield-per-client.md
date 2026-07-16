# This system ships greenfield: v2 architecture, future clients only

Tenancy is **by deployment**: the livestream code is client-generic, but each client runs their **own
instance**, env-pointed at that client's LMS (`LMS_BASE_URL`, `TRANSCODER_WEBHOOK_SECRET`, LMS Mongo URI
are single-valued per instance). The LMS itself is single-tenant per client (per-client branches, e.g.
`quicktricks-prod`).
This system — the v2 architecture (Room-less livestream ⇄ slice-07+ nodejs-server: stream-status
contract, `hlsAsset`, signed playback) — is deployed **fresh for clients onboarded from here on**.
Existing clients do not use this system and are out of its scope entirely: no data migration, no
backports, no dual-porting obligations toward their old stacks.

Consequences:

- **The Room-data-disposal problem does not exist.** New deployments start with a fresh DB — no Room
  documents, no `Note.classId` remap, no recordings backfill. The old Room-based branches are reference
  history, not a production line of this system.
- **v2 is the only production line.** Old-architecture defects (Room's unauthenticated routes, `GET
  /reset`, the enum drift) need no fixing — the code they live in never deploys again. They remain
  documented only as reasons the v2 design is shaped the way it is.
- **`clientId` stays dropped from the model** — the deployment *is* the tenant. If multi-tenant-per-
  deployment ever returns, it must be designed onto `Class` first (see the Room migration doc's loose end).
- **Per-client version drift is still possible in the future** (client A onboards on v2.0, client B on
  v2.3). "Which pairing does client X run" should be recorded per deployment when the second client lands.
- **True multi-tenancy is planned, not built.** The stated intent is to later serve multiple clients from
  ONE livestream instance. That day, three single-valued things become a per-client routing map keyed by
  the class's client — `{LMS_BASE_URL, TRANSCODER_WEBHOOK_SECRET, LMS Mongo URI}` — which is `clientId`
  returning (it already rides the RTMP path `/{clientId}/{classId}`), and ADR-0003's single-DB read
  becomes per-client. Nothing in v2 blocks this seam; do not build it before the second tenant is real.
