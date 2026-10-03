# System Brain — Hranker platform

This repo is the **brain** for a system that spans five independently-deployed repos:

- **livestream** — live streaming (OBS/webcam → GPU HLS → Live bucket/CDN; the *live* transcoder)
- **video-transcoder** — recorded/VOD transcoding (intake → GPU job-manager → containers; ops 1A/1B/1C)
- **nodejs-server** — *Content Protection*: the LMS API that holds `Class.hlsAsset` / `Pdf.pdfAsset` and mints signed playback + PDF-access URLs. **Deploy note:** the *production* LMS is the fork **quicktricks-backend** (`abhi092515/quicktricks-backend`, local `../quicktricks-backend`, branch `quicktricks-admin`) — same contracts and docs (CONTEXT.md/ADRs carried over in the 2026-08 merge) plus the client team's admin features; nodejs-server is the upstream lineage + phonetics standby. The fork is **not** slice-branch-synced — see `repos.manifest`.
- **admin-dashboard** — the admin control plane (Next.js): authors Classes/Courses/PDFs against nodejs-server's admin API; browser side of the PDF upload contracts; mints the Streamer token and hands off to **ls**. **Deploy note:** the production admin for the quicktricks line is the fork **quicktricks-admin** (`abhi092515/quicktricks-admin`, branch `quicktricks-admin`) — same fork discipline as quicktricks-backend; see `repos.manifest`.
- **ls** — the production livestream viewer/player UI (Next.js): presents the token to `/playback`, renders live + VOD HLS (replaces livestream's dead in-repo `ui/`)

It owns **only the cross-cutting layer** — the whole-system map, the shared boundary vocabulary, and the
vertical-slice playbooks. Per-repo truth stays in each repo's own `CONTEXT.md` / `MAP.md` / `docs/`.
**Never duplicate a per-repo definition here — link to it.**

## Read when
- **`SYSTEM.md`**: before work that crosses a service contract (stream-status, recordings, playback,
  realtime-token, private-mode, chat-moderation, PDF access/upload, shorts), or to find which repo or box
  owns something. It holds the service map, the contracts table and the end-to-end arcs.
- **`GLOSSARY.md`**: when you meet a shared term (`hlsAsset`, `pdfAsset`, Transcoder secret, Media stack,
  Upload lane, Job profile, Realtime token…), or before reasoning about playback auth or CDN tokens.
- **`BRANCHES.md`**: before committing slice work across the service repos. The quicktricks forks never
  follow the slice branch.

## How to use this repo

- **Single-repo task** (a fix that lives entirely in one service) → don't run here. Run in that repo;
  its own `CLAUDE.md` + `CONTEXT.md` are enough. Loading several repos' context is wasteful and less focused.
- **Vertical slice** (work that crosses a contract boundary — `stream-status`, `recordings`, `playback`,
  `hlsAsset`, `pdfAsset` / PDF upload, the `Transcoder secret`) → start here. Open the matching file in
  [`slices/`](./slices/), which names the ordered hops and the exact files to touch in each repo.

## Repo locations
The service repos are resolved as siblings (`../<name>`) or under `./repos/<name>`.
`repos.manifest` is the source of truth for their remotes and the **active shared branch**.

## Branch discipline (read before any slice commit)
A vertical slice spans repos, so every repo the slice touches must sit on the **same feature branch** while you work it —
otherwise half the slice lands on one branch and half on another. Before committing slice work:

```sh
./scripts/sync-branches.sh status     # show each repo's branch + flag drift
./scripts/sync-branches.sh            # put every repo on the manifest's ACTIVE_BRANCH
```

The active branch is data in `repos.manifest` (`ACTIVE_BRANCH`) — read it from there, not from prose.
To move the whole system to a new slice branch: `./scripts/sync-branches.sh <new-branch>` (creates it in
every repo and rewrites the manifest). Never hand-edit the branch name into prose — it goes stale.

## Agent skills

### Issue tracker

PRDs and implementation plans are tracked as local Markdown under `docs/plans/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Workflow states use the standard `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, and `wontfix` vocabulary. See `docs/agents/triage-labels.md`.

### Domain docs

This is a multi-context system: cross-repo language lives here, while per-repo definitions remain with their owning repos. See `docs/agents/domain.md`.
