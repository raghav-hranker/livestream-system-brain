#!/bin/zsh
# ONE server (port 3110, switch ON) on the PRODUCTION replica set, read-only by construction:
#   - readonly-guard.cjs makes every Mongo write / index build in the process fail
#   - rzp-stub.cjs keeps Razorpay local; crons stay off (worktree .env.development)
#   - reads go to secondaries (readPreference=secondary)
# Use it for LISTING requests only. Checkout requests will (correctly) fail with a 500.
#
#   ./run-prod-readonly.sh          start (log: $LOG_DIR/server-3110.log)
#   ./run-prod-readonly.sh stop
#   WINDOW=30 ./run-prod-readonly.sh   (open the Extension window, task 12; default 0 = as prod today)
#   PROD_READONLY_URI_FILE=~/.qt-readonly-mongo.env ./run-prod-readonly.sh   (a file with MONGO_URI_READONLY=… instead)

set -u
HERE=${0:A:h}
WT=${QT_AUTOEXT_WORKTREE:-/Users/raghav/Projects/worktrees/qt-autoext-local-test}
LOG_DIR=${LOG_DIR:-/tmp/qt-autoext-logs}
PORT=3110

if [[ ${1:-} == stop ]]; then
  pid=$(lsof -tiTCP:$PORT -sTCP:LISTEN 2>/dev/null) && kill $pid && echo "stopped $PORT ($pid)"
  exit 0
fi

if [[ -n ${PROD_READONLY_URI_FILE:-} ]]; then
  URI=$(grep '^MONGO_URI_READONLY=' $PROD_READONLY_URI_FILE | cut -d= -f2-)
else
  URI=$(grep '^MONGO_URI=' /Users/raghav/Projects/quicktricks-backend/.env.development | cut -d= -f2-)
fi
[[ -n $URI ]] || { echo "no prod URI found" >&2; exit 1; }
URI=${URI//readPreference=secondaryPreferred/readPreference=secondary}
[[ $URI == *readPreference=secondary* ]] || URI="$URI&readPreference=secondary"

mkdir -p $LOG_DIR
(
  cd $WT
  export MONGO_URI=$URI PORT=$PORT LAPSED_EXTENSION_ENABLED=true DISABLE_CRONS=true LAPSED_EXTENSION_WINDOW_DAYS=${WINDOW:-0}
  node -r $HERE/readonly-guard.cjs -r $HERE/rzp-stub.cjs -r ts-node/register/transpile-only src/app.ts \
    > $LOG_DIR/server-$PORT.log 2>&1 &
)
echo "starting $PORT (PROD, read-only guard, window ${WINDOW:-0}d) → $LOG_DIR/server-$PORT.log"
