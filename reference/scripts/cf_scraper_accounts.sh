#!/usr/bin/env bash
# read-only: which quicktricks accounts minted the livev2 tokens a scraper network is using.
# A livev2 token is `/v/<issuedAtUnix>-<mac>/472/<classId>/…`: HMAC over folder + issue second, no user, no IP.
# The playback route writes one `views` row (classId, userId, viewedAt) per mint, so a token's (classId, second)
# names the minting user. Cloudflare gives the scraper's distinct (classId, second) pairs (MAC dropped in jq,
# never stored); a Mongo read on webserver2-2 joins them to `views` and ranks users by tokens matched.
# A busy live class can have a real viewer minting in the same second, so trust a user only on many matches.
#
# usage: ./cf_scraper_accounts.sh            env: ASN (default 14618 Amazon), IP (one client instead of an ASN),
#        HOURS (default 24), HOST (default livev2.hranker.org), TOP (users shown, default 15)
# token: CF_API_TOKEN=$(security find-generic-password -s cf-analytics-token -w)
set -euo pipefail

: "${CF_API_TOKEN:?CF_API_TOKEN=\$(security find-generic-password -s cf-analytics-token -w)}"
ZID=37006234a9c877df3cc0faca5ef6f1da   # hranker.org
HOST=${HOST:-livev2.hranker.org}; HOURS=${HOURS:-24}; TOP=${TOP:-15}; ASN=${ASN:-14618}; IP=${IP:-}
BOX="ssh -i $HOME/.ssh/hranker-webserver2-2 -o ConnectTimeout=15 hranker@148.113.49.18"
APP=/var/www/backend.quicktricksbysahilsir.com/quicktricks-backend
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT

iso() { date -u -r "$1" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -d "@$1" +%Y-%m-%dT%H:%M:%SZ; }
now=$(date -u +%s)
who="clientAsn: \"$ASN\""; [ -n "$IP" ] && who="clientIP: \"$IP\""
F="{datetime_geq: \"$(iso $(( now - HOURS * 3600 )))\", datetime_lt: \"$(iso "$now")\", clientRequestHTTPHost: \"$HOST\", $who, clientRequestPath_like: \"/v/%.m3u8\"}"
Q="{ viewer { zones(filter: {zoneTag: \"$ZID\"}) { p: httpRequestsAdaptiveGroups(limit: 10000, filter: $F, orderBy: [count_DESC]) { count dimensions { clientIP clientRequestPath } } } } }"

curl -sS -K <(printf 'header = "Authorization: Bearer %s"\n' "$CF_API_TOKEN") -H 'Content-Type: application/json' \
  --data-binary "$(jq -n --arg q "$Q" '{query: $q}')" https://api.cloudflare.com/client/v4/graphql |
  jq -r 'if (.errors | length) > 0 then ("ERR " + ([.errors[].message] | join("; "))) else
    (.data.viewer.zones[0].p[] | (.dimensions.clientRequestPath | capture("^/v/(?<ts>[0-9]+)-[^/]+/472/(?<cls>[0-9a-f]{24})/")?) as $m
     | select($m) | [$m.ts, $m.cls, .dimensions.clientIP, .count] | @tsv) end' > "$tmp/rows.tsv"
if grep -q '^ERR ' "$tmp/rows.tsv"; then sed 's/^ERR /GraphQL: /' "$tmp/rows.tsv" >&2; exit 1; fi

# one row per token: ts, classId, requests, distinct IPs
awk -F'\t' '{k=$1"\t"$2; r[k]+=$4; if(!((k,$3) in s)){s[k,$3]=1; n[k]++}} END{for(k in r) print k"\t"r[k]"\t"n[k]}' "$tmp/rows.tsv" | sort > "$tmp/pairs.tsv"
echo "${IP:-AS$ASN} on $HOST, last ${HOURS}h: $(wc -l < "$tmp/pairs.tsv" | tr -d ' ') distinct tokens over $(cut -f2 "$tmp/pairs.tsv" | sort -u | wc -l | tr -d ' ') classes, $(cut -f3 "$tmp/rows.tsv" | sort -u | wc -l | tr -d ' ') IPs"
[ -s "$tmp/pairs.tsv" ] || exit 0

cat > "$tmp/join.cjs" <<'JS'
// stdin: ts \t classId \t requests \t ips. Read-only: views + users.
const mongoose = require('mongoose');
const top = Number(process.env.TOP || 15);
const pairs = require('fs').readFileSync(0, 'utf8').trim().split('\n').map(l => l.split('\t'))
  .map(([ts, cls, req, ips]) => ({ ts: Number(ts), cls, req: Number(req), ips: Number(ips) }));
(async () => {
  await mongoose.connect(process.env.MONGO_URI, { readPreference: 'secondaryPreferred' });
  const db = mongoose.connection.db;
  const byUser = new Map(); let unmatched = 0; let ambiguous = 0;
  for (const p of pairs) {
    const rows = await db.collection('views').find(
      { classId: new mongoose.Types.ObjectId(p.cls), viewedAt: { $gte: new Date(p.ts * 1000), $lt: new Date(p.ts * 1000 + 3000) } },
      { projection: { userId: 1 } }).toArray();
    const users = [...new Set(rows.map(r => String(r.userId || '')).filter(Boolean))];
    if (!users.length) { unmatched++; continue; }
    if (users.length > 1) ambiguous++;
    for (const u of users) {
      const e = byUser.get(u) || { tokens: 0, sole: 0, req: 0, classes: new Set(), first: Infinity, last: 0 };
      e.tokens++; if (users.length === 1) e.sole++; e.req += p.req; e.classes.add(p.cls);
      e.first = Math.min(e.first, p.ts); e.last = Math.max(e.last, p.ts); byUser.set(u, e);
    }
  }
  console.error(`tokens matched to a view: ${pairs.length - unmatched}/${pairs.length} (more than one user in that second: ${ambiguous})`);
  const ranked = [...byUser.entries()].sort((a, b) => b[1].sole - a[1].sole || b[1].tokens - a[1].tokens).slice(0, top);
  const ids = ranked.map(([u]) => u).filter(u => mongoose.Types.ObjectId.isValid(u)).map(u => new mongoose.Types.ObjectId(u));
  const users = new Map((await db.collection('users').find({ _id: { $in: ids } },
    { projection: { name: 1, mobile: 1, email: 1, createdAt: 1 } }).toArray()).map(u => [String(u._id), u]));
  const ist = s => new Date(s * 1000 + 19800000).toISOString().slice(5, 16).replace('T', ' ');
  const mask = m => m ? String(m).replace(/^(.*)(\d{3})$/, (_, a, b) => '*'.repeat(Math.max(0, a.length - 2)) + a.slice(-2) + b) : '-';
  console.log(['sole', 'tokens', 'scraper_req', 'classes', 'first_IST', 'last_IST', 'userId', 'name', 'mobile', 'email', 'joined'].join('\t'));
  for (const [u, e] of ranked) {
    const x = users.get(u) || {};
    console.log([e.sole, e.tokens, e.req, e.classes.size, ist(e.first), ist(e.last), u, x.name || '-', mask(x.mobile),
      x.email || '-', x.createdAt ? new Date(x.createdAt).toISOString().slice(0, 10) : '-'].join('\t'));
  }
  await mongoose.disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
JS

remote=/tmp/cf_scraper_join.$$.cjs
$BOX "cat > $remote" < "$tmp/join.cjs"
$BOX "export PATH=/home/hranker/.nvm/versions/node/v22.22.2/bin:\$PATH; cd $APP && TOP=$TOP NODE_PATH=$APP/node_modules DOTENV_CONFIG_PATH=.env.development node -r dotenv/config $remote; rc=\$?; rm -f $remote; exit \$rc" \
  < <(cut -f1-4 "$tmp/pairs.tsv") | column -t -s $'\t'
