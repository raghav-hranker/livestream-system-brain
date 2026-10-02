# Preview and deploy

**Type**: HITL
**Blocked by**: #01–#06; outline task 11 (the outline deploys first)

## What to build

- **Local preview against prod reads**, on a course the user names (writes hit prod):
  - Go live opens ls;
  - one upload on a test class;
  - PDF/Tests sheets attach and remove;
  - add a recorded class and a live class in place.
- **Deploy** on the user's go-ahead, like the outline:
  - backend: `dist` compile, then commit, push, box pull and pm2 restart;
  - admin: push.

## Acceptance criteria

- [ ] The user has approved the preview.
- [ ] Deployed; the SHAs are recorded here and in memory.
