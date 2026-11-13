#!/usr/bin/env bash
# Vidyagram overnight data run on the OCI bastion (opc@92.4.88.60).
# Order agreed 2026-10-13 with the session that owns the import:
#   indexes (dry run, then commit) -> import dry run -> import commit.
# The last five courses (74,77,95,96,101) are NOT captured here; no video moves.
#
# Expects, in ~/vidyagram:
#   backend/            clone of raghav-hranker/quicktricks-backend @ feat/vg-class-import
#   env.development.mac the Mac worktree's .env.development (Mongo creds, secrets)
#   env.b2              B2_* and THUMBNAIL_B2_* lines from the Vidyagram box env
#
# Run detached:  nohup bash ~/vidyagram/vidyagram-bastion-overnight.sh > ~/vidyagram/logs/overnight.log 2>&1 &
set -euo pipefail

export PATH=/home/opc/.nvm/versions/node/v24.13.1/bin:$PATH
EXPECTED_TIP=3eaffae3f
RUN_ID=full-2026-10-13
V=~/vidyagram
LOGS=$V/logs
mkdir -p "$LOGS"

while pgrep -u "$USER" -f "git clone.*quicktricks-backend" > /dev/null; do sleep 10; done
if ! git -C "$V/backend" rev-parse -q --verify "$EXPECTED_TIP^{commit}" > /dev/null 2>&1; then
  rm -rf "$V/backend"
  git clone -q --branch feat/vg-class-import git@github.com:raghav-hranker/quicktricks-backend.git "$V/backend"
fi
cd "$V/backend"

step() { echo; echo "=== $(date -u +%FT%TZ) $*"; }

step "checkout"
git fetch -q origin feat/vg-class-import
git checkout -q "$EXPECTED_TIP"
git log --oneline -1

step "env"
test -s "$V/env.b2" || { echo "missing $V/env.b2 (B2 + thumbnail keys)"; exit 1; }
umask 077
node - "$V/env.development.mac" "$V/env.b2" > .env.development <<'EOF'
const fs = require('fs');
const [macPath, b2Path] = process.argv.slice(2);
const drop = /^(B2_|THUMBNAIL_B2_|DISABLE_CRONS=|DB_NAME=|NODE_ENV=|APX_SESSION_KEEPALIVE=)/;
const lines = fs.readFileSync(macPath, 'utf8').split('\n').filter((l) => l && !drop.test(l));
const out = lines.map((l) => {
  if (!l.startsWith('MONGO_URI=')) return l;
  // Replica-set discovery from the bastion bounces to 127.0.0.1: keep the seed list here,
  // the probe below rewrites it to the writable primary with directConnection.
  return l;
});
out.push(...fs.readFileSync(b2Path, 'utf8').split('\n').filter(Boolean));
out.push('NODE_ENV=development', 'DB_NAME=vidyagramdb', 'DISABLE_CRONS=true');
process.stdout.write(out.join('\n') + '\n');
EOF

step "npm ci"
npm ci --no-audit --no-fund --loglevel=error

step "pick the writable primary and pin MONGO_URI to it"
node - <<'EOF'
require('dotenv').config({ path: '.env.development' });
const fs = require('fs');
const { MongoClient } = require('mongodb');
(async () => {
  const uri = process.env.MONGO_URI;
  const m = uri.match(/^(mongodb:\/\/[^@]+@)([^/]+)\/([^?]*)(\?.*)?$/);
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
      const hello = await c.db('admin').command({ hello: 1 });
      if (hello.isWritablePrimary) {
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

export NODE_ENV=development

step "unique indexes (dry run)"
npm run -s migrate:apx-unique-indexes 2>&1 | tee "$LOGS/indexes-dryrun.log"

step "unique indexes (commit)"
npm run -s migrate:apx-unique-indexes -- --commit 2>&1 | tee "$LOGS/indexes-commit.log"

step "ApxIngestJob indexes"
npx ts-node --transpile-only -e "
require('dotenv').config({ path: '.env.development' });
const mongoose = require('mongoose');
const ApxIngestJob = require('./src/models/ApxIngestJob').default;
(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: 'vidyagramdb', autoIndex: false });
  if (mongoose.connection.db.databaseName !== 'vidyagramdb') throw new Error('wrong db');
  await ApxIngestJob.createIndexes();
  console.log(JSON.stringify((await ApxIngestJob.collection.indexes()).map((i) => i.name)));
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
" 2>&1 | tee "$LOGS/ingestjob-indexes.log"

step "import dry run"
npx ts-node src/scripts/apxCatalogImportClasses.ts --run "$RUN_ID" --out "$LOGS/import-dryrun.json" 2>&1 | tee "$LOGS/import-dryrun.log"

step "import commit"
npx ts-node src/scripts/apxCatalogImportClasses.ts --run "$RUN_ID" --out "$LOGS/import-commit.json" --commit 2>&1 | tee "$LOGS/import-commit.log"

step "done"
