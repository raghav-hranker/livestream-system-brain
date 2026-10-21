# Rollout + prod verification

**Type**: HITL
**Blocked by**: #01–#06

## What to build

Ship to production in the safe order and prove it on a real send. HITL because the prod box is not
reachable from auto mode and the first Advanced send reaches real students.

1. **Backend first**: rebase onto `origin/quicktricks-admin`, surgical `dist` compile, commit (work
   email, no co-author trailer), push, box pull, pm2 restart. Confirm the currently live admin still
   creates Default plan broadcasts normally.
2. **Admin**: rebase, push to `quicktricks-admin` → Vercel.
3. **First Advanced send**: a small audience — e.g. one row, **Active** on a plan with a handful of
   holders. Before sending, note the estimate; after, compare `resolvedAudienceCount`, the delivery log
   user ids and the plan's current holders.
4. Update the brain: memory entry, and the PRD/README state to done.

## Acceptance criteria

- [ ] Backend live; a Default plan broadcast from the already-deployed admin behaves as before.
- [ ] Admin live with the Default/Advanced toggle.
- [ ] One small Advanced send: estimate = `resolvedAudienceCount` = distinct delivery-log users, and every recipient is an active holder of the chosen plan (and no one else).
- [ ] Brain docs/memory updated with the deployed commits.

## User stories covered

- Story 29: current holders don't get their own plan's promo under Default.
- Story 32: backend-first rollout.
