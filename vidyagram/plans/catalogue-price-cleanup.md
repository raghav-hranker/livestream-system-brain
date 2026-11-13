# Catalogue price and plan cleanup before launch (Vidyagram)

Status: needs-triage. Found 2026-10-22/23 while answering "do we need Plans?"
(`vidyagram/reports/plans-keep-or-remove-2026-10-22.md`). Data only. No code change is implied.

A student sees the course's own price (`Course.discountPrice`, else `price`) on course listings and pays the plan's
`amount` at checkout (`courseController.ts:1411-1413`, `orderController.ts:412-475`). On vidyagramdb on 2026-10-23,
the probe `reference/scripts/vidyagram-plans-shape-probe.cjs` finds three gaps across the 65 active courses.

1. **The card price differs from every plan that sells the course on its own: 11 courses.** For example, "SSC GD 2027
   (भारत Batch)" shows ₹599 and its plan charges ₹299. "Vocab Ocean" shows ₹199 and its plan charges ₹99. One more
   ("राजधानी SERIES") shows ₹0 and its plan charges ₹100. That the app renders `discountPrice` on the card is inferred
   from the backend response, not checked in the app.
2. **No plan sells the course on its own: 22 courses.** These can be bought only inside a combo, or not at all. Each
   one needs a decision: combo-only on purpose, free, or missing a plan.
3. **Stray courses inside real combos: 12 plans.** A real batch plan also holds an unrelated ₹12–96 "… 2026" course,
   all created 10-19. About 13.6k AppX buyers can open a course their order never listed. Removing it takes that
   access away, which needs an explicit yes under "never remove granted access". Where the links came from is not
   known.

Done when every active course has a plan whose price matches its card (or is deliberately combo-only), and the 12
stray links are resolved one way or the other. Rerun the probe to check.
