# Lifecycle, history + integration test

**Type**: AFK
**Blocked by**: #03 — Multiple rows with AND, #04 — Plan family + state rules

## What to build

Advanced audiences behave correctly across the whole notification lifecycle and leave an audit trail.

- **Form state**: rows survive toggling Default ↔ Advanced; the mode selected at save is the one stored.
- **Scheduled**: editing a still-scheduled notification loads and saves its mode and rows; the audience
  is resolved when the scheduler sends it, not at save time.
- **Resend** re-applies the saved rules against current order state.
- **`resolvedAudienceCount`** is written when the send job resolves its audience (immediate, scheduled
  and resend).
- **History/detail** shows the mode, the rows (by `planName` snapshot and ticked states) and the
  resolved count next to the existing recipient/success/failure counts.
- **Integration test** (real Mongo, integration suite): seed users with tokens and orders including an
  extension order and a voided order; for one Default and one two-row Advanced upsell, assert the exact
  estimate equals the audience the send path resolves, and `resolvedAudienceCount` matches.

## Acceptance criteria

- [ ] Toggling modes keeps rows in the form; saving in Default stores no rows.
- [ ] A scheduled Advanced notification can be edited (mode and rows) and sends to the audience as of send time.
- [ ] Resend re-resolves the audience from saved rules.
- [ ] `resolvedAudienceCount` recorded for immediate, scheduled and resend paths.
- [ ] History shows mode, rows and resolved count.
- [ ] Integration test passes under `npm run test:integration`.

## User stories covered

- Story 21: rows kept across toggles.
- Story 22: selected mode at save is stored.
- Story 23: scheduled audience resolved at send time.
- Story 24: edit mode and rows while scheduled.
- Story 25: resend re-applies rules.
- Story 26: history shows mode and rows.
- Story 27: history shows resolved count.
- Story 30: in-app list follows the resolved audience.
