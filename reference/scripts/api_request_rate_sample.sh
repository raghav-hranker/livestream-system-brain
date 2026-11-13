#!/usr/bin/env bash
# Run ON webserver2-2. Samples the live quicktricks-backend request log for N seconds
# (default 120) and prints counts only. Never prints log lines: bodies there can hold
# passwords and tokens.
set -euo pipefail
SECS="${1:-120}"
# pm2 jlist prefixes a ">>>> In-memory PM2 is out-of-date" banner when the daemon
# and CLI versions differ, so parse from the first "[".
LOG=$(pm2 jlist 2>/dev/null | node -e '
  const raw = require("fs").readFileSync(0, "utf8");
  const a = JSON.parse(raw.slice(raw.indexOf("[")));
  const p = a.find(x => x.name === "quicktricks-backend");
  if (!p) { console.error("quicktricks-backend not in pm2"); process.exit(1); }
  console.log(p.pm2_env.pm_out_log_path);')
SAMPLE=$(mktemp)
trap 'rm -f "$SAMPLE"' EXIT

START=$(wc -l < "$LOG")
echo "sampling $SECS s from $(date '+%Y-%m-%d %H:%M:%S %Z')"
sleep "$SECS"
tail -n +"$((START + 1))" "$LOG" > "$SAMPLE"

HTTP=$(grep -c '→ [0-9][0-9][0-9] (' "$SAMPLE" || true)
PLAYBACK=$(grep -E '/api/classes/[0-9a-f]{24}/playback' "$SAMPLE" | grep -c '→ [0-9][0-9][0-9] (' || true)
echo "api requests:        $HTTP  ($(( HTTP * 60 / SECS ))/min)"
echo "playback mints:      $PLAYBACK  ($(( PLAYBACK * 60 / SECS ))/min)"
echo "distinct classes played: $(grep '→ [0-9][0-9][0-9] (' "$SAMPLE" | grep -oE '/api/classes/[0-9a-f]{24}/playback' | sort -u | wc -l)"
echo "top routes (ids collapsed):"
grep -oE 'https?://[^ ]+ → [0-9]{3}' "$SAMPLE" \
  | sed -E 's#https?://[^/]+##; s#\?[^ ]*##; s#/[0-9a-f]{24}#/:id#g; s# → [0-9]{3}##' \
  | sort | uniq -c | sort -rn | head -15
