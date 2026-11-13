#!/usr/bin/env bash
# APX manual-completion pilot (2026-09-29). Runs ON webserver2-2.
# Mints at most 200 student tokens -- each sends a REAL APX login OTP --
# then imports manual-completion flags for only the tokens minted here.
# Needs an active APX admin session (admin dashboard -> /admin/apx-clone).
# Safe alongside the running cached-token importer: new tokens have higher
# _ids than that importer's descending cursor will ever reach.
set -u
base=/home/hranker/apx-manual-completion-paid
cd "$base/paid-backend" || exit 1
export PATH=/home/hranker/.nvm/versions/node/v22.22.2/bin:/usr/bin:/bin
export ENV_PATH=/var/www/backend.quicktricksbysahilsir.com/quicktricks-backend/.env.development
prewarm_log="$base/pilot-prewarm.jsonl"
import_log="$base/pilot-import.jsonl"

# Wait (up to 12 h) for an admin to re-login to APX; nothing is sent before then.
for _ in $(seq 1 720); do
  active=$(cd "$base/backend" && DOTENV_CONFIG_PATH="$ENV_PATH" node -r dotenv/config -e '
    const m = require("mongoose");
    m.connect(process.env.MONGO_URI).then(async () => {
      const s = await m.connection.db.collection("apxsessions").findOne({ orgId: "8680775" }, { projection: { isActive: 1 } });
      console.log(s && s.isActive !== false ? "yes" : "no"); await m.disconnect();
    });' 2>/dev/null)
  [[ $active == yes ]] && break
  printf '{"event":"pilot-waiting-for-apx-session","at":"%s"}\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$prewarm_log"
  sleep 60
done
if [[ $active != yes ]]; then
  printf '{"event":"pilot-finished","reason":"apx-session-never-activated"}\n' >> "$prewarm_log"; exit 1
fi

printf '{"event":"pilot-start","at":"%s"}\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$prewarm_log"
npm run --silent prewarm:apx-completion-paid -- --send-real-otp --max-otp=200 \
  --auth-failure-log="$base/cached-token-import.jsonl" \
  --auth-failure-log="$base/local-full-import.jsonl" \
  --auth-failure-log="$base/local-resumed-import.jsonl" >> "$prewarm_log" 2>&1

token_id=$(python3 -c '
import json, sys
s = None
for line in open(sys.argv[1]):
    try: r = json.loads(line)
    except ValueError: continue
    if r.get("event") == "summary" and "attempted" in r: s = r
print((s or {}).get("earliestMintedTokenId") or "")' "$prewarm_log")
if [[ -z $token_id ]]; then
  printf '{"event":"pilot-finished","reason":"no-token-minted"}\n' >> "$prewarm_log"
  exit 1
fi

npm run --silent migrate:apx-manual-completion -- --all --commit --delay-ms=500 \
  --from-token-id="$token_id" >> "$import_log" 2>&1
printf '{"event":"pilot-finished","at":"%s"}\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$import_log"
