// read-only: a live class's public chat from the socket Redis, per IST minute: total messages and buffering complaints
require('dotenv').config({ path: '.env' });
const { createClient } = require('redis');
const RE = /buff|bufer|baff|ruk|atak|atk|hang|lag rah|load|stuck|chal nhi|chal nahi|nahi chal|nhi chal|video band|net|freez|अटक|रुक|बफर/i;
(async () => {
  const r = createClient({ username: process.env.REDIS_USERNAME, password: process.env.REDIS_PASSWORD,
    socket: { host: process.env.REDIS_HOST, port: Number(process.env.REDIS_PORT) } });
  await r.connect();
  for (const cls of process.argv.slice(2)) {
    let key;
    for (const k of [`room:${cls}:messages`, `room:472/${cls}:messages`, `room:/472/${cls}:messages`]) if (await r.exists(k)) { key = k; break; }
    if (!key) { console.log(cls, 'no messages key'); continue; }
    const ids = await r.zRange(key, 0, -1);
    const p = r.multi(); ids.forEach(id => p.hGetAll(`message:${id}`)); const msgs = await p.exec();
    const field = m => m.message ?? m.text ?? m.content ?? '';
    const per = {};
    const hits = [];
    for (const m of msgs) {
      if (!m || !m.timestamp) continue;
      const t = new Date(Number(m.timestamp) + 5.5 * 3600e3).toISOString().slice(11, 16);
      per[t] ??= [0, 0]; per[t][0]++;
      const txt = String(field(m)); if (RE.test(txt)) { per[t][1]++; hits.push(`${t} ${String(m.userName ?? m.name ?? '').slice(0, 14)}: ${txt.slice(0, 70)}`); }
    }
    console.log(`=== ${cls} ${key} msgs=${ids.length} fields=${Object.keys(msgs.find(Boolean) || {}).join(',')}`);
    console.log('IST  total complaints');
    for (const [t, [n, b]] of Object.entries(per).sort()) if (b) console.log(t, n, b);
    console.log('--- complaint texts'); hits.forEach(h => console.log(h));
  }
  await r.quit();
})();
