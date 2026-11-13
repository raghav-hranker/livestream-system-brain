// Login-session probe — READ-ONLY.
//
// For each mobile number given, prints the user and every UserLoginSession in the
// last DAYS days (login time, device type, user agent, IP, active flag, and
// updatedAt — for an evicted session updatedAt ≈ the moment it was ended).
// Then a platform-wide baseline: users with >= 3 mobile logins in the last 24 h.
//
// Run on the box from the quicktricks-backend checkout:
//   DAYS=3 DOTENV_CONFIG_PATH=.env.development node -r dotenv/config - 9617898264 9792999918 < login_sessions_probe.js
const mongoose = require(require.resolve('mongoose', { paths: [process.cwd()] }));

const DAYS = Number(process.env.DAYS || 3);
const IST = (d) => (d ? new Date(new Date(d).getTime() + 5.5 * 36e5).toISOString().slice(0, 19).replace('T', ' ') : '-');

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.DB_NAME, readPreference: 'secondaryPreferred' });
  const db = mongoose.connection.db;
  const customer_id = Number(process.env.CUSTOMER_ID || 472);
  const since = new Date(Date.now() - DAYS * 864e5);

  for (const mobile of process.argv.slice(2)) {
    const users = await db.collection('users').find(
      { mobile: { $in: [mobile, Number(mobile), `+91${mobile}`, `91${mobile}`] } },
      { projection: { name: 1, mobile: 1, customer_id: 1, createdAt: 1 } },
    ).toArray();
    console.log(`\n### ${mobile}: ${users.length} user(s)`);
    for (const u of users) {
      console.log(`user ${u._id} name=${u.name} customer=${u.customer_id} created=${IST(u.createdAt)}`);
      const total = await db.collection('userloginsessions').countDocuments({ user_id: u._id });
      const sessions = await db.collection('userloginsessions').find(
        { user_id: u._id, login_time: { $gte: since } },
        { projection: { session_id: 0 } },
      ).sort({ login_time: 1 }).toArray();
      console.log(`  sessions total=${total}, last ${DAYS}d=${sessions.length}`);
      for (const s of sessions) {
        console.log(`  ${IST(s.login_time)} ${s.device_type.padEnd(6)} active=${s.login_status} ended/updated=${s.login_status ? '-' : IST(s.updatedAt)} lastAct=${IST(s.last_activity)} ip=${s.ip_address} ua=${(s.device_info || '').slice(0, 90)}`);
      }
    }
  }

  const day = new Date(Date.now() - 864e5);
  const heavy = await db.collection('userloginsessions').aggregate([
    { $match: { customer_id, login_time: { $gte: day }, device_type: 'mobile' } },
    { $group: { _id: '$user_id', n: { $sum: 1 }, ips: { $addToSet: '$ip_address' }, uas: { $addToSet: '$device_info' } } },
    { $match: { n: { $gte: 3 } } },
    { $sort: { n: -1 } },
  ]).toArray();
  const allMobile = await db.collection('userloginsessions').countDocuments({ customer_id, login_time: { $gte: day }, device_type: 'mobile' });
  console.log(`\n### baseline last 24h: ${allMobile} mobile logins; ${heavy.length} users with >= 3`);
  for (const h of heavy.slice(0, 15)) console.log(`  ${h._id} n=${h.n} distinctIPs=${h.ips.length} distinctUAs=${h.uas.length}`);

  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
