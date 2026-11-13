#!/usr/bin/env node
// Read-only. Runs the deployed GET /api/home/continue service (dist homeContinueFor) for real students
// who sent COURSE_VIEW or WATCH_VIDEO in the last 30 days, and prints one trimmed response for a
// student who owns no course and one for an owner. User ids are masked.
// Usage (on webserver2-2): node vidyagram-home-continue-sample.cjs /var/www/backend.vidyagramar.com/vidyagram-backend
const path = require('path');
const fs = require('fs');
const dir = process.argv[2];
if (!dir) {
  console.error('usage: node vidyagram-home-continue-sample.cjs <backend checkout>');
  process.exit(2);
}
process.chdir(dir);
const envFile = ['.env.development', '.env'].map((name) => path.join(dir, name)).find((file) => fs.existsSync(file));
require(path.join(dir, 'node_modules/dotenv')).config({ path: envFile });
process.env.DISABLE_CRONS = 'true';
const mongoose = require(path.join(dir, 'node_modules/mongoose'));
mongoose.set('autoIndex', false);
const connectDB = require(path.join(dir, 'dist/src/config/db')).default;
const AppEvent = require(path.join(dir, 'dist/src/models/AppEvent')).default;
const { homeContinueFor } = require(path.join(dir, 'dist/src/services/homeContinue.service'));

const mask = (id) => String(id).slice(0, 4) + '…' + String(id).slice(-3);
const trim = (section) => ({
  title: section.title,
  courses: section.courses.map((c) => ({
    id: String(c.id ?? c._id),
    title: c.title,
    continueAction: c.continueAction,
    isPaid: c.isPaid,
    is_buy: c.is_buy,
    isFree: c.isFree,
    price: c.price,
    discountPrice: c.discountPrice,
    banner: c.banner ? 'yes' : 'no',
    demoVideos: Array.isArray(c.demoVideos) ? c.demoVideos.length : null,
    introVideo: c.introVideo ? 'yes' : 'no',
    progress_percentage: c.progress_percentage,
  })),
});

(async () => {
  await connectDB();
  const since = new Date(Date.now() - 30 * 86400000);
  const users = await AppEvent.distinct('userId', {
    occurredAt: { $gte: since },
    eventName: { $in: ['COURSE_VIEW', 'WATCH_VIDEO'] },
    userId: { $nin: [null, ''] },
  });
  console.log(`students with COURSE_VIEW or WATCH_VIDEO in 30 days: ${users.length}`);
  const tally = { owner: 0, unowned: 0, empty: 0 };
  let ownerSample = null;
  let unownedSample = null;
  for (const userId of users) {
    const section = await homeContinueFor(String(userId));
    if (section.courses.length === 0) tally.empty += 1;
    else if (section.title === 'My Courses') { tally.owner += 1; ownerSample ??= { user: mask(userId), ...trim(section) }; }
    else { tally.unowned += 1; unownedSample ??= { user: mask(userId), ...trim(section) }; }
  }
  console.log('sections by kind:', tally);
  console.log('non-owner sample:', JSON.stringify(unownedSample, null, 2));
  console.log('owner sample:', JSON.stringify(ownerSample, null, 2));
  await mongoose.disconnect();
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
