// Read-only, refuses any DB but vidyagramdb: did the AppX folder pictures reach Vidyagram? Prints the
// course_outline_images row counts by level and source, any image-like field on sections / topics / subtopics /
// coursetopics, and how many FOLDER rows in the mirrored student tree (apxcatalogtree) carry a thumbnail.
// Aggregates only. Run on webserver2-2 from the Vidyagram checkout:
// URI=<MONGO_URI from .env.development> node - < script
const mongoose = require('mongoose');
const IMAGE_FIELDS = ['image', 'imageUrl', 'banner', 'thumbnail', 'icon', 'cover', 'apxImageUrl'];

(async () => {
  await mongoose.connect(process.env.URI, { serverSelectionTimeoutMS: 8000, readPreference: 'secondaryPreferred' });
  const db = mongoose.connection.db;
  if (db.databaseName !== 'vidyagramdb') throw new Error('refusing: connected to ' + db.databaseName);

  const names = (await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name);
  const lookalikes = names.filter((n) => /outline|folder.?image|node.?image/i.test(n));
  console.log('collections like outline/folder image:', JSON.stringify(lookalikes));

  if (names.includes('course_outline_images')) {
    const col = db.collection('course_outline_images');
    console.log('course_outline_images total:', await col.estimatedDocumentCount());
    console.log('by level + source:', JSON.stringify(await col.aggregate([
      { $group: { _id: { level: '$level', source: '$source' }, n: { $sum: 1 } } }, { $sort: { _id: 1 } },
    ]).toArray()));
  } else {
    console.log('course_outline_images: collection does not exist');
  }

  for (const name of ['sections', 'topics', 'subtopics', 'coursetopics']) {
    const col = db.collection(name);
    const total = await col.estimatedDocumentCount();
    const withImage = {};
    for (const f of IMAGE_FIELDS) {
      const n = await col.countDocuments({ [f]: { $exists: true, $nin: [null, ''] } });
      if (n) withImage[f] = n;
    }
    console.log(`${name}: ${total} docs, image-like fields set: ${JSON.stringify(withImage)}`);
  }

  const [tree] = await db.collection('apxcatalogtree').aggregate([
    { $unwind: '$rows' },
    { $match: { 'rows.material_type': { $regex: '^folder$', $options: 'i' } } },
    { $group: {
      _id: null,
      folderRows: { $sum: 1 },
      withThumbnail: { $sum: { $cond: [{ $regexMatch: { input: { $toString: { $ifNull: ['$rows.thumbnail', ''] } }, regex: '^https?://' } }, 1, 0] } },
      courses: { $addToSet: '$apxCourseId' },
      urls: { $addToSet: '$rows.thumbnail' },
    } },
    { $project: { _id: 0, folderRows: 1, withThumbnail: 1, courses: { $size: '$courses' }, distinctThumbnails: { $size: '$urls' } } },
  ], { allowDiskUse: true }).toArray();
  console.log('apxcatalogtree folder rows (all captures):', JSON.stringify(tree));

  await mongoose.disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
