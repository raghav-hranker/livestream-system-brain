# Upload video from the row

**Type**: AFK
**Blocked by**: #01 — Row Go live button, status pill and ⋯ menu

## What to build

PRD decision 7. The row ⋯ menu gets **Upload video**, which opens the existing
`SingleVideoUploadDialog` for that class (`upload lane 'class'`, path `<customerId>/<classId>`).

- If the class already has a recording, confirm first with "This class already has a recording.
  Uploading replaces it." A recording exists when the row's `streamStatus` is `ended`, or it has
  playback; task 01 puts both on the outline row.
- Check what a re-upload does to students in the meantime: if the transcoder sets the class to
  `processing` and `/playback` then returns 425, students lose the old recording until the new one is
  ready. If so, the warning says that too.
- After the upload, the row's status badge shows the transcoder's `streamStatus` once the outline
  refetches. No polling loop is needed beyond the existing refetch on focus.

## Acceptance criteria

- [ ] Upload video opens the dialog for the row's class.
- [ ] A class with a recording asks for confirmation before the dialog opens; a class without one
      doesn't.
- [ ] Component tests cover both paths.
- [ ] Baselines stay green.

## User stories covered

- 3, 4, 5
