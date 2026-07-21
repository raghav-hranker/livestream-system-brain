# Config repoint + single-upload E2E

**Type**: HITL
**Blocked by**: #3, #4

## What to build

The last config seam plus the first full-arc proof through the real UI.

**Config repoint (admin-dashboard, this branch):** `LIVESTREAMING_BACKEND_API_URL` moves
off the toppers host (`socket.topperswisdom.com`) to the quicktricks livestream backend.
It gates three things (all verified in code): room-sync on class create/update, the
single-upload dialog's room status update, and the bulk flow's room-batch creation.
The admin's `.env` also gains the #2 module's B2 vars and `STREAMER_JWT_SECRET` +
`NEXT_PUBLIC_LIVESTREAM_UI_BASE_URL` if not already set from the streamer-auth port.

**Then the E2E:** from the running admin dashboard, upload one real MP4 through the
single-video dialog to an existing class and follow it with no manual assists:

upload (progress visible) → object in `tempvideos-recorded-v2` → webhook → secured 1A/1B
→ `hlsAsset` set → SSE flips the dashboard to processed → Go Live handoff opens the `ls`
viewer → `/playback` mints a signed URL → video plays.

## Acceptance criteria

- [ ] No admin surface references the toppers livestream backend; rooms land in the quicktricks backend
- [ ] Single-dialog upload completes with progress; abort and retry behave as before
- [ ] Dashboard processing state flips via SSE without a manual refresh
- [ ] The uploaded class plays in the `ls` viewer via a signed `/playback` URL (B2+Bunny combo)
- [ ] Unsigned fetch of the same HLS master → 403
- [ ] Browser leg verified like the PDF task-04 pattern: bytes go browser → B2 direct; no video bytes transit the Next server

## User stories covered

- Story 1: uploaded video playable through the protected viewer
- Story 3: unchanged upload workflow, end to end
- Story 5: processing status without asking anyone
- Story 7: students reach it only via short-lived signed URLs
- Story 17: rooms sync to the quicktricks backend, not another tenant's
