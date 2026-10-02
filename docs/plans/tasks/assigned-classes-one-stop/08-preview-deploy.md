# Preview and deploy

**Type**: HITL
**Blocked by**: #01–#07, #09–#13; outline task 11 (the outline deploys first)

## What to build

- **Local preview against prod reads**, on a course the user names (writes hit prod):
  - Go live opens ls;
  - one upload on a test class;
  - PDF/Tests sheets attach and remove, and the row counts follow;
  - switch a row off and on, and check the student listing hides it while off;
  - add a recorded class and a live class in place;
  - Round 2: Go live from the row ⋯; Move to… a row and a ticked set; drag a row and three ticked rows
    into another topic; Reset a moved row; on a class shown in two places, remove one place and check
    the student listing still has the other; upload a PDF from a class with Free off.
- **Deploy** on the user's go-ahead, like the outline:
  - backend: `dist` compile, then commit, push, box pull and pm2 restart;
  - admin: push.

## Acceptance criteria

- [ ] The user has approved the preview.
- [ ] Deployed; the SHAs are recorded here and in memory.
