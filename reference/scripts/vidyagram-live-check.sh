#!/usr/bin/env bash
# READ-ONLY. Vidyagram only. One look at a running class, from the Mac: encoder VM, then the live class
# in vidyagramdb, then a signed walk of master -> every rung through qt-playback-check.cjs.
#   reference/scripts/vidyagram-live-check.sh [classId]
# With no classId it walks the most recently updated class whose streamStatus is live.
# Prints statuses only: no env, no tokens, no ffmpeg command lines (they carry the stream key).
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
CLASS_ID="${1:-}"
BOX=(ssh -i "$HOME/.ssh/hranker-webserver2-2" -o ConnectTimeout=15 -o ConnectionAttempts=3 hranker@148.113.49.18)
VG='cd /var/www/backend.vidyagramar.com/vidyagram-backend && export PATH=/home/hranker/.nvm/versions/node/v22.22.2/bin:$PATH && export DOTENV_CONFIG_PATH=.env.development'

echo "== encoder vidyagram-livestream"
gcloud compute ssh --zone asia-south2-c vidyagram-livestream --project genial-analogy-477417-r7 --quiet --command \
  'export PATH=$(ls -d ~/.nvm/versions/node/*/bin | tail -1):$PATH; uptime; df -h / | tail -1; pm2 ls --no-color | grep -E "name|vidyagram"; echo "ffmpeg processes: $(pgrep -c ffmpeg)"; echo "connections on 8937: $(ss -Htn state established "( sport = :8937 )" | wc -l)"' \
  || echo "ENCODER SSH FAILED"

echo
echo "== classes in vidyagramdb"
FOUND="$("${BOX[@]}" "$VG && node -r dotenv/config - 2>&1" <<'EOF'
const path = require('path');
const m = require(path.join(process.cwd(), 'node_modules/mongoose'));
const ist = (d) => (d ? new Date(new Date(d).getTime() + 5.5 * 36e5).toISOString().slice(0, 19).replace('T', ' ') : '-');
(async () => {
  await m.connect(process.env.MONGO_URI);
  const db = m.connection.db;
  if (db.databaseName !== 'vidyagramdb') throw new Error(`wrong database ${db.databaseName}`);
  console.log('now', ist(new Date()));
  const rows = await db.collection('classes').find(
    // No isLive filter: a class going live from the admin can carry isLive false. Recorded imports churn updatedAt, so match on streamStatus alone.
    { streamStatus: { $in: ['live', 'preparing', 'reconnecting'] } },
    { projection: { title: 1, startDate: 1, updatedAt: 1, isLive: 1, streamStatus: 1, hlsAsset: 1 } },
  ).sort({ updatedAt: -1 }).limit(10).toArray();
  for (const r of rows) {
    console.log(`${r._id} | ${(r.title || '').slice(0, 50)} | ${r.streamStatus} | isLive ${r.isLive} | start ${ist(r.startDate)} | updated ${ist(r.updatedAt)} | asset ${r.hlsAsset ? `${r.hlsAsset.bucket} ${r.hlsAsset.key}` : 'none'}`);
  }
  if (!rows.length) console.log('no live, preparing or reconnecting class');
  const live = rows.find((r) => r.streamStatus === 'live');
  if (live) console.log(`LIVE_ID=${live._id}`);
  await m.disconnect();
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
EOF
)"
echo "$FOUND" | grep -v '^LIVE_ID='
[ -z "$CLASS_ID" ] && CLASS_ID="$(echo "$FOUND" | sed -n 's/^LIVE_ID=//p' | head -1)"

echo
if [ -z "$CLASS_ID" ]; then
  echo "== signed walk skipped: no class has streamStatus live. Pass a classId to force it."
else
  echo "== signed walk of $CLASS_ID"
  "${BOX[@]}" "$VG && node -r dotenv/config - $CLASS_ID 2>&1" < "$HERE/qt-playback-check.cjs" | cut -c1-400
fi
