#!/usr/bin/env bash
# Vidyagram: keep course prices and length plans in step with AppX after each nightly capture (user, 2026-11-09).
# Runs on GCP test-uday from vidyagram-appx-prices.service, which waits on the nightly's host lock, so it starts once the
# nightly has finished. Skips (exit 0) unless the newest nightly finished its capture and this step has not run for it.
#   1. vidyagram-appx-length-plans.cjs --commit  courses on course selling / sold at several lengths (deployed backend code
#      in /home/raghav/vidyagram-selling-runtime, from git archive of origin/vidyagram-admin, see REVISION there)
#   2. vidyagram-appx-price-sync.cjs --commit     everything else, from the fresh mirror (LIVE=0, no AppX session needed)
# Each script writes its own backup in /home/raghav when it changes anything. Logs: /home/raghav/vidyagram-nightly/logs/prices-*.log
set -euo pipefail
umask 077
export PATH=/home/raghav/.nvm/versions/node/v24.14.0/bin:$PATH
export NODE_ENV=development
RT=/home/raghav/vidyagram-selling-runtime
STATE=/home/raghav/vidyagram-nightly
mkdir -p "$STATE/logs"
LOG="$STATE/logs/prices-$(TZ=Asia/Kolkata date +%F)-$(date -u +%H%M%S).log"
exec >> "$LOG" 2>&1
trap 'rc=$?; printf "=== exit %s %s\n" "$rc" "$(date -u +%FT%TZ)"' EXIT
cd "$RT"
printf '=== start %s runtime %s\n' "$(date -u +%FT%TZ)" "$(cat REVISION)"
set +e
RUN="$(node vidyagram-appx-prices-precheck.cjs)"; rc=$?
set -e
if [ "$rc" -eq 3 ]; then echo "$RUN"; exit 0; fi
[ "$rc" -eq 0 ] || exit "$rc"
echo "=== nightly run $RUN: length plans"
APP_ROOT=. MAX_AGE_H=30 node vidyagram-appx-length-plans.cjs --commit 2>&1 | grep -v 'MONGOOSE\] Warning\|trace-warnings'
echo "=== nightly run $RUN: price sync"
LIVE=0 MAX_AGE_H=30 node vidyagram-appx-price-sync.cjs --commit
printf '%s\n' "$RUN" > "$STATE/prices-last-run"
