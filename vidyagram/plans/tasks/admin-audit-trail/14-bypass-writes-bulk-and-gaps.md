# Writes that skip the hook (2): bulk writes, sales, plan sync, and the known-gaps list

**Type**: AFK
**Blocked by**: 10
**Repo**: backend + system-brain (gaps note)

## What to build

Cover the rest of the writes the hook can't see, and write down exactly what is still not covered.

- **Check Mongoose 8.15 first.** Does the plugin's middleware fire for `Model.bulkWrite` and `Model.insertMany`?
  Write a tiny test that proves it either way.
  - If `bulkWrite` middleware fires, hook it in the plugin (filter and count per operation, sample as in task 11).
  - If not, cover the catalogue `bulkWrite` call sites explicitly. There were 43 calls at 8da77b5eb: course PDFs,
    course topic ordering, course copy, plans and others. Group them by helper where possible, rather than editing
    43 places.
  - Same for `insertMany` (14 calls, including class insert and course copy).
- **Driver writes in jobs.** Bulk sale price changes (`bulkSale.service`), plan-order sync (`planOrderSync.service`)
  and the APX backfills. Inside a job these only need counts for the task 12 summary, so add them to the job's
  counters. If a site can also run from an admin request, give it full copies there.
- **Search for anything missed.** Grep the branch for `.collection.`, `mongoose.connection.db`, native driver calls,
  `bulkWrite`, `insertMany`, `$merge` and `$out`. Every hit that writes to a policy collection is either covered or
  listed.
- **Known-gaps note.** Write `vidyagram/reference/admin-history-known-gaps.md` listing what isn't covered and why:
  - the AppX nightly sync, unless task 12 covered it
  - read-only dashboard code
  - anything else found

  Lookup users should read it first.

## Acceptance criteria

- [ ] A test shows whether Mongoose 8.15 fires `bulkWrite` and `insertMany` middleware.
- [ ] Integration: an admin action that uses `bulkWrite` (course topic reorder) writes change rows or a bulk row.
- [ ] Integration: a bulk sale run inside its job adds to that job's summary counts.
- [ ] Known-gaps note written and linked from the lookup script's help text.
- [ ] `NO NEW FAILURES` against the backend baseline.

## User stories covered

- Stories 17, 18
