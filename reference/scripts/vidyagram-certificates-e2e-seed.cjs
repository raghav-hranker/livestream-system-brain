#!/usr/bin/env node
// Seeds a SCRATCH local Mongo for a by-hand end-to-end check of Vidyagram certificates (2026-10-24).
// Local only: refuses any URI that isn't localhost/127.0.0.1. Never point it at rs0.
//
//   NODE_PATH=~/Projects/worktrees/vg-backend/node_modules \
//   JWT_SECRET=<the local backend's secret> node vidyagram-certificates-e2e-seed.cjs mongodb://127.0.0.1:27031/?replicaSet=rs0 <out.json>
//
// Writes: one admin (generated password, no mobile so login skips OTP), a paid course with three classes,
// a student who bought it and ticked every class, and a second student who ticked only one.
// Prints ids; writes the admin login and student tokens to <out.json> (keep it out of chat and git).
const crypto = require('crypto');
const fs = require('fs');
const { MongoClient, ObjectId } = require('mongoose').mongo;
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const [uri, outFile] = process.argv.slice(2);
if (!uri || !outFile) { console.error('usage: <mongo uri> <out.json>'); process.exit(2); }
if (!/^mongodb:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(uri)) { console.error(`refusing: ${uri} is not local`); process.exit(1); }
if (!process.env.JWT_SECRET) { console.error('JWT_SECRET is required (the local backend secret)'); process.exit(2); }

const CUSTOMER_ID = 781;
const now = new Date();

(async () => {
    const client = await MongoClient.connect(uri, { directConnection: true });
    const db = client.db('vidyagramdb');

    const password = crypto.randomBytes(12).toString('base64url');
    const adminEmail = 'e2e-admin@vidyagram.test';
    await db.collection('admins').deleteMany({ Email: adminEmail });
    const adminId = new ObjectId();
    await db.collection('admins').insertOne({
        _id: adminId, Name: 'E2E Admin', Email: adminEmail, Psw: await bcrypt.hash(password, 10),
        status: 1, role: 'admin', admin_type: 1, customer_id: CUSTOMER_ID, createdAt: now, updatedAt: now,
    });

    const courseId = new ObjectId();
    await db.collection('courses').insertOne({
        _id: courseId, title: 'SSC CGL 2026 — गणित फाउंडेशन बैच', status: 1, isFree: false, price: 999,
        isLive: false, isRecorded: true, customer_id: CUSTOMER_ID, createdAt: now, updatedAt: now,
    });
    const topic = new ObjectId();
    const classIds = [];
    for (const [i, title] of ['Mensuration Part 18', 'Mensuration Part 19', 'Revision: Mensuration full chapter'].entries()) {
        const classId = new ObjectId();
        classIds.push(classId);
        await db.collection('classes').insertOne({
            _id: classId, title, status: 1, duration: 3600, streamStatus: 'ended', topic,
            customer_id: CUSTOMER_ID, createdAt: now, updatedAt: now,
        });
        await db.collection('courseclasses').insertOne({
            course: courseId, class: classId, topic, priority: i + 1, status: 1, isActive: true, createdAt: now, updatedAt: now,
        });
    }

    const student = async (first, last, ticked) => {
        const _id = new ObjectId();
        await db.collection('users').insertOne({ _id, first_name: first, last_name: last, mobile: `9${String(Date.now()).slice(-9)}`, customer_id: CUSTOMER_ID });
        const userId = String(_id);
        await db.collection('orders').insertOne({
            userId, orderStatus: 'success', status: 1, customer_id: CUSTOMER_ID, grandTotal: 999, gateway: 'razorpay',
            orderNumber: `ORD-${new ObjectId()}`, duration: 365, courseId: [courseId],
            expireDate: new Date(Date.now() + 300 * 864e5), createdAt: now,
        });
        for (const classId of classIds.slice(0, ticked)) {
            await db.collection('classprogresses').insertOne({
                userId, classId: String(classId), courseId, duration: 0, manualCompleted: true, createdAt: now, updatedAt: now,
            });
        }
        return { userId, token: jwt.sign({ user_id: userId, customer_id: CUSTOMER_ID }, process.env.JWT_SECRET, { expiresIn: '2d' }) };
    };
    const done = await student('Rahul', 'Sharma', 3);
    const partial = await student('Priya', 'Verma', 1);

    fs.writeFileSync(outFile, JSON.stringify({ admin: { email: adminEmail, password }, courseId: String(courseId), done, partial }, null, 2), { mode: 0o600 });
    console.log(JSON.stringify({ courseId: String(courseId), classes: classIds.map(String), doneUser: done.userId, partialUser: partial.userId, wrote: outFile }));
    await client.close();
})().catch((err) => { console.error(err); process.exit(1); });
