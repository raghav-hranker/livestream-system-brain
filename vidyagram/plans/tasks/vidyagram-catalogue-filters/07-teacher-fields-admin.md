# Teacher subject, rating and reviews in the admin

**Type**: AFK
**Blocked by**: 06 — Teacher catalogue fields and API (field names)
**Repo**: admin only

## What to build

- Faculty form (`FacultyForm`): three optional fields in the details section: **Subject** (text input with
  suggestions from subject values already used by other teachers, fetched from the faculty list, so
  spelling stays consistent), **Rating** (number, 0–5, step 0.1) and **Reviews** (whole number ≥ 0).
  Loading a faculty fills them; create and update payloads send them (multipart, like the other fields).
  Client-side validation mirrors the API (range and integer).
- Faculty list: Subject and Rating columns (rating shown as "4.8 · 18.4k" style, blank when unset).

## Acceptance criteria

- [ ] Component tests: the three fields render, load from an existing faculty, are included in the
      submitted payload, and a rating of 5.1 or a negative review count blocks submit with a message.
- [ ] List renders the two columns, blank when the fields are unset.
- [ ] `NO NEW FAILURES` against `baseline-admin.txt`.
- [ ] `config.ts` not committed pointing at localhost.

## User stories covered

- Teacher tab (PRD "Teacher tab" section): admin-entered subject, rating and review count.
