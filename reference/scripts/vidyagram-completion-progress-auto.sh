#!/bin/bash
# Cron on Azure migrator, every 30 minutes: imports ClassProgress markers for VG completion captures since the last batch.
# Stop: crontab -e on migrator and remove the line. Remove the line before any --undo, or the next run re-adds that batch.
set -u
D=/home/azureuser/vidyagram-completion-azure-20261103
exec 9>"$D/progress-auto.lock"
flock -n 9 || exit 0
{
  printf '%s ' "$(date -u +%FT%TZ)"
  VG_APP_ROOT=$D/runtime VG_ENV_PATH=$D/.env.development timeout 20m "$D/runtime/node/bin/node" \
    "$D/vidyagram-completion-progress-import.cjs" --all --new-only --commit --batch "vg-progress-auto-$(date -u +%Y%m%d%H%M)" 2>&1
  status=$?
  [ "$status" -eq 0 ] || echo "FAILED exit=$status"
} >>"$D/progress-auto.log"
