// Adds a PHP-panel client to the video-management app (raghav-hranker/video-management).
// Token sign-in from the PHP admin matches the token's user_id against users.customerId;
// a client with no record lands on /signin ("asks for sign in details").
// WRITES: Atlas cluster0 db `test`, collection `users`. Idempotent: never overwrites an existing record.
//
// Usage: node video_management_add_client.cjs <video-management checkout> <customerId> <password>
// Password convention: the client's lowercase brand name (only used for manual /signin login).
const [checkout, customerId, password] = process.argv.slice(2);
if (!checkout || !/^\d+$/.test(customerId || '') || !password) {
  console.error('usage: node video_management_add_client.cjs <video-management checkout> <numeric customerId> <password>');
  process.exit(2);
}
require(checkout + '/node_modules/dotenv').config({ path: checkout + '/.env' });
const mongoose = require(checkout + '/node_modules/mongoose');

(async () => {
  const conn = await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  const users = conn.connection.db.collection('users');
  const r = await users.updateOne(
    { customerId },
    { $setOnInsert: { customerId, user_id: Number(customerId), password } },
    { upsert: true },
  );
  const doc = await users.findOne({ customerId });
  console.log(`db=${conn.connection.db.databaseName} matched=${r.matchedCount} upserted=${r.upsertedCount}`);
  console.log(JSON.stringify({ _id: doc._id, customerId: doc.customerId, user_id: doc.user_id, hasPassword: !!doc.password }));
  console.log(`records for ${customerId}: ${await users.countDocuments({ customerId })}`);
  await mongoose.disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
