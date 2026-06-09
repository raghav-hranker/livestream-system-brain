# ADR 0001 — A thin "brain" repo for cross-repo work

## Status
Accepted

## Context
The platform is three independently-deployed repos (livestream, video-transcoder, nodejs-server) that share
contracts (`stream-status`, recordings, `/playback`, `hlsAsset`, the per-customer Transcoder secret). Each repo
already has strong AI-oriented docs (`CONTEXT.md` ubiquitous-language glossaries, `MAP.md` wiring, `docs/`), but
nothing draws the **whole-system arc** or guides work on a **vertical slice** that spans repos. We also lacked a
`CLAUDE.md` anywhere, so the best docs weren't auto-loaded at session start.

## Decision
Add a thin brain repo that owns **only** the cross-cutting layer:
- `SYSTEM.md` — whole-system wiring + contract ownership.
- `GLOSSARY.md` — shared boundary terms, each pointing to its authoritative per-repo definition.
- `slices/` — vertical-slice playbooks (ordered hops + files + e2e test).
- `repos.manifest` + `scripts/` — repo resolution and shared-branch alignment.

Constraints:
1. **Single source of truth stays per-repo.** The brain links to `CONTEXT.md`/`MAP.md`; it never copies them.
2. **Branch as data.** The shared slice branch lives in `repos.manifest` (`ACTIVE_BRANCH`), aligned by
   `sync-branches.sh`. No hardcoded branch names in prose.
3. **Track branches, not commits.** No git submodules — they pin commits and go stale on every push to an
   active branch.
4. **Run the brain only for slices.** Single-repo work runs in its own repo to keep context focused.

Also: add a one-screen `CLAUDE.md` to each service repo that `@`-imports its own `CONTEXT.md`/`MAP.md`, so the
existing docs are auto-loaded.

## Consequences
- Cross-repo knowledge has a home and is discoverable at session start.
- The brain can rot into a stale second copy if constraint #1 is violated — reviewers must reject duplicated
  definitions in favour of links.
- The brain is a separate repo; publishing it requires creating the remote (out of scope of the per-service
  push permissions).
