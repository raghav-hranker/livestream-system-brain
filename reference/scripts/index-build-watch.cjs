// Read-only watcher for an index build on rs0. Every 60 s prints each member's state, lag, disk and build progress.
// Exits 0 when no build on the collection is left on any member, and 2 when a member is unhealthy or its disk
// reaches DISK_STOP percent (default 85), so the caller can decide what to do. It never touches the build.
// Run on webserver2-2 from a backend checkout: DB=<db> COL=<collection> node - < script
// ENV_FILE (default .env.development) is read relative to the working directory.
const { createRequire } = require('module');
const fs = require('fs');
const path = require('path');
const r = createRequire(`${process.cwd()}/package.json`);
const { MongoClient } = r('mongoose').mongo;

const { DB, COL } = process.env;
const DISK_STOP = Number(process.env.DISK_STOP || 85);
const env = fs.readFileSync(path.resolve(process.cwd(), process.env.ENV_FILE || '.env.development'), 'utf8');
const uri = (env.match(/^MONGO_URI=(.*)$/m) || [])[1].trim().replace(/^['"]|['"]$/g, '');
const parts = uri.match(/^(mongodb:\/\/(?:[^@/]+@)?)([^/]+)(\/[^?]*)?(\?.*)?$/);
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const directUri = (host) => {
  const query = new URLSearchParams((parts[4] || '').slice(1));
  ['replicaSet', 'readPreference', 'readConcernLevel', 'w'].forEach((k) => query.delete(k));
  query.set('directConnection', 'true');
  query.set('readPreference', 'secondaryPreferred');
  return `${parts[1]}${host}/admin?${query}`;
};

(async () => {
  const clients = new Map();
  const connect = async (host) => {
    if (!clients.has(host)) {
      const client = new MongoClient(directUri(host), { serverSelectionTimeoutMS: 8000 });
      await client.connect();
      clients.set(host, client);
    }
    return clients.get(host);
  };

  for (;;) {
    let building = 0;
    let stop = '';
    const line = [new Date().toISOString()];
    for (const host of parts[2].split(',')) {
      try {
        const client = await connect(host);
        const admin = client.db('admin');
        const status = await admin.command({ replSetGetStatus: 1 });
        const me = status.members.find((m) => m.self);
        const newest = Math.max(...status.members.map((m) => m.optimeDate?.getTime() || 0));
        const disk = await client.db(DB).command({ dbStats: 1, scale: 1073741824 });
        const percent = (100 * disk.fsUsedSize) / disk.fsTotalSize;
        const { inprog } = await admin.command({ currentOp: 1, ns: `${DB}.${COL}`, $or: [{ 'command.createIndexes': COL }, { msg: /Index Build/ }] });
        const progress = inprog.find((op) => op.msg)?.msg || (inprog.length ? 'waiting' : 'none');
        building += inprog.length;
        line.push(`${host.split(':')[0]} ${me.stateStr} lag ${Math.round((newest - me.optimeDate) / 1000)} s disk ${percent.toFixed(1)}% build ${progress}`);
        if (percent >= DISK_STOP) stop = `${host} disk at ${percent.toFixed(1)}%`;
      } catch (error) {
        clients.delete(host);
        stop = `${host} unavailable: ${error.message}`;
        line.push(`${host.split(':')[0]} unavailable`);
      }
    }
    console.log(line.join(' | '));
    if (stop) {
      console.log(`STOP ${stop}`);
      process.exit(2);
    }
    if (building === 0) {
      console.log('DONE no build left on any member');
      process.exit(0);
    }
    await sleep(60000);
  }
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
