#!/usr/bin/env bash
# pre-push hook for the quicktricks fork repos (quicktricks-backend, quicktricks-admin).
# Refuses a push to a quicktricks-* branch when it carries Vidyagram work: either the
# local branch is a Vidyagram branch, or a pushed commit exists only on Vidyagram lines
# (reachable from vidyagram-* / vg-* refs, not from any published quicktricks-* ref).
# Escape hatch for a deliberate cross-tenant push: TENANT_PUSH_OK=1 git push ...
# Install: reference/scripts/install-tenant-push-guard.sh
set -euo pipefail

[[ "${TENANT_PUSH_OK:-}" == 1 ]] && exit 0

remote="$1"
zero=0000000000000000000000000000000000000000

vg_refs=$(git for-each-ref --format='%(refname)' refs/heads refs/remotes |
  grep -E '(^|/)(vidyagram-[^/]*|vg-[^/]*)$' || true)
qt_published=$(git for-each-ref --format='%(refname)' refs/remotes |
  grep -E '/quicktricks-[^/]*$' || true)

status=0
while read -r local_ref local_sha remote_ref remote_sha; do
  [[ "$local_sha" == "$zero" ]] && continue
  [[ "$remote_ref" =~ ^refs/heads/quicktricks- ]] || continue
  target="$remote/${remote_ref#refs/heads/}"

  if [[ "$local_ref" =~ (^|/)(vidyagram-|vg-) ]]; then
    echo "tenant-push-guard: refusing to push Vidyagram branch ${local_ref#refs/heads/} to $target." >&2
    status=1
    continue
  fi

  [[ -z "$vg_refs" ]] && continue
  known_remote=""
  if [[ "$remote_sha" != "$zero" ]] && git cat-file -e "$remote_sha" 2>/dev/null; then known_remote=$remote_sha; fi
  # shellcheck disable=SC2086
  outgoing=$(git rev-list "$local_sha" --not $qt_published $known_remote)
  [[ -z "$outgoing" ]] && continue
  # shellcheck disable=SC2086
  vg_only=$(git rev-list $vg_refs --not $qt_published)
  hits=$(comm -12 <(sort <<<"$outgoing") <(sort <<<"$vg_only"))
  if [[ -n "$hits" ]]; then
    echo "tenant-push-guard: refusing to push to $target. These commits exist only on Vidyagram lines:" >&2
    head -n 5 <<<"$hits" | xargs -n1 git log -1 --format='  %h %s' >&2
    (( $(wc -l <<<"$hits") > 5 )) && echo "  ... and $(( $(wc -l <<<"$hits") - 5 )) more" >&2
    status=1
  fi
done

if (( status )); then
  echo "Vidyagram work never ships to quicktricks (TENANTS.md). Deliberate? TENANT_PUSH_OK=1 git push ..." >&2
fi
exit "$status"
