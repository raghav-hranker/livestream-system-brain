# 02 Faculty in Bulk edit

**Type**: AFK
**Blocked by**: 01 (uses its route)
**Feature**: A, prefix `qt-faculty`

## What to build

Ticked classes, then Bulk edit, now has a Faculty field (board B). The sheet gets two group labels. "In
this course" holds the existing start date and Free fields. "In every course these classes are in" holds a
"Set faculty" checkbox, which reveals a faculty select.

- **Counts.** With faculty ticked, the sheet says how many classes change and how many courses that
  reaches. Ask the route for this, either with a `dryRun` flag or a small read. Choose one and say which.
- **Warning.** When any ticked class has no recording yet, show "N of them haven't gone live yet".
- **Apply.** Apply runs the per-course changes and the faculty change as two calls and reports each
  result. The faculty call goes only when its box is ticked and a faculty is picked. The button reads
  "Apply to N classes".

## Acceptance criteria

- [ ] Without the faculty box ticked, the payload and requests are exactly as before (component test).
- [ ] With it ticked, one faculty call carries every ticked class id (component test).
- [ ] Already-matching classes are reported as skipped.
- [ ] The outline rows refresh with the new faculty.
- [ ] Suites print NO NEW FAILURES.

## User stories covered

9–13
