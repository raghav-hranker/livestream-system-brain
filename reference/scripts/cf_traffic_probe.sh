#!/usr/bin/env bash
# read-only: who is hitting a Cloudflare zone over the last HOURS (default 24) — totals, top client IPs / ASNs /
# countries / paths / user agents, status x cache, IPs behind 4xx/5xx, and firewall (WAF, rate-limit, bot) events.
# One GraphQL Analytics API call; prints to the terminal only and saves nothing (the output has client IPs).
#
# usage: CF_API_TOKEN=... cf_traffic_probe.sh [zone-name|zone-id] [host]
#   zone   default hranker.org; a name needs Zone:Read on the token, a 32-hex zone id does not
#   host   optional, e.g. livev2.hranker.org — limits every section to that hostname
#   env    HOURS (default 24; the plan's max window is printed first), TOP rows per section (default 15)
#          ASN=14618 or IP=1.2.3.4 narrows every section to one network or one client
# token: Cloudflare API token with Zone > Analytics > Read (+ Zone > Zone > Read to look up a zone by name).
# Paths are shown with signed-URL tokens (/v/<tok>/, segments with = or ~, long opaque segments) and segment
# numbers collapsed, so a token is never printed and one class's segments count as one row.
set -euo pipefail

: "${CF_API_TOKEN:?export CF_API_TOKEN (Zone > Analytics > Read)}"
ZONE=${1:-hranker.org}; HOST=${2:-}; HOURS=${HOURS:-24}; TOP=${TOP:-15}
API=https://api.cloudflare.com/client/v4
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT

cf() { # cf <path> [json-body]; the token goes through a curl config on a pipe, never argv
  local auth; auth=$(printf 'header = "Authorization: Bearer %s"' "$CF_API_TOKEN")
  if [ $# -gt 1 ]; then
    curl -sS -K <(printf '%s\n' "$auth") -H 'Content-Type: application/json' --data-binary "$2" "$API$1"
  else
    curl -sS -K <(printf '%s\n' "$auth") "$API$1"
  fi
}

if [[ $ZONE =~ ^[0-9a-f]{32}$ ]]; then ZID=$ZONE; else
  cf "/zones?name=$ZONE" > "$tmp/z.json"
  ZID=$(jq -r '.result[0].id // empty' "$tmp/z.json")
  [ -n "$ZID" ] || { echo "zone $ZONE not visible to this token ($(jq -r '[.errors[]?.message] | join("; ") | if . == "" then "no match" else . end' "$tmp/z.json")): add Zone > Zone > Read for it, or pass the 32-hex zone id from the zone's Overview page" >&2; exit 1; }
fi

iso() { date -u -r "$1" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -d "@$1" +%Y-%m-%dT%H:%M:%SZ; }
now=$(date -u +%s); END=$(iso "$now"); START=$(iso $(( now - HOURS * 3600 )))

hostf=""; [ -n "$HOST" ] && hostf=", clientRequestHTTPHost: \"$HOST\""
[ -n "${ASN:-}" ] && hostf="$hostf, clientAsn: \"$ASN\""
[ -n "${IP:-}" ] && hostf="$hostf, clientIP: \"$IP\""
F="{datetime_geq: \"$START\", datetime_lt: \"$END\", requestSource: \"eyeball\"$hostf}"
FERR="{datetime_geq: \"$START\", datetime_lt: \"$END\", requestSource: \"eyeball\", edgeResponseStatus_geq: 400$hostf}"
FFW="{datetime_geq: \"$START\", datetime_lt: \"$END\"$hostf}"
H="httpRequestsAdaptiveGroups"; C="count sum { edgeResponseBytes }"

read -r -d '' Q <<GQL || true
{ viewer { zones(filter: {zoneTag: "$ZID"}) {
  settings { httpRequestsAdaptiveGroups { maxDuration notOlderThan } firewallEventsAdaptiveGroups { maxDuration notOlderThan } }
  total: $H(limit: 1, filter: $F) { count sum { edgeResponseBytes visits } }
  ips: $H(limit: $TOP, filter: $F, orderBy: [count_DESC]) { $C dimensions { clientIP clientAsn clientASNDescription clientCountryName } }
  asns: $H(limit: $TOP, filter: $F, orderBy: [count_DESC]) { $C dimensions { clientAsn clientASNDescription } }
  countries: $H(limit: $TOP, filter: $F, orderBy: [count_DESC]) { $C dimensions { clientCountryName } }
  paths: $H(limit: 500, filter: $F, orderBy: [count_DESC]) { $C dimensions { clientRequestHTTPHost clientRequestPath } }
  uas: $H(limit: $TOP, filter: $F, orderBy: [count_DESC]) { $C dimensions { userAgent } }
  status: $H(limit: 50, filter: $F, orderBy: [count_DESC]) { $C dimensions { edgeResponseStatus cacheStatus } }
  errIps: $H(limit: $TOP, filter: $FERR, orderBy: [count_DESC]) { count dimensions { clientIP clientCountryName edgeResponseStatus } }
  fw: firewallEventsAdaptiveGroups(limit: 50, filter: $FFW, orderBy: [count_DESC]) { count dimensions { action source ruleId } }
  fwIps: firewallEventsAdaptiveGroups(limit: $TOP, filter: $FFW, orderBy: [count_DESC]) { count dimensions { clientIP clientCountryName action source } }
} } }
GQL

cf /graphql "$(jq -n --arg q "$Q" '{query: $q}')" > "$tmp/r.json"
if jq -e '.errors | length > 0' "$tmp/r.json" >/dev/null; then
  echo "GraphQL errors (sections they name are missing below):" >&2
  jq -r '.errors[] | "  - \(.message) \(.path // [] | join("."))"' "$tmp/r.json" >&2
fi
jq -e '.data.viewer.zones[0]' "$tmp/r.json" >/dev/null || exit 1

J() { jq -r --argjson top "$TOP" "
  def b: if . >= 1e9 then \"\(./1e9*10|round/10) GB\" elif . >= 1e6 then \"\(./1e6*10|round/10) MB\" else \"\(./1e3|round) kB\" end;
  def pct(\$n; \$t): if \$t > 0 then \"\(\$n*1000/\$t|round/10)%\" else \"-\" end;
  .data.viewer.zones[0] as \$z | (\$z.total[0].count // 0) as \$tot | $1" "$tmp/r.json" | column -t -s $'\t'; }
sec() { printf '\n== %s\n' "$1"; }

echo "zone $ZONE ($ZID)${HOST:+ host $HOST}  $START → $END (${HOURS}h)"
J '"plan limits: http max \($z.settings.httpRequestsAdaptiveGroups.maxDuration // "?")s back \($z.settings.httpRequestsAdaptiveGroups.notOlderThan // "?")s | firewall max \($z.settings.firewallEventsAdaptiveGroups.maxDuration // "?")s back \($z.settings.firewallEventsAdaptiveGroups.notOlderThan // "?")s"'
J '$z.total[0] | "requests \(.count)  visits \(.sum.visits)  bytes \(.sum.edgeResponseBytes|b)"'

sec "top client IPs"
J '"req\t%\tbytes\tip\tasn\tcountry", ($z.ips[]? | [.count, pct(.count; $tot), (.sum.edgeResponseBytes|b), .dimensions.clientIP, "AS\(.dimensions.clientAsn) \(.dimensions.clientASNDescription|.[0:30])", .dimensions.clientCountryName] | @tsv)'
sec "top ASNs"
J '"req\t%\tbytes\tasn", ($z.asns[]? | [.count, pct(.count; $tot), (.sum.edgeResponseBytes|b), "AS\(.dimensions.clientAsn) \(.dimensions.clientASNDescription)"] | @tsv)'
sec "top countries"
J '"req\t%\tbytes\tcountry", ($z.countries[]? | [.count, pct(.count; $tot), (.sum.edgeResponseBytes|b), .dimensions.clientCountryName] | @tsv)'
sec "top paths (of the top 500 raw paths, tokens and segment numbers collapsed)"
J 'def redact: gsub("^/v/[^/]+"; "/v/<tok>") | split("/")
     | map(if test("[=~]") or (length >= 32 and (test("^[0-9a-f]+$") | not)) then "<tok>" else . end)
     | join("/") | gsub("segment_[0-9]+"; "segment_N") | gsub("[0-9]{2,}\\.(?<e>ts|m4s)$"; "N.\(.e)");
   "req\t%\tbytes\tpath",
   ([$z.paths[]? | {k: "\(.dimensions.clientRequestHTTPHost)\(.dimensions.clientRequestPath | redact)", c: .count, by: .sum.edgeResponseBytes}]
    | group_by(.k) | map({k: .[0].k, c: (map(.c) | add), by: (map(.by) | add)}) | sort_by(-.c) | .[:$top][]
    | [.c, pct(.c; $tot), (.by|b), .k] | @tsv)'
sec "top user agents"
J '"req\t%\tua", ($z.uas[]? | [.count, pct(.count; $tot), (.dimensions.userAgent | if . == "" then "(empty)" else .[0:110] end)] | @tsv)'
sec "status x cache"
J '"req\t%\tstatus\tcache", ($z.status[]? | [.count, pct(.count; $tot), .dimensions.edgeResponseStatus, .dimensions.cacheStatus] | @tsv)'
sec "IPs behind 4xx/5xx"
J '"req\tip\tcountry\tstatus", ($z.errIps[]? | [.count, .dimensions.clientIP, .dimensions.clientCountryName, .dimensions.edgeResponseStatus] | @tsv)'
sec "firewall events by rule"
J 'if ($z.fw | length) == 0 then "none" else ("events\taction\tsource\trule", ($z.fw[] | [.count, .dimensions.action, .dimensions.source, .dimensions.ruleId] | @tsv)) end'
sec "firewall events by IP"
J 'if ($z.fwIps | length) == 0 then "none" else ("events\tip\tcountry\taction\tsource", ($z.fwIps[] | [.count, .dimensions.clientIP, .dimensions.clientCountryName, .dimensions.action, .dimensions.source] | @tsv)) end'
