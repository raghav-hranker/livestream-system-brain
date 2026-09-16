# Admin: dialog polls the LMS; delete the R2 read path

**Type:** AFK  
**Status:** `ready-for-agent`  
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
