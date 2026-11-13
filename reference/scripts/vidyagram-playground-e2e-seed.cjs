#!/usr/bin/env node
// Seeds a SCRATCH local Mongo for the Course Builder Playground end to end (course-playground task 07, 2026-10-28).
// Local only: refuses any URI that isn't localhost/127.0.0.1. Never point it at rs0.
//
//   NODE_PATH=~/Projects/worktrees/vg-backend/node_modules \
//   JWT_SECRET=<the local backend's secret> node vidyagram-playground-e2e-seed.cjs mongodb://127.0.0.1:27033/ <bundle.json> <out.json>
//
// The bundle comes from vidyagram-playground-export.cjs (real courses, read-only export). This loads it into
// vidyagramdb after emptying those collections, then adds: one admin (generated password, no mobile so login
// skips OTP), one student, and two invented test series placed in two of the courses, because live Vidyagram has
// no course tests yet (invented rows carry `e2eSeed: true`). Writes the admin login and the student token to
// <out.json> (mode 600; keep it out of chat and git). The Mongo must be a replica set: Create uses a transaction.
const crypto = require('crypto');
const fs = require('fs');
const { MongoClient, ObjectId, BSON } = require('mongoose').mongo;
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const [uri, bundleFile, outFile] = process.argv.slice(2);
if (!uri || !bundleFile || !outFile) { console.error('usage: <mongo uri> <bundle.json> <out.json>'); process.exit(2); }
if (!/^mongodb:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(uri)) { console.error(`refusing: ${uri} is not local`); process.exit(1); }
if (!process.env.JWT_SECRET) { console.error('JWT_SECRET is required (the local backend secret)'); process.exit(2); }

const CUSTOMER_ID = 781;
const now = new Date();
const COLLECTIONS = ['courses', 'courseclasses', 'coursetopics', 'coursepdfs', 'coursetests', 'classes', 'pdfs', 'series',
  'sections', 'topics', 'subtopics', 'categories', 'maincategories', 'facultydetails', 'tags'];

(async () => {
  const bundle = BSON.EJSON.parse(fs.readFileSync(bundleFile, 'utf8'), { relaxed: false });
  const client = await MongoClient.connect(uri, { directConnection: true });
  const db = client.db('vidyagramdb');

  const counts = {};
  for (const name of COLLECTIONS) {
    await db.collection(name).deleteMany({});
    const rows = bundle[name] || [];
    if (rows.length) await db.collection(name).insertMany(rows, { ordered: false });
    counts[name] = rows.length;
  }

  // Two invented series placed in the first two courses: one under a topic of the course, one section-wide.
  const [first, second] = bundle.courses;
  const placedTopic = (course) => bundle.courseclasses.find((cc) => String(cc.course) === String(course._id) && cc.topic && cc.section);
  const seriesRows = [];
  for (const [i, course] of [first, second].entries()) {
    const cc = placedTopic(course);
    if (!cc) continue;
    const _id = new ObjectId();
    seriesRows.push({ _id, series_name: `E2E practice test ${i + 1}`, sectionId: cc.section, totalquestion: 25, status: 1, customer_id: CUSTOMER_ID, e2eSeed: true, createdAt: now, updatedAt: now });
    await db.collection('coursetests').insertOne({ course: course._id, test: _id, priority: 1, isActive: true, isFree: false, maxAttemptedLimit: 3,
      ...(i === 0 ? { topic: cc.topic } : {}), e2eSeed: true, createdAt: now, updatedAt: now });
  }
  if (seriesRows.length) await db.collection('series').insertMany(seriesRows);

  const password = crypto.randomBytes(12).toString('base64url');
  const adminEmail = 'e2e-admin@vidyagram.test';
  await db.collection('admins').deleteMany({ Email: adminEmail });
  await db.collection('admins').insertOne({
    _id: new ObjectId(), Name: 'E2E Admin', Email: adminEmail, Psw: await bcrypt.hash(password, 10),
    status: 1, role: 'admin', admin_type: 1, customer_id: CUSTOMER_ID, createdAt: now, updatedAt: now,
  });

  const userId = new ObjectId();
  await db.collection('users').insertOne({ _id: userId, first_name: 'Playground', last_name: 'Student', mobile: `9${String(Date.now()).slice(-9)}`, customer_id: CUSTOMER_ID, e2eSeed: true });
  const studentToken = jwt.sign({ user_id: String(userId), customer_id: CUSTOMER_ID }, process.env.JWT_SECRET, { expiresIn: '2d' });

  fs.writeFileSync(outFile, JSON.stringify({ admin: { email: adminEmail, password }, student: { userId: String(userId), token: studentToken },
    courses: bundle.courses.map((c) => ({ id: String(c._id), title: c.title })) }, null, 2), { mode: 0o600 });
  console.log(JSON.stringify({ loaded: counts, seededTests: seriesRows.length, wrote: outFile }));
  await client.close();
})().catch((err) => { console.error(err); process.exit(1); });
