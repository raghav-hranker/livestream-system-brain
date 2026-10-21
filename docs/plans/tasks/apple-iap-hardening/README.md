# Apple IAP backend hardening — tasks

Spec and decisions: `~/Projects/quicktricks-backend/src/notes/ios_iap_backend_hardening_spec.md`. **§2.1 is the
contract**; where the body of the spec disagrees with §2.1, §2.1 wins. Unit 1 (index, reviewer check, buyer hunt) is
done and recorded in spec §10; the plan index is commit `5c3734b9e` on the integration branch.

| Task | Unit | Side | Depends on |
|---|---|---|---|
| [01 submit endpoint](01-submit-endpoint.md) | 2 | backend | — |
| [02 webhook, unclaimed, refunds, alerts API](02-webhook-unclaimed-refund.md) | 3 | backend | 01 |
| [03 admin alerts list](03-admin-alerts-list.md) | 3 | admin | contract in 02 (parallel) |
| [04 daily reconciliation](04-reconciliation-job.md) | 3 | backend | 02 (OpsAlert model) |

## Working copies

Integration pair (prefix `qt-iap`): `~/Projects/worktrees/qt-iap-backend` and `~/Projects/worktrees/qt-iap-admin`, both
on branch `feat/apple-iap-hardening` off `origin/quicktricks-admin` (prod). Per-task worktrees come from
`scripts/qt-tasks.sh mkwt qt-iap <tag>` and are merged back with `scripts/qt-tasks.sh merge qt-iap <tag>`.
`node_modules` is a symlink to the main checkout. Never push `feat/apple-iap-hardening` to `origin/quicktricks-admin`:
the client team pulls that branch onto prod several times a day, so a push there is a deploy.

## Baselines

`baseline-backend.txt` and `baseline-admin.txt` here, taken on the integration heads with
`scripts/qt-tasks.sh suites <worktree>`. Run `scripts/qt-tasks.sh suites <your worktree> docs/plans/tasks/apple-iap-hardening/baseline-<side>.txt`
before you finish; it passes on `NO NEW FAILURES`.

## Facts every task relies on

- Verification already exists: `src/services/appleIap.service.ts` (`verifyAppleTransaction`, `SignedDataVerifier`
  per environment, API-client fallback by transaction id). Reuse it; do not write a second verifier.
- Fulfilment already exists: `createFulfilledAppleOrder` in `src/services/order.service.ts`. The unique partial index
  `uniq_apple_txn` on `orders.orderId` is the one-order-per-transaction lock. Keep it as the lock.
- `users.appAccountToken` is a server-issued UUID the app attaches to every purchase; the submit endpoint already
  requires it to match the transaction. The webhook identifies the buyer with it.
- Access = `Order.find({ userId, orderStatus: 'success', status: { $ne: 0 }, expireDate ≥ now })` in
  `src/utils/courseUtils.ts`. Any status other than `success` ends access.
- Revenue exclusion lives in `src/services/appleRevenueReporting.ts` (`APPLE_NON_REVENUE_CLAUSES`). Today it excludes
  `appleEnvironment: Sandbox` and `appleAmountStatus: pending`.
- Logging: `AppleIapLog` (`apple_iap_logs`), `source: 'submit' | 'webhook'`. Receipts are allowed there and nowhere else.
- Tests: `src/tests/integration/appleIap*.integration.test.ts` with the fake provider in `src/tests/support/appleIapFake.ts`
  (`setAppleIapProvider`). Extend the fake rather than mocking the Apple library.
- The pm2 request logger already prints `POST …/submit-apple-iap-order → 401` lines for requests rejected by
  middleware, so spec §5's "make middleware rejections visible" is already satisfied; do not build it.
