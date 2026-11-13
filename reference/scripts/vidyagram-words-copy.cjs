// Copies the PYP Dictionary words (adminPanelDB.words, toppers) into vidyagramdb.words.
// Dry run by default. COMMIT=1 inserts only; never updates or deletes a Vidyagram row.
// Content is copied with the same _id; per-student state on the toppers rows (seen, bookmarked, reports) is reset.
// Inserted ids go to LEDGER (default ./vg-words-copy-<UTC date>.ids.json) for undo:
//   UNDO=<ledger file> COMMIT=1 ... deletes exactly those ids from vidyagramdb.words (only rows still unseen/unreported).
// Run on webserver2-2 from the Vidyagram checkout (needs its mongoose):
//   cd /var/www/backend.vidyagramar.com/vidyagram-backend
//   URI=$(grep -E '^MONGO_URI=' .env.development | cut -d= -f2- | tr -d '"') nice -n 10 node - < script
const fs = require('fs');
const mongoose = require('mongoose');

const SRC_DB = 'adminPanelDB';
const DST_DB = 'vidyagramdb';
const COMMIT = process.env.COMMIT === '1';
const today = new Date().toISOString().slice(0, 10);
const LEDGER = process.env.LEDGER || `vg-words-copy-${today}.ids.json`;

// Fields that hold one toppers student's interaction, not dictionary content.
const RESET = {
  isSeen: false, seenAt: null, isBookmarked: false, bookmarkedAt: null,
  isReported: false, lastReportedAt: null, reports: [],
};
const hostOf = (u) => { try { return new URL(u).host; } catch { return 'not-a-url'; } };

async function undo(dst, file) {
  const ids = JSON.parse(fs.readFileSync(file, 'utf8')).map((x) => new mongoose.Types.ObjectId(x));
  const filter = { _id: { $in: ids }, isSeen: { $ne: true }, isBookmarked: { $ne: true }, isReported: { $ne: true } };
  const n = await dst.countDocuments(filter);
  console.log(JSON.stringify({ mode: COMMIT ? 'undo' : 'undo-dry-run', ledgerIds: ids.length, deletable: n }));
  if (COMMIT) console.log(JSON.stringify({ deleted: (await dst.deleteMany(filter)).deletedCount }));
}

(async () => {
  const conn = await mongoose.createConnection(process.env.URI, { readPreference: 'primary' }).asPromise();
  const src = conn.useDb(SRC_DB, { useCache: true }).db.collection('words');
  const dst = conn.useDb(DST_DB, { useCache: true }).db.collection('words');
  if (conn.useDb(DST_DB).db.databaseName !== 'vidyagramdb') throw new Error('destination is not vidyagramdb');
  if (process.env.UNDO) { await undo(dst, process.env.UNDO); await conn.close(); return; }

  const rows = await src.find({}).toArray();
  const dstIds = new Set((await dst.find({}, { projection: { _id: 1 } }).toArray()).map((d) => String(d._id)));
  const dstNames = new Set((await dst.find({}, { projection: { name: 1 } }).toArray()).map((d) => String(d.name).trim().toLowerCase()));

  const seenNames = new Set();
  const toInsert = [];
  const skipped = { idExists: 0, nameExists: 0, dupNameInSource: 0, noName: 0 };
  const stats = { byType: {}, active: 0, free: 0, withImage: 0, imageHosts: {}, withStudentState: 0, withReports: 0 };
  for (const r of rows) {
    const name = String(r.name || '').trim().toLowerCase();
    if (!name) { skipped.noName++; continue; }
    if (dstIds.has(String(r._id))) { skipped.idExists++; continue; }
    if (dstNames.has(name)) { skipped.nameExists++; continue; }
    if (seenNames.has(name)) { skipped.dupNameInSource++; continue; }
    seenNames.add(name);
    stats.byType[r.type] = (stats.byType[r.type] || 0) + 1;
    if (r.isActive) stats.active++;
    if (r.isFree) stats.free++;
    if (r.imageUrl) { stats.withImage++; const h = hostOf(r.imageUrl); stats.imageHosts[h] = (stats.imageHosts[h] || 0) + 1; }
    if (r.isSeen || r.isBookmarked || r.isReported) stats.withStudentState++;
    if (Array.isArray(r.reports) && r.reports.length) stats.withReports++;
    toInsert.push({ ...r, ...RESET });
  }
  const dstIndexes = (await dst.indexes().catch(() => [])).map((i) => i.name);
  console.log(JSON.stringify({ mode: COMMIT ? 'commit' : 'dry-run', source: rows.length, vidyagramBefore: dstIds.size, toInsert: toInsert.length, skipped, stats, dstIndexes }, null, 1));

  if (!COMMIT) { await conn.close(); return; }
  if (!dstIndexes.some((n) => /^name_1/.test(n))) await dst.createIndex({ name: 1 }, { unique: true });
  const inserted = [];
  for (let i = 0; i < toInsert.length; i += 500) {
    const batch = toInsert.slice(i, i + 500);
    try {
      await dst.insertMany(batch, { ordered: false });
    } catch (e) {
      // ordered:false keeps going past duplicates.
      const errs = e.writeErrors ? [].concat(e.writeErrors) : [];
      console.error(`batch ${i}: ${errs.length || 1} write errors, first: ${(errs[0]?.errmsg || e.message).slice(0, 160)}`);
    }
    // None of these ids existed before (filtered above), so any that exist now are ours.
    const landed = await dst.find({ _id: { $in: batch.map((b) => b._id) } }, { projection: { _id: 1 } }).toArray();
    inserted.push(...landed.map((d) => String(d._id)));
    fs.writeFileSync(LEDGER, JSON.stringify(inserted));
  }
  const after = await dst.countDocuments({});
  console.log(JSON.stringify({ inserted: inserted.length, vidyagramAfter: after, ledger: LEDGER }));
  await conn.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
