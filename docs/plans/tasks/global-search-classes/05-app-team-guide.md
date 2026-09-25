# App-team guide for the classes section

**Type**: HITL
**Blocked by**: #02 — Purchases on class results, from a verified token only

## What to build

A short client guide in `reference/` for the mobile app team, in the style of the existing mobile
socket guide, so they can build the Classes section without reading the backend. A human sends
it, and resends it if the contract changes.

It must cover:
- The `classes` section and its place in the response, the "Classes" capsule, and `type: "class"`
  for clicks.
- The full result shape from the PRD wire contract, with an example.
- How to pick the course to open through: `courses[0]` is the default (purchased → free →
  priority). `isActive: false` means "owned, not for sale".
- Access (`canPlay`) vs readiness (`streamStatus`, `hasPlayback`), and the Upcoming / Live /
  Processing / Locked / Play states that follow from them.
- `canPlay` is a hint: handle the `/playback` 403 as today.
- Send `Authorization` on `/api/search`. Without it, results are guest-view.
- Trending has no classes yet.

## Acceptance criteria

- [ ] Guide written in `reference/` and linked from the PRD.
- [ ] Every field in the guide matches a real response captured from the branch or prod.
- [ ] Sent to the app team; memory updated with "resend when the contract changes".

## User stories covered

- Stories 31–35: the app-facing contract
