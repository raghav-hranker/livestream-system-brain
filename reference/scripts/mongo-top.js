const t1 = db.adminCommand({top: 1}).totals;
const seen = {};
for (let i = 0; i < 20; i++) {
  db.getSiblingDB('admin').aggregate([{$currentOp: {allUsers: true}}, {$match: {active: true, ns: {$not: /^(local|admin)\./}}}]).toArray().forEach(o => {
    const k = `${o.ns} ${o.op} ${o.planSummary || ''} ${(o.client || '').split(':')[0]}`;
    const d = Number(o.docsExamined || 0);
    if (!seen[k]) seen[k] = {n: 0, maxDocs: 0, cmd: ''};
    seen[k].n++;
    if (d >= seen[k].maxDocs) { seen[k].maxDocs = d; seen[k].cmd = JSON.stringify(o.command || {}).slice(0, 300); }
  });
  sleep(500);
}
const t2 = db.adminCommand({top: 1}).totals;
const rows = Object.keys(t2).filter(k => k !== 'note' && t1[k])
  .map(k => ({ns: k, ms: (t2[k].total.time - t1[k].total.time) / 1000, n: t2[k].total.count - t1[k].total.count,
    rms: (t2[k].readLock.time - t1[k].readLock.time) / 1000, wms: (t2[k].writeLock.time - t1[k].writeLock.time) / 1000}))
  .sort((a, b) => b.ms - a.ms).slice(0, 12);
print('== top by time (10s window):');
rows.forEach(r => print(`  ${r.ms.toFixed(0).padStart(8)} ms (r ${r.rms.toFixed(0)} / w ${r.wms.toFixed(0)})  ${String(r.n).padStart(6)} ops  ${r.ns}`));
print('== sampled active ops (20 samples over 10s):');
Object.entries(seen).sort((a, b) => b[1].n - a[1].n).slice(0, 12)
  .forEach(([k, v]) => print(`  seen ${v.n}x maxDocsExamined=${v.maxDocs} ${k}\n     ${v.cmd}`));
