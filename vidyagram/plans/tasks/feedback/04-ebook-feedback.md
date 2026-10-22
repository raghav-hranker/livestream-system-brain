# Ebook feedback

**Type**: AFK
**Blocked by**: 01
**Repo**: backend

## What to build

A student can rate an ebook they can open.

Backend, one registry entry:
- `ebook`: `load` through the same lookup the ebook access route uses (`mongoEbookAccessDeps.findEbookById`
  in `controllers/ebookAccessController.ts`); `authorize` = the access route's rule (active, and free or
  `hasBoughtEbook`). Reuse that rule rather than copying it: extract it into a function both the access
  handler and the registry call, with the access route's tests still passing. No `parent`. `facultyIds`
  `[]`. `consumed` = a `DocumentRead` of kind ebook for this item and user.

## Acceptance criteria

- [ ] Integration: any logged-in student rates a free active ebook.
- [ ] Integration: a paid ebook needs a purchase; without one, 403.
- [ ] Integration: an inactive ebook returns 403 or 404 (match the access route).
- [ ] Integration: `consumed` true after a `DocumentRead` of kind ebook.
- [ ] The ebook access route's existing tests still pass unchanged.
- [ ] `NO NEW FAILURES` against the backend baseline.

## User stories covered

- Stories 1 (ebook), 3, 16
