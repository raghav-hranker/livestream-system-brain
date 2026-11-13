# PRD: Vidyagram extension terms per plan, in bulk

Status: ready-for-agent, drafted 2026-10-26 from the prototype session (variant E). Vidyagram only (backend branch
`vidyagram-admin`, admin branch `vidyagram-admin`). Nothing here ships to quicktricks.

Prototype (throwaway): [`../prototypes/extension-bulk-edit/index.html`](../prototypes/extension-bulk-edit/index.html),
tab "E · Bulk actions menu". Background on the live rule: fork ADR 0023 and the memory note
`automatic-plan-extension`.

## Problem Statement

A student whose plan has lapsed (or is about to, inside the Extension window) is offered an extension of that plan.
Today every Vidyagram plan gets the same offer: 183 days ("6 Months Validity") at 50% of what the student first paid,
never below ₹125. Those three numbers sit in the server's settings file, so the Vidyagram team cannot give a short
crash course a 3-month extension, price a premium combo differently, or switch the offer off on a cheap test pass.
Changing even the shared numbers needs a developer and a server restart.

## Solution

The admin can set extension terms per plan, for many plans at once, and can change the default every plan falls
back to.

- **Plans list.** Rows get a checkbox column. Ticking plans shows a bar with a **Bulk actions** menu. For now the menu
  holds one item, **Extension terms**. The page keeps its job as the list of whole plans: no extension-only column,
  only a small badge in the existing Flow column when a plan's extension differs from the default, and an
  **Extension** filter (Any, Default, Custom, Off) next to the others. A "Select all plans matching the filters" link
  reaches plans on other pages.
- **Extension terms dialog.** Four fields, each Default or Custom:
  1. **Extension offer:** On or Off.
  2. **Duration:** Default, or Custom in months or days. The dialog shows the card text the app will show
     ("3 Months Validity").
  3. **Price:** Default (the default percent), or Custom as a percent of what the student paid or a fixed rupee amount.
  4. **Minimum price:** Default, or Custom in rupees (0 means no minimum). Greyed out when the price is a fixed amount,
     because the admin typed the exact amount.

  With one plan, or plans whose terms match, the dialog opens on their current terms. With plans that differ it opens
  on Default, and saving gives every ticked plan the same terms. A before-and-after preview lists every plan and marks
  each one whose offer changes; it is the only warning. Closing the dialog changes nothing. After saving, the toast
  offers **Undo**, which puts each plan's previous terms back.
- **Default.** The dialog shows the default in one line with an **Edit default** button. The default is a duration,
  a percent and a minimum price, now stored in the database and edited from the admin. Its dialog says how many plans
  follow it, since a change reprices all of them.
- **Plan form.** One plan's terms also sit on its edit form, in an "Extension for lapsed students" card next to the
  Upgrade card, with the same four fields and the same preview line.

Offers already bought are never touched. A change applies to offers shown from then on.

## User Stories

1. As an admin, I want to tick several plans on the Plans list and set their extension terms in one go, so that I
   don't edit plans one by one.
2. As an admin, I want the bulk menu to be general ("Bulk actions"), so that the Plans list stays about whole plans and
   other bulk actions can join later.
3. As an admin, I want to turn the extension off on chosen plans, so that cheap test passes or retired batches are not
   offered a renewal.
4. As an admin, I want a custom extension duration in months or days, so that a short course can renew for 3 months.
5. As an admin, I want to see the exact card text ("3 Months Validity") while I type a duration, so that I know what
   students will read.
6. As an admin, I want a custom price as a percent of what the student paid, so that renewals stay proportional to
   each student's purchase.
7. As an admin, I want a custom fixed price, so that a plan renews at one round number for everyone.
8. As an admin, I want a fixed price never to exceed the plan's list price, so that a renewal never costs more than a
   new purchase.
9. As an admin, I want a custom minimum price per plan, so that a cheap plan's percent offer is not lifted to ₹125.
10. As an admin, I want the minimum price greyed out when the price is fixed, so that the number I typed is exactly
    what students pay.
11. As an admin, I want each field to offer "Default", so that a plan can follow the shared rule for some fields and
    have its own for others.
12. As an admin, I want a preview listing every ticked plan's offer now and after, for a student who paid the list
    price, so that I see the effect before saving.
13. As an admin, I want the preview to come from the same rule the server uses, so that it never disagrees with what
    students see.
14. As an admin, I want Undo after a save, so that a wrong bulk edit is one click to reverse.
15. As an admin, I want to filter the Plans list by Extension (Default, Custom, Off), so that I can find every plan
    with its own terms.
16. As an admin, I want a badge in the Flow column for plans whose extension is custom or off, so that the list shows
    it without a new column.
17. As an admin, I want "Select all plans matching the filters", so that one bulk edit can reach plans on other pages.
18. As an admin, I want to edit the default duration, percent and minimum price from the admin, so that I don't need a
    developer or a restart.
19. As an admin, I want the default editor to say how many plans follow the default, so that I know the reach of a
    change.
20. As an admin, I want to set one plan's terms from its edit form, so that I can do it while creating or editing a
    plan.
21. As a student with a lapsed plan, I want the offer card to show the plan's own price and validity, so that what I
    see is what I pay for.
22. As a student, I want an offer I already bought to keep its price and expiry, so that an admin change never changes
    my order.
23. As a student on iPhone, I want no change in behaviour, so that the App Store flow still works (iOS gets no offer,
    as today).
24. As an operator, I want the on/off switch and the Extension window to stay in the server settings, so that the
    feature can still be killed without the admin.

## Implementation Decisions

**Data shape.** One optional sub-document on the plan; absent means "all default".

```ts
type ExtensionPricing = { kind: 'percent'; percent: number } | { kind: 'fixed'; amount: number };

// Plans.extensionTerms
type PlanExtensionTerms =
  | { kind: 'off' }
  | { kind: 'custom'; days: number | null; pricing: ExtensionPricing | null; minPrice: number | null };
// null on a field = the default for that field. All three null = no sub-document (unset).
// pricing.kind 'fixed' forces minPrice null.

// The default, one singleton document (collection extensionsettings, singletonKey 'default')
type ExtensionDefaults = { days: number; percent: number; minPrice: number; updatedBy?: string; updatedAt?: Date };
```

- Bounds: `days` integer 1 to 1095; `percent` integer 1 to 100; `amount` integer ≥ 1; `minPrice` integer ≥ 0.
  Months entered in the admin convert with `round(months × 30.44)` (6 → 183), so the card label is exact.
- One parser turns request bodies into `PlanExtensionTerms` (or "unset") and is the only place these rules live. Plan
  create, plan update and the bulk route all use it. The retired `extensionEnabled`, `extensionPrice` and
  `extensionValidity` fields stay on the schema so old documents validate; nothing reads them.

**The rule.** `computeExtensionOffer` keeps every gate it has today (switch, iOS, Retired plan, source order, inactive
plan needs a paid order, empty plan never renewed). It then takes the plan's effective terms, the plan's own value per
field or else the default:

- `off` ⇒ no offer.
- percent ⇒ today's formula with the plan's percent, then the minimum: `max(price, min(minPrice, list))`. A percent
  result of ₹0 is still no offer.
- fixed ⇒ `min(amount, list)`; the minimum is not applied.
- Either kind: a final price of ₹0 or less ⇒ no offer, as today. A ₹0 order grants access with no bound, so a plan
  listed at ₹0 is never renewed, fixed price or not.
- duration ⇒ the plan's days. The card text keeps coming from `extensionValidityLabel(days)`.

Upgrade precedence (cheaper wins, a tie goes to the extension) is unchanged. `PLAN_OFFER_FIELDS` gains
`extensionTerms`, so every listing and order path that resolves offers reads it.

**The default store.** A singleton model in the pattern of `SupportAvailability`. A resolver returns the default:
the document if it exists, else today's env values (`LAPSED_EXTENSION_DAYS`, `LAPSED_EXTENSION_PERCENT`,
`LAPSED_EXTENSION_MIN_PRICE`, falling back to 183 / 50 / 125). It caches in process for 30 seconds and clears on a
write in the same process, so another process sees an edit within 30 seconds. `LAPSED_EXTENSION_ENABLED` and
`LAPSED_EXTENSION_WINDOW_DAYS` stay env-only. The offer readers (`planOffer.service`, `planAvailability.service`,
`courseAccessState.service`) take the default through the resolver; the pure policy stays synchronous and receives it.

**Routes (all `requireAdmin`, under `/api/plans`, registered before `/:id`).**

- `GET /extension-defaults` → the default plus `followingPlans`: how many plans a change to the default would
  reprice (not off, and at least one field on Default).
- `PUT /extension-defaults` → validate, upsert, stamp `updatedBy`, clear the cache, return the new default.
- `POST /extension-terms/preview` with `{ items: [{ planId, terms }] }` (terms may be `null` for "all default") →
  per plan `{ planId, planName, listPrice, currentTerms, before, after }`, where `before` and `after` are
  `{ price, days } | null` for a student who paid the list price. Computed with the same pure policy as the live offer.
- `PUT /extension-terms` with `{ items: [{ planId, terms }] }`, 1 to 500 items → one `bulkWrite`, `$set` or `$unset`
  per plan. Idempotent. Returns `{ matched, modified }`. Undo calls the same route with each plan's previous terms from
  the preview.
- `GET /extension-terms/matching?<the Plans list filters>` → `{ total, plans: [{ id, planName, amount, status,
  extensionTerms }] }`, first 500 by the list's order, for "Select all plans matching the filters".
- `GET /api/plans` (the admin list) accepts `extension=default|custom|off`. It returns `extensionTerms` on each row.

**Admin.** The dialog's four fields are one component, used by the bulk dialog and the plan form card. The preview
always comes from the preview route; the admin has no copy of the price rule. The old hidden Extension card in
`PlanForm.tsx` (its zod fields and the Upgrade/Extension mutual exclusion) and the list's `extensionEnabled` filter
are removed first. The Flow column stops reading `extensionEnabled`.

**App.** No change. The offer card already takes `amount`, `duration`, `name` ("<plan> : Extension (N Months
Validity)") and `description` from the server.

## Testing Decisions

Tests check what a student or admin sees, not how it is stored.

- **Policy (unit):** for each field, default versus custom; off; percent with and without the minimum lifting it;
  fixed below and above list price; fixed ignoring the minimum; a ₹0 list price under percent and under fixed (no
  offer either way); terms on an inactive plan for a
  never-paid holder (still no offer).
- **Default store (integration):** env fallback before any document; PUT then GET; bounds rejected with 400 and
  nothing written; the cache cleared by a write.
- **Offer paths (integration):** a lapsed holder of a plan with custom terms sees the custom price and validity on a
  plan listing and on a course page, and a checkout creates the order with those amounts and days. A plan set to off
  shows `is_expire: 0` and no extension.
- **Bulk routes (integration):** preview numbers match the listing for the same plan; a 3-plan save, a repeated save
  (no change), an undo, a 501-item body (400), a non-admin token (401/403).
- **Admin (component):** the menu shows only Extension terms; matching plans prefill; differing plans open on
  Default; minimum greys out on fixed; the preview renders the route's rows; Undo sends the previous terms; the filter
  and badge.
- Suites must print `NO NEW FAILURES` against the task folder's baselines.

## Out of Scope

- Other bulk actions (sale status, display screens, coupons). The menu is built so they can join later.
- Per-student or per-order terms, and time-boxed extension promos (Bulk Sales covers temporary price changes).
- The Extension window and the on/off switch in the admin.
- The old `isExtension` "extension plan" type and its badge.
- quicktricks. A port, if wanted, is a separate decision.

## Further Notes

- **Unverified:** the live values on the Vidyagram box. Reading its `.env.development` was blocked in the prototype
  session. Task 07 reads them, with the user's OK, before deploying, because the first save of the default replaces
  them.
- **Open before task 04:** the Vidyagram admin worktree has an uncommitted change to `components/admin/PlanForm.tsx`
  (Plan Details layout) that is not from this work. Ask whose it is before editing that file.
- A holder whose only orders on the plan were ₹0 (grants, AppX `TS-*` copies) is priced from the list price today,
  and keeps that under a custom percent. A fixed price applies to them as to anyone. The existing gates (Retired plan,
  inactive plan needs a paid order) still refuse them where they do today.
