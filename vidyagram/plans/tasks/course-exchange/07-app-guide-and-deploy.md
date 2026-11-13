# App guide and prod deploy

**Type**: HITL
**Blocked by**: 01 to 06
**Repo**: backend + admin + system-brain

## What to build

- **App team guide.** Write `vidyagram/reference/vidyagram-course-exchange-api-guide.md`, in the same style
  as the catalogue-filters guide. It covers:
  - the course detail `exchange` field and the button rule, with the requirement that the app sends its bearer
    token on `by-id-2` (the field is `null` without one);
  - `GET exchange-options`, with the full shape, every `reason` code and suggested copy for each;
  - `POST exchange-self`, with the confirm step that names both courses, the "Free swap" tag, no price,
    and the 409/400/404 handling;
  - refreshing My Courses after a swap;
  - the `exchangedFrom` history label.
  - It also includes a sample payload taken from a real local run.
- **Deploy, with the user's go-ahead at each step.**
  - Backend: push `vidyagram-admin`, surgical dist, `pm2 restart 92`, with `EXCHANGE_ENABLED=false` first.
  - Admin: the user deploys the frontend.
  - Turn the flag on only when the user says so.
  - The new fields need no backfill. Check whether `exchangeToPlanIds` or `exchange` needs an index (an
    `exchange` lookup is by `_id`, so most likely none).

## Acceptance criteria

- [ ] Guide written, with every reason code and a real sample payload.
- [ ] Backend deployed with the flag off. `exchange-options` returns 401 without a token and 404 with a
      token while the flag is off.
- [ ] After the user turns the flag on: a test account on a single-course plan with a list gets eligible
      options on prod; a swap and an admin undo both work on prod; the test account's state is restored
      afterwards and recorded in `prod-data-changes.md`.
- [ ] The memory ledger and `vidyagram-course-exchange.md` memory are updated with the deploy commits.

## User stories covered

- Story 37
