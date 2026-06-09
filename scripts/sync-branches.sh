#!/usr/bin/env bash
# Keep every service repo on the same branch for vertical-slice work.
#
#   sync-branches.sh            checkout ACTIVE_BRANCH (from repos.manifest) in every repo
#   sync-branches.sh status     show each repo's current branch and flag drift
#   sync-branches.sh <branch>   switch/create <branch> in every repo and update ACTIVE_BRANCH
#
# Repos are resolved as siblings (../<name>) or under ./repos/<name>.
set -euo pipefail

BRAIN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MANIFEST="$BRAIN_DIR/repos.manifest"

active_branch() { awk '/^ACTIVE_BRANCH/{print $2; exit}' "$MANIFEST"; }
repo_names()    { awk '!/^#/ && !/^ACTIVE_BRANCH/ && NF {print $1}' "$MANIFEST"; }

resolve() { # name -> path (empty if not found)
  local n="$1"
  if [ -d "$BRAIN_DIR/repos/$n/.git" ]; then echo "$BRAIN_DIR/repos/$n"
  elif [ -d "$BRAIN_DIR/../$n/.git" ]; then (cd "$BRAIN_DIR/../$n" && pwd)
  fi
}

set_active() { # persist branch as ACTIVE_BRANCH in the manifest
  local b="$1" tmp; tmp="$(mktemp)"
  awk -v b="$b" '/^ACTIVE_BRANCH/{print "ACTIVE_BRANCH  " b; next} {print}' "$MANIFEST" > "$tmp" && mv "$tmp" "$MANIFEST"
}

cmd="${1:-}"

if [ "$cmd" = "status" ]; then
  target="$(active_branch)"
  echo "ACTIVE_BRANCH = $target"
  for n in $(repo_names); do
    p="$(resolve "$n")"
    if [ -z "$p" ]; then printf '  %-18s MISSING (run scripts/setup.sh)\n' "$n"; continue; fi
    cur="$(git -C "$p" rev-parse --abbrev-ref HEAD)"
    if [ "$cur" = "$target" ]; then printf '  %-18s %s\n' "$n" "$cur"
    else printf '  %-18s %s   <-- DRIFT (expected %s)\n' "$n" "$cur" "$target"; fi
  done
  exit 0
fi

# No arg => use ACTIVE_BRANCH; an arg => that branch (and it becomes the new ACTIVE_BRANCH).
if [ -z "$cmd" ]; then target="$(active_branch)"; else target="$cmd"; fi

echo "Aligning all repos to: $target"
for n in $(repo_names); do
  p="$(resolve "$n")"
  if [ -z "$p" ]; then echo "  $n: MISSING — run scripts/setup.sh first" >&2; continue; fi
  git -C "$p" fetch origin "$target" --quiet 2>/dev/null || true
  if git -C "$p" show-ref --verify --quiet "refs/heads/$target"; then
    git -C "$p" checkout --quiet "$target"
  elif git -C "$p" show-ref --verify --quiet "refs/remotes/origin/$target"; then
    git -C "$p" checkout --quiet -b "$target" --track "origin/$target"
  else
    git -C "$p" checkout --quiet -b "$target"   # brand-new slice branch
  fi
  printf '  %-18s -> %s\n' "$n" "$(git -C "$p" rev-parse --abbrev-ref HEAD)"
done
set_active "$target"
echo "ACTIVE_BRANCH set to $target in repos.manifest"
