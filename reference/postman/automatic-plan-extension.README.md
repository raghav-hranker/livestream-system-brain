# Automatic plan extension — local Postman test bed (tasks 01–03, 12)

Manual acceptance for `docs/plans/tasks/automatic-plan-extension/01-automatic-offer-behind-switch.md`,
over the real routes, on a **throwaway local Mongo** — never the rs0 replica set.

| Piece | Where |
|---|---|
| Collection | `automatic-plan-extension.postman_collection.json` (generated; base URLs + fixture ids are collection variables — no environment file) |
| Generator (edit cases here) | `reference/scripts/automatic-plan-extension-local/build-postman.cjs` |
| Fixtures | `reference/scripts/automatic-plan-extension-local/seed.js` (fixed ids, refuses non-local hosts) |
| Servers | `reference/scripts/automatic-plan-extension-local/run-servers.sh` (+ `rzp-stub.cjs`) |
| Code under test | worktree `~/Projects/worktrees/qt-autoext-local-test`, detached at `feat/automatic-plan-extension` `92240a00b` + the worktree's uncommitted diff applied (oldest paid non-extension order capped at today's list price, Extension title) (node_modules symlinked from `../quicktricks-backend-auto-extension`); its gitignored `.env.development` points at the local Mongo |

## Run

```sh
docker start qt-autoext-mongo                       # mongo:7, single-node rs0, 127.0.0.1:27027
S=reference/scripts/automatic-plan-extension-local
$S/run-servers.sh                                   # 3106 ON · 3107 OFF · 3108 ON 30%/90d · 3109 ON window 30d; logs /tmp/qt-autoext-logs
mongosh --quiet "mongodb://127.0.0.1:27027/qt_autoext_test?directConnection=true" $S/seed.js   # re-seed before EVERY run
# Postman: import the collection, no environment needed ("No environment" is fine), Run collection (in order).
# or: npx newman@6 run reference/postman/automatic-plan-extension.postman_collection.json
$S/run-servers.sh stop
```

Razorpay is replaced in-process by `rzp-stub.cjs` (stub `order_stub_*` / `plink_stub_*` ids), so checkouts
create `initiated` orders locally and nothing reaches Razorpay. Crons are off. Initiated orders don't count
toward eligibility (only `success` does), but re-seed anyway; dates are relative to seed time.

Folder 5 (task 12) needs a tip that includes task 12 (`feat/autoext-window`); on an older tip 3109 behaves like
3106 and folder 5's 3109 requests fail. To test a newer tip (e.g. after tasks 02/03 merge): `git -C ~/Projects/worktrees/qt-autoext-local-test checkout --detach <sha>`,
restart the servers, extend `build-postman.cjs`, regenerate.

## Fixtures (Plan P = ₹1000 / 365d unless noted)

| User | History | Expected with switch ON |
|---|---|---|
| lapsed | paid ₹499, lapsed 10d | ₹250 / 183d, `is_expire 1` (3108: ₹150 / 90d) |
| active | lapsed ₹800 + active ₹1000 | list, `is_buy 1` |
| stranger | none | list |
| renewed | paid ₹900, then lapsed extension ₹450 | ₹450; checkout source = the extension order |
| granted | ₹0 only | ₹500 (half of list) |
| zero_paid | paid ₹700, newer ₹0 | ₹350 |
| round | paid ₹333 | ₹167 |
| couponed | paid ₹800 | ₹400 |
| two_paid | paid ₹600 (old), ₹800 (recent) | ₹300 (oldest = original purchase) |
| retired | paid ₹1000 on plan R (old per-plan config ₹10/30d) | ₹500 / 183d — old fields ignored |
| prec | active on S; lapsed ₹2000 on T1 (upgrade ₹600) and T2 (upgrade ₹1000) | T1 upgrade ₹600 wins; T2 tie → extension ₹1000 / 183d |

Task 12 — the **Extension window** (server 3109, `LAPSED_EXTENSION_WINDOW_DAYS=30`; 3106 has the window unset = 0).
Plan W = ₹1000 / 365d; Plan I is **inactive**, list ₹599.

| User | History | Expected on 3109 (window 30) | On 3106 (window 0) |
|---|---|---|---|
| in_window | paid ₹800 on W, **20d left** | ₹400 / 183d, `is_buy 1`, `is_expire 1`; checkout ₹400 on all 3 paths ⇒ Extension order, source = the live order | list, `is_buy 1`, `is_expire 0`; ₹400 rejected |
| far | paid ₹800 on W, 40d left | list, `is_buy 1`, `is_expire 0`; ₹400 rejected | same |
| active (task 01) | lapsed ₹800 + active ₹1000, 20d left | ₹400 (oldest paid ₹800), `is_buy 1`, `is_expire 1`, source = the live order | list, `is_buy 1` |
| iw_paid | paid ₹799 on inactive I, 20d left | listed at ₹300 (half of list ₹599), `is_buy 1`, `is_expire 1`; checkout ⇒ Extension order | not listed |
| iw_zero | ₹0 grant on inactive I, 20d left | not listed; checkout at list 403 (D16) | not listed |

Stacking at payment (Extension order `expireDate` = old expiry + 183d) needs a signed Razorpay webhook; it is
covered in the LMS repo by `src/tests/integration/extensionWindow.integration.test.ts` (create → webhook → stacked),
as are the course Extend flags. Not in this collection.

Coupon `WINBACK20` = 20 % off, stacks on the offer (₹250 → ₹200).

## Coverage vs task 01 acceptance

Covered: listings on all three shapes (on/off/anonymous), every base rule, rounding, custom percent/days,
precedence vs Upgrade, all three Razorpay paths at offer price / ₹1 tolerance / coupon, Extension order marks +
183d + source order, lapsed order unchanged, switch-off parity, retired per-plan fields ignored.
Not covered here (unit-level only): config parsing of invalid values; the "no code reads the retired fields" grep;
full-suite parity. Extension rows are asserted to carry `name`/`title` = "<plan> : Extension"; list/upgrade rows keep the plan title.
Last run 2026-09-25 on `92240a00b` + uncommitted diff: 70 requests, 377 assertions, 0 failures.
Task 12 extension (folder 5, 105 requests in total) generated 2026-09-25 and **not yet run** — the task-12 tip was
not on the local servers at the time.
