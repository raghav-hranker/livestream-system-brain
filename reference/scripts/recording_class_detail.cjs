// READ-ONLY. Lifecycle fields of given classes, plus the latest classes by startDate, to pair with recording_readiness.cjs.
// Run on webserver2-2 from the backend checkout, fed over ssh stdin:
//   CLASS_IDS=<id>,<id> DOTENV_CONFIG_PATH=.env.development node -r dotenv/config - < recording_class_detail.cjs
const path = require('path');
const m = require(path.join(process.cwd(), 'node_modules/mongoose'));

const ist = (d) => (d ? new Date(new Date(d).getTime() + 5.5 * 36e5).toISOString().slice(0, 16).replace('T', ' ') : '-');
const fields = { title: 1, startDate: 1, createdAt: 1, updatedAt: 1, isLive: 1, status: 1, streamStatus: 1, hlsAsset: 1, class_link: 1 };
const line = (c) => `${c._id}  start ${ist(c.startDate)}  created ${ist(c.createdAt)}  updated ${ist(c.updatedAt)}  isLive=${c.isLive ? 1 : 0} status=${c.status ?? '-'}  stream=${c.streamStatus ?? '-'}  asset=${c.hlsAsset ? `${c.hlsAsset.bucket}:${c.hlsAsset.key}` : '-'}  link=${c.class_link ? 'y' : 'n'}  ${String(c.title ?? '').slice(0, 45)}`;

(async () => {
  await m.connect(process.env.MONGO_URI);
  const classes = m.connection.db.collection('classes');
  const ids = (process.env.CLASS_IDS || '').split(',').filter(Boolean).map((id) => new m.Types.ObjectId(id));
  const asked = await classes.find({ _id: { $in: ids } }, { projection: fields }).toArray();
  console.log('asked:');
  for (const c of asked) console.log(line(c));
  const now = Date.now();
  // CREATED_DAYS=30 adds streamStatus counts per IST day created, for tenants whose classes carry no startDate.
  if (process.env.CREATED_DAYS) {
    const rows = {};
    const recent = await classes.find({ createdAt: { $gte: new Date(now - Number(process.env.CREATED_DAYS) * 864e5) }, isLive: true }, { projection: { createdAt: 1, streamStatus: 1 } }).toArray();
    for (const c of recent) {
      const r = (rows[ist(c.createdAt).slice(0, 10)] ||= {});
      r[c.streamStatus ?? 'none'] = (r[c.streamStatus ?? 'none'] || 0) + 1;
    }
    console.log('\nisLive classes per day created, by streamStatus:');
    for (const d of Object.keys(rows).sort()) console.log(d, JSON.stringify(rows[d]));
  }
  const around = await classes.find({ startDate: { $gte: new Date(now - 2 * 864e5), $lte: new Date(now + 864e5) } }, { projection: fields }).sort({ startDate: 1 }).toArray();
  console.log('\nscheduled from 2 days ago to tomorrow:');
  for (const c of around) console.log(line(c));
  await m.disconnect();
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
