# Ebooks section (course PDFs), with the Ebooks tab pinned

**Type**: AFK
**Blocked by**: 01 — Classes section, end to end (guest view)

## What to build

`coursePdfs` returns this course's PDFs whose **effective title** matches, each item exactly as
an entry of the live Ebooks tab (`GET /courses/:id/pdfs?groupBy=topic`). The item builder moves
out of the listing controller into one **course PDF item** module that both the tab and the
search call. The live tab must not change by a byte.

Order of work (the order matters):

1. **Pin the tab first.** Golden tests capture today's Ebooks tab responses, both `groupBy=topic`
   and flat, and paginated vs not. Fixtures cover: `apxTitle` beating `Pdf.title`; placement
   section and topic snapshots beating the PDF's taxonomy; the effective `isFree` (placement ∨
   PDF); `isDownloadable`; the `asset` summary with no `uploadPdf` or storage key; inactive
   placements excluded; `priority` order. Prior art: the course PDF listing snapshot tests.
2. **Extract** the placement → PDF item pipeline and its finishing step into the course PDF item
   module. The effective title must exist **as a pipeline field** (for matching and ranking) and
   as the item's `title`, from one definition. The listing keeps its grouping, pagination, admin
   ownership filter and admin search unchanged.
3. The golden tests pass unchanged.
4. **Fill `coursePdfs`**: title-search match and rank on the effective title, then placement
   `priority`, then the listing's secondary order; cut at `limit`. Spelling vocabulary scoped to
   this course's PDF titles.

## Acceptance criteria

- [ ] Golden tests for the Ebooks tab exist on the base branch's behaviour and pass unchanged
      after the extraction.
- [ ] A search matches the `apxTitle` a course shows, not the shared `Pdf.title` it overrides,
      and the item's `title` is the effective one.
- [ ] Each `coursePdfs` item deep-equals the Ebooks tab's entry for the same placement.
- [ ] Items never contain `uploadPdf`, a storage key or a signed URL.
- [ ] Inactive placements never appear; equal-rank matches follow `priority`.
- [ ] Class and test sections are unaffected; a throwing PDF section yields `coursePdfs: []`
      with the others intact.
- [ ] Integration test for the section (in-memory Mongo).

## User stories covered

- Stories 19–21: find an ebook by its shown title, with the course's own names and lock state
- Stories 37–38: the live tab doesn't regress; one item builder for tab and search
