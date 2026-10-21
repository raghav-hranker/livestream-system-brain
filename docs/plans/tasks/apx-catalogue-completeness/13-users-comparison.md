# Users comparison

**Type**: AFK
**Blocked by**: 01 — Action page tracer
**Status**: done

**DONE 2026-09-29**: probe at 11:55 UTC over 820,042 AppX purchase rows (copy last synced 11:55 UTC). Per AppX course, unique buyers: 342,501 have access; **443 paid + 2,063 free valid AppX purchases have no platform access** (top: course 48 = 134 paid, 135 = 72, 90 = 39, 91 = 33); 311,443 expired; 221 disabled-unexpired; 67 no platform user; 0 ambiguous. People linked via `apxuseridmaps` (338k) then phone/email (6.7k). Counts on the page; probe in `outputs/apx-catalogue-completeness/probes/users-probe.cjs`. The per-person list is generated on the box at grant time (task 14).

## What to build

Per course: AppX buyers with valid access and no platform access, from the local AppX purchase copy, linked through the AppX user map then email/phone. Counts only on the page; the per-person list stays on the box.

## Acceptance criteria

- [ ] Groups: has access / gap / AppX expired / disabled-unexpired / no user / ambiguous user / unmapped item
- [ ] Access computed with the app's own rules (orders + plans, expireDate null never expires)
- [ ] Report states how fresh the AppX copy is
- [ ] No personal data leaves the box

## User stories covered

- Stories 27–30 (PRD numbering)
