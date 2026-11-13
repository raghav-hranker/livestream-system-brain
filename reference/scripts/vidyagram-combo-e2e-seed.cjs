#!/usr/bin/env node
// Seeds a SCRATCH local Mongo for a by-hand check of the Combo course flag (2026-11-04).
// Local only: refuses any URI that isn't localhost/127.0.0.1. Never point it at rs0.
//
//   NODE_PATH=~/Projects/worktrees/vg-combo-backend/node_modules \
//     node vidyagram-combo-e2e-seed.cjs mongodb://127.0.0.1:27034/ <out.json>
//
// Writes: one admin (generated password, no mobile so login skips OTP), a main category, a category, a
// faculty and two courses that the course form can save. "Imported Batch" has no isCombo field, like the
// courses already on prod. Writes the admin login and the course ids to <out.json> (mode 600; keep it out
// of chat and git).
const crypto = require('crypto');
const fs = require('fs');
const { MongoClient, ObjectId } = require('mongoose').mongo;
const bcrypt = require('bcryptjs');

const [uri, outFile] = process.argv.slice(2);
if (!uri || !outFile) { console.error('usage: <mongo uri> <out.json>'); process.exit(2); }
if (!/^mongodb:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(uri)) { console.error(`refusing: ${uri} is not local`); process.exit(1); }

const CUSTOMER_ID = 781;
const now = new Date();
const IMAGE = 'https://placehold.co/600x400.png';

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

    const mainCategory = new ObjectId();
    const category = new ObjectId();
    const faculty = new ObjectId();
    await db.collection('maincategories').insertOne({ _id: mainCategory, mainCategoryName: 'SSC', mainCategoryImage: IMAGE, status: 1, priority: 1, createdAt: now, updatedAt: now });
    await db.collection('categories').insertOne({ _id: category, categoryName: 'SSC CGL', mainCategory, categoryImage: IMAGE, status: 1, priority: 1, createdAt: now, updatedAt: now });
    await db.collection('facultydetails').insertOne({ _id: faculty, name: 'Vidyagram Team', image: IMAGE, status: 1, createdAt: now, updatedAt: now });

    const courseIds = {};
    for (const [title, flags] of [['Imported Batch', {}], ['Plain Batch', { isCombo: false }]]) {
        const _id = new ObjectId();
        await db.collection('courses').insertOne({
            _id, title, description: `${title} description`, shortDescription: title, mainCategory, category,
            faculties: [faculty], facultyDetails: faculty, banner: IMAGE, bannerWebsite: IMAGE, status: 1, priority: 1,
            price: 999, discountPrice: 599, validity: '365 days', validityType: 'duration', validityValue: 365, validityUnit: 'days',
            isLive: true, isRecorded: false, isFree: false, customer_id: CUSTOMER_ID, createdAt: now, updatedAt: now,
            ...flags,
        });
        courseIds[title] = String(_id);
    }

    fs.writeFileSync(outFile, JSON.stringify({ adminEmail, adminPassword: password, courseIds }, null, 2), { mode: 0o600 });
    console.log(`seeded: ${Object.keys(courseIds).length} courses; login written to ${outFile}`);
    await client.close();
})().catch((err) => { console.error(err); process.exit(1); });
