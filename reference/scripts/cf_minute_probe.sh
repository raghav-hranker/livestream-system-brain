#!/usr/bin/env bash
# read-only: per-IST-minute delivery on a Cloudflare host for one path substring (e.g. a class id), from the GraphQL
# Analytics API. Segments (.ts) and playlists (.m3u8) separately: requests, HIT/MISS, 404 / 499 / other 4xx / 5xx,
# edge TTFB p95/p99 and origin (R2) response p99. Use it to line chat "buffering" minutes up with delivery.
#
# usage: CF_API_TOKEN=... cf_minute_probe.sh <path-substring|-> "<YYYY-MM-DD HH:MM IST start>" "<... end>"
#   env  HOST (default livev2.hranker.org), ZONE_ID (default hranker.org's), ASN / IP to narrow to one network or client
# token: Zone > Analytics > Read (Keychain: CF_API_TOKEN=$(security find-generic-password -s cf-analytics-token -w)).
# Counts are Cloudflare's adaptive-sampled estimates; the plan allows 30 days back and 30 days per query.
set -euo pipefail

: "${CF_API_TOKEN:?export CF_API_TOKEN (Zone > Analytics > Read)}"
[ $# -eq 3 ] || { sed -n 5,6p "$0" >&2; exit 2; }
SUB=$1; HOST=${HOST:-livev2.hranker.org}; ZID=${ZONE_ID:-37006234a9c877df3cc0faca5ef6f1da}

epoch() { TZ=Asia/Kolkata date -j -f "%Y-%m-%d %H:%M" "$1" +%s 2>/dev/null || TZ=Asia/Kolkata date -d "$1" +%s; }
iso() { date -u -r "$1" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -d "@$1" +%Y-%m-%dT%H:%M:%SZ; }
START=$(iso "$(epoch "$2")"); END=$(iso "$(epoch "$3")")

base="datetime_geq: \"$START\", datetime_lt: \"$END\", clientRequestHTTPHost: \"$HOST\""
[ -n "${ASN:-}" ] && base="$base, clientAsn: \"$ASN\""
[ -n "${IP:-}" ] && base="$base, clientIP: \"$IP\""
p() { if [ "$SUB" = - ]; then echo "%.$1"; else echo "%$SUB%.$1"; fi; }
G='httpRequestsAdaptiveGroups(limit: 10000, orderBy: [datetimeMinute_ASC]'
Q="{ viewer { zones(filter: {zoneTag: \"$ZID\"}) {
  segS: $G, filter: {$base, clientRequestPath_like: \"$(p ts)\"}) { count dimensions { datetimeMinute cacheStatus edgeResponseStatus } }
  segQ: $G, filter: {$base, clientRequestPath_like: \"$(p ts)\"}) { dimensions { datetimeMinute } quantiles { edgeTimeToFirstByteMsP95 edgeTimeToFirstByteMsP99 originResponseDurationMsP99 } }
  plS: $G, filter: {$base, clientRequestPath_like: \"$(p m3u8)\"}) { count dimensions { datetimeMinute edgeResponseStatus } }
  plQ: $G, filter: {$base, clientRequestPath_like: \"$(p m3u8)\"}) { dimensions { datetimeMinute } quantiles { edgeTimeToFirstByteMsP99 } }
} } }"

r=$(curl -sS -K <(printf 'header = "Authorization: Bearer %s"\n' "$CF_API_TOKEN") -H 'Content-Type: application/json' \
  --data-binary "$(jq -n --arg q "$Q" '{query: $q}')" https://api.cloudflare.com/client/v4/graphql)
if echo "$r" | jq -e '.errors | length > 0' >/dev/null; then echo "$r" | jq -r '.errors[].message' >&2; exit 1; fi

echo "host $HOST path ${SUB} ${ASN:+asn $ASN }${IP:+ip $IP }IST $2 → $3"
echo "$r" | jq -r '
  def ist: sub("Z$"; "") | strptime("%Y-%m-%dT%H:%M:%S") | mktime + 19800 | strftime("%H:%M");
  .data.viewer.zones[0] as $z
  | ([$z.segS[], $z.segQ[], $z.plS[], $z.plQ[]] | map(.dimensions.datetimeMinute) | unique) as $mins
  | "IST\tseg\thit\tmiss\t404\t499\t4xx\t5xx\tedge95\tedge99\torig99\t|\tpl\tpl404\tpl4xx\tpl99",
    ($mins[] as $m
     | [$z.segS[] | select(.dimensions.datetimeMinute == $m)] as $s
     | [$z.plS[] | select(.dimensions.datetimeMinute == $m)] as $l
     | ($z.segQ[] | select(.dimensions.datetimeMinute == $m) | .quantiles) as $q
     | (([$z.plQ[] | select(.dimensions.datetimeMinute == $m) | .quantiles.edgeTimeToFirstByteMsP99] | first) // "-") as $lq
     | def n(f): [.[] | select(f) | .count] | add // 0;
       [($m | ist), ($s | n(true)), ($s | n(.dimensions.cacheStatus == "hit")), ($s | n(.dimensions.cacheStatus == "miss")),
        ($s | n(.dimensions.edgeResponseStatus == 404)), ($s | n(.dimensions.edgeResponseStatus == 499)),
        ($s | n(.dimensions.edgeResponseStatus >= 400 and .dimensions.edgeResponseStatus < 500
                and .dimensions.edgeResponseStatus != 404 and .dimensions.edgeResponseStatus != 499)),
        ($s | n(.dimensions.edgeResponseStatus >= 500)),
        ($q.edgeTimeToFirstByteMsP95 // "-"), ($q.edgeTimeToFirstByteMsP99 // "-"), ($q.originResponseDurationMsP99 // "-"), "|",
        ($l | n(true)), ($l | n(.dimensions.edgeResponseStatus == 404)), ($l | n(.dimensions.edgeResponseStatus >= 400)), $lq]
     | @tsv)' | column -t -s $'\t'
