#!/usr/bin/env bash
# Undo one change row of the Vidyagram admin history (vidyagramdb `auditlogs`, admin-audit-trail task 16).
# Thin wrapper: runs the backend's src/scripts/audit-undo.ts on webserver2-2 from the Vidyagram checkout, so the
# restore is itself recorded as `script:audit-undo`. Preview by default; writes only with --commit.
#
#   reference/scripts/vidyagram-audit-undo.sh --row <changeRowId> [--commit] [--force]
#
# Find the row first with vidyagram-audit-lookup.js (--collection/--id or --deletes). --force overrides only the
# "record changed since this row" refusal, and the restore's own row then says --force. Bulk, insert, job-summary
# and truncated rows are always refused. Blanked secrets (<redacted>, <jwt>) are skipped with a warning.
# The backend script refuses any database but vidyagramdb before connecting. Needs the audit-trail deploy (task 18):
# it runs dist/src/scripts/audit-undo.js when the build has it, else the source through the checkout's ts-node.
set -euo pipefail

HOST="hranker@148.113.49.18"
KEY="$HOME/.ssh/hranker-webserver2-2"
CHECKOUT="/var/www/backend.vidyagramar.com/vidyagram-backend"
NODE_BIN="/home/hranker/.nvm/versions/node/v22.22.2/bin"

usage() { echo "usage: $0 --row <changeRowId> [--commit] [--force]" >&2; exit 2; }

row="" ; flags=()
while [ $# -gt 0 ]; do
  case "$1" in
    --row) [ $# -ge 2 ] || usage; row="$2"; shift 2 ;;
    --commit|--force) flags+=("$1"); shift ;;
    *) usage ;;
  esac
done
# A 24-hex ObjectId only: it goes into a remote shell command.
[[ "$row" =~ ^[0-9a-f]{24}$ ]] || usage

remote="export PATH=$NODE_BIN:\$PATH; cd $CHECKOUT && export DOTENV_CONFIG_PATH=.env.development;
if [ -f dist/src/scripts/audit-undo.js ]; then node dist/src/scripts/audit-undo.js --row $row ${flags[*]-};
else node_modules/.bin/ts-node --transpile-only src/scripts/audit-undo.ts --row $row ${flags[*]-}; fi"

exec ssh -i "$KEY" "$HOST" "$remote"
