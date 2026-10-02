# Handoff: Assigned Classes one-stop, round 2 (2026-10-02)

The user previewed the one-stop build locally (admin on `localhost:3000`) and asked for five more
changes. Two of them are design questions for the next session (items 2 and 5); the other three are
small. **Nothing below is built yet.** Start by grilling items 2 and 5, then write them into the PRD
and tasks the way rounds 1 and 2 were done.

## Where things stand

- PRD: [`docs/plans/prd-assigned-classes-one-stop.md`](../docs/plans/prd-assigned-classes-one-stop.md);
  tasks: [`docs/plans/tasks/assigned-classes-one-stop/`](../docs/plans/tasks/assigned-classes-one-stop/README.md).
- Tasks 00–07 are **done locally** and merged into `feat/assign-classes-one-stop`: backend `146653960`,
  admin `94cf488`, in the worktrees `~/Projects/worktrees/qt-one-stop-backend` and
  `~/Projects/worktrees/qt-one-stop-admin`. Nothing is pushed or deployed. Task 08 (preview +
  deploy) is still open.
- Task 00 (class test-assignment routes now need an admin token) also sits alone on
  `fix/class-series-require-admin` (backend `98a4a874a`, admin `a414e5a`, cut from origin) and can be
  deployed ahead of everything else. It closes an open hole on prod.
- The integration admin worktree has an **uncommitted** `config.ts` edit pointing at
  `localhost:5912` for the local preview. Never commit it.
- Per-task worktrees `qt-one-stop-{backend,admin}-0N` are still on disk; they can be removed.
- Baselines on the merged branch: backend tsc clean, 17 unit + 6 integration failures; admin 14
  vitest failures (BannedUsers, LearnLibrary ×2, PdfForm.section-topic), 138 tsc errors (+1 stale
  `.next`), `node --test lib` 249/249.

## The five changes

### 1. Go live moves into the row ⋯ menu (small)

The admin doesn't teach these classes; the streamer does, and the streamer's own view already has Go
live. On the outline row it takes space and draws the eye for nothing.
- Move Go live from `OutlineRowActions` (`components/admin/assign-classes/OutlineRowActions.tsx`) into
  `OutlineRowMenu` as the first item. Keep `useGoLive` (`hooks/use-go-live.ts`) as it is.
- `goLiveSolid` / `isGoLiveSolid` (`lib/class-video-status.ts`) then has no use on the row. Drop it or
  keep it only if the menu item needs an emphasis.
- The status pill stays.
- Open question: does the user also want Go live out of the Classes list and the live schedule, or
  only out of the outline? Ask; assume outline only.

### 2. "Change topic" / "Follow the class" needs a rethink (design, next session)

Screenshot 2 shows the dialog: "Where this class appears in this course", *Follow the class* vs *Pick
for this course*. The user calls it an unoptimal experience and wants to think it through in the next
session. Starting points for the grilling:
- The row link ("Change topic") takes row space for a rare action. It could move into the ⋯ menu.
- The two options are system language ("placement", "follow the class"). An admin thinks "move this
  class to another topic", not "pin a placement override".
- **Dragging a row into another topic or subtopic** could replace the dialog entirely: dropping it
  under another header pins it there for this course. This overlaps with item 5's cross-group question.
- The underlying model: a placement either follows the Class's taxonomy or carries its own
  (`taxonomyState`, `PlacementTaxonomyDialog.tsx`, `useUpdatePlacementTaxonomy`; outline PRD
  [`prd-assigned-classes-outline.md`](../docs/plans/prd-assigned-classes-outline.md)). Listing rows
  (multi-topic placements, `listingId`) don't offer Change topic today.

### 3. PDFs sheet: "Upload PDFs" for this class, no taxonomy, Free off (small to medium)

Screenshot 3: the class's PDFs sheet opens the generic **Bulk Upload PDFs** sheet. It asks for Main
Category, Category, Section and Topic, and "Free by default" is ticked.
- Rename the entry point from "Bulk Upload & Assign" (`components/admin/assign-pdfs-to-class/AvailablePdfsViewForClass.tsx:197`)
  to **"Upload PDFs"**, and title the sheet to match.
- When it is opened for a class, **derive the taxonomy from the class** (main category, category,
  section, topic, and subtopic if the Pdf model has one) and hide the Filters block. The PDFs are
  attached to this class (auto-assign at `AvailablePdfsViewForClass.tsx:284-290`), so asking again is
  redundant. Check which taxonomy fields the Pdf model and the upload session actually require, and
  what to do when the class is missing one.
- **Free off by default** for the class upload: `BulkUploadPdfsSheet.tsx:187` has
  `useState({ isFree: true, isActive: true })`. That sheet is shared with the PDFs dashboard, so either
  pass the default in as a prop from the class context or ask the user whether the global default
  should change too.
- Remember that `Pdf.isFree` is **global**: it makes the PDF free in every course. Class PDF
  assignments already carry a placement-scoped `isFree` (`pdfAssignments[].isFree`). Decide which one a
  class upload's Free checkbox should write; see memory "Assign PDFs outline" for the leak this caused
  before.
- Also visible in screenshot 3: the sheet's assigned tab showed "Showing 25 of 8565", which looks like
  the available-PDFs list, not this class's PDFs. Check what the "Class PDFs" tab rendered.

### 4. Remove the ▲▼ arrows on class rows (small)

Drag does the same job, and the arrows take row space.
- Remove the per-row up/down buttons (`AssignedClassesView.tsx` around line 818, `classMoveOrder`).
- Keyboard reordering stays possible: `OutlineSortable.tsx:87-89` already registers dnd-kit's
  `KeyboardSensor`. Confirm the drag handle is focusable and announces itself, since the arrows were
  the obvious accessible path.
- The section and topic "Move up / Move down" items live inside ⋯ menus and take no row space. Ask
  whether they go too; assume they stay.
- Check drag on a phone (touch), since the arrows were the only phone-friendly reorder.

### 5. Drag several classes at once (design, next session)

The user wants to drag the ticked classes together. dnd-kit has no built-in multi-drag; the usual
pattern is to drag one selected row and move the whole selection with it, keeping its relative order.
Questions to settle:
- **Within one group only**, or **across subtopics and topics** too? Across means re-filing, which is
  item 2's territory.
- Selection that spans groups: refuse the drag, or gather everything into the drop group?
- What the drag preview shows ("3 classes").
- Listing rows of multi-topic placements in the selection.
- Backend: the class reorder writes one topic's order (`useReorderTopic`, `saveTopicOrder`). Within
  one group a multi-move is still one order write. Across groups it would need a combined endpoint so
  the move is atomic.
- Bulk actions must stay additive: never take content away from buyers (memory "Never remove granted
  access").

## Other open items carried from this session

- Task 08: preview against prod reads (writes hit prod) on a course the user names, then deploy. The
  outline (outline task 11) deploys first.
- Live classes made in place end at the end of the start's IST day (no live-duration default exists),
  and a past start is not refused. Ask whether either should change.
- Two side-task chips were spawned:
  - the dead CourseClass notification post-save hook (reminders rely only on the per-minute cron);
  - `GET /api/topics/:topicId/classes` and `POST /api/courses/:courseId/todays-classes` ignore the
    per-course switch.
- Placement-status gap: Available Classes lists a class switched off in this course, and assigning it
  from there switches it back on.
