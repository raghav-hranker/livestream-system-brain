#!/usr/bin/env bash
# Symlink tenant-push-guard.sh as the pre-push hook of each quicktricks fork repo.
# One hook per shared .git covers every worktree of that repo. Idempotent.
set -euo pipefail

guard="$(cd "$(dirname "$0")" && pwd)/tenant-push-guard.sh"
chmod +x "$guard"
(( $# )) || set -- "$HOME/Projects/quicktricks-backend" "$HOME/Projects/quicktricks-admin"
for r in "$@"; do
  hooks="$(git -C "$r" rev-parse --path-format=absolute --git-common-dir)/hooks"
  if [[ -e "$hooks/pre-push" && ! -L "$hooks/pre-push" ]]; then
    echo "$r: an unrelated pre-push hook exists at $hooks/pre-push; not replacing it" >&2
    exit 1
  fi
  ln -sfn "$guard" "$hooks/pre-push"
  echo "$r: pre-push -> $guard"
done
