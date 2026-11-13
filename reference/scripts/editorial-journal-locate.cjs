// Read-only: which rs0 database holds an editorial journal / user id?
// The phonetics service (voice.hranker.com) reads `editorialjournals` from adminPanelDB only, so a
// journal that lives in vidyagramdb or quicktricksdb 404s there. Prints title + part count, never content.
// Run on webserver2-2 from a fork checkout (needs its mongoose):
//   JOURNAL=<id> USER=<id> URI=$MONGO_URI node - < editorial-journal-locate.cjs
const mongoose = require('mongoose');

const DBS = ['adminPanelDB', 'vidyagramdb', 'quicktricksdb'];
const journalId = process.env.JOURNAL;
const userId = process.env.USER_ID || process.env.USER_OBJ;

(async () => {
  const conn = await mongoose.createConnection(process.env.URI).asPromise();
  for (const name of DBS) {
    const db = conn.useDb(name, { useCache: true }).db;
    const j = journalId
      ? await db.collection('editorialjournals').findOne(
          { _id: new mongoose.Types.ObjectId(journalId) },
          { projection: { title: 1, isActive: 1, createdAt: 1 } }
        )
      : null;
    const u = userId
      ? await db.collection('users').findOne(
          { _id: new mongoose.Types.ObjectId(userId) },
          { projection: { _id: 1, createdAt: 1 } }
        )
      : null;
    const count = await db.collection('editorialjournals').estimatedDocumentCount();
    const phoneticUsers = await db.collection('userphonetics').estimatedDocumentCount().catch(() => 0);
    console.log(JSON.stringify({ db: name, journals: count, userphonetics: phoneticUsers, journal: j, userFound: !!u }));
  }
  await conn.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
