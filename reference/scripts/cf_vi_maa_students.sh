#!/usr/bin/env bash
# read-only: students on a laptop (Windows user agent) on Vi over IPv6 via MAA, for finding a tester on the bad route.
# usage: CF_API_TOKEN=... cf_vi_maa_students.sh   env HOURS (default 6), COLO (default MAA)
# Prints names and mobiles to the terminal; save nothing. The token MAC is dropped in jq.
set -euo pipefail
: "${CF_API_TOKEN:?export CF_API_TOKEN}"
H=${HOURS:-6}; C=${COLO:-MAA}; D=$(cd "$(dirname "$0")" && pwd)
START=$(date -u -v-"$H"H +%Y-%m-%dT%H:%M:00Z 2>/dev/null || date -u -d "$H hours ago" +%Y-%m-%dT%H:%M:00Z); END=$(date -u +%Y-%m-%dT%H:%M:00Z)
Q="{ viewer { zones(filter:{zoneTag:\"37006234a9c877df3cc0faca5ef6f1da\"}) { r: httpRequestsAdaptive(limit:10000, orderBy:[datetime_DESC], filter:{datetime_geq:\"$START\", datetime_lt:\"$END\", clientRequestHTTPHost:\"livev2.hranker.org\", coloCode:\"$C\", clientAsn_in:[\"38266\",\"45271\",\"55410\",\"55644\"], clientRequestPath_like:\"%.ts\", userAgent_like:\"%Windows%\"}) { clientIP clientRequestPath edgeResponseStatus } } } }"
TOK=$(curl -sS -m 40 -H "Authorization: Bearer $CF_API_TOKEN" -H 'Content-Type: application/json' --data-binary "$(jq -n --arg q "$Q" '{query:$q}')" https://api.cloudflare.com/client/v4/graphql |
  jq -c '.data.viewer.zones[0].r | map(select(.clientIP|contains(":")) | (.clientRequestPath|capture("^/v/(?<s>[0-9]+)-[^/]+/472/(?<id>[0-9a-f]{24})")) + {st:.edgeResponseStatus}) | group_by([.s,.id]) | map({s:(.[0].s|tonumber), id:.[0].id, n:length, r:(map(select(.st==206))|length)}) | sort_by(-.n) | .[0:60]')
{ printf 'const TOK=%s;\n' "$TOK"; cat "$D/qt_tokens_to_students.cjs"; } |
  ssh -i ~/.ssh/hranker-webserver2-2 hranker@148.113.49.18 'export PATH=/home/hranker/.nvm/versions/node/v22.22.2/bin:$PATH; cd /var/www/backend.quicktricksbysahilsir.com/quicktricks-backend && timeout 150 nice node -' 2>&1 | grep -v -E 'MONGOOSE|trace-warnings'
