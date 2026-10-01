# Preview and deploy Copy to another course

**Type**: HITL
**Blocked by**: #07, #08, #09, #11

## What to build

Copy ships as its own deploy, after the outline is live.

- **Local preview against prod.** Run preview mode across scopes on real courses. Run one real copy only
  into a target course the user names, for example an empty or test course. Remember that writes from
  local hit prod.
- After that copy, confirm the source course is unchanged: same placement count and same
  `coursetopics` rows.
- **Deploy** on the user's go-ahead: backend `dist` + admin, as in task 11.

## Acceptance criteria

- [ ] The user has approved the preview tables on at least one course and one section scope.
- [ ] One real copy into the user's named target: the result counts match the preview, the source is
      unchanged, and a re-run reports everything skipped.
- [ ] Deployed; SHAs recorded here and in memory.

## User stories covered

- Acceptance for 40–56, 59
