#!/usr/bin/env bash
# Dedicated daily runner on GCP test-uday; the service adds a host flock,
# and the CLI acquires the shared Vidyagram distributed lock.
set -euo pipefail
umask 077
export PATH=/home/raghav/.nvm/versions/node/v24.14.0/bin:$PATH
export NODE_ENV=development
APP=/home/raghav/vidyagram-nightly-20261019
STATE=/home/raghav/vidyagram-nightly
mkdir -p "$STATE/logs"
LOG="$STATE/logs/$(TZ=Asia/Kolkata date +%F)-$(date -u +%H%M%S).log"
exec >> "$LOG" 2>&1
trap 'rc=$?; printf "=== exit %s %s\n" "$rc" "$(date -u +%FT%TZ)"' EXIT
cd "$APP"
printf '=== start %s revision %s\n' "$(date -u +%FT%TZ)" "$(cat REVISION)"
# Stop before any catalogue writes when either upstream API is inaccessible.
node preflight.cjs
export REVISION="$(cat REVISION)"
node --max-old-space-size=1536 --require ts-node/register/transpile-only \
  src/scripts/vidyagramNightlySync.ts --out-dir "$STATE/logs" "$@"
