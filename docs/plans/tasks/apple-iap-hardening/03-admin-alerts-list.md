# 03 — Admin dashboard: Alerts list

State: ready-for-agent
Type: AFK
Side: admin only (`quicktricks-admin`). Blocked by: none for building; the API it calls ships in backend task 02, so
tests run against a mocked API and the page says plainly when the API is unreachable.

## Parent

Spec §2.1 ("Alerts … go to a list in the admin dashboard. No email.") in
`~/Projects/quicktricks-backend/src/notes/ios_iap_backend_hardening_spec.md`.

## API contract (owned by backend task 02; do not change it here)

```
GET   /api/ops-alerts?status=open|resolved   → { state: 200, data: OpsAlert[] }   (requireAdmin; default open; newest first)
PATCH /api/ops-alerts/:id/resolve            → { state: 200, data: OpsAlert }

OpsAlert = { id, kind: 'apple_unclaimed' | 'apple_reconciliation' | 'apple_webhook_error', severity: 'warn' | 'error',
             title, detail, refs: { transactionId?, orderNumber?, userId?, productId?, date? },
             status: 'open' | 'resolved', createdAt, resolvedAt?, resolvedBy? }
```

## What to build

A screen that an operator opens in the morning to see what needs a human. Follow `BannedUsersDashboard.tsx` for
structure, data fetching, auth header and test style (`BannedUsersDashboard.test.tsx`).

1. **Route and screen key.** `app/admin/ops-alerts/page.tsx` rendering `components/admin/OpsAlertsDashboard.tsx`.
   Add `{ key: 'ops-alerts', label: 'Alerts' }` to the **Sales** group in `components/admin/AdminForm.tsx` and wherever
   else screen keys are registered (sidebar nav, permission middleware map). The three-screen permission drift noted in
   memory means a new key must be ticked per admin account; say so in the report.
2. **List.** Tabs Open / Resolved. Each row: severity colour, kind as a short label ("Unclaimed purchase",
   "Apple sales mismatch", "Webhook error"), title, detail, created time (IST, relative + absolute on hover), and the
   refs as links where a target exists: `orderNumber` → the Orders screen filtered by that number, `userId` → the
   Users screen for that user. Transaction id and product id as copyable text.
3. **Resolve.** A Resolve button per open row, optimistic, with the row moving to Resolved on success and reverting
   with an inline error on failure.
4. **Empty and error states.** "Nothing needs attention" when open is empty. If the API returns 404 or a network error
   (backend not deployed yet), show one line saying the alerts API is not available, not a spinner.
5. **Mobile.** Works at 390 px: rows stack, buttons stay reachable (see the admin mobile harness memory).

## Out of scope

Badge counts in the sidebar. Email. Any backend change.

## Acceptance criteria

- [ ] `/admin/ops-alerts` lists open alerts from the mocked API, newest first, with kind, title, detail, time and refs.
- [ ] Resolve moves a row to Resolved and calls `PATCH /api/ops-alerts/:id/resolve`; a failed call reverts with an error.
- [ ] Empty state and API-unavailable state render as specified.
- [ ] The screen key `ops-alerts` is registered everywhere the existing keys are (grep `banned-users` and mirror each site).
- [ ] Vitest for the dashboard component covers list, resolve success, resolve failure, empty, unavailable.
- [ ] `scripts/qt-tasks.sh suites … baseline-admin.txt` → `NO NEW FAILURES`.
