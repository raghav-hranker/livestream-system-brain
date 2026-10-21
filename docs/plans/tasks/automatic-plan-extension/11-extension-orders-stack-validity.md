# Extension orders stack their validity (and QR paths honour the order's duration)

**Type**: AFK
**Blocked by**: None, can start immediately
**Status**: done 2026-09-25, `1914f186d` (local, fast-forwarded into `feat/automatic-plan-extension`)
**Decisions**: design record D11, D17 (QR finding); CONTEXT → *Extension order*; ADR 0023 → validity bullet.

## Why

Every success path sets `expireDate = paidAt + duration`. That is correct for a lapsed buyer but
would make a buyer inside the Extension window (task 12) lose the days they had left: access is the
union of orders, so a buyer with 20 days left who buys 183 days ends at now + 183, not now + 20 + 183.

Separately, and live today: three QR paths in `src/controllers/qrCodeController.ts` (~l.503, ~l.522,
~l.807) mark or create a successful order **without** `markOrderSuccessful` and use
`plan.duration || 365`, so a QR-paid **extension** order gets the plan's full duration instead of the
order's 183 days.

## What to build

- In `markOrderSuccessful` (`src/services/order.service.ts`, the seam all six Razorpay/QR success paths
  already share), for an order with `isExtensionOrder: true` only: compute
  `expireDate = max(Effective plan expiry for this user and plan EXCLUDING this order, paidAt) + order.duration days`
  and write `daysLeft` as the whole days until that date. The callers currently pass
  `expireDate`/`daysLeft` in `paymentDetails`; for extension orders the service's value wins. Keep one
  pure helper for the date math (unit-testable, no DB).
- Non-extension orders: byte-for-byte unchanged.
- With every eligible buyer lapsed (window 0, today), `max(...)` is `paidAt`, so behaviour is unchanged.
  Say so in a test.
- QR paths: route the first two through `markOrderSuccessful` if that is a safe drop-in (check what else
  it does: referral bonus + invoice; confirm both are wanted there, since they are for the Razorpay QR
  paths already). Otherwise make them use the order's own `duration` when present. For the fallback
  path that **creates** an order from a QR record (~l.807, and ~l.522), use the QR record's / plan
  offer's duration if one is recorded. If no extension marks exist on those created orders, leave their
  duration as is and note it.
- Idempotency: `markOrderSuccessful` already guards on `orderStatus != success`. Do not compute
  twice.

## Acceptance criteria

- [ ] Pure helper unit tests: lapsed (max = paidAt); active with 20 days left (stacks to +20 +183);
      several prior orders (furthest wins); the order itself excluded; non-extension untouched.
- [ ] Integration test: an extension order paid through the webhook path gets the stacked `expireDate`
      and matching `daysLeft`; a normal order paid the same way is unchanged.
- [ ] QR: an extension order paid by QR gets its own duration (183), not `plan.duration`.
- [ ] Suites: failure lists identical to base (28 unit / 8 integration at `e9d273233`); `tsc` clean on touched files.

## Done (2026-09-25, `1914f186d`)

- Pure `extensionOrderValidity` (`planExtension.service.ts`) + `stackExtensionValidity` inside
  `markOrderSuccessful`. Extension orders only, on the transition only (a replay returns before it).
  Lapsed holders: result == caller's `paidAt + duration`, so nothing extra is written.
- QR `sync` initiated-order path now goes through `markOrderSuccessful` and uses the order's own `duration`
  (plan duration only as a fallback). It gains the guarded transition, referral bonus, invoice, stacking.
  The two QR *create* paths are unchanged: QR create is list-price only, and QrCode has no extension or
  duration field, so they can never produce an Extension order.
- Tests: unit 1686 / 28 fail, integration 335 / 8 fail; failure lists identical to base; `tsc` 0 errors.
- **Known gap (accepted):** a stacking Extension order is written twice: the success transition, then the
  stacked dates. A crash between the two leaves the shorter `paidAt + 183`. Only reachable once the window
  is open (task 12/13); check the order in 13's test purchase.
- **Out-of-scope bugs found (not fixed):** (1) `sync`'s fallback create only looks for an `initiated` order.
  If the webhook already marked it successful, a later sync creates a second successful order for the same
  QR. (2) `sync` never calls `deductCoinsIfNeeded`; the webhook paths do.
