# Admin Plan form: remove the Extension card

**Type**: AFK
**Blocked by**: 04 — Deploy dark, accept on prod, switch on (deploy only once the automatic rule is live)

## What to build

In `quicktricks-admin`, remove the Plan form's Extension card (enable / price / validity), its
validation, and the Upgrade ⇄ Extension mutual-exclusion rule and hint (commit `6d8c3a0`). The
Upgrade card stays exactly as is. Add help text under the Active toggle: "Inactive plans stay
available to their lapsed buyers at the extension price." The form stops sending the extension
fields; the backend ignores them either way.

Also the Plans dashboard: since task 01 the backend no longer accepts an `extensionEnabled` list
filter (it is silently dropped), so remove the dashboard's `extensionEnabled` filter option and make
the "Extension" badge reflect only the older `isExtension` record flag.

## Acceptance criteria

- [ ] Component test: the Extension card and its hint are absent; the Active toggle shows the help text.
- [ ] Component test: a plan with an Upgrade offer saves with the same payload as before (minus extension fields).
- [ ] Editing `explore Test` (which still stores extension fields) loads and saves without a validation error.
- [ ] Plans dashboard: no `extensionEnabled` filter; the "Extension" badge shows only for `isExtension` plans.
- [ ] Browser check on the deployed admin: create and edit a plan end to end.

## User stories covered

- Story 29: no Extension settings in the admin
- Story 30: Upgrade settings unchanged
