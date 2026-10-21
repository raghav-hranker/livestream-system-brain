# Deploy the Free fix

**Type**: HITL
**Blocked by**: #01 — Course-screen Free writes this course only

## What to build

Ship task 01 to production, with the user's go-ahead at each step.

- Push both fix branches (backend via the `git@raghav-hranker` alias), merge into `quicktricks-admin`
  as the user directs.
- Backend: commit the built `dist` for the changed files (surgical build), push, box pull + pm2 restart
  (memories `quicktricks-backend-dist-deploy`, `quicktricks-prod-box`, `quicktricks-box-ssh-key`).
  Admin: Vercel deploys on push.
- Hand check on a course the user names: tick Free on one PDF that sits in two courses; confirm the
  other course is unchanged in the admin and in the student Ebooks tab; untick to restore.

## Acceptance criteria

- [ ] Backend and admin deployed; commit ids recorded in this README and in memory.
- [ ] The hand check passed and was reverted.
- [ ] `Pdf.isFree` count in prod unchanged by the check (still 14 until task 06).

## User stories covered

- 30, 43 (verified in production)
