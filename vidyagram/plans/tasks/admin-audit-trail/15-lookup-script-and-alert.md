# Full lookup script + alert when history fails to save

**Type**: AFK
**Blocked by**: 10
**Repo**: system-brain (script) + ops-console (`../ops-console`)

## What to build

The developer can answer every "what happened" question from the terminal, and hears about gaps in the history.

- **`vidyagram-audit-lookup`** grows from task 10's basic version. It stays read-only.
  - `--collection X --id Y`: one record's timeline (from task 10).
  - `--admin <id|email> --from --to`: everything one admin did, grouped by request.
  - `--deletes --days N`: every delete, by any actor.
  - `--request <id>`: one request and every change it made.
  - `--actor no-login|job:<name>|script:<name> --days N`: changes by that kind of actor.
  - Output: a readable timeline by default, with field-level differences between before and after; `--json` for
    raw rows.
  - Every listing prints the known-gaps reminder line (task 14's note).
  - Dates are shown in IST.
- **Alert.** An ops-console check, following the pattern of the existing Vidyagram checks, counts
  `AUDIT_WRITE_FAILED` lines in the Vidyagram pm2 out log since the last run. It posts to Telegram when the count is
  above zero, with the first line's actor and route. Deploying it is part of task 18.

## Acceptance criteria

- [ ] Each lookup mode works against an in-memory or local `auditlogs` seeded with rows of every kind. Sample output
      is pasted in the report.
- [ ] The before/after differences show added, removed and changed fields, nested ones included.
- [ ] The ops-console check fires on a sample log with failure lines and stays quiet without them. It has tests if
      the existing checks do.
- [ ] Script listed in `reference/scripts/README.md`.

## User stories covered

- Stories 2, 3, 26
