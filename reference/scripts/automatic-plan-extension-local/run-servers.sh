#!/bin/zsh
# Local manual-test bed for automatic plan extension (tasks 01–03, 12). Starts four servers on ONE
# throwaway Mongo (docker `qt-autoext-mongo`, 127.0.0.1:27027) so the Postman collection can
# compare switch states side by side:
#   3106  LAPSED_EXTENSION_ENABLED=true                      (defaults 50% / 183d)
#   3107  LAPSED_EXTENSION_ENABLED unset-equivalent (empty)  (switch off)
#   3108  LAPSED_EXTENSION_ENABLED=true, PERCENT=30, DAYS=90 (custom config)
#   3109  LAPSED_EXTENSION_ENABLED=true, WINDOW_DAYS=30      (Extension window, task 12 — needs a tip
#         that has task 12; on an older tip it behaves exactly like 3106 and folder 5 fails)
# Razorpay is replaced in-process by rzp-stub.cjs — nothing leaves the machine.
#
#   ./run-servers.sh          start (logs in $LOG_DIR/server-<port>.log)
#   ./run-servers.sh stop     kill the four
#
# The worktree's .env.development points MONGO_URI at the docker Mongo — NEVER at rs0.

set -u
HERE=${0:A:h}
WT=${QT_AUTOEXT_WORKTREE:-/Users/raghav/Projects/worktrees/qt-autoext-local-test}
LOG_DIR=${LOG_DIR:-/tmp/qt-autoext-logs}
PORTS=(3106 3107 3108 3109)

if [[ ${1:-} == stop ]]; then
  for p in $PORTS; do
    pid=$(lsof -tiTCP:$p -sTCP:LISTEN 2>/dev/null) && kill $pid && echo "stopped $p ($pid)"
  done
  exit 0
fi

grep -q '^MONGO_URI=mongodb://127.0.0.1:27027/' $WT/.env.development || {
  echo "refusing: $WT/.env.development MONGO_URI is not the local docker Mongo" >&2; exit 1; }

mkdir -p $LOG_DIR
start() { # port, env assignments...
  local port=$1; shift
  (cd $WT && env PORT=$port "$@" node -r $HERE/rzp-stub.cjs -r ts-node/register/transpile-only src/app.ts \
      > $LOG_DIR/server-$port.log 2>&1 &)
  echo "starting $port → $LOG_DIR/server-$port.log"
}
start 3106 LAPSED_EXTENSION_ENABLED=true
start 3107 LAPSED_EXTENSION_ENABLED=
start 3108 LAPSED_EXTENSION_ENABLED=true LAPSED_EXTENSION_PERCENT=30 LAPSED_EXTENSION_DAYS=90
start 3109 LAPSED_EXTENSION_ENABLED=true LAPSED_EXTENSION_WINDOW_DAYS=30
