# History, first working version

**Type**: AFK
**Blocked by**: 01, 07
**Repo**: backend + system-brain (lookup script)

## What to build

The thinnest complete history. An admin updating or deleting a **Class** leaves rows that say who, which session,
IP and browser, what, and before/after copies. The lookup script shows them. Later tasks widen coverage; this one
proves the whole path.

- **Request context.** Async-local storage holds the actor for one request.
  - Actor types: `admin` (id, name, email, role, session id), `student`, `no-login`, `job:<name>`, `script:<name>`.
  - It also holds IP (task 01), browser, request id, method and route pattern.
  - A middleware opens it for every request, and `requireAdmin` fills in the admin.
  - A `runAs(actor, fn)` call is exported for jobs and scripts (used in task 12).
- **History recorder.** `recordRequest`, `recordChange` and `recordJobSummary`.
  - Rows are saved off the request's path: the response never waits on them.
  - A failed save writes one `AUDIT_WRITE_FAILED` log line with actor, route, target and op, so the line itself
    still holds who and what.
  - `AUDIT_TRAIL=on|off` (default on) turns everything off.
  - Bodies go through the task 01 redactor, capped at 16 KB. Before and after copies are capped at 256 KB each, with
    a `truncated` flag.
- **`auditlogs` collection,** with the fields in the PRD. `kind` is request, change or job-summary. Ship an index
  script for:
  - `{ 'target.collection': 1, 'target.id': 1, at: -1 }`
  - `{ 'actor.adminId': 1, at: -1 }`
  - `{ requestId: 1 }`
  - `{ kind: 1, op: 1, at: -1 }`
  - a TTL on `at` of about 400 days

  Task 18 builds them on prod. No route writes, edits or deletes rows.
- **Database hook.** A global Mongoose plugin, registered before the models compile.
  - It covers `findOneAndUpdate`, `findOneAndDelete`, `updateOne`, `deleteOne`, `replaceOne`, and document `save` and
    `deleteOne`.
  - For an admin actor, the "pre" side reads the record and the "post" side reads it again, then `recordChange` is
    called.
  - In this task the audit policy holds only `classes`. Every other collection and actor is skipped.
- **Request rows.** Every admin write request (POST, PUT, PATCH, DELETE behind `requireAdmin`) gets one `request` row
  with status, outcome (succeeded, failed or refused) and duration. Refused attempts are recorded too. Change rows link
  to it by request id.
- **Lookup script, basic.** Add `reference/scripts/vidyagram-audit-lookup.js` to system-brain, and list it in its
  README.
  - It is read-only. `--collection classes --id <id>` prints a timeline: time, actor, session and IP, route, op, and
    the fields that changed between before and after.
  - It reads `vidyagramdb` using the connection pattern of the other `vidyagram-` scripts.

## Acceptance criteria

- [ ] Integration: an admin edit of a class through the real class route gives one request row and one change row,
      with actor, session id, IP, before and after.
- [ ] Integration: an admin class delete gives a change row with `before` and no `after`.
- [ ] Integration: a refused admin request (validation 400) gives a request row with outcome failed.
- [ ] Integration: secrets in the body are blanked. An oversize document is truncated and flagged.
- [ ] Integration: a forced save failure (stubbed) doesn't change the response and logs `AUDIT_WRITE_FAILED`.
      `AUDIT_TRAIL=off` writes no rows.
- [ ] Integration: a student request touching classes writes nothing.
- [ ] The lookup script prints the timeline for a seeded in-memory run.
- [ ] `NO NEW FAILURES` against the backend baseline.

## User stories covered

- Stories 1, 4, 5, 6, 7, 8, 22, 24, 25, 27
