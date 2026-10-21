# 04 — Daily reconciliation against Apple's sales report

State: ready-for-agent
Type: AFK
Side: backend only. Blocked by: 02 (`OpsAlert` model and `raiseOpsAlert`).

## Parent

Spec §2.1 and §9 in `~/Projects/quicktricks-backend/src/notes/ios_iap_backend_hardening_spec.md`.

## What to build

A cron that makes a repeat of finding A impossible to miss: compare what Apple says it sold with what we fulfilled, and
raise an alert on any difference. It needs an App Store Connect **team key** that does not exist yet, so it ships
behind a config check and does nothing but log until the key is on the box.

### Data shape first

```ts
// apple_iap_reconciliations — one row per run
{ reportDate: 'YYYY-MM-DD' /* unique */, windowStart: Date, windowEnd: Date,
  apple: Record<sku, units>, ours: Record<sku, orders>, diffs: Array<{ sku, apple, ours }>,
  status: 'ok' | 'mismatch' | 'skipped_not_configured' | 'report_not_ready' | 'error', error?, ranAt }
```

Pure functions, each unit-tested with fixtures and no network: `parseSalesReportTsv(text) → Record<sku, units>`
(rows with a `Parent Identifier` only; negative `Units` are refunds and subtract), `reportWindowIst(reportDate) →
{ start, end }` (report day D covers D-1 20:30 IST → D 20:30 IST, spec §9), `normalizeSku(productId)` (strip the `c.`
segment so both product ID forms count as one), `diff(apple, ours)`.

### Rules

1. **Config.** `APPLE_ASC_ISSUER_ID`, `APPLE_ASC_KEY_ID`, `APPLE_ASC_PRIVATE_KEY_PATH` (or `APPLE_ASC_PRIVATE_KEY`),
   `APPLE_VENDOR_NUMBER`. Any missing → one log line `apple reconciliation skipped: not configured` per run, a
   reconciliation row with `skipped_not_configured`, no alert. Add the names to `.env.example` with a comment that this is
   the team key, not the In-App Purchase key.
2. **Fetch.** ES256 JWT (`iss` issuer id, `kid`, `aud: appstoreconnect-v1`, exp ≤ 20 min), then
   `GET https://api.appstoreconnect.apple.com/v1/salesReports?filter[frequency]=DAILY&filter[reportType]=SALES&filter[reportSubType]=SUMMARY&filter[version]=1_1&filter[vendorNumber]=…&filter[reportDate]=YYYY-MM-DD`,
   gunzip the TSV. HTTP 404 → `report_not_ready` (published the following day), retry next run. Put the client behind
   a small interface so tests inject a fake.
3. **Compare.** Our side: `orders` with `gateway: 'apple'`, `appleEnvironment: 'Production'`,
   `orderStatus in ['success','refunded']`, `applePurchaseDate` in the window, grouped by `normalizeSku(appleProductId)`;
   a `refunded` order counts −1 like Apple's negative units. Compare the report day's totals. To absorb the 20:30 boundary,
   alert only when the **3-day rolling totals** (report days D, D-1, D-2) also differ for that SKU.
4. **Alert.** Per differing SKU, `raiseOpsAlert({ kind: 'apple_reconciliation', severity: 'error', title: 'Apple sold N, we
   have M for <sku>', detail: <window, both numbers>, refs: { productId, date }, dedupeKey: 'apple_reconciliation:' + date + ':' + sku })`.
5. **Schedule.** Daily at 09:30 IST for report day = yesterday (IST), respecting `DISABLE_CRONS`, registered like the
   other crons in `app.ts`. Expose `runAppleReconciliation(reportDate)` so it can be run by hand for a back-fill.

### Out of scope

Creating the team key (Raghav). Any UI (task 03 renders the alerts). Sandbox orders (not in Apple's report).

## Acceptance criteria

- [ ] With config missing, a run writes a `skipped_not_configured` row, logs once, raises nothing.
- [ ] `parseSalesReportTsv` handles the fixture (header row, IAP rows with Parent Identifier, app rows without, negative units).
- [ ] `reportWindowIst('2026-10-02')` = 2026-10-01 15:00:00Z → 2026-10-02 15:00:00Z.
- [ ] Fake client returning Apple 4 / ours 3 for one SKU across the rolling window → one `apple_reconciliation` alert, deduped on rerun.
- [ ] Fake client returning 404 → `report_not_ready`, no alert.
- [ ] Both product ID forms aggregate under one SKU.
- [ ] `scripts/qt-tasks.sh suites … baseline-backend.txt` → `NO NEW FAILURES`; `npx tsc --noEmit` clean.

## Follow-ups from task 02, included here

- A `REFUND` or `REVOKE` for a transaction that only has an `apple_iap_unclaimed` row (no order) must mark that row
  claimed/closed (`claimedAt`, reason `refunded`) and resolve its open `apple_unclaimed` alert, so a refunded purchase never
  raises "paying customer without access". (`src/services/appleIapWebhook.service.ts`, `markRefunded`.)
- The 15-minute cron (`src/cron/appleIapAlertsCron.ts`) must reprocess `apple_iap_notifications` rows that were stored
  but never processed (`processedAt` missing, `receivedAt` older than 5 minutes). A process crash between store and act
  otherwise loses that notification forever, because Apple's retry is treated as a duplicate.
