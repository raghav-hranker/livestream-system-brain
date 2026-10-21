# Deploy course flags + window (dark), accept, open the window at 30

**Type**: HITL
**Blocked by**: 09, 10, 11, 12
**Status**: in progress. **Live** on prod since 2026-09-25 ~22:31 UTC (`0173e013c`), window closed; in-window test purchase pending
**Decisions**: design record D17.

## What to do

1. Rebase `feat/automatic-plan-extension` onto `origin/quicktricks-admin` (fetch over HTTPS, gh credential
   helper). Surgical dist per memory `quicktricks-backend-dist-deploy` (dist == fresh compile).
2. Push (the user's go-ahead; auto mode off). Box: `git pull --ff-only`, `pm2 restart 27 --update-env`
   (memory `quicktricks-box-ssh-key`). `LAPSED_EXTENSION_WINDOW_DAYS` is **not** set yet.
3. Live the moment it deploys, with no switch: truthful `is_buy`/`isExpired`/`daysLeft` on `/active`,
   `/filter`, `/batch-filter`, `/my-courses`, `/by-id-2`. Lapsed courses flip Resume → Expired.
   `isExtension` + the `by-id-2` offer follow `LAPSED_EXTENSION_ENABLED` (already on).
4. Validate on the three test accounts with `/private/tmp/autoext-validate-users.cjs` (extend it for the
   course flags) against the prod read-only server (3110) before the deploy, and against prod after.
5. **In-window test purchase:** on the user's test account, set `LAPSED_EXTENSION_WINDOW_DAYS=30` on the
   3110 read-only server first, then on prod. Make one real Razorpay purchase of an in-window extension
   and confirm the new order's `expireDate` = old expiry + 183 d. If it is right, leave 30 in the box
   `.env.development` (back it up first). Rollback: delete the line + `pm2 restart 27 --update-env`.
6. Record the deploy (commit, times, accounts, the stacked dates) here.

## Acceptance criteria

- [ ] Prod `/my-courses` for the 3 accounts: flags match the validator.
- [ ] One in-window purchase stacked correctly on prod.
- [ ] Window at 30 on the box, backup of `.env.development` taken, rollback steps recorded.

## Deploy record

- 2026-09-25: origin `quicktricks-admin` `e9d273233..0173e013c` (5 commits: docs `3bd023e78`, stacking `1914f186d`,
  course flags `6c744aa86`, by-id-2 offer `aa9025447`, window `6818adfb3`, surgical dist `0173e013c`). Origin had not moved,
  so no rebase. The full-tree compile of the tip vs committed dist had **0 `.js` differences**. New unit tests pass from dist (64/64).
- Pre-push testing: local newman 105 req / 583 assertions green (window 30 on 3109); prod read-only 3110 (window 30):
  lapsed SPL holder ⇒ Expired + ext, by-id-2 ₹300/₹599 "6 Months"; in-window holder ⇒ Extend 29 d, listing `is_buy 1 / is_expire 1`.
- Local write server on prod (3111, `run-prod-write.sh`, crons off, Razorpay stubbed) was started at the user's request.
  Its boot attempted prod index builds (assign-ques, series), which failed harmlessly (exists / E11000). Same code as the box.
- **Box pulled 2026-09-25 ~22:31 UTC (≈04:01 IST 09-26):** clean tree at `e9d273233`, 0 ahead / 6 behind ⇒ `git pull --ff-only` to
  `0173e013c`, `pm2 restart 27 --update-env` (only 27). `.env.development` has `LAPSED_EXTENSION_ENABLED` only, so the window is 0.
  Status online. The only error-log lines predate the restart (duplicate `refferal_code`, unrelated).
- Live API check (window 0): lapsed SPL holder `6a43efc4…3aab` ⇒ by-id-2 `0/false/true/true/0`, ₹300 vs ₹599, "6 Months";
  my-courses both lapsed courses Expired + ext; listing "… : Extension" ₹300/183 `is_buy 0 / is_expire 1`. In-window
  holder `6a459c99…85df` (exp 2026-10-23) ⇒ SPL **Resume** `1/false/false/false/29`, stored price ₹599 "12 Months";
  listing ₹599/365 `is_buy 1 / is_expire 0`; their lapsed Railway ALP course shows Expired + ext ₹100.
- Next: in-window test purchase on the user's test account with the window at 30, then keep 30 in the box `.env.development`.
