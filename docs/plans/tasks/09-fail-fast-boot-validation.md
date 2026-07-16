# Fail-fast boot validation for LMS config

**Type**: AFK
**Blocked by**: #01 — Pin the deployable branch pairing
**Repo**: livestream
**Governing docs**: [PRD](../prd-client-launch-v2.md) · [ADR-0004](../../adr/0004-architecture-ships-greenfield-per-client.md) (per-client env: `LMS_BASE_URL`, `TRANSCODER_WEBHOOK_SECRET`, LMS Mongo URI are single-valued per instance)

> **Branch guard:** verify `git branch --show-current` matches `ACTIVE_BRANCH` in
> `system-brain/repos.manifest` before reading or changing anything. Ignore `.claude/worktrees/*`.

## What to build

Make the livestream service refuse to boot when its LMS wiring is missing: the LMS base URL and the
transcoder webhook secret. Today a missing value surfaces at class time (a status write that silently
never lands, a private-mode call that 401s); it must surface at deploy time instead, with a clear
message naming the missing variable. Each client deployment is env-pointed at its own LMS (ADR-0004),
so a misconfigured instance is a per-client launch hazard.

## Acceptance criteria

- [ ] Boot aborts with a clear, variable-naming error when the LMS base URL is unset
- [ ] Boot aborts with a clear, variable-naming error when the transcoder webhook secret is unset
- [ ] A correctly configured environment boots exactly as before
- [ ] Test covers the validation (missing vars ⇒ startup failure; present ⇒ startup proceeds)

## User stories covered

- Story 11: fail fast at boot on missing LMS URL or webhook secret, so misconfiguration surfaces at deploy time
