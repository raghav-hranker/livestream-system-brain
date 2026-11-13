#!/usr/bin/env bash
# read-only, from the Mac: is Vi traffic leaving Cloudflare since routing to Bunny went on? Per 30 IST minutes, video
# segments on one Cloudflare host: Vi vs Jio + Airtel, Vi's share of the three (cancels out how many are watching),
# and Vi's re-downloads (206) and aborts (499) per 1,000. Routing lowers the share on the recorded host only, so run
# it on the live host as the control. Counts are Cloudflare's sampled estimates.
# usage: qt_vi_routing_status.sh "<YYYY-MM-DD HH:MM IST start>" "<... end>"   env HOST (default recordedvideosv2.hranker.org)
# token: CF_API_TOKEN=$(security find-generic-password -s cf-analytics-token -w)
set -euo pipefail
: "${CF_API_TOKEN:?export CF_API_TOKEN}"
[ $# -eq 2 ] || { sed -n 6p "$0" >&2; exit 2; }
HOST=${HOST:-recordedvideosv2.hranker.org}
iso() { TZ=Asia/Kolkata date -j -f "%Y-%m-%d %H:%M" "$1" +%s | xargs -I{} date -u -r {} +%Y-%m-%dT%H:%M:00Z; }
FROM=$(iso "$1"); TO=$(iso "$2")
VI='"38266","45271","55410","55644"'
Q="{ viewer { zones(filter: {zoneTag: \"37006234a9c877df3cc0faca5ef6f1da\"}) { g: httpRequestsAdaptiveGroups(limit: 10000, filter: {datetime_geq: \"$FROM\", datetime_lt: \"$TO\", clientRequestHTTPHost: \"$HOST\", clientRequestPath_like: \"%.ts\", clientAsn_in: [$VI,\"55836\",\"45609\",\"24560\"]}) { count dimensions { datetimeFifteenMinutes clientAsn edgeResponseStatus } } } } }"
curl -sS -K <(printf 'header = "Authorization: Bearer %s"\n' "$CF_API_TOKEN") -H 'Content-Type: application/json' \
  --data-binary "$(jq -n --arg q "$Q" '{query:$q}')" https://api.cloudflare.com/client/v4/graphql |
jq -r --arg host "$HOST" '
  if .errors then (.errors[].message | halt_error) else .data.viewer.zones[0].g |
  def isvi: .dimensions.clientAsn | IN("38266","45271","55410","55644");
  def sum: map(.count) | add // 0;
  def status($s): map(select(.dimensions.edgeResponseStatus == $s)) | sum;
  "\($host)\tVi segs\tJio+Airtel\tVi share\t206/1k\t499/1k",
  (map(. + {slot: (.dimensions.datetimeFifteenMinutes | fromdate + 19800 | . - (. % 1800))})
   | group_by(.slot)[]
   | (map(select(isvi))) as $v | (map(select(isvi | not))) as $o
   | ($v | sum) as $vn | ($o | sum) as $on
   | [(.[0].slot | strftime("%m-%d %H:%M")), $vn, $on,
      "\(if ($vn + $on) > 0 then ($vn * 1000 / ($vn + $on) | floor) / 10 else 0 end)%",
      (if $vn > 0 then (($v | status(206)) * 1000 / $vn | floor) else "-" end),
      (if $vn > 0 then (($v | status(499)) * 1000 / $vn | floor) else "-" end)] | @tsv)
  end' | column -t -s $'\t'
