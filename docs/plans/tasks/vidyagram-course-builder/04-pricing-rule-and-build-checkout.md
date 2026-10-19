# Pricing rule and build checkout

**Type**: AFK
**Blocked by**: #00 — Team pricing answers, #02 — Builder settings and Builder mode

## What to build

A student pays for a build, and the amount Razorpay charges is computed by the backend.

**Pricing rule** as one pure function with no I/O (PRD module 1):
`priceBuild(settings, { topicIds, extrasOn, revisionOnly })` returns the subtotal, capped value, each
amount taken off, the final price and whether it sits at the minimum.
- normal: chapters = min(Σ chapter price of picked chapters, max);
- Revision only: chapters = max − revision discount, every chapter, picks ignored;
- then subtract the value of each offered extra switched off;
- then raise to the minimum and round to the rupee, halves up.

**Checkout**: a new authenticated route (user from the token, never from the body) taking
`{ courseId, topicIds, extrasOn, revisionOnly }`. It rejects topics not in the settings, extras not
offered, an empty pick in normal mode, and a disabled builder. It prices with the function above,
creates the Razorpay order for that amount, and writes a pending order carrying a `build` snapshot
`{ courseId, topicIds, extrasOn, revisionOnly, breakdown, settingsVersion }` with no expiry. The existing
payment-success path marks it successful. Do not reuse or change the existing client-amount checkout
routes.

## Acceptance criteria

- [ ] Table tests for the function: whole course ₹799; Notes off ₹699; Notes and Tests off ₹549;
      Arithmetic (51%) ₹407; Arithmetic with both off raised to ₹199; custom prices summing above max
      capped before extras; Revision only ₹449 and with both off ₹199; rounding at .5; unoffered extras
      ignored.
- [ ] Checkout integration tests with Razorpay stubbed: the server amount is charged even when the body
      carries another amount; foreign topic, unoffered extra, empty pick and unauthenticated requests are
      rejected; the success webhook leaves the order successful with the snapshot intact.
- [ ] Suites `NO NEW FAILURES`.

## User stories covered

- Story 12, 22, 39, 40, 42
