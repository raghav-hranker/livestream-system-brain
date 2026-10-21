# Measure, deploy and accept on prod

**Type**: HITL
**Blocked by**: 01, 02, 03, 04

## What to build

Ship course search to the production LMS and prove it on real data without regressing the
course screen.

- **Measure first** on prod-sized data (read-only harness:
  `reference/scripts/automatic-plan-extension-local/run-prod-readonly.sh` with
  `QT_AUTOEXT_WORKTREE` pointed at the test worktree). Budget from the PRD: a broad two-letter
  query on the largest course (~600 class placements) under ~150 ms server time, signed in. If
  over, fix before deploying (bound the pool before expensive stages, as the global class
  searcher did).
- **Deploy** the fork's way: rebase on `origin/quicktricks-admin`, commit src, surgical `dist`
  (compile to a temp dir, copy only changed `.js`, fix `.js.map` sources), `node --test` the
  dist, push, box `git pull --ff-only`, `pm2 restart` the API only. Commit as the work email,
  no co-author trailers. Auto mode blocks the push and the box: the user runs those steps.

## Acceptance criteria

- [ ] Perf numbers recorded (largest course, broad and narrow query, guest and signed in).
- [ ] Deployed; the commit SHA recorded in the task README and the memory note.
- [ ] The three tabs (class-tabs, Ebooks, Tests) return the same responses as before the deploy
      for a sample course (diff saved).
- [ ] A live search on the largest course returns all three sections; a live search on an
      inactive course returns 200.
- [ ] A signed-in search shows the same watch status and resume point as the class-tabs card.
- [ ] First minutes after restart: no new 5xx on the course routes.

## User stories covered

- Story 28: inactive course still searchable, verified on prod
- Story 39: fast on the largest course
