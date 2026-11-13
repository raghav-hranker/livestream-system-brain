# Partial ownership in listings

**Type**: AFK
**Blocked by**: #05 — Classes locked by chapter

## What to build

A student with a build sees the course in My Courses and can tell what they own. My Courses and the
course detail return `isPartial`, `ownedTopicIds`, `ownedExtras` and `revisionOnly` for a partial owner,
with `is_buy` = 1. The builder data endpoint (03) tells a full owner they already own everything, and
tells a partial owner which chapters they already have.

## Acceptance criteria

- [ ] Partial owner appears in My Courses with the new fields; full owner and non-owner unchanged.
- [ ] Existing listing responses for other users are byte-identical apart from the new fields.
- [ ] Suites `NO NEW FAILURES`.

## User stories covered

- Story 14, 17, 24
