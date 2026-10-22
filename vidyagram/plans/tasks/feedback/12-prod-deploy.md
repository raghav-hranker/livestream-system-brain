# Prod indexes, seed, deploy and backfill

**Type**: HITL
**Blocked by**: 01 to 11
**Repo**: backend + admin + system-brain

## What to build

With the user present:

1. Merge `feat/vg-feedback` into `vidyagram-admin` on both repos.
2. Read `reference/hosts.md`. Build the `feedbacks` and `feedbacktags` indexes by hand on rs0 for
   `vidyagramdb` (unique key plus the three read indexes, `commitQuorum: 'majority'`), and add them to
   the index ledger. `autoIndex` never builds on prod.
3. Run the tag seed dry-run, then `--commit`. Record it in the prod-data-changes ledger.
4. Backend dist build and deploy (push `vidyagram-admin`, pull in
   `/var/www/backend.vidyagramar.com/vidyagram-backend`, `pm2 restart 92`). Admin deploy to Vercel
   `vidyagram-admin`.
5. Run the class teacher backfill dry-run and show the unmatched names to the user. On their go,
   `--commit`, then the re-snapshot. Record both in the ledger.
6. Tick the "Feedback" screen permission for the roles the user names.
7. Smoke: as a test student, rate one item of each kind against the live API; read them in the live admin;
   then delete only those smoke rows, with the user's OK.
8. Send the guide from task 11 to the app team when the user says so.

## Acceptance criteria

- [ ] Indexes present on prod and in the ledger.
- [ ] Tag seed recorded; one row per `{ kind, code }` on prod.
- [ ] Backend and admin deployed; commit SHAs recorded in the README's done line.
- [ ] Backfill matched and unmatched counts recorded; unmatched list handed to the user.
- [ ] Smoke rows rated, seen in the admin and removed.
- [ ] Memory note written with what is live.

## User stories covered

- All, on prod
