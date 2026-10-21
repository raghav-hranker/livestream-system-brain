# Preview and deploy the outline, drags and Move to

**Type**: HITL
**Blocked by**: #08, #09 — and the Assigned Classes work deployed (this branch is built on it)

## What to build

- Local preview with the user (local admin → local backend on the prod database, ssh tunnel), on a
  course the user names: outline matches the student Ebooks tab; drag within and across topics;
  multi-drag; Move to…; Reverse; Free (this course); Download. Restore anything changed.
- On the user's go-ahead: merge, build `dist`, push, box pull + pm2 restart; admin via Vercel.
- Post-deploy: compare the admin outline and the student Ebooks tab on two real courses.

## Acceptance criteria

- [ ] Preview walked through with the user; issues fixed or ticketed.
- [ ] Deployed after the classes work; commit ids recorded in the README and memory.
- [ ] Two courses compared post-deploy.

## User stories covered

- 1–29 (verified in production)
