# Admin: dialog polls the LMS; delete the R2 read path

**Type:** AFK  
**Status:** CODE DONE 2026-09-17 — `614de12` on `feat/shorts-dialog-lms-polling`
(worktree `~/Projects/worktrees/qt-admin-shorts-poll`, off `origin/quicktricks-admin` @ `1b56559`),
NOT pushed. 11 new tests green; full suite 156/168 with the same 12 failures as origin tip
(LearnLibraryPriorityEditor 6, LearnLibraryDashboard 1, BannedUsersDashboard 5 — verified against a
throwaway worktree at `1b56559`); `node --test lib/**` 131/131; `tsc` 115 errors vs the 116 baseline,
none in touched files. Acceptance greps clean. Deviation: item 4 NOT done — see below.  
**ADR:** [0007](../../../adr/0007-shorts-readiness-via-transcode-callback.md) decision 8  
**Blocked by:** 01 deployed (the dialog needs `videoStatus`/`videoError` on `GET /api/shorts/:id`)

## Repo

`quicktricks-admin`, worktree off `origin/quicktricks-admin`. Files:
`components/admin/ShortVideoUploadDialog.tsx` (`awaitTranscode`, `POLL_TIMEOUT_MS`, the
`outcome === 'failed'` branch), `app/api/shorts_transcode/route.ts`, `lib/shorts-storage.ts`
(`readTranscodeState` and friends; keep the multipart **upload** functions),
`lib/shorts-storage.test.ts`, `components/admin/ShortsDashboard.tsx`, `hooks/api/use-shorts.ts`.

First: `git -C ~/Projects/worktrees/qt-admin-shorts checkout -- .` to discard the uncommitted
read-side fix (five files). It is superseded, not merged.

## What to build

1. **Dialog**: after upload + `PATCH {sourceKey}`, poll `GET /api/shorts/{id}` (existing hook or a
   new `useShortStatus(id, { enabled })`) every 5 s. Render `processing` (spinner + "You can close
   this; the short becomes playable on its own"), `ready` (link, play preview), `failed`
   (`videoError` text, "Re-upload to try again"). No timeout that changes state; a long wait only
   changes the copy to mention the queue. The dialog **never** writes `videoStatus`.
2. **Dashboard**: rows in `processing` refetch on an interval (or the list query polls while any row
   is processing) so a closed-dialog upload flips visibly. Show `videoError` on failed rows.
3. **Delete** `app/api/shorts_transcode/route.ts`, the `status.json`/HEAD helpers and their tests,
   and the `SHORTS_OUTPUT_BUCKET` read if nothing else uses it. Vercel keeps `SHORTS_UPLOAD_*` for the
   write; note in the slice that the read need is gone (the scoped-token follow-up shrinks to
   write-only on `tempvideos-hranker`).
4. Copy in the dialog still says plainly that the upload is **public** (ADR-0006 stands).

## Acceptance criteria

- [ ] `grep -r "shorts_transcode\|status.json\|master.m3u8" app components lib` returns nothing
      outside the upload path.
- [ ] No code path calls `PATCH /api/shorts/:id/video` with a `videoStatus` body (task 07 removes the
      arm; this must already be true).
- [ ] Playwright/vitest harness (see the admin mobile UI harness notes): stubbed
      `GET /api/shorts/:id` cycling processing → ready renders the link; processing → failed renders
      the error; unmounting the dialog mid-poll leaves no timer running.
- [ ] `vitest --exclude .sandcastle/**` and `tsc` clean.

## Do not

- Keep a "re-check"/"mark ready" button. Read R2 from the browser or a route handler for readiness.
- Push to `origin/quicktricks-admin` without fetch + rebase + build (the remote moves fast). No
  co-author trailers.


## Result 2026-09-17

Built as specified except item 4. What landed:

- `useShortVideoStatus(id, { enabled })` polls `GET /api/shorts/:id` every 5 s and stops at
  `ready`/`failed` and on unmount. The cadence decision is two pure functions,
  `shortVideoPollInterval` / `shortsListPollInterval`, tested directly.
- `useGetShorts` refetches while ANY row is `processing`; failed rows show `videoError` plus
  "re-upload to try again".
- No timeout changes state. Past 10 min the dialog copy only adds "the job may be queued behind
  others"; `LONG_WAIT_MS` is derived per poll response, so the dialog runs no clock of its own.
- Deleted `app/api/shorts_transcode/route.ts`, `readTranscodeState`, `publicHlsUrlFor`, and the
  already-unreferenced `deleteShortObjects`. `SHORTS_PUBLIC_BASE_URL` and `SHORTS_OUTPUT_BUCKET` had
  no remaining consumer and are no longer required by `shortsConfig()` — the admin's shorts
  credential need is now write-only on `tempvideos-hranker`, which is what the scoped-token follow-up
  should be scoped to.
- Added `grid-cols-1` to the dialog (the shadcn grid/min-content trap; `SingleVideoUploadDialog`
  already carries it on origin, this dialog did not).

**Deviation — item 4 (public-upload copy) deliberately NOT done.** The amber "This video will be
public" notice was removed on purpose by `5687d32` ("The admin team asked for the amber notice to
go"), which postdates ADR-0006 and is a stakeholder decision this task was written without. Re-adding
it would silently reverse that, so it was left out and raised instead. The now-false "keep this
browser tab open until processing finishes" notice **was** removed — it is the opposite of what the
dialog now does. Owner decision needed: restore the public notice, or let ADR-0006's disclosure
requirement rest somewhere other than this dialog.
