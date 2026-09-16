# BRANCHES — keeping the system in sync across repos

A **vertical slice spans repos**, so its changes must land on the **same branch name in every repo**.
If livestream is on `feat/x` but video-transcoder is on `main`, half the slice is invisible to the other
half and the contract between them looks broken even when the code is right.

## The rule
- **One shared feature branch per slice**, identical name across the repos in [`repos.manifest`](./repos.manifest) (`livestream`, `nodejs-server`, `video-transcoder`, `admin-dashboard`, `ls`).
- The active name is **data**, not prose: it lives in [`repos.manifest`](./repos.manifest) as `ACTIVE_BRANCH`.
- Single-repo work that is *not* part of a slice can use that repo's own branch freely — the shared-branch
  rule only binds work that crosses a contract boundary.

## Current active branch
Read `ACTIVE_BRANCH` in [`repos.manifest`](./repos.manifest) — it is the only authoritative copy
(a literal here already went stale once).

## Commands
```sh
./scripts/sync-branches.sh status     # print each repo's current branch; flag any drift from ACTIVE_BRANCH
./scripts/sync-branches.sh            # checkout ACTIVE_BRANCH in every repo (create-tracking if needed)
./scripts/sync-branches.sh <branch>   # start/switch the whole system to <branch> and update the manifest
```

## The fork exception

The **deploy forks** (see the commented registry in `repos.manifest`) do NOT follow the shared-branch
rule. `quicktricks-backend` — the production LMS — is the client team's separate cloned repo living on
**their** `quicktricks-admin` line; our work reaches it by explicit merge (as in the 2026-08-13 admin
merge), never by `sync-branches.sh`. Same will apply to their admin-dashboard clone once recorded.
Slice work on the LMS side therefore has two landing zones: the slice branch in `nodejs-server`
(upstream/standby) and a coordinated merge into the fork for production.

## Why not git submodules?
Submodules pin a *commit*, which goes stale on every push to an active branch and adds a commit-bump
ritual to every change. For repos under active development we track a **branch name** (in the manifest)
instead, and `sync-branches.sh` aligns the working copies. The brain never pins the services' commits.
