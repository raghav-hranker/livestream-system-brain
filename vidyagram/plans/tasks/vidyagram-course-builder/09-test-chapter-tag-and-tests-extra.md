# Test chapter tag and Tests extra

**Type**: AFK
**Blocked by**: #05 — Classes locked by chapter

## What to build

Tests follow the student's chapters and open only with Tests in the build.

- An optional chapter (topic) on the course-test placement, set from a picker on the Assign Tests screen.
- The user test access route takes the user from the login token, not from URL params. Check every
  caller (app and website) before changing the contract and note any that still send a URL user id.
- Access for a partial owner: the test's chapter is in scope and Tests is in the build. An untagged test
  is covered when the build includes any chapter of the test's section (interim rule, PRD question 5).

## Acceptance criteria

- [ ] Tagged test: opens with its chapter and Tests; denied without Tests or without the chapter.
- [ ] Untagged test follows the interim section rule.
- [ ] Request with another user's id in the URL cannot read that user's access.
- [ ] Admin test for the picker; both suites `NO NEW FAILURES`.

## User stories covered

- Story 20, 34
