// Index for GET /api/user-test/question-percantage/:seriesId/:q_id on userquestionanswers.
// Dry run prints replica health, size, disk, live indexes, q_id types in recent rows, and the plan and cost of the
// real query for one recent question. --commit builds the index. --covered picks the five-field index, which also
// holds q_time and is_correct so the $group reads no documents.
// Run on webserver2-2 from the tenant's checkout (the checkout's env picks the database):
//   node ~/uqa-question-percentage-index.cjs [--covered] [--commit]
// A long build: nohup node ~/uqa-question-percentage-index.cjs --commit > ~/uqa-index.log 2>&1 &
// ENV_FILE (default .env.development) is read relative to the working directory. MONGO_URI overrides it, for local tests.
const { createRequire } = require('module');
const fs = require('fs');
const path = require('path');
const r = createRequire(`${process.cwd()}/package.json`);
const { MongoClient } = r('mongoose').mongo;

const ALLOWED = (process.env.ALLOW_DB || 'quicktricksdb,vidyagramdb').split(',');
const commit = process.argv.includes('--commit');
const covered = process.argv.includes('--covered');
const REQUESTED = { seriesId: 1, q_id: 1, attempted_count: 1 };
const COVERED = { ...REQUESTED, is_correct: 1, q_time: 1 };
const key = covered ? COVERED : REQUESTED;

const uriFromEnvFile = () => {
  const env = fs.readFileSync(path.resolve(process.cwd(), process.env.ENV_FILE || '.env.development'), 'utf8');
  return (env.match(/^MONGO_URI=(.*)$/m) || [])[1]?.trim().replace(/^['"]|['"]$/g, '');
};

const percentagePipeline = (match) => [
  { $match: match },
  {
    $group: {
      _id: null,
      avg_time: { $avg: '$q_time' },
      total: { $sum: 1 },
      correct_count: { $sum: { $cond: [{ $eq: ['$is_correct', 1] }, 1, 0] } },
    },
  },
];

const stagesOf = (plan) => [...new Set(JSON.stringify(plan).match(/"stage":"[A-Z_]+"/g) || [])].map((s) => s.slice(9, -1));

const statsFromExplain = (explain) => {
  const s = explain.executionStats || explain.stages?.[0]?.$cursor?.executionStats || {};
  return { ms: s.executionTimeMillis, keys: s.totalKeysExamined, docs: s.totalDocsExamined };
};

(async () => {
  const uri = (process.env.MONGO_URI || uriFromEnvFile()).replace(/readConcernLevel=majority&?/, '');
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 15000, socketTimeoutMS: 0, readPreference: 'primary' });
  const db = client.db();
  if (!ALLOWED.includes(db.databaseName)) throw new Error(`refusing: database is ${db.databaseName}`);
  await client.connect();
  const col = db.collection('userquestionanswers');

  const status = await client.db('admin').command({ replSetGetStatus: 1 });
  console.log(`database ${db.databaseName}`);
  status.members.forEach((m) => console.log(`${m.name} ${m.stateStr} health=${m.health} lastHeartbeatRecv=${m.lastHeartbeatRecv?.toISOString?.()} optime=${m.optimeDate?.toISOString?.()} ${m.lastHeartbeatMessage || ''}`));
  const newest = Math.max(...status.members.map((m) => m.optimeDate?.getTime() || 0));
  const MAX_LAG_MS = 60000;
  const unhealthy = status.members.filter((m) => m.health !== 1 || !['PRIMARY', 'SECONDARY'].includes(m.stateStr) || newest - m.optimeDate > MAX_LAG_MS);

  const stats = await db.command({ collStats: 'userquestionanswers', scale: 1048576 });
  const disk = await db.command({ dbStats: 1, scale: 1073741824 });
  console.log(`rows ${stats.count}, data ${stats.size} MB, on disk ${stats.storageSize} MB, indexes ${stats.totalIndexSize} MB`);
  console.log(`index sizes MB ${JSON.stringify(stats.indexSizes)}`);
  console.log(`volume ${Math.round(disk.fsUsedSize)} of ${Math.round(disk.fsTotalSize)} GB used`);

  const indexes = await col.indexes();
  indexes.forEach((i) => console.log(`index ${i.name} ${JSON.stringify(i.key)}`));
  const running = await client.db('admin').command({ currentOp: 1, 'command.createIndexes': 'userquestionanswers' });
  console.log(`builds running on this collection: ${running.inprog.length}`);

  const recent = await col.find({}, { projection: { q_id: 1, seriesId: 1 } }).sort({ _id: -1 }).limit(500).maxTimeMS(20000).toArray();
  const types = {};
  recent.forEach((row) => {
    const type = row.q_id?._bsontype || (row.q_id === undefined ? 'missing' : typeof row.q_id);
    types[type] = (types[type] || 0) + 1;
  });
  console.log(`q_id types in ${recent.length} recent rows ${JSON.stringify(types)}`);

  const sample = recent.find((row) => typeof row.q_id === 'string' && row.seriesId);
  if (sample) {
    const match = { seriesId: sample.seriesId, q_id: sample.q_id, attempted_count: 1 };
    const pipeline = percentagePipeline(match);
    const explain = (verbosity) => db.command({ explain: { aggregate: 'userquestionanswers', pipeline, cursor: {} }, verbosity, maxTimeMS: 60000 });
    const planned = await explain('queryPlanner');
    const stages = stagesOf(planned);
    console.log(`sample series ${sample.seriesId} question ${sample.q_id}, plan stages ${stages.join(' ')}`);
    if (stages.includes('COLLSCAN')) {
      console.log('skipped timing: the plan is a full collection scan');
    } else {
      for (let run = 1; run <= 3; run += 1) {
        const start = Date.now();
        const [result] = await col.aggregate(pipeline, { maxTimeMS: 60000 }).toArray();
        const wall = Date.now() - start;
        const cost = statsFromExplain(await explain('executionStats'));
        console.log(`run ${run}: ${wall} ms, rows matched ${result?.total ?? 0}, keys ${cost.keys}, docs fetched ${cost.docs}`);
      }
    }
  } else {
    console.log('skipped plan check: no recent row has a string q_id, and the route only matches strings');
  }

  const want = JSON.stringify(key);
  const present = indexes.find((i) => JSON.stringify(i.key) === want);
  console.log(`target ${want}: ${present ? `already built as ${present.name}` : 'missing'}`);
  if (!commit) console.log('dry run: pass --commit to build');
  if (commit && !present) {
    if (unhealthy.length) throw new Error('refusing to build while a member is unhealthy');
    if (running.inprog.length) throw new Error('refusing: a build is already running on this collection');
    const started = Date.now();
    console.log(`building, started ${new Date(started).toISOString()}`);
    const result = await db.command({ createIndexes: 'userquestionanswers', indexes: [{ key, name: Object.entries(key).map(([k, v]) => `${k}_${v}`).join('_') }], commitQuorum: 'majority' });
    console.log(`built in ${Math.round((Date.now() - started) / 60000)} min ${JSON.stringify({ ok: result.ok, before: result.numIndexesBefore, after: result.numIndexesAfter })}`);
  }
  await client.close();
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
