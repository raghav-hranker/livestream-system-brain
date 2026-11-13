#!/usr/bin/env bash
# Build ~/vidyagram/pdf/.env.development on the OCI bastion for the Vidyagram PDF import.
# Inputs in ~/vidyagram: env.development.mac (Mongo creds + secrets from the Mac worktree) and
# env.b2 (B2_* lines from the Vidyagram box env, copied by the operator). Pins MONGO_URI to the
# writable primary with directConnection, because replica-set discovery from the bastion bounces
# to 127.0.0.1. Prints only host names and key names, never values.
#
#   bash ~/vidyagram/vidyagram-bastion-pdf-env.sh
set -euo pipefail
export PATH=/home/opc/.nvm/versions/node/v24.13.1/bin:$PATH
V=~/vidyagram
cd "$V/pdf"
test -s "$V/env.development.mac" || { echo "missing $V/env.development.mac"; exit 1; }
test -s "$V/env.b2" || { echo "missing $V/env.b2 (B2 keys from the Vidyagram box)"; exit 1; }
test -d node_modules/mongoose || { echo "run npm ci in $V/pdf first"; exit 1; }
umask 077
node - "$V/env.development.mac" "$V/env.b2" > .env.development <<'EOF'
const fs = require('fs');
const [macPath, b2Path] = process.argv.slice(2);
const drop = /^(B2_|THUMBNAIL_B2_|DISABLE_CRONS=|DB_NAME=|NODE_ENV=|APX_SESSION_KEEPALIVE=)/;
const out = fs.readFileSync(macPath, 'utf8').split('\n').filter((l) => l && !drop.test(l));
out.push(...fs.readFileSync(b2Path, 'utf8').split('\n').filter(Boolean));
out.push('NODE_ENV=development', 'DB_NAME=vidyagramdb', 'DISABLE_CRONS=true');
process.stdout.write(out.join('\n') + '\n');
EOF
node - <<'EOF'
require('dotenv').config({ path: '.env.development' });
const fs = require('fs');
const { MongoClient } = require('mongoose').mongo;
(async () => {
  const m = process.env.MONGO_URI.match(/^(mongodb:\/\/[^@]+@)([^/]+)\/([^?]*)(\?.*)?$/);
  if (!m) throw new Error('MONGO_URI not in mongodb://user:pass@hosts/db form');
  const [, auth, hosts, db, qs = ''] = m;
  if (db !== 'vidyagramdb') throw new Error(`MONGO_URI names ${db}, expected vidyagramdb`);
  const params = new URLSearchParams(qs.replace(/^\?/, ''));
  params.delete('replicaSet');
  params.set('directConnection', 'true');
  for (const host of hosts.split(',')) {
    const candidate = `${auth}${host}/${db}?${params}`;
    const c = new MongoClient(candidate, { serverSelectionTimeoutMS: 8000 });
    try {
      await c.connect();
      if ((await c.db('admin').command({ hello: 1 })).isWritablePrimary) {
        const env = fs.readFileSync('.env.development', 'utf8').replace(/^MONGO_URI=.*$/m, `MONGO_URI=${candidate}`);
        fs.writeFileSync('.env.development', env, { mode: 0o600 });
        console.log('primary', host);
        await c.close();
        return;
      }
    } catch (e) {
      console.log('host', host, 'not usable:', e.message);
    }
    await c.close().catch(() => {});
  }
  throw new Error('no writable primary found');
})().catch((e) => { console.error(e.message); process.exit(1); });
EOF
echo "keys present:"; grep -o -E '^(MONGO_URI|DB_NAME|B2_[A-Z_]+)=' .env.development | sort | tr '\n' ' '; echo
