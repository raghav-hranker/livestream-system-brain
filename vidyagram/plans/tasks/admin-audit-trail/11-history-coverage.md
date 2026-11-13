# History coverage

**Type**: AFK
**Blocked by**: 10
**Repo**: backend

## What to build

Widen the task 10 history from "admin edits to classes" to everything in the audit policy.

- **Audit policy table:** one data structure, not scattered `if`s.
  - **Collections:** courses, classes, course-class links, course topics and placements, PDFs and course PDFs, plans,
    orders, users, coupons, banners, course folders, taxonomy (topics, subtopics, sections), extension settings,
    feedback (moderation), certificates, admins and admin sessions.
  - **Actors:** `admin`, `no-login`, `job`, `script` are always recorded. `student` is recorded only for deletes, or
    for a write to a record that isn't their own (for example, a user record whose id isn't theirs, or an order
    whose user isn't theirs).
- **Multi-record operations.** `updateMany`, `deleteMany` and `insertMany` hooks.
  - Each records the filter and the total count, and samples before/after copies of up to 200 records (the first
    200 by `_id`).
  - The count and sample read happen only for recorded actors.
- **Deletes from anyone.** Any delete on a policy collection is recorded whatever the actor, students included.
- **No-login writes.** A write with no login is recorded as `no-login` with IP, browser and referer. Many routes are
  still open, so this is where unexpected changes will show.
- **Sensitive reads.** A `request` row of kind read for:
  - user list and search, a user's profile
  - every export or CSV route
  - order lists and order reads
  - `purchased-users`
  - the admin feedback lists
  - the passwordless-login path

  It holds the filter (redacted) and the number of rows returned, never the rows. List the routes in the policy
  table, with how each route's result count is read.
- **Admin requests of every collection** get request rows, not just classes.

## Acceptance criteria

- [ ] Integration: an admin edit on a course, order and user each give change rows. A coupon edit through its route
      does too.
- [ ] Integration: an admin `updateMany` over 500 records gives one change row with the filter, count 500 and 200
      sampled copies.
- [ ] Integration: a no-login write to an open route gives rows with actor `no-login` and the IP.
- [ ] Integration: a student editing their own profile writes nothing. A student delete of their own record writes
      a change row.
- [ ] Integration: an admin calling user search writes a read row with the filter and row count, and no student data.
- [ ] Integration: the passwordless-login path writes a read row.
- [ ] `NO NEW FAILURES` against the backend baseline.

## User stories covered

- Stories 9, 12, 13, 16
