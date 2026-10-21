# App handoff, seed on prod, deploy

**Type**: HITL
**Blocked by**: 00, 01, 02, 03, 04
**Repo**: backend + admin + system-brain

## What to build

With the user present:

1. Merge the integration branch `feat/vg-catalogue-filters` into `vidyagram-admin` on both repos after
   the course-builder branch has landed there (this branch was cut from it).
2. Write the app team guide in system-brain `reference/` (same style as the mobile socket guide): the
   `tab` values, `search`, the `groups` shape with a sample response per tab, `isOld` on course payloads,
   and the "Old batch · VOD" label.
3. Run the Skills seed once against `vidyagramdb` (read `reference/hosts.md` first; record the run in the
   prod-data-changes ledger). Confirm one `isSkills` row.
4. Backend dist build and deploy to the Vidyagram pm2 process; admin deploy to its Vercel project.
5. Smoke: the three filter calls (`exam`, `skills`, `old`) by hand against the live API, and in the admin
   create one skill course and retire one batch, then undo the retire.

## Acceptance criteria

- [ ] Guide committed in system-brain and sent to the app team.
- [ ] Seed run recorded in the ledger; exactly one `isSkills` main category on prod.
- [ ] Live `tab: 'exam'` returns groups with counts and no Skills group; `tab: 'skills'` returns the
      Skills categories; `tab: 'old'` returns only old courses and no other tab returns them.
- [ ] Admin: Old switch, badge and filter work on real data; Skills row shows the label and no delete.
- [ ] Memory note updated with what is live.

## User stories covered

- Stories 22, 28, 29, 30, 31 (end to end)
