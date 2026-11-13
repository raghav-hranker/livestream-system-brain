# Remaining tabs and search

**Type**: AFK
**Blocked by**: 01 — Old batch (catalogue rule and `tab`)
**Repo**: backend only

## What to build

The app sends `tab` for every catalogue tab and a `search` text; the server owns the rules.

- Catalogue rule: `new` = `showInBatchFilter: true`; `live` = `isLive: true` plus the existing "live is
  never free"; `vod` = `isRecorded: true`; `free` = `isFree: true`; `all` = only the common clauses. Each
  tab also excludes old courses (already in the rule from task 01). An unknown `tab` is a 400.
- `search`: optional text. After the tab clauses, keep courses whose title or any faculty name contains the
  text, case-insensitively, using the faculties the handler already looks up. Empty or whitespace `search`
  means no search. Works with every tab, including `exam` and `skills` once those land (groups are then
  computed from the searched set, which is what the prototype shows).
- `/batch-filter` keeps forcing `showInBatchFilter` on top of whatever `tab` says.

## Acceptance criteria

- [ ] Integration tests, one per tab: `new`, `live`, `vod`, `free`, `all` each return exactly the expected
      courses from a fixture that has one course of every kind plus an old one.
- [ ] Integration test: `search` matches by title and by faculty name, case-insensitively, inside the chosen
      tab; a search with no hits returns an empty list and status 200.
- [ ] Integration test: unknown `tab` returns 400; `/batch-filter` with `tab: 'all'` still only returns
      `showInBatchFilter` courses.
- [ ] Unit tests on the rule for each of the five tabs.
- [ ] `NO NEW FAILURES` against the backend baseline.

## User stories covered

- Stories 13, 14, 15, 31
