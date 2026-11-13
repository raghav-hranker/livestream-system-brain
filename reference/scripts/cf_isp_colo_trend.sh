#!/usr/bin/env bash
# read-only: per day, which Cloudflare colos serve one ISP's video segments and each colo's client-abort (499) rate.
# A routing move (e.g. Vi SIN -> BOM/PNQ/MAA on 2026-10-27) shows as a colo-share flip; a rising 499 rate on the new
# colos = viewers' downloads too slow to finish. Edge TTFB does not see this; 499s are the only CDN-side signal.
# usage: cf_isp_colo_trend.sh [YYYY-MM-DD from] [YYYY-MM-DD to]   env ASNS (default Vi "38266","45271"), TOP colos (5)
# token: CF_API_TOKEN=$(security find-generic-password -s cf-analytics-token -w)
set -euo pipefail
: "${CF_API_TOKEN:?export CF_API_TOKEN}"
FROM=${1:-$(date -v-14d +%F 2>/dev/null || date -d '14 days ago' +%F)}; TO=${2:-$(date +%F)}
ASNS=${ASNS:-'"38266","45271"'}; TOP=${TOP:-5}
Q="{ viewer { zones(filter: {zoneTag: \"37006234a9c877df3cc0faca5ef6f1da\"}) { g: httpRequestsAdaptiveGroups(limit: 10000, filter: {date_geq: \"$FROM\", date_leq: \"$TO\", clientRequestHTTPHost_in: [\"recordedvideosv2.hranker.org\",\"livev2.hranker.org\"], clientRequestPath_like: \"%.ts\", clientAsn_in: [$ASNS]}) { count dimensions { date coloCode edgeResponseStatus } } } } }"
curl -sS -K <(printf 'header = "Authorization: Bearer %s"\n' "$CF_API_TOKEN") -H 'Content-Type: application/json' \
  --data-binary "$(jq -n --arg q "$Q" '{query:$q}')" https://api.cloudflare.com/client/v4/graphql |
jq -r --argjson top "$TOP" 'if .errors then (.errors[].message | halt_error) else .data.viewer.zones[0].g |
  "ASN [\(env.ASNS // "38266,45271")] segments per day: colo share (abort 499 rate)",
  (group_by(.dimensions.date)[] | (map(.count)|add) as $t | ((map(select(.dimensions.edgeResponseStatus==499)|.count)|add)//0) as $a |
   "\(.[0].dimensions.date) \($t/1000|floor)k all-abort \($a*10000/$t|floor/100)%  " + (group_by(.dimensions.coloCode)
   | map({c:.[0].dimensions.coloCode, n:(map(.count)|add), a:((map(select(.dimensions.edgeResponseStatus==499)|.count)|add)//0)})
   | sort_by(-.n) | .[0:$top] | map("\(.c) \(.n*100/$t|floor)% (\(.a*10000/.n|floor/100)%)") | join("  "))) end'
