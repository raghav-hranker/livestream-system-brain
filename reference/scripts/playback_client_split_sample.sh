#!/usr/bin/env bash
# Run ON webserver2-2 (as root: apache logs are root:adm 750). Samples web-server access logs for N seconds (default 120) and splits
# playback-URL requests by client: browser (website) vs native app. Prints counts only.
# Per-file counts are shown because the box serves several backends with the same
# routes; only the quicktricks backend's log matters.
set -euo pipefail
SECS="${1:-120}"
shopt -s nullglob
FILES=(/var/log/apache2/*access*.log /var/log/nginx/*access*.log)
[ ${#FILES[@]} -gt 0 ] || { echo "no readable access logs under /var/log/apache2 or /var/log/nginx (need root?)"; exit 1; }

declare -A START
for f in "${FILES[@]}"; do START[$f]=$(wc -l < "$f" 2>/dev/null || echo 0); done
echo "sampling $SECS s from $(date '+%Y-%m-%d %H:%M:%S %Z')"
sleep "$SECS"

for f in "${FILES[@]}"; do
  lines=$(tail -n +"$(( ${START[$f]} + 1 ))" "$f" 2>/dev/null | grep -E '/api/classes/[0-9a-f]{24}/playback' || true)
  [ -n "$lines" ] || continue
  total=$(printf '%s\n' "$lines" | wc -l)
  echo
  echo "$f: $total playback requests ($(( total * 60 / SECS ))/min)"
  printf '%s\n' "$lines" | awk -F'"' '{ ua = $6
    if (ua ~ /okhttp|Dart\/|CFNetwork|Darwin|Expo|ReactNative/) c = "app (native http client)"
    else if (ua ~ /; wv\)/) c = "app (android webview)"
    else if (ua ~ /Mozilla/) c = "browser (website)"
    else c = "other: " substr(ua, 1, 40)
    n[c]++ } END { for (c in n) printf "  %6d  %s\n", n[c], c }' | sort -rn
done
