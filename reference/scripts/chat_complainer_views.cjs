// read-only: who complained about buffering in a live class chat, and their playback mints for that class.
// Joins the socket Redis chat (userId) to Mongo `views` (viewedAt second = token issuedAt), so the seconds can go
// straight into `HOST=livev2.hranker.org cf_user_sessions.sh <classId> <start> <end> <issuedAt>...`.
// Prints user ids and display names only; no mobiles, no tokens.
// run on webserver2-2: ssh … 'export PATH=<nvm>/bin:$PATH; node - <classId>' < chat_complainer_views.cjs
const SOCK = '/var/www/socket.quicktricksbysahilsir.com/livestream/backend';
const BACK = '/var/www/backend.quicktricksbysahilsir.com/quicktricks-backend';
const sockEnv = require(`${SOCK}/node_modules/dotenv`).config({ path: `${SOCK}/.env` }).parsed;
const backEnv = require(`${SOCK}/node_modules/dotenv`).parse(require('fs').readFileSync(`${BACK}/.env.development`));
const { createClient } = require(`${SOCK}/node_modules/redis`);
const mongoose = require(`${BACK}/node_modules/mongoose`);
const RE = /buff|bufer|baff|ruk|atak|atk|hang|lag rah|load|stuck|chal nhi|chal nahi|nahi chal|nhi chal|video band|net|freez|अटक|रुक|बफर/i;
const ist = d => new Date(new Date(d).getTime() + 19800000).toISOString().slice(11, 19);
(async () => {
  const cls = process.argv[2];
  const r = createClient({ username: sockEnv.REDIS_USERNAME, password: sockEnv.REDIS_PASSWORD,
    socket: { host: sockEnv.REDIS_HOST, port: Number(sockEnv.REDIS_PORT) } });
  await r.connect();
  const ids = await r.zRange(`room:${cls}:messages`, 0, -1);
  const p = r.multi(); ids.forEach(id => p.hGetAll(`message:${id}`)); const msgs = (await p.exec()).filter(m => m && m.userId);
  await r.quit();
  const who = new Map();
  for (const m of msgs) {
    const u = who.get(m.userId) || { name: String(m.userName || '').trim().slice(0, 16), msgs: 0, complaints: [] };
    u.msgs++; if (RE.test(m.message || '')) u.complaints.push(`${ist(Number(m.timestamp))} ${String(m.message).slice(0, 50)}`);
    who.set(m.userId, u);
  }
  const complainers = [...who].filter(([, u]) => u.complaints.length);
  console.log(`chat users ${who.size}, complainers ${complainers.length}`);
  await mongoose.connect(backEnv.MONGO_URI, { readPreference: 'secondaryPreferred' });
  const db = mongoose.connection.db;
  const oid = s => { try { return new mongoose.Types.ObjectId(s); } catch { return s; } };
  for (const [uid, u] of complainers) {
    const views = await db.collection('views').find({ userId: { $in: [uid, oid(uid)] }, classId: { $in: [cls, oid(cls)] } })
      .sort({ viewedAt: 1 }).toArray();
    const secs = views.map(v => Math.floor(new Date(v.viewedAt).getTime() / 1000));
    console.log(`USER ${uid} ${u.name} msgs=${u.msgs} mints=${secs.length} [${views.map(v => ist(v.viewedAt)).join(' ')}]`);
    console.log(`  SECS ${secs.join(' ')}`);
    u.complaints.forEach(c => console.log(`  > ${c}`));
  }
  await mongoose.disconnect();
})();
