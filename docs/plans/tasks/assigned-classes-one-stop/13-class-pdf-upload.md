# Class PDF upload: filed from the class, free in this class only

**Type**: AFK
**Blocked by**: — (task 03, the PDFs sheet, is merged)

## What to build

PRD Round 2 decisions 16, 24 and 25. Mostly admin.

`AvailablePdfsViewForClass.tsx:192-198` opens the shared `BulkUploadPdfsSheet` with
`enableAutoAssign` and an `onAssign` that calls `assignMultipleMutation({ pdfIds, classId })`.

- **Name.** The button "Bulk Upload & Assign" becomes **"Upload PDFs"**; the sheet title for a class
  reads "Upload PDFs" with the class title under it ("They attach to ‹title› when they finish").
- **Taxonomy from the class.** Give the sheet a class context prop (`forClass: { classId, title,
  mainCategory, category, section, topic }`). With it:
  - hide the Filters block and show the four values read-only ("Filed under (taken from the class)"),
    plus "PDFs have no subtopic.";
  - send those ids as the session metadata. `topic` may be null: the backend accepts it
    (`pdfSchemas.ts` `optionalNullableObjectId`), so relax the sheet's own topic requirement
    (`BulkUploadPdfsSheet.tsx:354-362, 389-392, 734`) only in class mode.
  - Find where the class's taxonomy ids are already loaded in the PDFs sheet; if they are not, read
    the class once.
- **Free in this class.** In class mode:
  - `Pdf.isFree` is always **false** in the session metadata;
  - the default checkbox and the per-row checkbox read "Free in this class", **off** by default;
  - `onAssign` sends `pdfs: [{ pdfId, isFree }]` (the class PDF assign already accepts that body and
    defaults `isFree` to false), so the flag lands on `pdfAssignments[].isFree`.
- **Dashboard default.** `globalSettings` (`BulkUploadPdfsSheet.tsx:187`) starts with `isFree: false`
  everywhere, the PDFs dashboard included.
- **The 8565 line.** "Showing N of M" is the Available tab's `totalAvailablePdfs`. Confirm the class's
  own tab counts only its PDFs; if the screenshot was the Available tab, nothing to fix; say so in the
  PR notes.

## Acceptance criteria

- [ ] From a class's PDFs sheet, "Upload PDFs" asks for no taxonomy, files the PDFs under the class's
      main category / category / section / topic, and attaches them to the class.
- [ ] A class with no topic uploads fine (section only).
- [ ] Free is off by default; ticking it makes the PDF free in this class only (`pdfAssignments`),
      never `Pdf.isFree`.
- [ ] The PDFs dashboard's "Free by default" starts off.
- [ ] Tests: class-mode metadata (ids from the class, `isFree:false`, null topic allowed); the assign
      body carries the per-row free flag; the dashboard default.
- [ ] Baselines stay green.

## User stories covered

- 36
