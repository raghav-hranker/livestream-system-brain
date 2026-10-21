# Targeted importer import class

**Type**: HITL
**Blocked by**: 11
**Status**: done

**DONE 2026-09-30**: 17 new classes (16 inactive deleted-in-AppX + talk show active) with ingest jobs; 10 dead live-stream rows dropped. Verified 51/51 placement statuses.

## What to build

Extend the targeted importer to create new classes and enqueue the video ingest for approved Import class rows; AppX-disabled items come in inactive.

## Acceptance criteria

- [ ] Reuses existing class-creation and ingest-job code
- [ ] Status set at creation
- [ ] Re-audit shows the rows cleared and hlsAsset stamped after ingest

## User stories covered

- Stories 10, 22 (PRD numbering)
