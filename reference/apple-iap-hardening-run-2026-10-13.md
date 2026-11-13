# Apple IAP hardening — autonomous run, 2026-10-13

Decision trail for the build of units 2 and 3 while Raghav was away. Spec and agreed decisions:
`~/Projects/quicktricks-backend/src/notes/ios_iap_backend_hardening_spec.md` §2.1. Tasks:
`docs/plans/tasks/apple-iap-hardening/`.

## Ground rules for this run

- Build and commit on `feat/apple-iap-hardening` in `~/Projects/worktrees/qt-iap-{backend,admin}`. **No push, no deploy,
  no prod writes.** `origin/quicktricks-admin` is pulled onto prod by the client team, so pushing there is a deploy.
- Unit 1's prod index build is still Raghav's to run (auto mode blocked the remote write). The schema declaration is
  committed (`5c3734b9e`).

## Throughput checkpoint

- Blocking first steps: worktrees + baselines (admin done: 44 tsc / 52 vitest pre-existing; backend running).
- Independent workstreams: task 01 (backend) ∥ task 03 (admin, against the contract in task 02).
- Shared mutable state: 01 → 02 → 04 serialize on `orderController.ts`, `order.service.ts`, `Order.ts`, `OpsAlert`.
  Split applied: the alert API contract is written down in 02 and 03 so the admin side never waits.
- Smallest safe decomposition: four task-implementer agents, one per task, each in its own worktree.

## Log

- 14:10 unit 1 reads on prod: reviewer order paid server-side; 6 Sandbox orders; 2 Oct buyer never reached the server.
- 14:32 worktrees created off `origin/quicktricks-admin` (`ae057c8c1` backend, `8b8a720` admin). Index commit `5c3734b9e`.
- 14:40 admin baseline taken. Backend baseline running. Task files 01–04 written.
- 14:45 backend baseline taken (2 tsc pre-existing: exceljs, ffmpeg-static missing; unit 19, integration 49; Apple tests pass).
  Task 01 (backend-01) and task 03 (admin-03) launched as task-implementer agents in parallel.
- 14:52 task 03 done (admin, 4 commits, NO NEW FAILURES, 8 new tests) and merged into qt-iap-admin. Agent also added
  `?search=` to the Orders screen so alerts can deep-link an order; kept. Not opened in a browser yet. The screen key
  `ops-alerts` must be ticked per admin account after deploy.
- 15:05 task 01 done (backend, 3 commits, 15 new tests, NO NEW FAILURES) and merged into qt-iap-backend. Reviewed
  `appleIapFulfilment.service.ts`: rejection table + typed result as designed; replay shortcut before Apple verification
  returns only the caller's own success order (safe). Agent decisions accepted: aborted/refunded own order on replay →
  422 REVOKED; Sandbox INR amount kept in grandTotal (excluded by status); two plans matching one product → PRODUCT_NOT_MAPPED.
  Baseline lists ~36 class-rename integration failures that now pass; baseline is a superset, left as is. Task 02 launched.
- 15:30 task 02 done (backend, 6 commits, 23 new tests, NO NEW FAILURES) and merged. Handler table keyed by
  notificationType; 401 only for bad signature, 5xx for retryable failures; Razorpay crons now exclude gateway apple;
  webhook body kept out of the pm2 log. Two gaps the agent flagged (refund of an unclaimed txn leaves the row; stored-but-
  unprocessed rows never retried) folded into task 04. Open: dashboard counts `refunded` as `initiated` (not paid, so harmless).

## Deploy checklist (nothing below has been run; Raghav decides when)

Branch `feat/apple-iap-hardening` in `~/Projects/worktrees/qt-iap-backend` and `~/Projects/worktrees/qt-iap-admin`.
Per the agreed sequence the backend ships as two deploys, unit 2 then unit 3; both are on the one branch, so unit 2 alone
means cherry-picking `3e310187a` (the task 01 merge) onto `origin/quicktricks-admin` first, or deciding to ship both at once.

Backend (prod box, `commit → push → pull`, see quicktricks-prod-box memory):
1. Build dist locally from the branch (dist is the tracked deploy artifact; never `npm run build` on the box).
2. Push to `origin/quicktricks-admin`, pull on the box, `pm2 restart 27`. The crons start with the API process.
3. Watch `apple_iap_logs` for the first `Apple IAP submission received` row with `appVersion` and the first fulfilment.
4. New collections appear on first write: `apple_iap_notifications`, `apple_iap_unclaimed`, `ops_alerts`,
   `apple_iap_reconciliations`. Indexes are created by `createIndexes()` at boot.
5. Register `https://backend.quicktricksbysahilsir.com/api/webhooks/apple-iap` in App Store Connect → App Information →
   App Store Server Notifications, Version 2, as BOTH the Production and the Sandbox URL. Then call
   `POST /inApps/v1/notifications/test` (In-App Purchase key) and confirm a `TEST` row in `apple_iap_notifications`.
6. Team key for reconciliation: create under Users and Access → Integrations → App Store Connect API → Team Keys,
   role Sales and Reports; put `APPLE_ASC_ISSUER_ID`, `APPLE_ASC_KEY_ID`, `APPLE_ASC_PRIVATE_KEY_PATH`, `APPLE_VENDOR_NUMBER`
   (94677757) in the box's untracked `.env.development`; restart. Until then the job logs "skipped: not configured".

Admin (Vercel project `quicktricks-admin`):
1. Push `feat/apple-iap-hardening` → `origin/quicktricks-admin`; Vercel builds.
2. Tick the new screen key `ops-alerts` ("Alerts", Sales group) on every admin account that has an explicit screen list.

Proof after deploy: one Sandbox purchase from TestFlight (expect order with `appleAmountStatus: sandbox`, 201 with the new
body), one Sandbox refund (expect `orderStatus: refunded` and the course locked), Apple's TEST notification stored, and the
Alerts screen loading an empty list instead of "API not available".
- 15:55 task 04 done (backend, 6 commits, 34 new tests, NO NEW FAILURES) and merged → integration head `ea9d46a09`.
  Accepted: refunds counted on the refund day (matches Apple), `.hint('uniq_apple_txn')` on the orders query (index
  confirmed present on prod, as is `users.appAccountToken_1`), `.env.example` created with `!.env.example` in .gitignore.
  Assumption to confirm with the first real report: Apple's `SKU` column holds the IAP product id.
- Whole branch: 19 commits, 41 files, +3067/−225 on backend; 4 commits on admin. Final suite runs started on both
  integration worktrees. Browser check of the Alerts screen not done (needs an admin login).
- 16:20 final suites on the merged integration heads: backend failure list identical to baseline (2 tsc / 19 unit / 49
  integration, all pre-existing); admin identical to baseline (44 tsc / 0 lib / 52 vitest). Run complete. Nothing pushed.

## Deploy log

- 15:52 IST backend DEPLOYED: origin/quicktricks-admin fast-forwarded ae057c8c1 → 49b7f25bf (Raghav ran the push and the
  box pull + `pm2 restart 27`; auto mode blocks both). Pull also carried the client team's pending commit (notification
  changes). Boot verified: process online, 0 unstable restarts; `inAppPurchaseProductId_1_unique_partial` built on
  `plans` at boot (unit 1 closed); `ops_alerts`, `apple_iap_notifications`, `apple_iap_unclaimed`,
  `apple_iap_reconciliations` created with their indexes; `/api/ops-alerts` → 401 without token, `/api/webhooks/apple-iap`
  with a non-JWS body → 401, submit without token → 401. Error log shows only the three pre-existing index failures
  (assign_ques, series, users). Admin push and App Store Connect steps still pending.

## 2026-10-14 consumable switch (requested by the app developer)

- Developer creates the `c.` products in App Store Connect with his script; we switch the plans afterwards.
- Export sent to Raghav: `reference/apple-consumable-products-2026-10-14.csv` (153 plans with a product id: 122 status 1, 31
  status 0; all have priceIOS). Switch script ready, dry run by default, backup before write, `--only <file>` to restrict
  to created products: `reference/scripts/apple_plans_to_consumable.cjs` (run on the box from the backend checkout).
- Order: webhook URL registered → products created and approved → consumable app build live → run the switch with --commit.
  Flipping plans before the products are purchasable breaks live purchases (the app asks StoreKit for the plan's product id).
- Yesterday's first real traffic: Sandbox ₹519 fulfilled (201, status sandbox); ₹1,699 txn 2000001250224348 refused
  TRANSACTION_ALREADY_CLAIMED because account testhr5@yopmail.com already holds it (same Apple sandbox id). App retried the
  422 five times: it does not read `code` yet. Apple notification history: 0 in both envs → URL was not registered.
- 2026-10-14 16:39 IST webhook CONFIRMED LIVE: Apple TEST notifications (Sandbox + Production) stored within ~1 s. The URL
  had been registered earlier in the day: 3 ONE_TIME_CHARGE notifications already received (2 Production ₹209/₹649, 1
  Sandbox), each held as unclaimed with reason NO_USER (the app does not pass appAccountToken at purchase yet), then
  claimed 8–15 s later by the app's submit. No alerts raised, correctly. Webhook can only hold, not fulfil, until the app
  sends appAccountToken (spec §12).
