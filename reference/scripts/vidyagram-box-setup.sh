#!/usr/bin/env bash
# Vidyagram (customer 781) backend on webserver2-2. Part A runs as hranker (no sudo).
# Part B needs sudo and is run by Raghav. Prints no secret values.
#
#   ssh -i ~/.ssh/hranker-webserver2-2 hranker@148.113.49.18 'bash -s' < vidyagram-box-setup.sh
set -euo pipefail
export PATH=/home/hranker/.nvm/versions/node/v22.22.2/bin:$PATH

ROOT=/var/www/backend.vidyagramar.com
APP=$ROOT/vidyagram-backend
QT=/var/www/backend.quicktricksbysahilsir.com/quicktricks-backend
PORT=4100

# ---- Part A: checkout, env, process ----
mkdir -p "$ROOT"
if [ ! -d "$APP/.git" ]; then
  git clone --branch vidyagram-admin --single-branch git@github.com:abhi092515/quicktricks-backend.git "$APP"
fi
cd "$APP"
git config user.name "Raghav Sharma"
git config user.email raghavsharma@hranker.com
git pull --ff-only
npm ci --no-audit --no-fund

# Env: shared infrastructure keys are copied from quicktricks; everything else is
# left out (client-specific: Razorpay, SMS, WhatsApp, Apple, Firebase, mail login,
# legacy PHP/MySQL sync). Login secrets are new. Only key names are printed.
if [ ! -f .env.development ]; then
  QT_ENV="$QT/.env.development" PORT="$PORT" node - <<'NODE'
const fs = require('fs');
const crypto = require('crypto');
const src = fs.readFileSync(process.env.QT_ENV, 'utf8').split('\n');
const shared = /^(MONGO_URI|AWS_REGION|S3_BUCKET_NAME|R2_[A-Z_]+|B2_[A-Z_]+|THUMBNAIL_B2_[A-Z_]+|BUNNY_[A-Z_]+|CF_[A-Z_]+|RECORDED_CDN_PROVIDER|LIVE_CDN_PROVIDER|SHORTS_PUBLIC_BASE_URL|PDF_URL_TTL_SECONDS|PLAYBACK_URL_TTL_SECONDS|TRANSCODER_WEBHOOK_SECRET|MQ_URL|REDIS_HOST|REDIS_PORT|REDIS_PASSWORD|MAIL_HOST|MAIL_PORT|MAIL_SECURE|APX_COURSE_CONTROL_SYNC_DISABLED)=/;
const kept = [], dropped = [];
const out = [];
for (const line of src) {
  const key = line.split('=')[0];
  if (!line.includes('=') || line.startsWith('#')) continue;
  if (!shared.test(line)) { dropped.push(key); continue; }
  let l = line;
  if (key === 'MONGO_URI') {
    l = l.replace(/\/quicktricksdb\?/, '/vidyagramdb?');
    if (!l.includes('/vidyagramdb?')) throw new Error('MONGO_URI has no /quicktricksdb? path to rewrite');
  }
  kept.push(key); out.push(l);
}
const secret = () => crypto.randomBytes(32).toString('hex');
out.push(
  '', '# Vidyagram (customer 781)',
  'NODE_ENV=development', `PORT=${process.env.PORT}`, 'DB_NAME=vidyagramdb',
  `JWT_SECRET=${secret()}`, `STREAMER_JWT_SECRET=${secret()}`, `REALTIME_TOKEN_SECRET=${secret()}`,
  'PHP_LEGACY_SYNC_ENABLED=false', 'APX_DAILY_CATCHUP_DISABLED=1', 'LAPSED_EXTENSION_ENABLED=false',
);
fs.writeFileSync('.env.development', out.join('\n') + '\n', { mode: 0o600 });
console.log('kept:', kept.join(' '));
console.log('left out:', dropped.join(' '));
NODE
fi

if ! pm2 describe vidyagram-backend >/dev/null 2>&1; then
  NODE_ENV=development PORT=$PORT pm2 start dist/src/app.js --name vidyagram-backend --max-memory-restart 2G
  pm2 save
fi
sleep 20
pm2 logs vidyagram-backend --lines 40 --nostream | grep -iE "MongoDB Connected|running on|does not match|failed|error" | head -20
curl -s -o /dev/null -w "local /api/apx-sessions -> %{http_code}\n" "http://127.0.0.1:$PORT/api/apx-sessions"

# ---- Part B (sudo; Raghav runs these by hand) ----
cat <<EOF

Part B, run as a sudoer on webserver2-2:
  sudo sed -e 's/backend\.vibhagexam\.com/backend.vidyagramar.com/g' -e 's#localhost:4000/#localhost:$PORT/#g' \\
    /etc/apache2/sites-available/backend.vibhagexam.com.conf | sudo tee /etc/apache2/sites-available/backend.vidyagramar.com.conf >/dev/null
  sudo a2ensite backend.vidyagramar.com.conf && sudo apache2ctl configtest && sudo systemctl reload apache2
  sudo certbot --apache -d backend.vidyagramar.com
EOF
