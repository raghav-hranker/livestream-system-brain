// Read-only, refuses any DB but vidyagramdb: what still depends on AppX after the migration. Classes by playback
// source (our hlsAsset / YouTube link / nothing) x apxAssetKey kind, split by student-visible (Class.status 1 and an
// active CourseClass); Pdfs with and without our pdfAsset; courses and ebooks whose image is on an AppX host.
// Pairs with vidyagram-url-host-census.cjs. Run on webserver2-2 from the Vidyagram checkout:
// URI=<MONGO_URI from .env.development> node - < script
const mongoose = require('mongoose');
const APPX = /classx\.co\.in|akamai\.net\.in|kaxa\.in|securevideo\.in|appx\.co\.in|cloud-front\.in|bytepluses\.com/i;
(async () => {
  await mongoose.connect(process.env.URI, { serverSelectionTimeoutMS: 8000, readPreference: 'secondaryPreferred' });
  const db = mongoose.connection.db;
  if (db.databaseName !== 'vidyagramdb') throw new Error('refusing: connected to ' + db.databaseName);

  const visible = new Set((await db.collection('courseclasses').distinct('class', { status: 1, isActive: { $ne: false } })).map(String));
  const classes = await db.collection('classes').find({}, { projection: { hlsAsset: 1, link: 1, apxAssetKey: 1, status: 1, image: 1, title: 1 } }).toArray();
  const kind = (k) => !k ? 'none' : /^https?:/.test(k) ? (/\.mp4/i.test(k) ? 'url-mp4' : /\.m3u8/i.test(k) ? 'url-m3u8' : 'url-other') : k.split(':')[0];
  const grid = {}; const examples = {};
  for (const c of classes) {
    const play = c.hlsAsset ? 'ours-hls' : /youtu/i.test(c.link || '') ? 'youtube' : c.link ? 'other-link' : 'nothing';
    const vis = c.status === 1 && visible.has(String(c._id)) ? 'visible' : 'hidden';
    const key = `${play} | ${kind(c.apxAssetKey)} | ${vis}`;
    grid[key] = (grid[key] || 0) + 1;
    if (play !== 'ours-hls' && play !== 'youtube' && !examples[key]) examples[key] = { id: String(c._id), title: (c.title || '').slice(0, 60) };
  }
  const imageHosts = {};
  for (const c of classes) { const h = c.image ? (APPX.test(c.image) ? 'appx' : new URL(c.image).host) : 'none'; imageHosts[h] = (imageHosts[h] || 0) + 1; }
  console.log('classes:', classes.length, 'visible:', classes.filter((c) => c.status === 1 && visible.has(String(c._id))).length);
  console.log('playback | apxAssetKey kind | student visibility:'); for (const [k, n] of Object.entries(grid).sort()) console.log('  ', k.padEnd(48), n);
  console.log('no-playback examples:', JSON.stringify(examples));
  console.log('class image hosts:', JSON.stringify(imageHosts));

  console.log('class hlsAsset buckets:', JSON.stringify(await db.collection('classes').aggregate([
    { $group: { _id: { bucket: '$hlsAsset.bucket', prefix: { $arrayElemAt: [{ $split: ['$hlsAsset.key', '/'] }, 0] } }, n: { $sum: 1 } } }]).toArray()));

  const pdfs = db.collection('pdfs');
  console.log('pdf pdfAsset buckets:', JSON.stringify(await pdfs.aggregate([
    { $group: { _id: { bucket: '$pdfAsset.bucket', prefix: { $arrayElemAt: [{ $split: ['$pdfAsset.key', '/'] }, 0] } }, n: { $sum: 1 } } }]).toArray()));
  console.log('pdfs by pdfAsset x apx source:', JSON.stringify(await pdfs.aggregate([
    { $group: { _id: { ours: { $gt: ['$pdfAsset.key', null] }, apxSource: { $gt: ['$apxAssetKey', null] }, status: '$status' }, n: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]).toArray()));
  const pdfUrlFields = await pdfs.find({ $or: ['pdfUrl', 'url', 'fileUrl', 'uploadPdf'].map((f) => ({ [f]: { $regex: APPX.source, $options: 'i' } })) }, { projection: { _id: 1 } }).limit(5).toArray();
  console.log('pdfs with an AppX host in a served url field (pdfUrl/url/fileUrl/uploadPdf):', pdfUrlFields.length);

  const courses = await db.collection('courses').find({}, { projection: { title: 1, banner: 1, status: 1, image: 1 } }).toArray();
  const appxBanner = courses.filter((c) => APPX.test(c.banner || ''));
  const ytBanner = courses.filter((c) => /ytimg/.test(c.banner || ''));
  console.log('courses:', courses.length, 'AppX banner:', appxBanner.length, '(status 1:', appxBanner.filter((c) => c.status === 1).length + ')',
    'YouTube-thumb banner:', ytBanner.length, 'no banner:', courses.filter((c) => !c.banner).length);
  console.log('ebooks with AppX image:', await db.collection('ebooks').countDocuments({ image1: { $regex: APPX.source, $options: 'i' } }));
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
