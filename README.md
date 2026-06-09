# system-brain

The brain for the Hranker video platform — the cross-repo layer over three services:
**livestream** (live transcoder), **video-transcoder** (recorded/VOD), **nodejs-server** (playback signing).

It owns only what no single repo can: the whole-system map, shared boundary vocabulary, and vertical-slice
playbooks. Per-repo truth stays in each repo's own `CONTEXT.md` / `MAP.md` / `docs/`.

## Start here
- [`CLAUDE.md`](./CLAUDE.md) — what loads at session start + how to use this repo
- [`SYSTEM.md`](./SYSTEM.md) — whole-system wiring and contract ownership
- [`GLOSSARY.md`](./GLOSSARY.md) — shared boundary terms (point to authoritative per-repo defs)
- [`slices/`](./slices/) — vertical-slice playbooks
- [`BRANCHES.md`](./BRANCHES.md) — keeping all repos on one slice branch

## Setup
```sh
scripts/setup.sh            # verify/clone the service repos, then align branches
scripts/sync-branches.sh status
```

Single-repo work → run in that repo. Cross-repo slice → run here.
