#!/bin/zsh
# Local manual-test bed for global search classes (tasks 01–03). Starts two servers on ONE
# throwaway Mongo (docker `qt-autoext-mongo`, 127.0.0.1:27027, db qt_gsearch_test) + local Redis:
#   3110  ENFORCE_ORDER_EXPIRY unset (expired orders still count — prod default)
#   3111  ENFORCE_ORDER_EXPIRY=true  (expired orders count as not bought)
#
#   ./run-servers.sh          (re)start both (logs in $LOG_DIR/server-<port>.log)
#   ./run-servers.sh stop     kill both
#
# Always re-seed first, then (re)start: the class-title spelling vocabulary is cached for 5 min.
# The worktree's .env.development points MONGO_URI at the docker Mongo — NEVER at rs0 — and carries
# local-only secrets; the collection signs its JWTs with that local JWT_SECRET.

set -u
HERE=${0:A:h}
WT=${QT_GSEARCH_WORKTREE:-/Users/raghav/Projects/worktrees/qt-gsearch-local-test}
LOG_DIR=${LOG_DIR:-/tmp/qt-gsearch-logs}
PORTS=(3110 3111)

stop() {
  for p in $PORTS; do
    pid=$(lsof -tiTCP:$p -sTCP:LISTEN 2>/dev/null) && kill $pid && echo "stopped $p ($pid)"
  done
}
if [[ ${1:-} == stop ]]; then stop; exit 0; fi

grep -q '^MONGO_URI=mongodb://127.0.0.1:27027/qt_gsearch_test' $WT/.env.development || {
  echo "refusing: $WT/.env.development MONGO_URI is not the local qt_gsearch_test Mongo" >&2; exit 1; }

stop; sleep 1
mkdir -p $LOG_DIR
start() { # port, env assignments...
  local port=$1; shift
  (cd $WT && env PORT=$port "$@" node -r ts-node/register/transpile-only src/app.ts \
      > $LOG_DIR/server-$port.log 2>&1 &)
  echo "starting $port → $LOG_DIR/server-$port.log"
}
start 3110 ENFORCE_ORDER_EXPIRY=
start 3111 ENFORCE_ORDER_EXPIRY=true

for p in $PORTS; do
  for i in {1..60}; do
    curl -sf -o /dev/null http://localhost:$p/api/search/collections && { echo "$p up"; break; }
    sleep 1
  done
done
