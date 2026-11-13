// Read-only guard (preload): makes every MongoDB write in this process fail, so a local server can
// be pointed at the production replica set to exercise READ paths on real data.
//   node -r readonly-guard.cjs -r ts-node/register/transpile-only src/app.ts   (cwd = the backend worktree)
// Patches the driver instance mongoose itself uses (resolved from the backend's node_modules), and
// turns off mongoose autoIndex/autoCreate. Blocked calls reject with READ-ONLY GUARD and are logged.
const Module = require('module');
const path = require('path');

const backendRequire = Module.createRequire(path.join(process.cwd(), 'noop.js'));
const mongoose = backendRequire('mongoose');
const mongodb = Module.createRequire(backendRequire.resolve('mongoose'))('mongodb');

mongoose.set('autoIndex', false);
mongoose.set('autoCreate', false);

const block = (where, name) => function blocked() {
  const target = this && (this.collectionName || this.databaseName || '');
  const err = new Error(`READ-ONLY GUARD: blocked ${where}.${name}${target ? ` on ${target}` : ''}`);
  console.error(`[readonly-guard] ${err.message}`);
  return Promise.reject(err);
};

const COLLECTION_WRITES = [
  'insertOne', 'insertMany', 'updateOne', 'updateMany', 'replaceOne', 'deleteOne', 'deleteMany',
  'findOneAndUpdate', 'findOneAndReplace', 'findOneAndDelete', 'bulkWrite',
  'createIndex', 'createIndexes', 'dropIndex', 'dropIndexes', 'drop', 'rename',
  'createSearchIndex', 'createSearchIndexes', 'dropSearchIndex', 'updateSearchIndex',
];
for (const name of COLLECTION_WRITES) {
  if (typeof mongodb.Collection.prototype[name] === 'function') mongodb.Collection.prototype[name] = block('collection', name);
}
for (const name of ['initializeOrderedBulkOp', 'initializeUnorderedBulkOp']) {
  mongodb.Collection.prototype[name] = function () { throw new Error(`READ-ONLY GUARD: blocked collection.${name}`); };
}

// Aggregations that write ($out / $merge).
const origAggregate = mongodb.Collection.prototype.aggregate;
mongodb.Collection.prototype.aggregate = function (pipeline, ...rest) {
  if (Array.isArray(pipeline) && pipeline.some(stage => stage && ('$out' in stage || '$merge' in stage))) {
    const err = new Error(`READ-ONLY GUARD: blocked aggregate with $out/$merge on ${this.collectionName}`);
    console.error(`[readonly-guard] ${err.message}`);
    throw err;
  }
  return origAggregate.call(this, pipeline, ...rest);
};

for (const name of ['createCollection', 'dropCollection', 'dropDatabase', 'renameCollection', 'createIndex']) {
  if (typeof mongodb.Db.prototype[name] === 'function') mongodb.Db.prototype[name] = block('db', name);
}

// Raw commands: only an allow-list of read/diagnostic commands gets through.
const READ_COMMANDS = new Set([
  'find', 'getMore', 'aggregate', 'count', 'distinct', 'listIndexes', 'listCollections',
  'ping', 'hello', 'isMaster', 'ismaster', 'buildInfo', 'buildinfo', 'serverStatus', 'endSessions', 'killCursors', 'dbStats', 'collStats',
]);
const origCommand = mongodb.Db.prototype.command;
mongodb.Db.prototype.command = function (cmd, ...rest) {
  const op = cmd && Object.keys(cmd)[0];
  if (!READ_COMMANDS.has(op)) return block('db.command', op).call(this);
  if (op === 'aggregate' && Array.isArray(cmd.pipeline) && cmd.pipeline.some(s => s && ('$out' in s || '$merge' in s))) {
    return block('db.command', 'aggregate($out/$merge)').call(this);
  }
  return origCommand.call(this, cmd, ...rest);
};

console.log('[readonly-guard] armed: MongoDB writes, index builds and collection creation are blocked in this process');
