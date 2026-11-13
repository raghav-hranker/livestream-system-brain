// read-only: public class chat from the socket Redis, for offline analysis
//   node chat_export.cjs --list [days]   rooms with chat in the last N days (default 7): key, messages, first/last IST
//   node chat_export.cjs <classId>...    one JSON line per class: {classId, key, messages:[{t, u, type, text}]}
// u is a short hash of userId (unique-asker counts), no names leave the box. Private chat is never read.
require('dotenv').config({ path: '.env' });
const crypto = require('crypto');
const { createClient } = require('redis');
const ist = ms => new Date(Number(ms) + 5.5 * 3600e3).toISOString().slice(0, 16).replace('T', ' ');
(async () => {
  const r = createClient({ username: process.env.REDIS_USERNAME, password: process.env.REDIS_PASSWORD,
    socket: { host: process.env.REDIS_HOST, port: Number(process.env.REDIS_PORT) } });
  await r.connect();
  const args = process.argv.slice(2);
  if (args[0] === '--list') {
    const since = Date.now() - Number(args[1] || 7) * 864e5;
    const rows = [];
    for await (const batch of r.scanIterator({ MATCH: 'room:*:messages', COUNT: 1000 })) {
      for (const key of [].concat(batch)) {
        const last = await r.zRangeWithScores(key, -1, -1);
        if (!last.length || last[0].score < since) continue;
        const first = await r.zRangeWithScores(key, 0, 0);
        rows.push([key, await r.zCard(key), first[0].score, last[0].score]);
      }
    }
    rows.sort((a, b) => b[3] - a[3]);
    for (const [key, n, f, l] of rows) console.log(`${key}\t${n}\t${ist(f)}\t${ist(l)}`);
  } else {
    for (const cls of args) {
      let key;
      for (const k of [`room:${cls}:messages`, `room:472/${cls}:messages`, `room:/472/${cls}:messages`]) if (await r.exists(k)) { key = k; break; }
      if (!key) { console.error(cls, 'no messages key'); continue; }
      const ids = await r.zRange(key, 0, -1);
      const p = r.multi(); ids.forEach(id => p.hGetAll(`message:${id}`)); const msgs = await p.exec();
      const messages = msgs.filter(m => m && m.timestamp && m.isPrivate !== 'true').map(m => ({
        t: Number(m.timestamp),
        u: crypto.createHash('sha256').update(String(m.userId || '')).digest('hex').slice(0, 8),
        type: m.type || 'text',
        text: String(m.message ?? m.text ?? '').slice(0, 500),
      }));
      console.log(JSON.stringify({ classId: cls, key, messages }));
    }
  }
  await r.quit();
})();
