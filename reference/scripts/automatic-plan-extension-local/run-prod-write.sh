#!/bin/zsh
# ONE server (port 3111) running the LOCAL tip against the PRODUCTION replica set WITH WRITES.
# Asked for by the user 2026-09-25 to test the course flags / Extension window before deploy.
#   - writes are REAL (no readonly-guard) — only call it with test accounts
#   - crons OFF (DISABLE_CRONS=true): the box already runs them
#   - Razorpay stubbed in-process (rzp-stub.cjs): checkout writes an `initiated` order, no real link/money
#   - WINDOW (default 30) = LAPSED_EXTENSION_WINDOW_DAYS
#
#   ./run-prod-write.sh          start (log: $LOG_DIR/server-3111.log)
#   ./run-prod-write.sh stop

set -u
HERE=${0:A:h}
WT=${QT_AUTOEXT_WORKTREE:-/Users/raghav/Projects/worktrees/qt-autoext-local-test}
LOG_DIR=${LOG_DIR:-/tmp/qt-autoext-logs}
PORT=3111

if [[ ${1:-} == stop ]]; then
  pid=$(lsof -tiTCP:$PORT -sTCP:LISTEN 2>/dev/null) && kill $pid && echo "stopped $PORT ($pid)"
  exit 0
fi

URI=$(grep '^MONGO_URI=' /Users/raghav/Projects/quicktricks-backend/.env.development | cut -d= -f2-)
[[ -n $URI ]] || { echo "no prod URI found" >&2; exit 1; }

mkdir -p $LOG_DIR
(
  cd $WT
  export MONGO_URI=$URI PORT=$PORT LAPSED_EXTENSION_ENABLED=true DISABLE_CRONS=true LAPSED_EXTENSION_WINDOW_DAYS=${WINDOW:-30}
  node -r $HERE/rzp-stub.cjs -r ts-node/register/transpile-only src/app.ts > $LOG_DIR/server-$PORT.log 2>&1 &
)
echo "starting $PORT (PROD, WRITES ON, crons off, Razorpay stubbed, window ${WINDOW:-30}d) → $LOG_DIR/server-$PORT.log"
