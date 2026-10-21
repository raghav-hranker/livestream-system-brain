# 01 — Submit endpoint fulfils from the verified transaction alone

State: ready-for-agent
Type: AFK
Side: backend only. Blocked by: none.

## Parent

Spec §2.1 (decisions), §3, §4, §5, §8 in `~/Projects/quicktricks-backend/src/notes/ios_iap_backend_hardening_spec.md`.

## What to build

`POST /api/orders/submit-apple-iap-order` (`submitAppleIapOrder` in `src/controllers/orderController.ts`, ~line 838)
currently needs the app to send `userId`, `planId`, `apple_product_id`, `txn_id` and more, and checks each against the
verified transaction. After this task the verified transaction is the only trusted input. Everything else is derived on
the server, and the client fields are accepted as hints only.

### Data shape first

Introduce one typed result for fulfilment so the controller and the webhook (task 02) share it. Put it in a new
`src/services/appleIapFulfilment.service.ts`:

```ts
type AppleFulfilmentHints = { planId?: string; appleProductId?: string; type?: string; orderVia?: string; planFor?: string };
type AppleFulfilmentResult =
  | { kind: 'fulfilled'; order: IOrder }
  | { kind: 'replayed';  order: IOrder }                       // same user, same transaction, already fulfilled
  | { kind: 'rejected';  code: AppleRejectionCode; message: string; httpStatus: 422 };
type AppleRejectionCode =
  | 'SIGNATURE_INVALID' | 'BUNDLE_MISMATCH' | 'PRODUCT_NOT_MAPPED' | 'REVOKED'
  | 'ACCOUNT_TOKEN_MISMATCH' | 'TRANSACTION_ALREADY_CLAIMED' | 'PLAN_NOT_ELIGIBLE';

fulfilAppleTransaction(verified: VerifiedAppleTransaction, userId: string, hints: AppleFulfilmentHints, source: 'submit' | 'webhook'): Promise<AppleFulfilmentResult>
```

The function owns: plan resolution, every post-verification check, duration resolution, `createFulfilledAppleOrder`,
the replay/claim decision, and the `Apple IAP order fulfilled` / `rejected` / `duplicate submit` log rows. The
controller only parses, verifies, calls it, and maps the result to HTTP. A table of code → message beats a chain of
ifs; keep the rejection codes in one `const` the tests import.

### Rules

1. **Log first.** Write `Apple IAP submission received` before schema validation and before any lookup, with the raw
   body minus `apple_receipt`, the `x-app-version` header if present, and the token user id. If the request reaches the
   handler, a row exists.
2. **Request shape.** `apple_receipt` (JWS) is required unless `txn_id` is present (the existing API-lookup path stays).
   `userId`, `planId`, `apple_product_id`, `grandTotal`, `duration`, `practiceBatchId`, `courseId`, `packageId`,
   `customer_id`, `order_date`, `apple_environment`, `apple_original_transaction_id` become optional. Relax
   `submitAppleIapOrderSchema` in `src/schemas/orderSchemas.ts` accordingly. The user is the token user, always; drop
   the 403 "User mismatch" branch (a body `userId` that disagrees is logged as a hint mismatch, nothing more).
3. **Plan from product ID.** `findPlanByAppleProductId(productId)` resolves both `com.quicktricks.sahilsir.<planId>`
   and `com.quicktricks.sahilsir.c.<planId>` to the same plan: strip an optional `c.` segment, look up
   `plans.inAppPurchaseProductId` in both spellings, require `status: 1`, require exactly one match. No match →
   `PRODUCT_NOT_MAPPED`. If `hints.planId` is present and differs, log `Apple IAP plan hint mismatch` and grant the
   derived plan.
4. **Checks.** Bundle id (`BUNDLE_MISMATCH`), `revocationDate` absent (`REVOKED`), `appAccountToken` equals
   `users.appAccountToken` case-insensitively (`ACCOUNT_TOKEN_MISMATCH`), extension-plan eligibility via the existing
   `validateExtensionPlanPurchase` (`PLAN_NOT_ELIGIBLE`). **Remove** the `type !== 'Non-Renewing Subscription'` check;
   store `type` on the log row and the order (`appleProductType`). A `Consumable` with a new `transactionId` is a new
   order even when `originalTransactionId` repeats.
5. **Replay vs claim.** Existing order with the same `orderId` (= transactionId): same user → `replayed` (HTTP 200,
   `state: 201`, existing order, log `Apple IAP duplicate submit`); different user → `TRANSACTION_ALREADY_CLAIMED`.
   The current 409 goes away: the app treats anything but 200/201 as retryable, and a 422 with a code is what tells it to stop.
6. **Amount status.** Replace `'verified' | 'pending'` with `'verified' | 'sandbox' | 'foreign_currency' | 'unpriced'`
   in `resolveAppleAmount` (`src/services/order.service.ts`), `Order.ts`, and `appleRevenueReporting.ts`:
   `sandbox` for any Sandbox transaction, `verified` for a Production INR price, `foreign_currency` for a Production
   non-INR price (store Apple's amount and currency, `grandTotal` 0, and log `Apple IAP foreign currency purchase` as an
   anomaly, the app is India-only), `unpriced` when Apple sent no price. Revenue counts only `verified` + Production.
   Keep `pending` in the exclusion clauses so the two legacy Sandbox docs stay excluded; do not migrate data.
7. **Response contract.** 201 `{state: 201, message, data}` on fulfilled; 200 `{state: 201, …}` on replayed (unchanged
   shape, the app depends on it); 422 `{state: 422, code, message, data: null}` on rejected; 502 for Apple unreachable,
   500 for missing config (unchanged). Every rejection writes `Apple IAP order rejected` with `payload.reason = code`
   and `payload.httpStatus`.
8. Log rows (`AppleIapLog`) gain `productId`, `type`, `appVersion`, `httpStatus` in `payload` where known. Keep
   `apple_receipt` out of every row except as `'[redacted]'`.

### Out of scope

Webhook, unclaimed collection, `refunded` status, alerts, reconciliation (tasks 02–04). App changes. Data migration.

## Acceptance criteria

- [ ] Submit with only `apple_receipt` creates the right order for the token user, plan derived from the product ID.
- [ ] Submit with a `planId` hint that disagrees grants the derived plan and logs the mismatch.
- [ ] `…sahilsir.<id>` and `…sahilsir.c.<id>` both resolve to the same plan.
- [ ] A `Consumable` transaction is fulfilled; a second consumable purchase with a new `transactionId` creates a second order.
- [ ] A Sandbox transaction is fulfilled with `appleAmountStatus: sandbox` and excluded by `APPLE_NON_REVENUE_CLAUSES`.
- [ ] A Production non-INR transaction is fulfilled with `foreign_currency`, Apple's amount and currency stored, excluded from revenue, anomaly row written.
- [ ] Re-submit by the same user → 200 with `state: 201` and the existing order; by another user → 422 `TRANSACTION_ALREADY_CLAIMED`.
- [ ] Every rejection leaves a `submission received` row and a `rejected` row with `reason` = code; a validation failure (400) still leaves the received row.
- [ ] `src/services/appleIapFulfilment.service.ts` exists with the typed result above and the controller is a thin mapper.
- [ ] Existing `appleIap*.integration.test.ts` pass or are updated with a one-line reason per changed assertion.
- [ ] `scripts/qt-tasks.sh suites … baseline-backend.txt` → `NO NEW FAILURES`; `npx tsc --noEmit` clean.
