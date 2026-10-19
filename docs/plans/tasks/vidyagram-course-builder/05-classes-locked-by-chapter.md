# Classes locked by chapter

**Type**: AFK
**Blocked by**: #01 — One "what does this user own" check, #04 — Pricing rule and build checkout

## What to build

A student who bought a build can watch the classes of the chapters they bought and nothing else.

Extend the resolver with the partial kind:
`{ kind: 'partial', chapters: Map<topicId, 'all' | 'revision'>, extras }`, read from successful orders
carrying a `build`. A Revision-only build marks every chapter of the course `revision`. Several builds
union: full beats partial, `all` beats `revision` for the same chapter, extras union.

A class's chapter is its placement's per-course topic, else the class topic. Playback, downloads and the
realtime token allow a class when the scope is full, or its chapter is in the scope as `all`. A chapter
scoped `revision` opens no classes in this task; task 08b opens tagged classes for them. Free classes and free placements stay free. Classes added later to a
bought chapter are covered because the scope stores topic ids.

## Acceptance criteria

- [ ] Partial owner: bought-chapter class plays; unbought-chapter class is denied with the existing
      denial shape; free placement plays.
- [ ] A class added to a bought chapter after purchase plays.
- [ ] Two builds union; a full purchase plus a build behaves as full.
- [ ] Suites `NO NEW FAILURES`.

## User stories covered

- Story 15, 16, 41
