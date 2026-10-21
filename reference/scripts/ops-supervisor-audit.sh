#!/usr/bin/env bash
# Read-only audit of "who restarts what" on the boxes the phone ops console will watch.
# Step 1 of docs/plans/ops-console.md. Prints, per box: Redis/Mongo/Apache units and their
# systemd Restart= policy, running redis-server processes, whether pm2 has a boot unit, and
# every quicktricks/vidyagram pm2 app's exec mode, max_memory_restart and restart counts.
# Never prints env values: only the NAMES of REDIS_* keys found in the checkout's .env files.
#
#   bash reference/scripts/ops-supervisor-audit.sh            # both boxes
#   bash reference/scripts/ops-supervisor-audit.sh webserver  # one box
#   bash reference/scripts/ops-supervisor-audit.sh encoder
set -uo pipefail

REMOTE='
set -uo pipefail
echo "=== $(hostname)  $(TZ=Asia/Kolkata date "+%F %T") IST"
echo "--- service units (redis|mongo|apache|nginx)"
systemctl list-units --type=service --all --no-legend 2>/dev/null | grep -i -E "redis|mongo|apache|nginx" || echo "none"
echo "--- systemd Restart= policy per redis unit"
for u in $(systemctl list-unit-files --type=service --no-legend 2>/dev/null | awk "/redis/{print \$1}"); do
  printf "%s: Restart=%s RestartSec=%s Enabled=%s\n" "$u" "$(systemctl show "$u" -p Restart --value)" "$(systemctl show "$u" -p RestartUSec --value)" "$(systemctl is-enabled "$u" 2>/dev/null)"
done
echo "--- redis-server processes, who started them, and the cgroup they live in"
pgrep -a redis-server || echo "none running"
for pid in $(pgrep redis-server); do
  ps -o pid=,ppid=,user=,etimes=,cmd= -p "$pid"
  ppid=$(ps -o ppid= -p "$pid" | tr -d " "); echo "  parent: $(ps -o pid=,user=,cmd= -p "$ppid")"
  echo "  cgroup: $(cut -d: -f3 /proc/$pid/cgroup | head -1)"
  echo "  config: $(tr "\0" " " < /proc/$pid/cmdline)"
done
echo "--- redis in crontab / rc.local / docker"
crontab -l 2>/dev/null | grep -i redis || echo "not in $(whoami) crontab"
grep -il redis /etc/rc.local /etc/cron.d/* 2>/dev/null || echo "not in rc.local or cron.d"
docker ps --format "{{.Names}} {{.Image}}" 2>/dev/null | grep -i redis || echo "no redis container"
echo "--- pm2 boot unit"
systemctl list-unit-files --type=service --no-legend 2>/dev/null | grep -i pm2 || echo "no pm2 systemd unit (pm2 will not come back after a reboot)"
echo "--- pm2 apps: mode, max_memory_restart, autorestart, restarts, unstable"
for b in ~/.nvm/versions/node/*/bin; do [ -x "$b/pm2" ] && export PATH="$b:$PATH"; done
command -v pm2 >/dev/null || echo "pm2 not found under ~/.nvm"
pm2 jlist 2>/dev/null | sed -n "/^\[/,\$p" | node -e "
const a=JSON.parse(require(\"fs\").readFileSync(0,\"utf8\"));
for (const p of a) {
  const e=p.pm2_env;
  console.log(String(p.pm_id).padStart(3), p.name.padEnd(28), \"mode=\"+e.exec_mode, \"max_memory_restart=\"+(e.max_memory_restart||\"none\"), \"autorestart=\"+e.autorestart, \"restarts=\"+e.restart_time, \"unstable=\"+e.unstable_restarts, \"status=\"+e.status);
}" || echo "pm2 jlist did not return JSON"
echo "--- REDIS_* key names in checkout .env files (names only)"
for d in /var/www/backend.quicktricksbysahilsir.com/quicktricks-backend ~/quicktricks-livestream ~/livestream; do
  [ -d "$d" ] || continue
  for f in "$d"/.env*; do [ -f "$f" ] || continue; printf "%s: " "$f"; grep -o "^REDIS_[A-Z_]*" "$f" | sort -u | tr "\n" " "; echo; done
done
echo "=== end"
'

want="${1:-all}"
if [ "$want" = all ] || [ "$want" = webserver ]; then
  ssh -i ~/.ssh/hranker-webserver2-2 -o ConnectTimeout=15 -o BatchMode=yes hranker@148.113.49.18 "bash -s" <<<"$REMOTE"
fi
if [ "$want" = all ] || [ "$want" = encoder ]; then
  gcloud compute ssh --zone asia-south2-c livestream-testing-raghav --project genial-analogy-477417-r7 --command "bash -s" <<<"$REMOTE"
fi
