# Background uploads, and a video in the add form

**Type**: AFK
**Blocked by**: #14 (same row pill area; merge 14 first)

## What to build

PRD Round 3 decisions 29 (no-video and one-video shapes), 30, 31 and 32. Admin only: the single-`title`
in-place endpoint already exists.

- **Upload queue store** (decision 30), keyed by `classId`, outliving every dialog: `Uploader`, lane
  `'class'`, path `<customerId>/<classId>`, two at a time, the existing retries, states
  `waiting | uploading(pct) | processing | failed`, `retry(classId)`, `cancelRemaining()`, and a
  `beforeunload` confirm while anything is waiting or uploading. Read `stores/videoUploadStore.ts` and
  `SingleVideoUploadDialog.tsx` first and reuse what they already get right (filename sanitising, abort
  handling, `isUploadAborted`).
- **Dialog** (decision 29): rename the recorded mode to "Add recorded classes here" (header ⋯ item and
  heading). Add the drop zone and "Choose videos". This task handles **0 or 1** file:
  - 0 files: today's form;
  - 1 file: a file chip (name, size, remove) above Title and Teacher; the title stays the series
    suggestion; "Use the file name instead" sets it from `titleFromFileName`;
  - Create → the in-place POST, then hand the file to the queue for the new `classId`, close the
    dialog, refetch. No more `SingleVideoUploadDialog` after create.
  - Picking several files at this stage shows "Several videos arrive with the next task", or keep the
    picker single-file. Task 16 lifts it.
- **Row pill** (decision 31): while the queue knows a class, its state replaces the server pill
  ("Uploading 43%" + a small bar, "Waiting to upload", "Uploaded · being processed", "Upload failed" +
  "Retry upload"). Otherwise as today.
- **Bottom bar** on the Assigned Classes view while the queue has waiting, uploading or failed items:
  overall bytes bar, "Uploading N videos · X GB left", "k of n uploaded · m waiting · f failed", "Keep
  this tab open until uploads finish", "Cancel remaining".
- **Row "Upload video"** (decision 32) feeds the queue too; the replace warning stays.

## Acceptance criteria

- [ ] Adding a class with one video closes the dialog straight away; the row shows upload progress and
      the admin can keep using the outline.
- [ ] A failed upload shows on its row and Retry restarts it; the class is never removed.
- [ ] Leaving the page while uploading asks for confirmation; Cancel remaining stops the rest and the
      classes stay with "No video yet".
- [ ] Row "Upload video" survives closing its dialog.
- [ ] Tests: the queue as a unit (concurrency 2, order, retry, cancel, abort not counted as failure);
      `titleFromFileName`; the dialog hands the file to the queue with the new classId; the pill maps
      each queue state.
- [ ] Baselines stay green. Nothing here can be checked in a browser by the agent: say so.

## User stories covered

- 39, 43, 44
