#!/usr/bin/env bash
# read-only, from the Mac: video segments per network x Cloudflare colo on one host over the last HOURS, with
# re-downloads (206) and aborts (499) per 1,000. A bad route shows as one network + colo far above the rest, e.g.
# Vi via MAA at 349 against Vi via DEL at 8 on 2026-11-03. Rows under 400 segments are dropped.
# usage: cf_net_colo_redownloads.sh   env HOST (default livev2.hranker.org), HOURS (default 4)
# token: CF_API_TOKEN=$(security find-generic-password -s cf-analytics-token -w)
set -euo pipefail
: "${CF_API_TOKEN:?export CF_API_TOKEN}"
HOST=${HOST:-livev2.hranker.org}; HOURS=${HOURS:-4}
FROM=$(date -u -v-"${HOURS}"H +%Y-%m-%dT%H:%M:00Z); TO=$(date -u +%Y-%m-%dT%H:%M:00Z)
Q="{ viewer { zones(filter: {zoneTag: \"37006234a9c877df3cc0faca5ef6f1da\"}) { g: httpRequestsAdaptiveGroups(limit: 10000, filter: {datetime_geq: \"$FROM\", datetime_lt: \"$TO\", clientRequestHTTPHost: \"$HOST\", clientRequestPath_like: \"%.ts\", clientAsn_in: [\"38266\",\"45271\",\"55410\",\"55644\",\"55836\",\"45609\",\"24560\"]}) { count dimensions { clientAsn coloCode edgeResponseStatus } } } } }"
echo "$HOST, last $HOURS h: network, colo, segments, 206/1k, 499/1k"
curl -sS -K <(printf 'header = "Authorization: Bearer %s"\n' "$CF_API_TOKEN") -H 'Content-Type: application/json' \
  --data-binary "$(jq -n --arg q "$Q" '{query:$q}')" https://api.cloudflare.com/client/v4/graphql |
jq -r 'if .errors then (.errors[].message | halt_error) else .data.viewer.zones[0].g
  | map(. + {net: (if .dimensions.clientAsn == "55836" then "Jio" elif (.dimensions.clientAsn | IN("45609","24560")) then "Airtel" else "Vi" end)})
  | group_by([.net, .dimensions.coloCode])[]
  | (map(.count) | add) as $t | select($t > 400)
  | [.[0].net, .[0].dimensions.coloCode, $t,
     ((map(select(.dimensions.edgeResponseStatus == 206) | .count) | add // 0) * 1000 / $t | floor),
     ((map(select(.dimensions.edgeResponseStatus == 499) | .count) | add // 0) * 1000 / $t | floor)] | @tsv end' |
sort -k1,1 -k3,3nr | column -t
