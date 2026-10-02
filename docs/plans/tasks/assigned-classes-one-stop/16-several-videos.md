# Several videos at once, and the old bulk button goes

**Type**: AFK
**Blocked by**: #15 (the queue and the dialog)

## What to build

PRD Round 3 decisions 26, 29 (several-videos shape) and 33. Backend + admin.

**Backend**
- The in-place endpoint accepts `titles: string[]` (1–30, recorded only, mutually exclusive with
  `title`). One transaction for every class and placement, in order, landing last in the group; each
  placement waits for its recording (task 14). Response `{ classes: [{ classId, placementId, title }] }`.
- Before writing: 409 `{ field: 'titles', taken, repeated }` (exact-match `Class.exists`, as today);
  400 for an empty or over-long list, a blank title, or `titles` with `isLive`.
- The single-`title` body is unchanged.

**Admin**
- The dialog's several-videos shape: a list (file name + size, editable title, remove, drag to reorder)
  in natural file-name order; "Titles: Number them ‹Part-7 → Part-10› | Use file names"
  (`nextTitlesInSeries`; no trailing number on the group's last class ⇒ file names, toggle hidden);
  numbered titles follow the order, edited ones stick; "Teacher for all N"; "They go last in ‹group›, in
  this order."; Create label "Create N classes and upload".
- Inline errors per row (blank, already in the outline, repeated in the list); the server 409 maps
  `taken`/`repeated` back onto the rows. Create disabled while any row has an error.
- On success hand every file to the queue in list order (two at a time), close, refetch, toast "N
  classes added to ‹path›. Uploading 2 at a time."
- Remove the "Bulk Upload & Assign" button and the `BulkUploadVideosSheet` usage from
  `assign-classes/AvailableClassesView.tsx` (the sheet stays for the Classes dashboard).

## Acceptance criteria

- [ ] Four videos become four classes, last in the group, in list order, titled Part-7…Part-10 (or the
      file names), all waiting for their recordings, uploading two at a time.
- [ ] A taken or repeated title blocks Create and names the rows; a 409 from the server creates nothing.
- [ ] Reordering the list renumbers the untouched titles.
- [ ] The course's Available tab has no bulk upload button; the Classes dashboard still has its own.
- [ ] Tests: backend integration for batch order and landing, all-or-nothing on 409, the 400s, every
      placement waiting. Admin: `nextTitlesInSeries` (padding, no number), natural sort, the list's
      error mapping, the queue receives files in order.
- [ ] Baselines stay green.

## User stories covered

- 38, 40, 41, 42, 45, 47
