# Plans list Bulk actions and the Extension terms dialog

**Type**: AFK
**Blocked by**: 03, 04
**Repo**: admin

## What to build

Variant E of the prototype on the real Plans list (`components/admin/PlansDashboard.tsx`).

- A checkbox column with a header checkbox for the page. Selection survives paging and filter changes until cleared.
- When anything is ticked, a sticky bar: "N selected", a **Bulk actions** menu holding one item, **Extension terms**,
  and Clear. When the page is fully ticked, a "Select all plans matching the filters" link calls
  `GET /api/plans/extension-terms/matching` and selects up to 500; above 500 it says so and asks to narrow the filter.
- An **Extension** filter (Any, Default, Custom, Off) sent as `extension`. A Flow-column badge for custom ("Extension:
  3 Months · 40%") and off ("Extension: Off").
- An `ExtensionTermsFields` component with the four fields from the PRD (each Default or Custom; minimum price greyed
  out when the price is fixed; duration in months or days with the card text shown). Task 06 reuses it on the plan
  form.
- The **Extension terms** dialog:
  - Opens on the ticked plans' terms when they all match, else on Default for every field.
  - Shows the default in one line (read-only here; task 06 adds Edit default).
  - Calls the preview route as fields change (debounced) and lists every plan, now and after, marking each plan whose
    offer changes. "N of M plans change". Save is disabled at 0.
  - Save calls `PUT /api/plans/extension-terms`. The toast says how many plans changed and offers Undo, which sends
    each plan's `currentTerms` from the last preview.
  - Closing changes nothing. No per-field "leave as is" and no mixed-value warnings (decided 2026-10-26).
- Months convert to days with `round(months × 30.44)`.

## Acceptance criteria

- [ ] Component: the menu lists only Extension terms; ticking two pages of plans keeps both pages' ticks.
- [ ] Component: matching plans prefill their terms; differing plans open on Default.
- [ ] Component: picking a fixed price greys out the minimum and omits it from the request.
- [ ] Component: the preview table renders the route's `before` and `after` and the changed count.
- [ ] Component: Save sends one request with every ticked plan; Undo sends the previous terms.
- [ ] Component: the Extension filter sends `extension=custom`; the badge renders for custom and off rows.
- [ ] Manual, against a local backend with test data: tick 3 plans, set 3 months at 40%, save, see the badges and
      listing prices change, undo.
- [ ] `NO NEW FAILURES` against the admin baseline.

## User stories covered

- Stories 1, 2, 3, 4, 5, 6, 7, 10, 11, 12, 14, 15, 16, 17
