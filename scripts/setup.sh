#!/usr/bin/env bash
# Ensure every service repo from repos.manifest is present, then align branches.
#
# - On Claude Code web the three repos are already cloned as siblings; this just verifies them.
# - Locally it clones any missing repo into ./repos/<name>.
#
# Run from anywhere: scripts/setup.sh
set -euo pipefail

BRAIN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MANIFEST="$BRAIN_DIR/repos.manifest"

manifest_lines() { awk '!/^#/ && !/^ACTIVE_BRANCH/ && NF {print $1, $2}' "$MANIFEST"; }

while read -r name url; do
  [ -z "${name:-}" ] && continue
  if [ -d "$BRAIN_DIR/../$name/.git" ] || [ -d "$BRAIN_DIR/repos/$name/.git" ]; then
    echo "ok    $name (present)"
  else
    echo "clone $name <- $url"
    mkdir -p "$BRAIN_DIR/repos"
    git clone "$url" "$BRAIN_DIR/repos/$name"
  fi
done < <(manifest_lines)

echo
"$BRAIN_DIR/scripts/sync-branches.sh"
