#!/usr/bin/env bash
# Start an isolated, lock-protected VG pilot role. No app service is restarted.
set -euo pipefail
role=${1:?worker role required: both, acquire, read, sheet, mapper}
dir=$(cd "$(dirname "$0")" && pwd)
case "$(hostname)" in
 test-uday)
  echo 'VG completion disabled on test-uday at user request' >&2
  exit 1
  ;;
 migrator|migrator2|migrator3|migrator4|migrator5|migrator6|migrator7|migrator8|migrator9|migrator10|migrator11|migrator12)
  export VG_APP_ROOT=$dir/runtime
  export VG_ENV_PATH=$dir/.env.development
  nodebin=$dir/runtime/node/bin/node
  ;;
 phonetics)
  export VG_APP_ROOT=/home/raghav/nodejs-server
  export VG_ENV_PATH=$dir/.env.development
  nodebin=/usr/bin/node
  ;;
 testing-server-selectionway)
  export VG_APP_ROOT=/home/raghav/arvidyagram-backend
  export VG_ENV_PATH=$dir/.env.development
  nodebin=/home/raghav/.nvm/versions/node/v24.12.0/bin/node
  ;;
 instance-20260216-1825)
  export VG_APP_ROOT=/home/opc/vidyagram/pdf
  export VG_ENV_PATH=$dir/.env.development
  export GOOGLE_KEY=/home/opc/vidyagram/sheets-sa.json
  nodebin=/home/opc/.nvm/versions/node/v24.13.1/bin/node
  ;;
 ubuntu)
  export VG_APP_ROOT=/home/livestreaming/nodejs-server
  export VG_ENV_PATH=$dir/.env.development
  nodebin=/home/livestreaming/.nvm/versions/node/v20.19.6/bin/node
  ;;
 Ubuntu-2404-noble-amd64-base)
  export VG_APP_ROOT=/root/video-transcoder/gpu-server/job-manager
  export VG_ENV_PATH=$dir/.env.development
  nodebin=/root/.nvm/versions/node/v24.20.0/bin/node
  ;;
 *) echo 'Unrecognised VG pilot host' >&2; exit 1 ;;
esac
if [[ $(hostname) == phonetics || $(hostname) == testing-server-selectionway ]]; then
 export VG_EGRESS_ID
 VG_EGRESS_ID=$(curl -fsS --connect-timeout 3 --max-time 5 -H 'Metadata-Flavor: Google' http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/access-configs/0/external-ip)
elif [[ $(hostname) == Ubuntu-2404-noble-amd64-base ]]; then
 export VG_EGRESS_ID=178.63.88.34
elif [[ $(hostname) == instance-20260216-1825 ]]; then
 export VG_EGRESS_ID=92.4.88.60
elif [[ $(hostname) == ubuntu ]]; then
 export VG_EGRESS_ID=148.113.35.99
elif [[ $(hostname) == migrator ]]; then
 export VG_EGRESS_ID=20.193.151.140
elif [[ $(hostname) == migrator2 ]]; then
 export VG_EGRESS_ID=20.193.132.31
elif [[ $(hostname) == migrator3 ]]; then
 export VG_EGRESS_ID=20.193.139.89
elif [[ $(hostname) == migrator4 ]]; then
 export VG_EGRESS_ID=20.193.253.251
elif [[ $(hostname) == migrator5 ]]; then
 export VG_EGRESS_ID=4.240.100.64
elif [[ $(hostname) == migrator6 ]]; then
 export VG_EGRESS_ID=40.81.225.65
elif [[ $(hostname) == migrator7 ]]; then
 export VG_EGRESS_ID=20.193.138.160
elif [[ $(hostname) == migrator8 ]]; then
 export VG_EGRESS_ID=20.40.44.181
elif [[ $(hostname) == migrator9 ]]; then
 export VG_EGRESS_ID=4.240.96.214
elif [[ $(hostname) == migrator10 ]]; then
 export VG_EGRESS_ID=4.240.103.74
elif [[ $(hostname) == migrator11 ]]; then
 export VG_EGRESS_ID=20.193.154.220
elif [[ $(hostname) == migrator12 ]]; then
 export VG_EGRESS_ID=57.159.31.41
fi
export VG_LEARNER_GAP_MS=${VG_LEARNER_GAP_MS:-60000}
export VG_REQUEST_GAP_MS=${VG_REQUEST_GAP_MS:-1500}
export VG_ADMIN_GAP_MS=${VG_ADMIN_GAP_MS:-2000}
export VG_REQUEST_JITTER_MS=${VG_REQUEST_JITTER_MS:-250}
case "$role" in
 both|acquire|read) args=("$dir/vidyagram-completion-pilot.cjs" worker "$role") ;;
 sheet) args=("$dir/vidyagram-completion-sheet.cjs") ;;
 overnight-seed) args=("$dir/vidyagram-completion-pilot.cjs" seed) ;;
 overnight-acquire|overnight-read|overnight-sheet) args=("$dir/vidyagram-completion-overnight.cjs" "${role#overnight-}") ;;
 mapper) args=("$dir/vidyagram-completion-pilot.cjs" mapper) ;;
 *) echo 'Invalid role' >&2; exit 1 ;;
esac
umask 077
nohup flock -n "$dir/$role.lock" "$nodebin" "${args[@]}" >> "$dir/$role.jsonl" 2>&1 < /dev/null &
printf 'VG %s launcher PID %s\n' "$role" "$!"
