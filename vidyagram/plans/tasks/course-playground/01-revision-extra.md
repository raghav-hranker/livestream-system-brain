# Revision as an extra on every builder course

**Type**: AFK
**Blocked by**: None
**Repo**: backend

## What to build

Revision stops being included in a bought chapter and stops being a "Revision only" mode. It becomes a third extra
beside Notes and Tests, on every Course Builder course. PRD section "Revision as an extra".

- `BUILD_EXTRAS` = `notes`, `tests`, `revision` (`services/buildPricingPolicy.ts`). `priceBuild` drops `revisionOnly`
  (settings and picks); Revision is subtracted when offered and switched off, like the others. Update the header
  comment.
- `Course.builder`: add `extras.revision {offered, value, defaultOn}` (default not offered, 0, false); leave the old
  `revisionOnly` subdocument readable in the model but out of the save schema and pricing. `utils/courseBuilderConfig.ts`:
  `extras.revision` required in the input, `revisionOnly` gone, the extras-total rule counts Revision.
- `services/courseScope.ts`: `chapterOpensClass(chapter, isRevision, extras)` — a bought chapter opens a placement
  that is not a revision one, or any placement when `extras` has `revision`. Keep reading old orders: new build
  orders carry `build.rules: 2` (set in `buildOrder.service.ts` for checkout and manual grant, and on the Order model);
  `scopeBuild` reads a build without `rules: 2` the old way (normal build ⇒ treat as having `revision`; Revision-only
  build ⇒ its chapters open revision placements only). Update every caller (`classAccessAuthz.ts`,
  `certificate/certificatePolicy.ts`, `courseScope.ts` listing helpers, `courseOutlineRows.ts`,
  `courseAccessState*`, `classTabs/courseClassCard.ts`, `coursePurchasers.service.ts`, `notificationAudience/buildBuyers.ts`)
  so the one rule decides. Listings' `revisionTopicIds` keeps meaning "chapters where only revision classes open"
  for old Revision-only builds; add `ownedExtras` containing `revision` where it applies.
- Checkout (`buildCheckoutController.ts`, `buildOrder.service.ts`): `revisionOnly: true` ⇒ 400 "Revision only is no
  longer sold; add the Revision extra instead." `extrasOn` may include `revision` only when offered.
- `GET /:courseId/builder`, `POST /builder/quote`, the student builder data route (`courseBuilderDataController.ts`):
  return the Revision extra; drop Revision only from responses. Not-offered extras are left out of the student data.
- CONTEXT.md / the fork's ADR list: record the rule change (one ADR).

## Acceptance criteria

- [ ] Unit: `priceBuild` with Revision offered and off subtracts its value; not offered never subtracts; the minimum
      still floors the price.
- [ ] Unit: `chapterOpensClass` table: bought chapter × revision placement × revision extra; unbought never opens.
- [ ] Integration: a new build without Revision opens the chapter's ordinary classes and not its revision classes
      (playback authz and notes); with Revision it opens both.
- [ ] Integration: an order saved without `build.rules` (old normal build) still opens revision classes; an old
      Revision-only order still opens only revision classes.
- [ ] Integration: checkout with `revisionOnly: true` is 400 and writes nothing; `extrasOn: ['revision']` on a course
      where Revision is not offered is 400.
- [ ] Integration: builder save refuses Notes + Tests + Revision values above max − min; accepts within.
- [ ] `NO NEW FAILURES` against the backend baseline.

## User stories covered

- Stories 16, 17, 22, 23, 24
