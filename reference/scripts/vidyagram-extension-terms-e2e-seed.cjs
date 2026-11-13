#!/usr/bin/env node
// Seeds a SCRATCH local Mongo for a by-hand check of Vidyagram extension terms (2026-10-26).
// Local only: refuses any URI that isn't localhost/127.0.0.1. Never point it at rs0.
//
//   NODE_PATH=~/Projects/worktrees/vg-backend/node_modules \
//   JWT_SECRET=<the local backend's secret> node vidyagram-extension-terms-e2e-seed.cjs mongodb://127.0.0.1:27032/ <out.json>
//
// Writes: one admin (generated password, no mobile so login skips OTP), three courses, eight plans
// (default, custom percent, custom fixed, off, inactive, cheap, combo, no lapsed holder) and one student
// whose orders on the first six plans lapsed yesterday. Writes the admin login and the student token
// to <out.json> (mode 600; keep it out of chat and git).
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
const DAY = 864e5;
const now = new Date();

(async () => {
    const client = await MongoClient.connect(uri, { directConnection: true });
    const db = client.db('vidyagramdb');

    const password = crypto.randomBytes(12).toString('base64url');
    const adminEmail = 'e2e-admin@vidyagram.test';
    await db.collection('admins').deleteMany({ Email: adminEmail });
    await db.collection('admins').insertOne({
        _id: new ObjectId(), Name: 'E2E Admin', Email: adminEmail, Psw: await bcrypt.hash(password, 10),
        status: 1, role: 'admin', admin_type: 1, customer_id: CUSTOMER_ID, createdAt: now, updatedAt: now,
    });

    const courses = [];
    for (const title of ['SSC CGL 2026 Complete', 'Bank PO Foundation', 'Railway NTPC Crash Course']) {
        const _id = new ObjectId();
        await db.collection('courses').insertOne({ _id, title, status: 1, isFree: false, price: 999, customer_id: CUSTOMER_ID, createdAt: now, updatedAt: now });
        courses.push(_id);
    }

    const planDefs = [
        ['SSC CGL 2026 Complete Batch', 1499, 365, 1, [courses[0]], undefined, true],
        ['Bank PO Foundation', 999, 183, 1, [courses[1]], { kind: 'custom', days: 365, pricing: { kind: 'percent', percent: 40 }, minPrice: null }, true],
        ['English Spoken Skills', 499, 183, 1, [courses[0]], { kind: 'custom', days: null, pricing: { kind: 'fixed', amount: 199 }, minPrice: null }, true],
        ['Railway Group D Test Pass', 149, 90, 1, [courses[2]], { kind: 'off' }, true],
        ['Reasoning Masterclass (old)', 599, 365, 0, [courses[1]], undefined, true],
        ['Railway NTPC Crash Course', 299, 90, 1, [courses[2]], undefined, true],
        ['Bank PO + SSC Combo', 1799, 365, 1, [courses[0], courses[1]], undefined, false],
        ['State PCS Prelims 2026', 2499, 365, 1, [courses[0]], undefined, false],
    ];
    const plans = [];
    for (const [i, [name, amount, duration, status, course, extensionTerms]] of planDefs.entries()) {
        const _id = new ObjectId();
        await db.collection('plans').insertOne({
            _id, name, title: name, amount: String(amount), duration, status, course, packages: [], practiceBatch: [],
            displayOn: ['packages', 'course', 'studyPlan', 'plans'], priority: i + 1, customer_id: CUSTOMER_ID,
            isExtension: false, upgradationEnabled: false, upgradationPlanIds: [],
            ...(extensionTerms ? { extensionTerms } : {}),
            createdAt: new Date(now.getTime() - (planDefs.length - i) * 60e3), updatedAt: now,
        });
        plans.push({ id: String(_id), name });
    }

    const userId = new ObjectId();
    await db.collection('users').insertOne({ _id: userId, first_name: 'Lapsed', last_name: 'Student', mobile: `9${String(Date.now()).slice(-9)}`, customer_id: CUSTOMER_ID });
    for (const [i, [, amount, duration, , course, , lapsed]] of planDefs.entries()) {
        if (!lapsed) continue;
        const orderDate = new Date(now.getTime() - (duration + 1) * DAY);
        await db.collection('orders').insertOne({
            userId: String(userId), planId: plans[i].id, orderStatus: 'success', status: 1, customer_id: CUSTOMER_ID,
            grandTotal: amount, gateway: 'razorpay', orderNumber: `ORD-${new ObjectId()}`, duration,
            courseId: course, orderDate, createdAt: orderDate, expireDate: new Date(now.getTime() - DAY),
        });
    }
    const studentToken = jwt.sign({ user_id: String(userId), customer_id: CUSTOMER_ID }, process.env.JWT_SECRET, { expiresIn: '2d' });

    fs.writeFileSync(outFile, JSON.stringify({ admin: { email: adminEmail, password }, student: { userId: String(userId), token: studentToken }, plans }, null, 2), { mode: 0o600 });
    console.log(JSON.stringify({ plans, studentUser: String(userId), wrote: outFile }));
    await client.close();
})().catch((err) => { console.error(err); process.exit(1); });
