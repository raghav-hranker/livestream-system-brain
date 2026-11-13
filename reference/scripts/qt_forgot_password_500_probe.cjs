// read-only: why does POST /api/users/forgot-password answer 500 for some students?
// On the box: pulls the email/mobile of recent 500 (and 200, for contrast) forgot-password requests out of the pm2
// out log, loads each user through the backend's own User model and runs doc.validate() (no save), then tallies the
// validation error paths. A failing validate means user.save() throws AFTER the temp-password email went out.
// Prints tallies only: no address, mobile, name or hash leaves the box.
// run: ssh webserver2-2 "cd <backend checkout> && CUSTOMER=<472|781> LOG=~/.pm2/logs/<app>-out.log NODE_PATH=$PWD/node_modules DOTENV_CONFIG_PATH=.env.development node -r dotenv/config -" < qt_forgot_password_500_probe.cjs
// env: LOG_BYTES (default 1500000000)
const { execSync } = require('child_process');
const path = require('path');
const mongoose = require('mongoose');

(async () => {
  const e = process.env;
  const customer = Number(e.CUSTOMER);
  if (!customer || !e.LOG) throw new Error('CUSTOMER and LOG are required');
  const bytes = Number(e.LOG_BYTES) || 1500000000;
  const raw = execSync(
    `tail -c ${bytes} ${e.LOG} | grep -aoE '/api/users/forgot-password → (200|500) \\([0-9]+ms\\) \\| body: \\{"(email|mobile)": ?"?[^",}]{1,120}'`,
    { maxBuffer: 1 << 28, shell: '/bin/bash' }).toString();
  const reqs = { 200: new Set(), 500: new Set() };
  for (const line of raw.split('\n')) {
    const m = line.match(/→ (200|500) .*\{"(email|mobile)": ?"?(.+)$/);
    if (m) reqs[m[1]].add(`${m[2]}:${m[3].trim().toLowerCase()}`);
  }
  console.log(`distinct logins: 500=${reqs[500].size} 200=${reqs[200].size}`);

  await mongoose.connect(e.MONGO_URI, { readPreference: 'secondaryPreferred' });
  const mod = require(path.join(process.cwd(), 'dist/src/models/User'));
  const User = mod.default || mod.User || mod;
  console.log(`db=${mongoose.connection.db.databaseName} customer=${customer}`);

  for (const status of [500, 200]) {
    const tally = {}; const bump = k => { tally[k] = (tally[k] || 0) + 1; };
    for (const key of reqs[status]) {
      const [kind, value] = [key.slice(0, key.indexOf(':')), key.slice(key.indexOf(':') + 1)];
      const q = { customer_id: customer };
      if (kind === 'email') q.email = value; else q.mobile = Number(value);
      let user;
      try { user = await User.findOne(q); } catch (err) { bump(`findOne threw: ${err.name}`); continue; }
      if (!user) { bump('user not found now'); continue; }
      bump(`flag=${user.password_setup_required === true} apx=${!!user.usersApxId} hasEmail=${!!user.email}`);
      try { await user.validate(); bump('validate OK'); }
      catch (err) {
        const paths = err.errors ? Object.entries(err.errors).map(([p, v]) => `${p}(${v.kind})`).sort().join(',') : err.name;
        bump(`validate FAILS: ${paths}`);
      }
    }
    console.log(`== requests that got ${status}`);
    for (const [k, n] of Object.entries(tally).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${k}`);
  }
  await mongoose.disconnect();
})().catch(err => { console.error(err.message); process.exit(1); });
