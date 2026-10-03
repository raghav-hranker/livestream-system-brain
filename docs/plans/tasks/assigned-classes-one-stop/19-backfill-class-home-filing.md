# Backfill the class's own filing from its courses

**Type**: AFK to build and dry-run; HITL to run `--commit` on prod
**Blocked by**: — (round 3 is merged)

## What to build

PRD Round 4, "The backfill" and decision 45. Backend only.

- `src/scripts/backfillClassHomeFiling.ts`, runnable with `ts-node` like the other scripts in
  `src/scripts/` (read two of them first and match their shape: env loading, connect, disconnect,
  exit codes).
- Candidates: `Class` with `status: 1` and `topic: null`. For each, the distinct (section, topic,
  subTopic) of its **active** placements (`CourseClass.isActive: true`) that have a topic. Exactly one
  distinct triple ⇒ that is the class's new section, topic and subTopic. Compare ids as strings
  (placements may hold an ObjectId or a legacy string); write ObjectIds.
- Default is a dry run: counts per outcome (one place / several topics / no course filing), and up to
  10 sample rows (title, old section, new section › topic › subtopic).
- It always writes the backup JSON before any write: `_id` plus the old `section`, `topic`,
  `subTopic` of every class it would change, to a path given by `--backup <file>` (required with
  `--commit`).
- `--commit`: one `bulkWrite` of `updateOne` per class, filter `{ _id, topic: null }` so a class edited
  meanwhile is skipped; report matched/modified.
- `--restore <backup.json>`: put the old values back (same guard idea: only where the class still has
  the backfilled topic).
- Never touches placements.

Put the pure part (placements in → decision out) in a function with unit tests; the script is a thin
shell around it.

## Acceptance criteria

- [ ] Dry run against a local Mongo fixture shows the three outcomes correctly, writes nothing to
      classes, and writes the backup file.
- [ ] `--commit` updates only one-place classes, skips a class whose topic was set after selection,
      and leaves every placement byte-for-byte unchanged.
- [ ] `--restore` brings the old values back.
- [ ] Unit tests for the decision function: one place, same topic with two subtopics (= several
      places, not backfilled), several topics, no topic anywhere, inactive placements ignored,
      ObjectId vs string ids.
- [ ] Baselines stay green. **Do not run it against prod**; the prod run is the HITL step below.

## HITL step (user)

On the box after deploy: dry run, check the counts (expect about 399 one-place classes; numbers drift),
then `--commit --backup …` with the user's go-ahead. Keep the backup next to the other restore files.

## User stories covered

- 58
