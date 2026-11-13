// read-only: a quicktricks user by mobile -> playback mints (views, last 4 days; viewedAt second = token issuedAt),
// login devices, telemetry counts, latest classprogresses. Feed the VIEW seconds to cf_user_sessions.sh.
// run: ssh webserver2-2 "cd <backend> && MOB=<10 digits> NODE_PATH=$PWD/node_modules DOTENV_CONFIG_PATH=.env.development node -r dotenv/config -" < qt_user_playback.cjs
const mongoose = require('mongoose');
(async () => {
  await mongoose.connect(process.env.MONGO_URI, { readPreference: 'secondaryPreferred' });
  const db = mongoose.connection.db;
  const m = process.env.MOB, re = new RegExp(m);
  const ist = d => d ? new Date(new Date(d).getTime() + 19800000).toISOString().slice(0, 19).replace('T', ' ') : '-';
  const users = await db.collection('users').find({ $or: [{ mobile: { $in: [Number(m), Number('91' + m), m, '91' + m] } }, { mobile: { $type: 'string', $regex: re } }] })
    .project({ name: 1, last_name: 1, customer_id: 1, usersApxId: 1, last_logged_in: 1, createdAt: 1, signup_device: 1 }).toArray();
  console.log('users', users.length);
  for (const u of users) {
    console.log(`== ${u._id} ${u.name || ''} cust=${u.customer_id} apx=${u.usersApxId || '-'} joined=${ist(u.createdAt)} last_login=${ist(u.last_logged_in)} signup=${u.signup_device}`);
    const idq = { $in: [u._id, String(u._id)] };
    const since = new Date(Date.now() - 4 * 86400000);
    const views = await db.collection('views').find({ userId: idq, viewedAt: { $gte: since } }).sort({ viewedAt: 1 }).toArray();
    const cls = new Map((await db.collection('classes').find({ _id: { $in: [...new Set(views.map(v => String(v.classId)))].map(i => new mongoose.Types.ObjectId(i)) } },
      { projection: { title: 1, isLive: 1, streamStatus: 1, hlsAsset: 1 } }).toArray()).map(c => [String(c._id), c]));
    console.log(`views (playback mints) since ${ist(since)}: ${views.length}`);
    for (const v of views) {
      const c = cls.get(String(v.classId)) || {};
      console.log(['VIEW', ist(v.viewedAt), Math.floor(new Date(v.viewedAt).getTime() / 1000), String(v.classId), (c.title || '-').slice(0, 45),
        `live=${c.isLive} st=${c.streamStatus || '-'} bucket=${c.hlsAsset && c.hlsAsset.bucket || '-'}`, JSON.stringify(Object.fromEntries(Object.entries(v).filter(([k]) => !/^(_id|userId|classId|viewedAt|__v)$/.test(k)))).slice(0, 120)].join('\t'));
    }
    const sess = await db.collection('userloginsessions').find({ $or: [{ userId: idq }, { user_id: idq }] }).sort({ _id: -1 }).limit(6).toArray();
    for (const s of sess) console.log('SESSION', ist(s.createdAt || s._id.getTimestamp()), 'active=' + s.isActive, JSON.stringify(s.device_info || s.deviceInfo || '').slice(0, 200));
    for (const n of ['playbacktelemetrysessions', 'playbacktelemetryevents'])
      console.log(n, await db.collection(n).countDocuments({ $or: [{ userId: idq }, { user_id: idq }] }));
    const prog = await db.collection('classprogresses').find({ $or: [{ userId: idq }, { user_id: idq }, { user: u._id }] }).sort({ updatedAt: -1 }).limit(8).toArray();
    for (const p of prog) console.log('PROGRESS', ist(p.updatedAt), String(p.classId || p.class_id || ''), JSON.stringify(Object.fromEntries(Object.entries(p).filter(([k]) => /position|watch|duration|percent|complete|device/i.test(k)))).slice(0, 160));
  }
  await mongoose.disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
