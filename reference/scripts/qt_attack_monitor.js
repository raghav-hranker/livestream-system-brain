// Live attack monitor for quicktricks prod (10-29 incident). Runs ON webserver2-2, fed over ssh stdin:
//   ssh -i ~/.ssh/hranker-webserver2-2 hranker@148.113.49.18 "export PATH=/home/hranker/.nvm/versions/node/v22.22.2/bin:\$PATH; \
//     cd /var/www/backend.quicktricksbysahilsir.com/quicktricks-backend && MINUTES=29 NODE_PATH=\$PWD/node_modules \
//     DOTENV_CONFIG_PATH=.env.development node -r dotenv/config -" < reference/scripts/qt_attack_monitor.js
// Read-only. Every POLL it reads the new Apache lines and new DB rows and prints one line per finding, nothing when quiet:
//   SPRAY        login tries from spray IPs (5+ login 404s today) or fake old browser UAs; lists accounts that got in
//   SCRIPT       requests with a script UA (Python, curl...) by route/status
//   CLOUD        cloud IPs (AWS/Google/Hetzner ranges) getting 200 on login, playback or PDF access
//   PDF SWEEP    an IP fetching 60+ different PDFs in one run
//   SWEEP        an account opening 40+ different classes in 30 min (once per account per day)
//   WATCHED LOGIN / CHANGED   logins and phone/email/status changes on the reset and locked accounts
//   SCRIPT LOGIN a login session whose device_info is a script UA
//   5XX          more than 40 server errors in one poll
// State (Apache offset, spray IPs, already-reported keys) is kept in ~/qt-monitor-state.json so re-arming carries on.
const fs = require('fs'), os = require('os'), readline = require('readline'), m = require('mongoose');
const A = '/var/log/apache2/backend.quicktricksbysahilsir.com-access.log';
const STATE = os.homedir() + '/qt-monitor-state.json', BK = os.homedir() + '/prod-backups';
const MIN = +(process.env.MINUTES || 29), POLL = +(process.env.POLL_S || 120) * 1000;
const CLIENT = '6a44b54a3aed5ba9f311e601';
const ist = d => new Date(d.getTime() + 19800000).toISOString().slice(11, 16);
const out = s => console.log(`${ist(new Date())} ${s}`);
const MON = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
const RE = /^(\S+) \S+ \S+ \[(\d+)\/(\w+)\/(\d+):(\d\d:\d\d:\d\d)[^\]]*\] "(\S+) (\S+)[^"]*" (\d{3}) \S+ "[^"]*" "([^"]*)"/;
const FAKE = /Opera\/9|Windows NT [56]\.|MSIE|compatible;/;
const SCRIPT = /^(Python|python|aiohttp|curl|Go-http|Wget|axios|node-fetch|PostmanRuntime|okhttp\/[23])/;
const CLOUD = /^(3|13|18|34|35|44|52|54)\.|^(188\.245|94\.130|5\.161|78\.46)\./;
const LOGIN = /^\/api\/users\/(login|mobile-login)$/;

let st = {}; try { st = JSON.parse(fs.readFileSync(STATE)); } catch {}
st.spray = st.spray || {}; st.emitted = st.emitted || {}; st.offset = st.offset || 0;
st.since = st.since ? new Date(st.since) : new Date(Date.now() - POLL);
const save = () => fs.writeFileSync(STATE, JSON.stringify(st), { mode: 0o600 });
const once = k => { if (st.emitted[k]) return false; st.emitted[k] = 1; return true; };
const pdfByIp = {};

async function readApache(eventsFrom) {
  const s = fs.statSync(A);
  if (st.ino !== s.ino || s.size < st.offset) { st.ino = s.ino; st.offset = 0; }
  if (s.size === st.offset) return null;
  const c = { spray: {}, sprayIn: new Set(), sprayInIps: new Set(), script: {}, cloud: {}, e5: 0, lines: 0 };
  const rl = readline.createInterface({ input: fs.createReadStream(A, { start: st.offset, end: s.size - 1 }) });
  for await (const l of rl) {
    const x = RE.exec(l); if (!x) continue;
    const [, ip, d, mo, y, hms, meth, url, status, ua] = x, path = url.split('?')[0];
    if (LOGIN.test(path) && status === '404') st.spray[ip] = (st.spray[ip] || 0) + 1;
    if (new Date(`${y}-${MON[mo]}-${d}T${hms}+05:30`) < eventsFrom) continue;
    c.lines++;
    if (status[0] === '5') c.e5++;
    const sprayer = (st.spray[ip] || 0) >= 5 || FAKE.test(ua);
    if (sprayer && LOGIN.test(path)) { c.spray[status] = (c.spray[status] || 0) + 1; if (status === '200') c.sprayInIps.add(ip); }
    if (sprayer && /my-orders\?userId=/.test(url) && status === '200') c.sprayIn.add(url.split('userId=')[1].split('&')[0]);
    // The live encoder (GCP 34.131.52.223, axios) reports stream-status with the Transcoder secret: ours.
    if (SCRIPT.test(ua) && /^\/(api|admin)\//.test(path) && !/\/stream-status$/.test(path)) {
      const k = `${ip} ${ua.slice(0, 24)} ${meth} ${path.replace(/[0-9a-f]{24}/g, '<id>').replace(/\/\d{6,}/g, '/<n>')} ${status}`;
      c.script[k] = (c.script[k] || 0) + 1;
    }
    if (CLOUD.test(ip) && status === '200' && (/\/playback$|\/access$/.test(path) || LOGIN.test(path))) {
      const k = `${ip} ${ua.slice(0, 20)}`; c.cloud[k] = (c.cloud[k] || 0) + 1;
    }
    const pdf = /\/pdfs\/([0-9a-f]{24})\/access$/.exec(path);
    if (pdf && status === '200') (pdfByIp[ip] = pdfByIp[ip] || new Set()).add(pdf[1]);
  }
  st.offset = s.size;
  return c;
}

(async () => {
  await m.connect(process.env.MONGO_URI, { readPreference: 'secondaryPreferred' });
  const db = m.connection.db, U = db.collection('users'), S = db.collection('userloginsessions'), V = db.collection('views');
  const watched = new Set();
  for (const f of fs.readdirSync(BK).filter(f => /^(claimed458-reset|spray-reset|scraper-lock|lock9).*\.json$/.test(f)))
    for (const x of fs.readFileSync(`${BK}/${f}`, 'utf8').matchAll(/"_id":"([0-9a-f]{24})"/g)) if (x[1] !== CLIENT) watched.add(x[1]);
  const wIds = [...watched].map(i => new m.Types.ObjectId(i));
  const snap = async () => new Map((await U.find({ _id: { $in: wIds } }, { projection: { mobile: 1, email: 1, status: 1 } }).toArray()).map(u => [String(u._id), `${u.mobile}|${u.email}|${u.status}`]));
  let base = await snap();
  const firstRun = !st.ino;
  out(`monitor up: ${watched.size} watched accounts, ${Object.values(st.spray).filter(n => n >= 5).length} spray IPs known, polling every ${POLL / 1000}s for ${MIN} min${firstRun ? ' (first run: scanning today\'s log)' : ''}`);
  const end = Date.now() + MIN * 60000;
  while (true) {
    try {
      const from = st.since, now = new Date();
      const c = await readApache(from);
      if (c) {
        const tries = Object.values(c.spray).reduce((a, b) => a + b, 0);
        if (c.spray['200'] || tries >= 50)
          out(`SPRAY ${tries} login tries (${Object.entries(c.spray).map(([k, v]) => k + '=' + v).join(' ')}); got in: ${c.sprayIn.size ? [...c.sprayIn].join(',') : (c.sprayInIps.size ? 'from ' + [...c.sprayInIps].join(',') : 'none')}`);
        // Refused script logins (401/403/404) are only counted; anything else a script gets is reported at once.
        const sk = Object.entries(c.script).sort((a, b) => b[1] - a[1]);
        const refused = sk.filter(([k]) => / 40[134]$/.test(k));
        st.refused = (st.refused || 0) + refused.reduce((a, [, v]) => a + v, 0);
        // Public catalogue reads (topic/class/PDF lists) need no login, so a script reading them is noise.
        const rest = sk.filter(([k]) => !/ 40[134]$/.test(k) && /\/(playback|access|login|mobile-login|change-password|forgot-password|update-user|sendOtp|my-orders|realtime-token)\b|\/admin\//.test(k));
        if (rest.length) out(`SCRIPT ${rest.slice(0, 6).map(([k, v]) => `${k} x${v}`).join(' | ')}`);
        if (st.refused && Date.now() - (st.refusedAt || 0) > 15 * 60000) { out(`SCRIPT refused so far: ${st.refused}`); st.refusedAt = Date.now(); }
        const cl = Object.entries(c.cloud);
        if (cl.length) out(`CLOUD 200s on login/playback/PDF: ${cl.map(([k, v]) => `${k} x${v}`).join(' | ')}`);
        if (c.e5 > 40) out(`5XX ${c.e5} server errors in ${c.lines} requests`);
      }
      for (const [ip, set] of Object.entries(pdfByIp)) if (set.size >= 60 && once(`pdf ${ip} ${now.toISOString().slice(0, 10)}`)) out(`PDF SWEEP ${ip} took ${set.size} different PDFs since this run started`);
      for (const x of await S.find({ login_time: { $gt: from } }, { projection: { user_id: 1, login_time: 1, device_info: 1 } }).toArray()) {
        const id = String(x.user_id), ua = String(x.device_info || '');
        if (watched.has(id)) out(`WATCHED LOGIN ${id} ${ist(x.login_time)} ${ua.slice(0, 30)}`);
        else if (SCRIPT.test(ua)) out(`SCRIPT LOGIN ${id} ${ist(x.login_time)} ${ua.slice(0, 30)}`);
      }
      const nb = await snap();
      for (const [id, k] of nb) if (base.get(id) !== k) out(`CHANGED ${id} phone/email/status ${base.get(id)?.split('|')[2]}->${k.split('|')[2]} (contact ${base.get(id)?.split('|').slice(0, 2).join('|') === k.split('|').slice(0, 2).join('|') ? 'same' : 'CHANGED'})`);
      base = nb;
      const sw = await V.aggregate([{ $match: { viewedAt: { $gte: new Date(Date.now() - 30 * 60000) } } }, { $group: { _id: '$userId', n: { $sum: 1 }, c: { $addToSet: '$classId' } } },
        { $project: { n: 1, c: { $size: '$c' } } }, { $match: { c: { $gte: 40 } } }]).toArray();
      for (const x of sw) if (once(`sweep ${x._id} ${now.toISOString().slice(0, 10)}`)) out(`SWEEP ${x._id} opened ${x.c} classes (${x.n} links) in the last 30 min${watched.has(String(x._id)) ? ' [WATCHED]' : ''}`);
      st.since = now; save();
    } catch (e) { out(`MONITOR ERROR ${String(e && e.message || e).slice(0, 200)}`); }
    if (Date.now() + POLL > end) break;
    await new Promise(r => setTimeout(r, POLL));
  }
  out('monitor run ended (re-arm to continue)');
  process.exit(0);
})();
