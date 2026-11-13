// WRITES with COMMIT=1: turns off password_setup_required on ONE quicktricks student whose real password was already
// saved (an admin edit via updateUser leaves the flag on, and login then rejects every password).
// Touches only that field. The filter needs id, customer 472 and the matching email, so a wrong id changes nothing.
// Dry run without COMMIT=1. Undo: same command with UNDO=1 COMMIT=1. Never prints the hash, full mobile or a token.
// run: ssh webserver2-2 "cd <quicktricks checkout> && USER_ID=<id> EMAIL=<email> COMMIT=1 NODE_PATH=$PWD/node_modules DOTENV_CONFIG_PATH=.env.development node -r dotenv/config -" < qt_user_clear_password_flag.cjs
const mongoose = require('mongoose');

(async () => {
  const { USER_ID, EMAIL, COMMIT, UNDO } = process.env;
  if (!USER_ID || !EMAIL) throw new Error('USER_ID and EMAIL are required');
  await mongoose.connect(process.env.MONGO_URI, { readPreference: 'primary' });
  const users = mongoose.connection.db.collection('users');
  const fromValue = UNDO === '1' ? false : true;
  const filter = {
    _id: new mongoose.Types.ObjectId(USER_ID),
    customer_id: { $in: [472, '472'] },
    email: EMAIL,
    password_setup_required: fromValue,
  };
  const show = u => u
    ? `${u._id} customer=${u.customer_id} status=${u.status} password_setup_required=${u.password_setup_required} hashIsBcrypt=${/^\$2[aby]\$/.test(u.password || '')}`
    : 'no row';
  const projection = { customer_id: 1, status: 1, password_setup_required: 1, password: 1 };

  const before = await users.findOne(filter, { projection });
  console.log(`db=${mongoose.connection.db.databaseName} before: ${show(before)}`);
  if (!before) throw new Error('no row matches id + customer + email + current flag; nothing changed');
  if (!/^\$2[aby]\$/.test(before.password || '')) throw new Error('stored password is not a bcrypt hash; nothing changed');

  if (COMMIT !== '1') {
    console.log('dry run: nothing changed (set COMMIT=1)');
  } else {
    const result = await users.updateOne(filter, { $set: { password_setup_required: !fromValue } });
    console.log(`matched=${result.matchedCount} modified=${result.modifiedCount}`);
    console.log(`after:  ${show(await users.findOne({ _id: before._id }, { projection }))}`);
  }
  await mongoose.disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
