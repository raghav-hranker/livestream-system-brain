# Writes that skip the hook (1): class assignment and course exchange

**Type**: AFK
**Blocked by**: 10
**Repo**: backend

## What to build

These admin actions write straight to the database driver (`Model.collection.*`), so the task 10 hook never sees
them. Each gets an explicit `recordChange` call with before/after copies.

Known sites on `origin/vidyagram-admin` 8da77b5eb (re-check line numbers on a fresh checkout):
- Course-class groups (adminCourseClassGroupsController, three driver writes)
- Class duplicate into a course
- Class rename (class names)
- Class assignment into a course (course-class assign)
- Course exchange and its admin undo (the order service's `Order.collection.updateOne`)

For each site:
- Read the affected records before the write.
- Write.
- Read them again and call `recordChange`. Bulk sites use the same 200-copy sample and total count as task 11.
- The actor comes from the request context, so nothing is passed by hand.

If a site can simply move onto the Mongoose model API without changing behaviour or speed, that's allowed instead of
an explicit call. Say which in the report.

## Acceptance criteria

- [ ] Integration, one per site: the admin action through its real route writes a change row with the right target,
      before and after.
- [ ] Integration: an exchange undo by an admin writes a change row on the order, actor admin.
- [ ] Report lists each site and how it was covered.
- [ ] `NO NEW FAILURES` against the backend baseline.

## User stories covered

- Story 17
