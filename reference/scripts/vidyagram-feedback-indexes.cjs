// Builds the feedback indexes on vidyagramdb from the schemas' own declarations (prod never autoIndexes).
// Prints replica-set member health first and refuses to build while a member is unhealthy. Dry run by default.
// Run on the box from the Vidyagram backend checkout:
//   cd /var/www/backend.vidyagramar.com/vidyagram-backend && node ~/vidyagram-feedback-indexes.cjs [--commit]
const { createRequire } = require('module');
const fs = require('fs');
const r = createRequire(`${process.cwd()}/package.json`);
const { MongoClient } = r('mongoose').mongo;

const env = fs.readFileSync(`${process.cwd()}/${process.env.ENV_FILE || '.env.development'}`, 'utf8');
const envVar = (k) => (env.match(new RegExp(`^${k}=(.*)$`, 'm')) || [])[1]?.trim().replace(/^['"]|['"]$/g, '');
const commit = process.argv.includes('--commit');
const MODELS = { feedbacks: 'Feedback', feedbacktags: 'FeedbackTag' };

(async () => {
  const client = new MongoClient(envVar('MONGO_URI'), { serverSelectionTimeoutMS: 15000, readPreference: 'primary' });
  await client.connect();
  const db = client.db();
  if (db.databaseName !== 'vidyagramdb') throw new Error(`refusing: database is ${db.databaseName}`);
  const status = await client.db('admin').command({ replSetGetStatus: 1 });
  const members = status.members.map((m) => `${m.name} ${m.stateStr} health=${m.health}`);
  console.log(`database ${db.databaseName}\n${members.join('\n')}`);
  const unhealthy = status.members.filter((m) => m.health !== 1 || !['PRIMARY', 'SECONDARY'].includes(m.stateStr));
  for (const [collection, model] of Object.entries(MODELS)) {
    const schema = r(`./dist/src/models/${model}.js`).default.schema;
    const specs = schema.indexes().map(([key, options]) => ({ key, ...options }));
    const existing = await db.collection(collection).indexes().catch(() => []);
    const have = new Set(existing.map((i) => JSON.stringify(i.key)));
    const missing = specs.filter((s) => !have.has(JSON.stringify(s.key)));
    console.log(`${collection}: ${existing.length} present, ${missing.length} to build`, missing.map((s) => s.key));
    if (!commit || missing.length === 0) continue;
    if (unhealthy.length) throw new Error('refusing to build while a member is unhealthy');
    const names = await db.collection(collection).createIndexes(missing, { commitQuorum: 'majority' });
    console.log(`${collection}: built`, names);
  }
  if (!commit) console.log('dry run: pass --commit to build');
  await client.close();
})().catch((error) => { console.error(error.message); process.exit(1); });
