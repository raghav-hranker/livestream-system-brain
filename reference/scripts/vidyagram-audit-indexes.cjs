// Builds the auditlogs indexes on vidyagramdb (prod never autoIndexes). The specs mirror the AuditLog schema
// (src/models/AuditLog.ts, admin-audit-trail task 10): by record, by admin, by request id, "every delete", and the
// TTL that expires rows after 400 days. Build them before the history deploy (task 18): without them every
// lookup scans the collection and rows never expire.
// Refuses any database but vidyagramdb, before connecting. Prints replica-set member health first and refuses
// to build while a member is unhealthy. Dry run by default. Run on the box from the Vidyagram backend checkout:
//   cd /var/www/backend.vidyagramar.com/vidyagram-backend && node ~/vidyagram-audit-indexes.cjs [--commit]
// ENV_FILE (default .env.development) is read relative to the working directory.
const { createRequire } = require('module');
const fs = require('fs');
const path = require('path');
const r = createRequire(`${process.cwd()}/package.json`);
const { MongoClient } = r('mongoose').mongo;

const env = fs.readFileSync(path.resolve(process.cwd(), process.env.ENV_FILE || '.env.development'), 'utf8');
const envVar = (k) => (env.match(new RegExp(`^${k}=(.*)$`, 'm')) || [])[1]?.trim().replace(/^['"]|['"]$/g, '');
const commit = process.argv.includes('--commit');
const INDEXES = {
  auditlogs: [
    { key: { 'target.collection': 1, 'target.id': 1, at: -1 } },
    { key: { 'actor.adminId': 1, at: -1 } },
    { key: { requestId: 1 } },
    { key: { kind: 1, op: 1, at: -1 } },
    { key: { at: 1 }, expireAfterSeconds: 400 * 24 * 60 * 60 },
  ],
};

(async () => {
  const client = new MongoClient(envVar('MONGO_URI'), { serverSelectionTimeoutMS: 15000, readPreference: 'primary' });
  const db = client.db();
  if (db.databaseName !== 'vidyagramdb') throw new Error(`refusing: database is ${db.databaseName}`);
  await client.connect();
  const status = await client.db('admin').command({ replSetGetStatus: 1 });
  const members = status.members.map((m) => `${m.name} ${m.stateStr} health=${m.health}`);
  console.log(`database ${db.databaseName}\n${members.join('\n')}`);
  const unhealthy = status.members.filter((m) => m.health !== 1 || !['PRIMARY', 'SECONDARY'].includes(m.stateStr));
  for (const [collection, specs] of Object.entries(INDEXES)) {
    const existing = await db.collection(collection).indexes().catch(() => []);
    const have = new Set(existing.map((i) => JSON.stringify(i.key)));
    const missing = specs.filter((s) => !have.has(JSON.stringify(s.key)));
    console.log(`${collection}: ${existing.length} present, ${missing.length} to build`, missing.map((s) => ({ key: s.key, expireAfterSeconds: s.expireAfterSeconds })));
    if (!commit || missing.length === 0) continue;
    if (unhealthy.length) throw new Error('refusing to build while a member is unhealthy');
    const names = await db.collection(collection).createIndexes(missing, { commitQuorum: 'majority' });
    console.log(`${collection}: built`, names);
  }
  if (!commit) console.log('dry run: pass --commit to build');
  await client.close();
})().catch((error) => { console.error(error.message); process.exit(1); });
