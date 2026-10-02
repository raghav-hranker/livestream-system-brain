# Row ⋯ menu + Go live

**Type**: AFK
**Blocked by**: None — can start immediately

## What to build

PRD decisions 4 and 5. Every class row in the Assigned Classes outline gets a ⋯ menu. Its first item
is **Go live**: it mints the Streamer token and opens the class screen in a new tab, exactly as the
Classes list does today.

- Lift `ClassesDashboard.handleGoLive` (`components/ClassesDashboard.tsx:154-197`) into a `useGoLive`
  hook. Use it in the Classes list, the live schedule (`LiveClassesScheduleDashboard.tsx:159-177`) and
  the outline.
- Keep `userId = classId` in the token, as the Classes list does: ls takes the socket identity from
  the token's `userId` (`ls/app/[userId]/[roomId]/page.tsx:99-114`).
- The live schedule passes the admin id instead. Read ls and decide whether to align it. Report the
  decision either way; don't change behaviour silently.
- The row menu (`OutlineRowMenu`) is disabled while a drag or save is in flight. On a listing row it
  acts on the row's class. Leave clear slots for tasks 02–04's items.

## Acceptance criteria

- [ ] Every class row has a ⋯ menu, and Go live opens `<base>/<customer_id>/<classId>/?token=…` in a
      new tab with the same token claims as the Classes list.
- [ ] The Classes list and the live schedule use `useGoLive`, with unchanged behaviour (or a documented,
      deliberate change for the schedule's `userId`).
- [ ] The menu is disabled during a drag or save, and works at phone width.
- [ ] Component tests: the ⋯ menu renders on rows, and Go live calls the hook with the row's class.
      The hook's URL and claims are tested with the token mint mocked.
- [ ] Baselines stay green.

## User stories covered

- 1, 2
