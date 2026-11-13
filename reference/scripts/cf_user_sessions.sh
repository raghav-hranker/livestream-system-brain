#!/usr/bin/env bash
# read-only: one viewer's own CDN requests for one class, found by the token seconds they minted (qt_user_playback.cjs
# VIEW column 3). Per token: ISP, colo, statuses, cache, TTFB, rungs, then segment number vs seconds into the session.
# 206 on a segment = the app re-fetching a download that dropped; long gaps = paused/backgrounded or stalled.
# usage: cf_user_sessions.sh <classId|-> "<UTC start ISO>" "<UTC end ISO>" <issuedAt> [issuedAt...]
#   The query matches the token prefixes (/v/<issuedAt-3..+2>-), so `-` works for any class, live replays included
#   (their path id is the stream, not the class). env STEP (query window seconds, default 3600; lower it on
#   "window hit 10000 rows"), HOST (default recordedvideosv2.hranker.org; live replays =
#   livev2.hranker.org). Splits the window into 1 h queries.
# token: CF_API_TOKEN=$(security find-generic-password -s cf-analytics-token -w). The MAC never leaves jq.
set -euo pipefail
: "${CF_API_TOKEN:?export CF_API_TOKEN}"
CLS=$1; S=$(date -u -j -f %Y-%m-%dT%H:%M:%SZ "$2" +%s 2>/dev/null || date -u -d "$2" +%s)
E=$(date -u -j -f %Y-%m-%dT%H:%M:%SZ "$3" +%s 2>/dev/null || date -u -d "$3" +%s); shift 3; MINTS="$*"
HOST=${HOST:-recordedvideosv2.hranker.org}; ZID=37006234a9c877df3cc0faca5ef6f1da
OR=$(for m in $MINTS; do for d in -3 -2 -1 0 1 2; do printf '{clientRequestPath_like: "/v/%s-%%"} ' $(( m + d )); done; done)
[ "$CLS" = - ] && CF="" || CF=", clientRequestPath_like: \"%/472/$CLS/%\""
iso() { date -u -r "$1" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -d "@$1" +%Y-%m-%dT%H:%M:%SZ; }
rows=${KEEP:-$(mktemp)}; [ -n "${KEEP:-}" ] && : > "$rows" || trap 'rm -f "$rows"' EXIT
STEP=${STEP:-3600}
for ((t = S; t < E; t += STEP)); do
  u=$(( t + STEP < E ? t + STEP : E ))
  Q="{ viewer { zones(filter: {zoneTag: \"$ZID\"}) { httpRequestsAdaptive(limit: 10000, filter: {datetime_geq: \"$(iso $t)\", datetime_lt: \"$(iso $u)\", clientRequestHTTPHost: \"$HOST\"$CF, OR: [$OR]}, orderBy: [datetime_ASC]) { datetime clientIP clientASNDescription clientRequestPath edgeResponseStatus cacheStatus edgeTimeToFirstByteMs originResponseDurationMs userAgent coloCode } } } }"
  curl -sS -K <(printf 'header = "Authorization: Bearer %s"\n' "$CF_API_TOKEN") -H 'Content-Type: application/json' \
    --data-binary "$(jq -n --arg q "$Q" '{query:$q}')" https://api.cloudflare.com/client/v4/graphql |
  jq -c --arg m "$MINTS" 'if .errors then error([.errors[].message]|join("; ")) else ($m|split(" ")|map(tonumber)) as $M
    | if (.data.viewer.zones[0].httpRequestsAdaptive|length) == 10000 then ("window hit 10000 rows; narrow it" | halt_error) else . end
    | .data.viewer.zones[0].httpRequestsAdaptive[] | (.clientRequestPath|capture("^/v/(?<ts>[0-9]+)-[^/]+/472/(?<id>[0-9a-f]+)/(?<f>.*)$")) as $c
    | ($c.ts|tonumber) as $ts | select(any($M[]; . - $ts >= -2 and . - $ts <= 3)) | del(.clientRequestPath) + {ts:$ts, file:$c.f, id:$c.id} end' >> "$rows"
done
jq -s -r 'group_by(.ts)[] | (map(.datetime|fromdateiso8601)) as $t |
  "TOKEN \(.[0].ts + 19800 | strftime("%H:%M:%S")) IST reqs=\(length) span=\(($t|max)-($t|min))s isp=\(map(.clientASNDescription[0:14])|unique|join(",")) colo=\(map(.coloCode)|unique|join(",")) id=\(map(.id)|unique|join(",")) ua=\(.[0].userAgent[0:20]) status=\(map(.edgeResponseStatus|tostring)|group_by(.)|map("\(.[0])x\(length)")|join(",")) cache=\(map(.cacheStatus)|group_by(.)|map("\(.[0])x\(length)")|join(",")) ttfb_max=\(map(.edgeTimeToFirstByteMs)|max)ms",
  "  " + (map(select(.file|test("\\.ts$"))) | if length == 0 then ["(no segments)"] else (.[0].datetime|fromdateiso8601) as $t0 | map("\((.datetime|fromdateiso8601) - $t0)s:\(.file|sub("^hls/";"")|sub("\\.ts$";""))\(if .edgeResponseStatus==206 then "(206)" else "" end)") end | join(" "))' "$rows"
