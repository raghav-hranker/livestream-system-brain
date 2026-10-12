# 03 Deploy faculty

**Type**: HITL (the user approves each push)
**Blocked by**: 01, 02

## Steps

1. Fetch both origins, then rebase or merge `feat/class-faculty` onto the tips.
2. Run the suites against the baseline.
3. Backend: build the dist surgically (memory `quicktricks-backend-dist-deploy`) and run the
   artifact-vs-source check on the tip.
4. **Ask the user.** Then push the backend to `quicktricks-admin` through the `raghav-hranker` alias. The
   box pulls and runs `pm2 restart 27`, from the user or the box ssh key. Smoke test: the new route
   answers 401 without a token, not 404.
5. **Ask the user.** Then push the admin. Vercel project `quicktricks-admin` builds production.
6. Prod check with one real class whose faculty is wrong. Record it in `reference/prod-data-changes` if
   it was a data fix.
7. Update memory and this README.
