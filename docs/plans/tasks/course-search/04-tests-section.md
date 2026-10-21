# Tests section (course tests), with the Tests tab pinned

**Type**: AFK
**Blocked by**: 01 — Classes section, end to end (guest view)

## What to build

`tests` returns this course's tests whose `series_name` matches, each item exactly as an entry of
the live mobile Tests tab (`GET /courses/:id/tests?userId=…`). The item builder moves out of the
listing controller into one **course test item** module that takes the user id as an argument.
The live tab must not change by a byte.

Order of work:

1. **Pin the tab first.** Golden tests capture today's mobile Tests tab response (topic grouping
   included). Fixtures cover: section-name resolution with and without `overrideSectionName`;
   `is_free` truthy variants; `max_attempted_limit`; `custom_tag` `'0'` → `Misc`; attempt counts
   for the query user; inactive placements excluded; `priority` order.
2. **Extract** the placement → series item pipeline, the batched section-name resolution and the
   attempt enrichment into the course test item module (the user id is an argument, `null` for
   none). Topic grouping stays in the listing. The listing keeps passing its query `userId`
   unchanged; the admin mode of that controller is untouched.
3. The golden tests pass unchanged.
4. **Fill `tests`**: title-search match and rank on `series_name`, then placement `priority`; cut
   at `limit`; attempts from the **verified token user only** (D10), none for a guest. Spelling
   vocabulary scoped to this course's test names.

## Acceptance criteria

- [ ] Golden tests for the mobile Tests tab exist on the base branch's behaviour and pass
      unchanged after the extraction.
- [ ] Each `tests` item deep-equals the Tests tab's entry for the same placement and the same
      (token) user.
- [ ] A body `userId` without a token yields the listing's defaults (`is_attempted` /
      `attempted_count` not from that user); a valid token yields that user's attempts.
- [ ] Inactive placements never appear; equal-rank matches follow `priority`.
- [ ] A throwing tests section yields `tests: []` with the others intact.
- [ ] Integration test for the section (in-memory Mongo).

## User stories covered

- Stories 22–24: find a test by name, with attempts, limit and sections
- Story 30: attempts never revealed through a body user id
- Stories 37–38: the live tab doesn't regress; one item builder for tab and search
