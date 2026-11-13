// read-only: why can't this student log in with a password? Works for either tenant (uses the checkout's own env).
// Mirrors userLogin's lookup, then reports the fields it branches on. Never prints the hash, full mobile or a token.
// LOGIN = email or 10-digit mobile. PW is optional: the password to compare against the stored hash.
// run: ssh webserver2-2 "cd <backend checkout> && LOGIN=<email|mobile> PW=<password> NODE_PATH=$PWD/node_modules DOTENV_CONFIG_PATH=.env.development node -r dotenv/config -" < user_login_probe.cjs
const mongoose = require('mongoose');
let bcrypt;
try { bcrypt = require('bcrypt'); } catch { bcrypt = require('bcryptjs'); }

const ist = d => d ? new Date(new Date(d).getTime() + 19800000).toISOString().slice(0, 19).replace('T', ' ') : '-';
const maskMobile = m => m ? String(m).slice(0, 2) + '******' + String(m).slice(-2) : '-';
const escapeRegex = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

(async () => {
  const login = (process.env.LOGIN || '').trim();
  if (!login) throw new Error('LOGIN is required');
  await mongoose.connect(process.env.MONGO_URI, { readPreference: 'secondaryPreferred' });
  const db = mongoose.connection.db;
  console.log(`db=${db.databaseName}`);

  const isMobile = /^\d+$/.test(login);
  const query = isMobile
    ? { mobile: { $in: [Number(login), login] } }
    : { email: { $regex: `^\\s*${escapeRegex(login)}\\s*$`, $options: 'i' } };
  const rows = await db.collection('users').find(query).project({
    email: 1, mobile: 1, customer_id: 1, status: 1, password: 1, password_setup_required: 1, usersApxId: 1,
    createdAt: 1, updatedAt: 1, last_logged_in: 1, is_login: 1, name: 1,
  }).toArray();
  console.log(`matches (any customer, any case): ${rows.length}`);

  for (const u of rows) {
    const hash = typeof u.password === 'string' ? u.password : '';
    const exactEmail = isMobile ? '-' : u.email === login;
    console.log(`== ${u._id} ${u.name || ''} customer=${u.customer_id} emailExact=${exactEmail} emailLen=${(u.email || '').length} mobile=${maskMobile(u.mobile)} apx=${u.usersApxId || '-'}`);
    console.log(`   status=${u.status} password_setup_required=${u.password_setup_required} hashIsBcrypt=${/^\$2[aby]\$/.test(hash)} hashLen=${hash.length}`);
    console.log(`   created=${ist(u.createdAt)} updated=${ist(u.updatedAt)} last_login=${ist(u.last_logged_in)} is_login=${u.is_login}`);
    if (process.env.PW && hash) {
      console.log(`   PW matches stored hash: ${await bcrypt.compare(process.env.PW, hash)}`);
    }
    const idq = { $in: [u._id, String(u._id)] };
    const sessions = await db.collection('userloginsessions').find({ $or: [{ userId: idq }, { user_id: idq }] }).sort({ _id: -1 }).limit(3).toArray();
    for (const s of sessions) {
      console.log(`   SESSION ${ist(s.createdAt || s._id.getTimestamp())} active=${s.isActive} ${JSON.stringify(s.device_info || s.deviceInfo || '').slice(0, 80)}`);
    }
  }
  await mongoose.disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
