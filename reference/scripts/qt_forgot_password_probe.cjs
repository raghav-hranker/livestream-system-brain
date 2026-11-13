// read-only: can Forgot Password work for this tenant? Works from either tenant's backend checkout (uses its own env).
// 1) SMTP: logs in to the mail server with the box's MAIL_* settings (transporter.verify, sends nothing).
// 2) Users of this customer: how many are still flagged password_setup_required (login ignores their stored hash,
//    so an emailed temp password cannot log in) and how many have no email (nothing is sent, password still changes).
// Prints counts and the SMTP result only; never a password, hash, address or the MAIL_PASS value.
// run: ssh webserver2-2 "cd <backend checkout> && CUSTOMER=<472|781> NODE_PATH=$PWD/node_modules DOTENV_CONFIG_PATH=.env.development node -r dotenv/config -" < qt_forgot_password_probe.cjs
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');

(async () => {
  const e = process.env;
  console.log(`smtp host=${e.MAIL_HOST} port=${e.MAIL_PORT} secure=${e.MAIL_SECURE} userSet=${!!e.MAIL_USER} passSet=${!!e.MAIL_PASS} fromSet=${!!e.MAIL_FROM}`);
  const t0 = Date.now();
  try {
    await nodemailer.createTransport({
      host: e.MAIL_HOST, port: Number(e.MAIL_PORT) || 587, secure: e.MAIL_SECURE === 'true',
      auth: { user: e.MAIL_USER, pass: e.MAIL_PASS }, connectionTimeout: 15000, greetingTimeout: 15000,
    }).verify();
    console.log(`smtp verify: OK in ${Date.now() - t0} ms`);
  } catch (err) {
    console.log(`smtp verify: FAILED in ${Date.now() - t0} ms code=${err.code} responseCode=${err.responseCode || '-'} msg=${String(err.message).slice(0, 200)}`);
  }

  await mongoose.connect(e.MONGO_URI, { readPreference: 'secondaryPreferred' });
  const db = mongoose.connection.db;
  const customer = Number(e.CUSTOMER || e.CUSTOMER_ID);
  if (!customer) throw new Error('CUSTOMER is required (472 quicktricks, 781 Vidyagram)');
  console.log(`db=${db.databaseName} customer=${customer}`);
  const users = db.collection('users');
  const base = { customer_id: customer, status: { $ne: 0 } };
  const noEmail = { $or: [{ email: { $exists: false } }, { email: null }, { email: '' }] };
  const [total, flagged, emailless, flaggedWithEmail] = await Promise.all([
    users.countDocuments(base),
    users.countDocuments({ ...base, password_setup_required: true }),
    users.countDocuments({ ...base, ...noEmail }),
    users.countDocuments({ ...base, password_setup_required: true, email: { $nin: [null, ''] } }),
  ]);
  console.log(`active users=${total} flagged(password_setup_required)=${flagged} noEmail=${emailless} flaggedWithEmail=${flaggedWithEmail}`);
  await mongoose.disconnect();
})().catch(err => { console.error(err.message); process.exit(1); });
