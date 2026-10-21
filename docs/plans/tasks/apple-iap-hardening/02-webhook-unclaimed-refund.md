# 02 — App Store Server Notifications webhook, unclaimed purchases, refunds, alerts API

State: ready-for-agent
Type: AFK
Side: backend only. Blocked by: 01 (uses `fulfilAppleTransaction` and the new amount statuses).

## Parent

Spec §2.1, §6, §7 in `~/Projects/quicktricks-backend/src/notes/ios_iap_backend_hardening_spec.md`.

## What to build

Apple calls us directly for every purchase and refund. This is the only path that does not depend on the app, so it
is what stops a paid purchase from vanishing (spec finding A) and adds refund handling, which does not exist today.

### Data shapes first

```ts
// apple_iap_notifications — one row per Apple notification, idempotent on notificationUUID
{ notificationUUID: string /* unique */, notificationType, subtype?, environment: 'Sandbox'|'Production',
  bundleId, transactionId?, originalTransactionId?, productId?, appAccountToken?, signedDate: Date,
  receivedAt: Date, processedAt?: Date, outcome: 'fulfilled'|'replayed'|'unclaimed'|'refunded'|'restored'|'logged'|'error',
  error?: string, payload: Mixed /* decoded, never the raw JWS */ }

// apple_iap_unclaimed — a verified transaction with no order yet
{ transactionId: string /* unique */, originalTransactionId?, productId, environment, appAccountToken?,
  reason: 'NO_USER' | AppleRejectionCode, verified: Mixed /* VerifiedAppleTransaction snapshot */,
  createdAt, claimedAt?, claimedByOrderNumber? }

// ops_alerts — things a human must look at (task 03 renders this; task 04 writes to it too)
{ kind: 'apple_unclaimed' | 'apple_reconciliation' | 'apple_webhook_error', severity: 'warn'|'error',
  title: string, detail: string, refs: { transactionId?, orderNumber?, userId?, productId?, date? },
  dedupeKey: string /* unique while status = open */, status: 'open'|'resolved', createdAt, resolvedAt?, resolvedBy? }
```

The notification handler is a table keyed by `notificationType` → handler, not a switch that grows.

### Rules

1. **Route.** `POST /api/webhooks/apple-iap`, no auth middleware, JSON body `{ signedPayload }`, body limit small
   (64 KB). One route for both environments; the environment comes from the verified payload. Register it in `app.ts`
   next to the other routers.
2. **Verify.** Add `verifyAppleNotification(signedPayload)` to `appleIap.service.ts`: peek `environment` in the JWS
   payload only to pick the verifier, then `verifyAndDecodeNotification`; then verify `data.signedTransactionInfo`
   with `verifyAndDecodeTransaction` through the existing `AppleIapProvider` so `appleIapFake.ts` can fake both. Bad
   signature or wrong bundle → HTTP 401, log `Apple IAP webhook rejected` (`source: 'webhook'`), store nothing else.
3. **Store, then act, then 200.** Insert the notification row first (unique `notificationUUID`; a duplicate key means
   re-delivery → respond 200 with no further work). Process inline, catch everything, record `outcome`/`error`, and
   return 200 whenever the signature was valid. Apple retries only on non-200.
4. **`ONE_TIME_CHARGE`.** Resolve the user by `appAccountToken` (`users.appAccountToken`, add an index if none).
   Found → `fulfilAppleTransaction(verified, userId, {}, 'webhook')`; `fulfilled`/`replayed` → outcome accordingly.
   Not found, or `rejected` → upsert `apple_iap_unclaimed` by `transactionId` with the reason, outcome `unclaimed`.
5. **Claiming.** In `fulfilAppleTransaction`, after a successful order insert, mark any `apple_iap_unclaimed` row for
   that `transactionId` as claimed (`claimedAt`, `claimedByOrderNumber`). Nothing else is needed for submit or restore
   to claim: both go through the same function.
6. **`REFUND` and `REVOKE`.** Find the order by `orderId = transactionId`, set `orderStatus: 'refunded'`,
   `appleRefundedAt`, `appleRefundNotificationUUID`. Add `'refunded'` to the `orderStatus` enum in `Order.ts` and to
   the `OrderStatus` type. Access ends on its own because entitlement reads only `success`. `REFUND_REVERSED` sets
   `success` again and clears `appleRefundedAt`. No order → log, outcome `logged`. Check `razorpayOrderSyncCron.ts` and
   `razorpayWebsiteOrderSyncCron.ts`: they match `orderStatus: { $ne: 'success' }`; make sure a `gateway: 'apple'` order
   can never be matched and flipped back by them (add `gateway: { $ne: 'apple' }` if the match could reach it).
7. **`REFUND_DECLINED`, `CONSUMPTION_REQUEST`, `TEST`, anything else** → outcome `logged`.
8. **Alerts.** `OpsAlert` model + `src/routes/opsAlertRoutes.ts`: `GET /api/ops-alerts?status=open|resolved` (default
   open, newest first, limit 200) and `PATCH /api/ops-alerts/:id/resolve`, both behind `requireAdmin` from
   `src/middleware/authMiddleware.ts`. Helper `raiseOpsAlert({kind, severity, title, detail, refs, dedupeKey})` that is
   a no-op when an open alert with that `dedupeKey` exists. A cron every 15 minutes (respect `DISABLE_CRONS`, register
   like the others in `app.ts`) raises `apple_unclaimed` for each unclaimed row older than 60 minutes with
   `dedupeKey = 'apple_unclaimed:' + transactionId`, and `apple_webhook_error` for any notification with outcome `error`
   in the last hour.

### Out of scope

Reconciliation (task 04). Admin UI (task 03). Registering the URL in App Store Connect (Raghav). App changes.

## Acceptance criteria

- [ ] Valid `ONE_TIME_CHARGE` for a known `appAccountToken` creates the order and the notification row says `fulfilled`.
- [ ] Same notification delivered twice → one order, second response 200, no second row.
- [ ] `ONE_TIME_CHARGE` with an unknown token → `apple_iap_unclaimed` row; a later submit of that transaction by a
      user whose token matches creates the order and marks the row claimed.
- [ ] `REFUND` → order `refunded`, `addIsPaidToCourses` reports the course unpaid; `REFUND_REVERSED` → `success` again.
- [ ] Invalid signature → 401, nothing stored except the rejected log row.
- [ ] Unclaimed row older than 60 min → one open `apple_unclaimed` alert, not one per cron tick.
- [ ] `GET /api/ops-alerts` without an admin token → 401; with one → open alerts; `PATCH …/resolve` closes one.
- [ ] Razorpay sync crons cannot flip an Apple `refunded` order back to `success` (test or cite the match filter).
- [ ] `scripts/qt-tasks.sh suites … baseline-backend.txt` → `NO NEW FAILURES`; `npx tsc --noEmit` clean.
