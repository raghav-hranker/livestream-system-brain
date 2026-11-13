# Editable default in the database

**Type**: AFK
**Blocked by**: 01
**Repo**: backend

## What to build

The default duration, percent and minimum price move from the settings file to one database document the admin can
edit.

- A singleton model in the pattern of `models/SupportAvailability.ts`: collection `extensionsettings`,
  `singletonKey: 'default'`, `days`, `percent`, `minPrice`, `updatedBy`, timestamps.
- A resolver that returns `ExtensionDefaults`: the document if it exists, else today's env values from
  `config/lapsedExtension.ts` (183 / 50 / 125 when unset). In-process cache of 30 seconds, cleared by a write in the
  same process.
- `planOffer.service` (both resolve functions), `planAvailability.service` and `courseAccessState.service` get the
  default through the resolver and hand it to the pure policy. `enabled` and `windowDays` still come from env. The
  policy stays synchronous; tests can still inject a default.
- `GET /api/plans/extension-defaults` and `PUT /api/plans/extension-defaults`, both `requireAdmin`, registered before
  `/:id`. GET returns the default (with `source: 'database' | 'settings-file'`) and `followingPlans`: plans a change to the
  default would reprice, meaning plans not set to `off` that have no `extensionTerms` or leave `days` or `pricing` null,
  or leave `minPrice` null under a percent price (a fixed price never uses the minimum). PUT validates the PRD bounds, upserts, stamps `updatedBy` from the admin token, clears the
  cache and returns the new default.

## Acceptance criteria

- [ ] Integration: with no document, GET returns the env values and `source: 'settings-file'`.
- [ ] Integration: PUT `{ days: 91, percent: 40, minPrice: 99 }` then GET returns them with `source: 'database'`;
      a lapsed holder on a Default plan immediately sees the new price and "3 Months Validity".
- [ ] Integration: out-of-bound bodies return 400 and write nothing; a non-admin token is refused.
- [ ] Unit: the cache serves within 30 seconds and is cleared by a write.
- [ ] `lapsedExtensionConfig.test.ts` and the extension suites still pass.
- [ ] `NO NEW FAILURES` against the backend baseline.

## User stories covered

- Stories 18, 19, 24
