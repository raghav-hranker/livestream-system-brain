# Upload video from the row

**Type**: AFK
**Blocked by**: #01 — Row ⋯ menu + Go live

## What to build

PRD decision 6. The row ⋯ menu gets **Upload video**, which opens the existing
`SingleVideoUploadDialog` for that class (`upload lane 'class'`, path `<customerId>/<classId>`).

- If the class already has a recording, confirm first with "This class already has a recording.
  Uploading replaces it." A recording exists when the row's `streamStatus` is `ended`, or it has
  playback. Check what the row data carries; if neither field is there, add `hasPlayback` to the
  class-groups row.
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
