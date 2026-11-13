#!/bin/bash
# Cron on webserver2-2 (user hranker) at :15 and :45, after the phonetics capture at :00 and :30: imports VG saved questions
# captured since the last batch, as batch vg-saved-auto-<UTC minute>. Writes nothing when nothing is new; refuses (exit 2)
# more than 5000 rows at once. Stop: crontab -e and remove the line. Remove the line before any --undo of an auto batch,
# or rows the student still has saved on AppX come back on the next run.
set -u
D=/home/hranker/vidyagram-saved-questions
exec 9>"$D/import-auto.lock"
flock -n 9 || exit 0
VG_APP_ROOT=/var/www/backend.vidyagramar.com/vidyagram-backend timeout 20m /home/hranker/.nvm/versions/node/v22.22.2/bin/node \
  "$D/vidyagram-saved-questions-import.cjs" --auto >>"$D/import-auto.log" 2>&1
status=$?
[ "$status" -eq 0 ] || echo "$(date -u +%FT%TZ) FAILED exit=$status" >>"$D/import-auto.log"
