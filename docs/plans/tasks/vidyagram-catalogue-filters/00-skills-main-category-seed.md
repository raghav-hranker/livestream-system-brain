# Skills main category, seeded and guarded

**Type**: AFK
**Blocked by**: None — can start immediately
**Repo**: backend + admin

## What to build

Skills is one main category that exists from the first deploy and can never be removed. Add
`isSkills` (boolean, default false) to the main category model; it has no admin form field and is written
only by a seed.

Backend:
- An idempotent seed script under the backend's scripts folder (same style as the existing one-off scripts)
  that upserts one main category matching `{ isSkills: true }`: on miss it creates "Skills" with status 1,
  priority after the existing ones and a placeholder image; on hit it changes nothing. Matching is by
  `isSkills`, never by name, so a renamed row is found again. Takes the Mongo URI from the environment the
  other scripts use; prints what it did.
- The main category delete route refuses to delete a document with `isSkills: true` (4xx with a clear
  message). Update keeps working, except that `isSkills` is stripped from any create or update body.
- Main category list and read payloads include `isSkills`.

Admin:
- The main categories list shows a "Skills section" label on the `isSkills` row and hides its delete
  control. Edit stays available.

## Acceptance criteria

- [ ] Integration test: the seed run twice leaves exactly one `isSkills` main category; renaming it and
      re-running does not create a second; a database with no Skills row gets one.
- [ ] Integration test: deleting the `isSkills` main category returns an error and the row remains; deleting
      another main category still works.
- [ ] Integration test: create and update bodies cannot set `isSkills`.
- [ ] Admin component test: the list renders the label and no delete control for the `isSkills` row.
- [ ] `NO NEW FAILURES` against both baselines.

## User stories covered

- Stories 22, 23, 24, 27
