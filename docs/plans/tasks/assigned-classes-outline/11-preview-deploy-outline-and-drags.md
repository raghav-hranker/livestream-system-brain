# Preview and deploy the outline and drags

**Type**: HITL
**Blocked by**: #01–#06, #10

## What to build

The user previews the outline locally against production, then the branch ships, without Copy.

- **Local preview.** The user runs the backend with `DISABLE_CRONS=true PORT=5912` against prod (ssh
  tunnel), plus the local admin.
  - Reads are checked on several courses: Railway Prime Batch, a course with a stored topic order, one
    without, and the largest (32 sections).
  - Writes (drags, reverse, Change topic) are checked only on a course the user names.
- If Copy (07–09) is already on the branch, keep it unreachable for this deploy: hide its menu entries,
  or ship before it merges. The user decides which.
- **Deploy**, only on the user's go-ahead:
  - backend: surgical `dist` compile, then commit, push, box pull, pm2 restart (memory
    `quicktricks-backend-dist-deploy`);
  - admin: push to the Vercel line.
  - Rebase on `origin/quicktricks-admin` first.
- Check on prod: the website order for one dragged course follows the admin.

## Acceptance criteria

- [ ] The user has previewed and approved the outline locally.
- [ ] Backend and admin pushed and deployed; commit SHAs recorded here and in memory
      `course-class-grouped-view`.
- [ ] On prod, one topic drag and one section drag on the user's chosen course show up in the website's
      accordion and tab order.
- [ ] The Topic Priority page returns 404 on the deployed admin.

## User stories covered

- Acceptance for 1–39, 57, 58, 60–62
