# Deploy, demo course and app guide

**Type**: HITL
**Blocked by**: 07

## What to do

1. Count real build orders on live (read-only) and list builder courses with Revision only offered (expected: the demo
   course). Agree with the user what Revision extra price the demo course gets; old orders stay whole through
   `build.rules`.
2. Update `vidyagram/reference/vidyagram-course-builder-app-guide.md` (Revision extra, no Revision only, hidden
   extras) and its Claude Doc; the user sends it to the app team. The app must ship the Revision extra before or with
   the backend, or students on an old app can't buy Revision (they can still buy chapters).
3. Merge `origin/vidyagram-admin` into both integration branches, suites `NO NEW FAILURES`, surgical backend dist
   (backup the box dist first), push `vidyagram-admin` on both repos with the user's go, box pull + `pm2 restart 92`,
   Vercel admin deploy.
4. Smoke: new routes 401 without a token; builder data for the demo course shows the Revision extra; one admin
   playground create on live with the user, left off sale, then deleted or kept as the user says.
5. Memory note + README status.
