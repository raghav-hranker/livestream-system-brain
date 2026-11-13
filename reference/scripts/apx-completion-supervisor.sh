#!/usr/bin/env bash
# Run one completion worker per checkout/role. After the OTP safety stop,
# recover only when a delayed one-user probe can mint successfully again.
# Required: FLEET_WORKTREE, ENV_PATH, FLEET_LOG, FLEET_ROLE (prewarm/import).
set -uo pipefail
: "${FLEET_WORKTREE:?}" "${ENV_PATH:?}" "${FLEET_LOG:?}" "${FLEET_ROLE:?}"
cd "$FLEET_WORKTREE" || exit 1
exec 9>".apx-completion-${FLEET_ROLE}.lock"
flock -n 9 || exit 0
export DOTENV_CONFIG_PATH="$ENV_PATH" NODE_ENV=development
run_log=$(mktemp)
trap 'rm -f "$run_log"' EXIT
auth_backoff_initial=${FLEET_AUTH_BACKOFF_SECONDS:-3600}
auth_backoff_seconds=$auth_backoff_initial
auth_backoff_max=${FLEET_AUTH_BACKOFF_MAX_SECONDS:-21600}
case "$FLEET_ROLE" in
  prewarm)
    script=src/scripts/apxPaidCompletionTokenPrewarm.ts
    args=(--send-real-otp --all --pause-ms=60000 "$@")
    ;;
  import)
    script=src/scripts/apxManualCompletionMigration.ts
    args=(--all --commit --delay-ms=500 --from-token-id=6abb9a8cc27ac1b3e94a024e "$@")
    ;;
  *) exit 2 ;;
esac
while true; do
  node -r dotenv/config node_modules/ts-node/dist/bin.js "$script" "${args[@]}" 2>&1 | tee "$run_log" >> "$FLEET_LOG"
  status=${PIPESTATUS[0]}
  cp "$run_log" "${FLEET_LOG}.last-run"
  if [[ "$FLEET_ROLE" == import && ( "$status" == 0 || "$status" == 2 ) ]]; then
    sleep "${FLEET_IMPORT_INTERVAL_SECONDS:-1200}"
    continue
  fi
  if [[ "$FLEET_ROLE" == import && "$status" == 3 ]] && grep -q '"event":"source-access-denied"' "$run_log"; then
    printf '{"event":"supervisor-source-backoff","seconds":%s,"at":"%s"}\n' \
      "${FLEET_IMPORT_ACCESS_BACKOFF_SECONDS:-3600}" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$FLEET_LOG"
    sleep "${FLEET_IMPORT_ACCESS_BACKOFF_SECONDS:-3600}"
    continue
  fi
  if [[ "$FLEET_ROLE" == prewarm && "$status" == 2 ]] && grep -q '"reason":"five-consecutive-token-failures"' "$run_log"; then
    while true; do
      printf '{"event":"supervisor-otp-backoff","seconds":%s,"at":"%s"}\n' \
        "$auth_backoff_seconds" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$FLEET_LOG"
      sleep "$auth_backoff_seconds"
      timeout --signal=TERM --kill-after=30s 30m \
        node -r dotenv/config node_modules/ts-node/dist/bin.js "$script" \
          --send-real-otp --max-otp=1 --pause-ms=1000 "$@" 2>&1 | tee "$run_log" >> "$FLEET_LOG"
      probe_status=${PIPESTATUS[0]}
      cp "$run_log" "${FLEET_LOG}.last-run"
      if [[ "$probe_status" == 0 ]] && grep -Eq '"event":"summary".*"minted":1([,}])' "$run_log"; then
        printf '{"event":"supervisor-otp-recovered","at":"%s"}\n' \
          "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$FLEET_LOG"
        auth_backoff_seconds=$auth_backoff_initial
        break
      fi
      if [[ "$probe_status" == 0 ]] && grep -Eq '"event":"summary".*"attempted":0([,}])' "$run_log"; then
        printf '{"event":"supervisor-finished","at":"%s"}\n' \
          "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$FLEET_LOG"
        exit 0
      fi
      auth_backoff_seconds=$((auth_backoff_seconds * 2))
      if (( auth_backoff_seconds > auth_backoff_max )); then auth_backoff_seconds=$auth_backoff_max; fi
    done
    continue
  fi
  if [[ "$status" != 0 ]] && grep -Eq 'ECONNREFUSED|ECONNRESET|ETIMEDOUT|MongoServerSelectionError|MongoNetworkError|ReplicaSetNoPrimary|connection.*closed' "$run_log"; then
    printf '{"event":"supervisor-db-retry","exitCode":%s,"at":"%s"}\n' "$status" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$FLEET_LOG"
    sleep "${FLEET_RETRY_SECONDS:-120}"
    continue
  fi
  printf '{"event":"supervisor-stopped","exitCode":%s,"at":"%s"}\n' "$status" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$FLEET_LOG"
  exit "$status"
done
