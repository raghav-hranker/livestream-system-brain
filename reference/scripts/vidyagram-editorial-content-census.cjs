// Read-only: what PYP Dictionary + Daily Editorial content sits in adminPanelDB (toppers, which the Vidyagram app
// borrows today) versus vidyagramdb, so we can size moving the feature. Counts, names and date ranges only; no
// student data, no journal text. Run on webserver2-2 from the Vidyagram checkout:
//   cd /var/www/backend.vidyagramar.com/vidyagram-backend
//   URI=$(grep -E '^MONGO_URI=' .env.development | cut -d= -f2- | tr -d '"') nice -n 10 node - < script
const mongoose = require('mongoose');

const DBS = ['adminPanelDB', 'vidyagramdb'];
const EXPLORE_PLAN_ID = '69f8e245bcfd15c67da0fa35'; // hard-coded in vidyagram-backend getExploreEditorial
const NAME_RE = /word|editorial|phonetic|paragraph/i;

const hostOf = (u) => { try { return new URL(u).host; } catch { return u ? 'not-a-url' : 'none'; } };

async function census(db, vgDb) {
  const vgUsers = vgDb && vgDb.collection('users');
  const out = { db: db.databaseName };
  const cols = (await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name).filter((n) => NAME_RE.test(n)).sort();
  out.collections = {};
  for (const c of cols) out.collections[c] = await db.collection(c).estimatedDocumentCount();

  const ej = db.collection('editorialjournals');
  out.journals = await ej.aggregate([
    { $group: { _id: { type: '$type', active: '$isActive', free: '$isFree' }, n: { $sum: 1 }, first: { $min: '$date' }, last: { $max: '$date' } } },
    { $sort: { '_id.type': 1, '_id.active': -1 } },
  ]).toArray();
  out.journalTags = (await ej.distinct('tag')).length;
  out.journalMediaHosts = await ej.aggregate([
    { $project: { h: [{ $ifNull: ['$imageUrl', ''] }, { $ifNull: ['$audioUrl', ''] }] } }, { $unwind: '$h' }, { $match: { h: { $ne: '' } } },
    { $group: { _id: '$h', n: { $sum: 1 } } },
  ]).toArray().then((rows) => {
    const m = {}; for (const r of rows) { const h = hostOf(r._id); m[h] = (m[h] || 0) + r.n; } return m;
  });
  const seriesIds = await ej.distinct('seriesIds');
  const series = seriesIds.length
    ? await db.collection('series').find({ _id: { $in: seriesIds } }, { projection: { series_name: 1, status: 1 } }).toArray()
    : [];
  out.journalSeries = { linkedIds: seriesIds.length, foundHere: series.length, sample: series.slice(0, 8).map((s) => s.series_name) };
  if (vgUsers) out.journalSeries.inVidyagramdb = seriesIds.length ? await vgDb.collection('series').countDocuments({ _id: { $in: seriesIds } }) : 0;

  out.words = await db.collection('words').aggregate([
    { $group: { _id: '$type', n: { $sum: 1 }, first: { $min: '$date' }, last: { $max: '$date' } } }, { $sort: { _id: 1 } },
  ]).toArray();

  out.plans = await db.collection('plans').find(
    { $or: [{ isEditorial: true }, { isVocab: true }, { _id: new mongoose.Types.ObjectId(EXPLORE_PLAN_ID) }] },
    { projection: { name: 1, title: 1, amount: 1, discountPrice: 1, status: 1, customer_id: 1, isEditorial: 1, isVocab: 1 } },
  ).toArray().then((ps) => ps.map((p) => ({
    id: String(p._id), name: p.name || p.title, amount: p.amount, discountPrice: p.discountPrice, status: p.status,
    customer_id: p.customer_id, editorial: !!p.isEditorial, vocab: !!p.isVocab, explorePlan: String(p._id) === EXPLORE_PLAN_ID,
  })));

  // How many Vidyagram students already have reading-test rows in this DB (ids only compared, never printed).
  if (vgUsers) {
    const ids = await db.collection('userphonetics').distinct('user_id');
    const oids = ids.filter((x) => mongoose.Types.ObjectId.isValid(String(x))).map((x) => new mongoose.Types.ObjectId(String(x)));
    out.userphoneticsUsers = { distinct: ids.length, vidyagramUsers: oids.length ? await vgUsers.countDocuments({ _id: { $in: oids } }) : 0 };
    // paragraphresults.user points at userphonetics._id, so the userphonetics count covers results too.
    out.userphoneticsByCustomer = await db.collection('userphonetics').aggregate([{ $group: { _id: '$customer_id', n: { $sum: 1 } } }]).toArray();
  }
  return out;
}

(async () => {
  const conn = await mongoose.createConnection(process.env.URI, { readPreference: 'secondaryPreferred' }).asPromise();
  const vgDb = conn.useDb('vidyagramdb', { useCache: true }).db;
  for (const name of DBS) {
    const db = conn.useDb(name, { useCache: true }).db;
    console.log(JSON.stringify(await census(db, name === 'adminPanelDB' ? vgDb : null), null, 1));
  }
  await conn.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
