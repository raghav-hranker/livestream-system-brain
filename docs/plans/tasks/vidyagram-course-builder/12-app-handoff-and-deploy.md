# App team handoff and deploy

**Type**: HITL
**Blocked by**: #03, #06, #07, #08b, #09

## What to build

- A guide for the app team in `reference/`: the builder data endpoint, the pricing rule as the client
  formula with the PRD examples as test cases, the checkout request, how to lock unowned chapters,
  the "Revision only" label and locked chapters, the "already at the minimum price" message, Continue
  disabled with no chapter, and that the server price wins.
- Push and deploy to the Vidyagram deploy with the user present, after deciding on the unpushed
  expiry-field fix (9db09adbb) that the integration branch carries.

## Acceptance criteria

- [ ] Guide written and sent by the user.
- [ ] Deployed; one real build purchase verified end to end on the Vidyagram deploy.

## User stories covered

- Story 4, 5, 6, 7, 8, 10, 11
