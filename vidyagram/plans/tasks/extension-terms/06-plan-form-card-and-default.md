# Plan form card and Edit default

**Type**: AFK
**Blocked by**: 05
**Repo**: admin

## What to build

- **Plan form card.** In `components/admin/PlanForm.tsx`, an "Extension for lapsed students" card next to the
  Upgrade card, built from `ExtensionTermsFields`. On create it starts on all Default. It saves with the plan
  (`extensionTerms` in the create and update payload; `null` when every field is Default). A line under it shows the
  preview route's `after` for this plan ("A student who paid ₹499 would be offered ₹250 for 6 Months") and links to the
  Plans list for bulk changes.
- **Edit default.** A dialog opened from the default line in the bulk dialog and on the plan form card. It loads
  `GET /api/plans/extension-defaults`, shows duration (days, with the card text), percent and minimum price, and says
  "Used by N plans" from `followingPlans`. Save calls `PUT`, then the calling dialog refreshes its preview.

## Acceptance criteria

- [ ] Component: a new plan saved with the card untouched sends `extensionTerms: null`; with custom duration it sends
      the custom terms.
- [ ] Component: an existing plan with custom terms opens with them filled in.
- [ ] Component: Edit default shows "Used by N plans", saves, and the bulk dialog's preview reloads.
- [ ] Manual, against a local backend: change the default to 91 days and see a Default plan's preview change to
      "3 Months"; set it back.
- [ ] `NO NEW FAILURES` against the admin baseline.

## User stories covered

- Stories 18, 19, 20
