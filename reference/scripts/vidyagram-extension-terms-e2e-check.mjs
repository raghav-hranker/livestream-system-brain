#!/usr/bin/env node
// By-hand API check of Vidyagram extension terms against a LOCAL backend seeded by
// vidyagram-extension-terms-e2e-seed.cjs (2026-10-26). Refuses a non-localhost base URL.
//
//   node vidyagram-extension-terms-e2e-check.mjs http://localhost:5932 <seed out.json>
//
// Logs in as the seeded admin, then checks: the default, the lapsed student's listed offers,
// the preview against those listings, a bulk save, the listing after it, and an undo.
// Writes nothing outside the local database; leaves the plans as the seed made them.
import fs from 'node:fs';

const [base, seedFile] = process.argv.slice(2);
if (!base || !seedFile) { console.error('usage: <base url> <seed out.json>'); process.exit(2); }
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base)) { console.error(`refusing: ${base} is not local`); process.exit(1); }
const seed = JSON.parse(fs.readFileSync(seedFile, 'utf8'));

let failures = 0;
const check = (ok, label, detail = '') => { if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`); };
const call = async (method, path, { token, body } = {}) => {
    const res = await fetch(base + path, {
        method,
        headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, json: await res.json().catch(() => null) };
};

const login = await call('POST', '/api/admins/login', { body: { email: seed.admin.email, password: seed.admin.password } });
const admin = login.json?.data?.token;
check(login.status === 200 && !!admin, 'admin login', `status ${login.status}`);
if (!admin) process.exit(1);

const byName = Object.fromEntries(seed.plans.map(p => [p.name, p.id]));
const ids = seed.plans.map(p => p.id);

const listing = async () => {
    const res = await call('POST', `/api/plans/filter-active/${seed.student.userId}`, { token: seed.student.token, body: {} });
    const rows = res.json?.data?.plans ?? res.json?.data ?? [];
    return new Map((Array.isArray(rows) ? rows : []).map(r => [String(r.id ?? r._id), r]));
};

const defaults = await call('GET', '/api/plans/extension-defaults', { token: admin });
const d = defaults.json?.data;
check(defaults.status === 200 && d?.days === 183 && d?.percent === 50 && d?.minPrice === 125 && d?.source === 'settings-file',
    'default comes from the settings file', JSON.stringify(d && { days: d.days, percent: d.percent, minPrice: d.minPrice, source: d.source, followingPlans: d.followingPlans }));

const before = await listing();
const show = id => { const r = before.get(id); return r ? `${r.amount} for ${r.duration}d, is_expire ${r.is_expire}, "${r.name}"` : 'not listed'; };
for (const p of seed.plans) console.log(`      listing  ${p.name}: ${show(p.id)}`);
const offer = id => { const r = before.get(id); return r && r.is_expire === 1 ? { price: Number(r.amount), days: Number(r.duration) } : null; };
check(JSON.stringify(offer(byName['SSC CGL 2026 Complete Batch'])) === JSON.stringify({ price: 750, days: 183 }), 'default plan offers 50% of 1499 for 183 days');
check(JSON.stringify(offer(byName['Bank PO Foundation'])) === JSON.stringify({ price: 400, days: 365 }), 'custom 40% plan offers 400 for 365 days');
check(JSON.stringify(offer(byName['English Spoken Skills'])) === JSON.stringify({ price: 199, days: 183 }), 'fixed plan offers 199');
check(offer(byName['Railway Group D Test Pass']) === null, 'off plan has no offer');

const preview = await call('POST', '/api/plans/extension-terms/preview', { token: admin, body: { items: ids.map(planId => ({ planId, terms: { kind: 'custom', days: 91, pricing: { kind: 'percent', percent: 30 }, minPrice: 99 } })) } });
const rows = preview.json?.data?.items ?? [];
check(preview.status === 200 && rows.length === ids.length, 'preview answers for every plan', `status ${preview.status}, switchOn ${preview.json?.data?.switchOn}`);
for (const r of rows) console.log(`      preview  ${r.planName}: ${JSON.stringify(r.before)} -> ${JSON.stringify(r.after)}`);
const listedNow = rows.filter(r => offer(r.planId) && r.planName !== 'Reasoning Masterclass (old)');
check(listedNow.every(r => JSON.stringify(r.before) === JSON.stringify(offer(r.planId))), 'preview "before" equals what the student is offered now');

const target = [byName['SSC CGL 2026 Complete Batch'], byName['Railway NTPC Crash Course'], byName['Bank PO Foundation']];
const terms = { kind: 'custom', days: 91, pricing: { kind: 'percent', percent: 30 }, minPrice: 99 };
const pre = await call('POST', '/api/plans/extension-terms/preview', { token: admin, body: { items: target.map(planId => ({ planId, terms })) } });
const save = await call('PUT', '/api/plans/extension-terms', { token: admin, body: { items: target.map(planId => ({ planId, terms })) } });
check(save.status === 200 && save.json?.data?.modified === 3, 'bulk save changes 3 plans', JSON.stringify(save.json?.data));

const after = await listing();
const afterOffer = id => { const r = after.get(id); return r && r.is_expire === 1 ? { price: Number(r.amount), days: Number(r.duration), name: r.name } : null; };
for (const item of pre.json?.data?.items ?? []) {
    const got = afterOffer(item.planId);
    check(!!got && got.price === item.after?.price && got.days === item.after?.days, `listing after save matches preview: ${item.planName}`, got ? `${got.price} / ${got.days}d / "${got.name}"` : 'no offer');
}

const undo = await call('PUT', '/api/plans/extension-terms', { token: admin, body: { items: (pre.json?.data?.items ?? []).map(i => ({ planId: i.planId, terms: i.currentTerms })) } });
check(undo.status === 200 && undo.json?.data?.modified === 3, 'undo restores 3 plans', JSON.stringify(undo.json?.data));
const restored = await listing();
check(target.every(id => JSON.stringify(restored.get(id)?.amount) === JSON.stringify(before.get(id)?.amount)), 'listing after undo equals the start');

const student = await call('PUT', '/api/plans/extension-terms', { token: seed.student.token, body: { items: [{ planId: target[0], terms }] } });
check(student.status === 403, 'student token refused', `status ${student.status}`);

console.log(failures ? `\n${failures} FAILED` : '\nALL PASS');
process.exit(failures ? 1 : 0);
