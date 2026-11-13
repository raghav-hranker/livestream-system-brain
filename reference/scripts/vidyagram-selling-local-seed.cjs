// Local only, in-memory. Starts a throwaway one-node replica set named vidyagramdb on PORT (27041), seeds what the course
// form needs (categories, faculty, one admin with a live session), prints an admin token, and stays up until killed.
// Nothing is saved. NODE_MODULES=<backend node_modules> JWT_SECRET=<local secret> node reference/scripts/vidyagram-selling-local-seed.cjs
const root = (process.env.NODE_MODULES || '').replace(/\/?$/, '/');
const { MongoMemoryReplSet } = require(root + 'mongodb-memory-server');
const { MongoClient, ObjectId } = require(root + 'mongoose').mongo;
const jwt = require(root + 'jsonwebtoken');
const crypto = require('crypto');

(async () => {
  const port = Number(process.env.PORT || 27041);
  const set = await MongoMemoryReplSet.create({ replSet: { count: 1, name: 'rs0', dbName: 'vidyagramdb' }, instanceOpts: [{ port }] });
  const client = await MongoClient.connect(set.getUri());
  const db = client.db('vidyagramdb');
  const now = new Date();
  const adminId = new ObjectId();
  const sessionId = crypto.randomUUID();
  await db.collection('admins').insertOne({ _id: adminId, Name: 'Local Admin', Email: 'local-admin@example.test', Psw: 'not-a-login', role: 'admin', status: 1, customer_id: 781 });
  await db.collection('adminsessions').insertOne({ sessionId, adminId, ip: null, browser: null, createdAt: now, lastSeenAt: now, endedAt: null, endReason: null });
  const mains = [['SSC', ['SSC CGL', 'SSC GD']], ['UP Exams', ['UPSSSC', 'UP Police']]];
  for (const [name, cats] of mains) {
    const { insertedId } = await db.collection('maincategories').insertOne({ mainCategoryName: name, status: 1, priority: 1, customer_id: 781 });
    await db.collection('categories').insertMany(cats.map((categoryName) => ({ categoryName, mainCategory: insertedId, status: 1, priority: 1, customer_id: 781 })));
  }
  await db.collection('facultydetails').insertMany(['Aditya Ranjan Sir', 'Jai Sir', 'Dilawar Sir'].map((name) => ({ name, experience: '10 years', reach: '1M', description: name, status: 1, customer_id: 781 })));
  const token = jwt.sign({ admin_id: String(adminId), session_id: sessionId, role: 'admin', email: 'local-admin@example.test' }, process.env.JWT_SECRET, { expiresIn: '12h' });
  console.log(`READY uri=${set.getUri('vidyagramdb')}`);
  console.log(`TOKEN ${token}`);
  process.on('SIGTERM', async () => { await client.close(); await set.stop(); process.exit(0); });
  setInterval(() => {}, 60000);
})().catch((error) => { console.error(error); process.exit(1); });
