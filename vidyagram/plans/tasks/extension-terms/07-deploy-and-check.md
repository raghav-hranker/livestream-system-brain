# Prod deploy and real-plan check

**Type**: HITL
**Blocked by**: 01 to 06
**Repo**: backend + admin + this repo

## What to do

With the user present for every write.

1. **Read the live values first.** With the user's OK, read the `LAPSED_EXTENSION_*` lines in the Vidyagram box's
   `.env.development` (`/var/www/backend.vidyagramar.com/vidyagram-backend`, see `reference/hosts.md`). Record them
   here. They are what the default shows until the first save from the admin replaces them.
2. **Backend.** Merge `feat/vg-extension-terms` with `origin/vidyagram-admin`, build the dist with
   `scripts/qt-surgical-dist.sh`, run the extension suites from `dist/`. Back up the box's dist, `git merge --ff-only`,
   `pm2 restart 92`. No index build is needed (no new index), and no data is written by the deploy.
   Before any admin saves the default, build the unique index `{ singletonKey: 1 }` on `vidyagramdb.extensionsettings`
   (the model declares it; autoIndex never builds on rs0, see memory `prod-mongo-cluster`). Without it, two first saves
   at once could leave two default documents. Use the `vidyagram-*-indexes.cjs` script pattern (dry run, rs0 health,
   `commitQuorum: 'majority'`) and add the script to `reference/scripts/README.md`.
3. **Smoke checks** on `backend.vidyagramar.com`: the new routes return 401 with no token; a known listing still
   returns the same extension price as before the deploy for a Default plan.
4. **Admin.** Push `vidyagram-admin`, wait for the Vercel deployment, confirm it is aliased to admin.vidyagramar.com.
5. **Real-plan check**, with a test plan and test account the user names: set custom terms on the test plan, see the
   listing price and "N Months Validity" change for a lapsed test order, undo, confirm the old offer is back. Do not
   change the default unless the user asks.
6. **Records.** Status in this folder's README; a memory note `vidyagram-extension-terms` (tenant: vidyagram); a line
   in `prod-data-changes` if any prod plan's terms were changed.

## Acceptance criteria

- [ ] Live env values recorded before deploy.
- [ ] Backend and admin deployed, smoke checks pass, the real-plan check passes and is cleaned up.
- [ ] README status and memory updated.
