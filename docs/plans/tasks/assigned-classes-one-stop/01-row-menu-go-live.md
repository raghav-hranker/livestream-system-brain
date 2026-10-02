# Row Go live button, status pill and ⋯ menu

**Type**: AFK
**Blocked by**: None — can start immediately

## What to build

PRD decisions 3, 5 and 6 (board G of the preview, https://claude.ai/artifact/FhD4V5SgPczfghzZA1KoKn).
Every class row in the Assigned Classes outline gets three things:
- a **Go live** button on the row itself;
- a **video status pill** under the title;
- a **⋯ menu**, empty here, that tasks 02–04 fill with Upload video, PDFs and Tests.

- **Backend:** the outline rows (`loadListingRows`, `adminCourseClassGroupsController.ts`) carry each
  class's `streamStatus` and `hasPlayback` (true when the class has an `hlsAsset`; never send the asset).
  Check what the rows carry first; add only what is missing.
- **Go live:** lift `ClassesDashboard.handleGoLive` (`components/ClassesDashboard.tsx:154-197`) into a
  `useGoLive` hook. Use it in the Classes list, the live schedule (`LiveClassesScheduleDashboard.tsx:159-177`)
  and the outline row button.
  - Keep `userId = classId` in the token, as the Classes list does: ls takes the socket identity from
    the token's `userId` (`ls/app/[userId]/[roomId]/page.tsx:99-114`).
  - The live schedule passes the admin id instead. Read ls and decide whether to align it. Report the
    decision either way; don't change behaviour silently.
  - Solid style for *Live now* and *Scheduled*, light otherwise. Offered on every row.
- **Status pill:** one pure function in `lib/` of `{ streamStatus, hasPlayback, startDate, now }`:
  `live`/`preparing`/`reconnecting` → *Live now*; `processing` → *Processing*; `hasPlayback` or `ended`
  → *Recording ready*; else a future start → *Scheduled · 03 Oct, 10:00*; else *No video yet*.
- **Row ⋯ menu** (`OutlineRowMenu`): disabled, like Go live, while a drag or save is in flight. On a
  listing row both act on the row's class. Leave clear slots for tasks 02–04's items.

## Acceptance criteria

- [ ] Every class row shows Go live, which opens `<base>/<customer_id>/<classId>/?token=…` in a new tab
      with the same token claims as the Classes list.
- [ ] Every class row shows the status pill, and it matches the class's state.
- [ ] The Classes list and the live schedule use `useGoLive`, with unchanged behaviour (or a documented,
      deliberate change for the schedule's `userId`).
- [ ] Go live and ⋯ are disabled during a drag or save, and the row works at phone width.
- [ ] Tests: the pill function (each state, including the future-start case); Go live calls the hook with
      the row's class; the hook's URL and claims with the token mint mocked; a backend test that the
      outline rows carry `streamStatus` and `hasPlayback`.
- [ ] Baselines stay green.

## User stories covered

- 1, 2, 19
