# Retire Room-era notes from livestream

**Type:** AFK  
**Status:** `ready-for-agent`  
**User stories:** 14, 31–32, 37, 55

## Parent

[PRD: LMS-Owned Personal Notes with Media Parity](../../prd-lms-owned-personal-notes.md)

## What to build

After the production cutover gate records zero legacy notes traffic, remove the Room-era notes API,
Note persistence model, route mount, and notes-specific upload code from livestream. Preserve any
storage helper still used by chat media or another real-time feature. Confirm the deployed LMS owns
both canonical and compatibility contracts directly and no LMS route proxies notes back to
livestream.

This task retires code and network ownership only. It does not delete the retained legacy Mongo data
or old bucket objects; destructive source cleanup remains outside this PRD until the rollback window
has elapsed and receives separate authorization.

## Acceptance criteria

- [ ] Livestream contains no personal-notes route, Note model, route mount, or notes-only upload path.
- [ ] Requests to the former socket-service notes endpoints return 404 after deployment.
- [ ] LMS canonical and compatibility notes routes continue to pass text, image, and audio CRUD acceptance through both viewers.
- [ ] The deployed LMS has no notes proxy or runtime dependency on the livestream notes endpoint.
- [ ] Chat media and every remaining caller of shared storage helpers continue to work and their regression suites remain green.
- [ ] Old Mongo records and bucket objects are not deleted by this task and remain recoverable through the rollback window.
- [ ] Whole-system documentation no longer describes personal notes as owned by livestream and links to the LMS contract instead.

## Blocked by

- [Task 07: Production migration and cutover](./07-production-migration-and-cutover.md)
