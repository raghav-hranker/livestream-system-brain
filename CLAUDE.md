# System Brain — Hranker video platform

This repo is the **brain** for a system that spans three independently-deployed repos:

- **livestream** — live streaming (OBS/webcam → GPU HLS → Live bucket/CDN; the *live* transcoder)
- **video-transcoder** — recorded/VOD transcoding (intake → GPU job-manager → containers; ops 1A/1B/1C)
- **nodejs-server** — *Video Content Protection*: the LMS API that holds `Class.hlsAsset` and mints signed playback URLs

It owns **only the cross-cutting layer** — the whole-system map, the shared boundary vocabulary, and the
vertical-slice playbooks. Per-repo truth stays in each repo's own `CONTEXT.md` / `MAP.md` / `docs/`.
**Never duplicate a per-repo definition here — link to it.**

## Read first
@SYSTEM.md
@GLOSSARY.md
@BRANCHES.md

## How to use this repo

- **Single-repo task** (a fix that lives entirely in one service) → don't run here. Run in that repo;
  its own `CLAUDE.md` + `CONTEXT.md` are enough. Loading three repos' context is wasteful and less focused.
- **Vertical slice** (work that crosses a contract boundary — `stream-status`, `recordings`, `playback`,
  `hlsAsset`, the `Transcoder secret`) → start here. Open the matching file in [`slices/`](./slices/),
  which names the ordered hops and the exact files to touch in each repo.

## Repo locations
The three service repos are resolved as siblings (`../<name>`) or under `./repos/<name>`.
`repos.manifest` is the source of truth for their remotes and the **active shared branch**.

## Branch discipline (read before any slice commit)
A vertical slice spans repos, so all three repos must sit on the **same feature branch** while you work it —
otherwise half the slice lands on one branch and half on another. Before committing slice work:

```sh
./scripts/sync-branches.sh status     # show each repo's branch + flag drift
./scripts/sync-branches.sh            # put every repo on the manifest's ACTIVE_BRANCH
```

The active branch is data in `repos.manifest` (`ACTIVE_BRANCH`), currently `claude/zealous-bardeen-45dtkg`.
To move the whole system to a new slice branch: `./scripts/sync-branches.sh <new-branch>` (creates it in
every repo and rewrites the manifest). Never hand-edit the branch name into prose — it goes stale.
