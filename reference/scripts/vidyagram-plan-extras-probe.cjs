// Read-only. Refuses any DB but vidyagramdb. For one course (COURSE_ID): what its main plans list that the course
// form's attach row doesn't ("Also on this course's plan"), which records those are, and the admin history rows
// that touched those plans. Run on webserver2-2 from the Vidyagram checkout:
// COURSE_ID=<id> node -r dotenv/config - dotenv_config_path=.env.development < script
const mongoose = require('mongoose');
const { ObjectId } = mongoose.Types;
const short = (v, n = 400) => { const s = JSON.stringify(v); return s && s.length > n ? s.slice(0, n) + '…' : s; };
(async () => {
  const courseId = String(process.env.COURSE_ID || '');
  if (!/^[0-9a-f]{24}$/.test(courseId)) throw new Error('set COURSE_ID');
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 8000, readPreference: 'secondaryPreferred' });
  const db = mongoose.connection.db;
  if (db.databaseName !== 'vidyagramdb') throw new Error('refusing: connected to ' + db.databaseName);
  const course = await db.collection('courses').findOne({ _id: new ObjectId(courseId) }, { projection: { title: 1, status: 1, selling: 1, apxCourseId: 1, apx: 1 } });
  if (!course) throw new Error('no such course');
  const attached = (course.selling && course.selling.attached) || {};
  const subs = (course.selling && course.selling.combo && course.selling.combo.on && course.selling.combo.subCourses) || [];
  console.log('COURSE', short({ title: course.title, status: course.status, attached, combo: course.selling && course.selling.combo }, 1500));

  const plans = await db.collection('plans').find({ 'courseSale.courseId': new ObjectId(courseId), 'courseSale.key': /^main:/ }).toArray();
  const listed = new Set([courseId, ...subs.map(String), ...(attached.courses || []).map(String)]);
  const extraIds = new Set();
  for (const p of plans) {
    const courses = (Array.isArray(p.course) ? p.course : []).map(String);
    const extra = courses.filter(id => !listed.has(id));
    extra.forEach(id => extraIds.add(id));
    const { course: _c, packages, ebook, description, ...rest } = p;
    console.log('\nPLAN', String(p._id), short({ ...rest, packages: (packages || []).length, ebook: (ebook || []).length }, 1500));
    console.log('  plan.course =', courses.join(', '));
    console.log('  extra       =', extra.join(', ') || '(none)');
  }

  for (const id of extraIds) {
    const extra = await db.collection('courses').findOne({ _id: new ObjectId(id) });
    if (!extra) { console.log('\nEXTRA', id, 'NOT FOUND in courses'); continue; }
    const apxKeys = Object.keys(extra).filter(k => /apx|appx|source|import/i.test(k));
    console.log('\nEXTRA', id, short({ title: extra.title, status: extra.status, isFree: extra.isFree, price: extra.price, createdAt: extra.createdAt, updatedAt: extra.updatedAt, createdBy: extra.createdBy, selling: !!extra.selling, ...Object.fromEntries(apxKeys.map(k => [k, extra[k]])) }, 1500));
    const sameTitle = await db.collection('courses').find({ title: extra.title }).project({ status: 1, createdAt: 1 }).toArray();
    console.log('  courses with this exact title:', sameTitle.map(c => `${c._id} status ${c.status}`).join(' | '));
    const itsPlans = await db.collection('plans').find({ course: { $in: [id, new ObjectId(id)] } }).project({ name: 1, title: 1, status: 1, amount: 1, 'courseSale.key': 1, 'courseSale.courseId': 1 }).toArray();
    console.log('  plans listing it:', itsPlans.map(p => short(p, 300)).join('\n    '));
  }

  const planIds = plans.flatMap(p => [p._id, String(p._id)]);
  const logs = await db.collection('auditlogs').find({ 'target.collection': 'plans', 'target.id': { $in: planIds } }).sort({ at: 1 }).limit(60).toArray();
  console.log('\nAUDIT rows on these plans:', logs.length);
  for (const l of logs) {
    const { _id, userAgent, ip, sessionId, ...rest } = l;
    const text = JSON.stringify(rest);
    const touchesCourse = [...extraIds].some(id => text.includes(id)) || /"course"/.test(text);
    console.log(' ', l.at && l.at.toISOString(), l.kind, l.op || '', l.method || '', l.route || l.path || '', short(l.actor, 200), touchesCourse ? '\n    ' + short(rest, 1800) : '');
    if (l.before || l.after) console.log('    course before =', short((l.before || {}).course, 600), '\n    course after  =', short((l.after || {}).course, 600));
  }
  await mongoose.disconnect();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
