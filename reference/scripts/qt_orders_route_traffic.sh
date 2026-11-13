#!/usr/bin/env bash
# Read-only: who calls /api/orders on quicktricks prod, from the Apache access logs on webserver2-2.
# Prints aggregate counts only: day, method, route shape (ids collapsed), query KEY names (never values),
# status, Referer host, UA family. No IPs, ids, phones or tokens leave the box.
#
#   reference/scripts/qt_orders_route_traffic.sh            # every kept log file
#   FILES='access.log.5.gz' reference/scripts/qt_orders_route_traffic.sh
#   PREFIX=/api/users reference/scripts/qt_orders_route_traffic.sh   # another router
#   SITE=backend.vidyagramar.com PREFIX=/api/courses reference/scripts/qt_orders_route_traffic.sh   # Vidyagram
set -euo pipefail
KEY=${KEY:-$HOME/.ssh/hranker-webserver2-2}
PREFIX=${PREFIX:-/api/orders}
FILES=${FILES:-'access.log*'}
SITE=${SITE:-backend.quicktricksbysahilsir.com}

ssh -i "$KEY" -o ConnectTimeout=15 hranker@148.113.49.18 \
  "PREFIX='$PREFIX' FILES='$FILES' SITE='$SITE' bash -s" <<'REMOTE'
set -euo pipefail
cd /var/log/apache2
for f in $(ls -1 "$SITE"-$FILES 2>/dev/null | sort -V); do
  nice -n 19 ionice -c3 zcat -f "$f" | grep -F "$PREFIX" || true
done | nice -n 19 awk -F'"' -v prefix="$PREFIX" '
{
  split($2, rq, " "); method = rq[1]; url = rq[2]
  if (index(url, prefix) != 1) next
  split($1, a, "["); day = substr(a[2], 1, 11)
  split($3, st, " "); status = st[1]
  q = ""; p = url
  if ((i = index(url, "?")) > 0) {
    p = substr(url, 1, i - 1); qs = substr(url, i + 1)
    n = split(qs, kv, "&"); keys = ""
    for (j = 1; j <= n; j++) { split(kv[j], k, "="); if (k[1] != "") keys = keys (keys == "" ? "" : ",") k[1] }
    q = "?" keys
  }
  gsub(/\/[0-9a-fA-F]{24}/, "/:id", p)
  gsub(/\/order_[A-Za-z0-9]+/, "/:rzp", p)
  gsub(/\/course\/[^\/]+/, "/course/:courseId", p)
  gsub(/\/by-razorpay\/[^\/]+/, "/by-razorpay/:rzp", p)
  ref = $4; if (ref == "-" || ref == "") ref = "none"; else { sub(/^[a-z]+:\/\//, "", ref); sub(/[\/:?].*$/, "", ref) }
  ua = $6
  if (ua ~ /python-requests/) fam = "python-requests"
  else if (ua ~ /aiohttp/) fam = "aiohttp"
  else if (ua ~ /^Dart/) fam = "Dart(app)"
  else if (ua ~ /okhttp/) fam = "okhttp(app)"
  else if (ua ~ /CFNetwork|Darwin/) fam = "iOS-native"
  else if (ua ~ /^curl/) fam = "curl"
  else if (ua ~ /PostmanRuntime/) fam = "Postman"
  else if (ua ~ /Mozilla/) fam = "browser"
  else if (ua == "-" || ua == "") fam = "none"
  else { fam = ua; sub(/[\/ ].*$/, "", fam); fam = "other:" substr(fam, 1, 20) }
  print day "\t" method "\t" p q "\t" status "\t" ref "\t" fam
}' | sort | uniq -c | sort -k2,2 -k1,1nr
REMOTE
