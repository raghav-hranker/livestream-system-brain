# Tags page

**Type**: AFK
**Blocked by**: 01
**Repo**: backend + admin

## What to build

An admin manages complaint tags per kind without a deploy or an app release.

Backend: `/api/admin/feedback/tags` with list (including retired), create (`kind`, `code`, `label`),
update (`label`, `order`, `active`). `code` and `kind` are immutable after create. There is no delete.

Admin: a Tags page with one section per kind: add, rename, drag to reorder, retire and restore.

## Acceptance criteria

- [ ] Integration: create rejects a duplicate `{ kind, code }`; update rejects a change to `code` or `kind`.
- [ ] Integration: a retired tag disappears from `GET /api/feedback/tags` and is refused on a new `PUT`,
      and old rows keep it and still show its label in the admin.
- [ ] Integration: a new order is reflected in `GET /api/feedback/tags`.
- [ ] Admin component tests: add, rename, reorder and retire call the right routes.
- [ ] `NO NEW FAILURES` against both baselines.

## User stories covered

- Stories 20, 21
