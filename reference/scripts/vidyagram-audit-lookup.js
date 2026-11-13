// Read-only. Answers "what happened" from the Vidyagram admin history (vidyagramdb `auditlogs`, admin-audit-trail
// tasks 10 and 15). Read vidyagram/reference/admin-history-known-gaps.md first: it lists the writes the history
// cannot see. Every listing ends with that reminder.
//   --collection classes --id <id>                  one record's timeline (an ObjectId, or any other stored id),
//                                                    bulk rows that sampled it included
//   --admin <id|email> [--from D] [--to D]          everything one admin did, grouped by request (default: last 7 days)
//   --deletes [--days N]                            every delete, by any actor (default 7 days)
//   --request <requestId>                           one request and every change it made
//   --actor no-login|unknown|job[:<name>]|script[:<name>] [--days N]   changes by that kind of actor, grouped by request
//   --limit N                                       newest N rows only (default 500)
//   --json                                          the rows as JSON instead (the reminder goes to stderr)
// D is an IST date (2026-10-30), an IST time (2026-10-30 14:05) or any ISO time with its zone; --to on a bare date
// means the end of that day. Times print in IST. A change prints its fields as `+ added`, `- removed`, `~ changed`,
// nested fields by dotted path; arrays compare whole. A field cut to fit the 256 KB cap shows as
// `<truncated N bytes>`. `updatedAt` is left out of the changes.
// Row shapes (backend services/audit/recorder.ts): a multi-record write is ONE bulk row, `target.id` null,
// `bulk: { filter, count, sampled }` with the filter as one EJSON string (null for an insert), and `before`/`after`
// arrays of the first 200 records by _id, index by index (`after[i]` null: that record is gone). A record past the
// first 200 is in the count but has no copy, so its timeline can't show that write. A sensitive read is a request row
// with `read: { what, filter, count }` (filter an EJSON string; count null when the response doesn't say).
// Refuses any database but vidyagramdb, before connecting. Run on the box from the Vidyagram backend checkout:
//   cd /var/www/backend.vidyagramar.com/vidyagram-backend && node ~/vidyagram-audit-lookup.js --deletes --days 3
// ENV_FILE (default .env.development) is read relative to the working directory.
// Dynamic imports only, so it runs as CommonJS on the box and as ESM inside system-brain ("type": "module").
(async () => {
  const { createRequire } = await import('module');
  const fs = await import('fs');
  const path = await import('path');
  const r = createRequire(`${process.cwd()}/package.json`);
  const { MongoClient, ObjectId } = r('mongoose').mongo;

  const GAPS = 'Known gaps: writes the history cannot see are listed in system-brain vidyagram/reference/admin-history-known-gaps.md';
  const USAGE = [
    'usage: --collection <name> --id <id> | --admin <id|email> [--from D] [--to D] | --deletes [--days N]',
    '       | --request <requestId> | --actor no-login|unknown|job[:<name>]|script[:<name>] [--days N]',
    '       [--limit N] [--json]',
    'Read first: system-brain vidyagram/reference/admin-history-known-gaps.md (the writes the history cannot see).',
  ].join('\n');
  const arg = (name) => {
    const at = process.argv.indexOf(`--${name}`);
    return at === -1 ? undefined : process.argv[at + 1];
  };
  const has = (name) => process.argv.includes(`--${name}`);
  const limit = Number(arg('limit') || 500);
  const days = Number(arg('days') || 7);
  const asJson = has('json');
  const modes = ['collection', 'admin', 'deletes', 'request', 'actor'].filter(has);
  if (modes.length !== 1 || (modes[0] === 'collection' && !arg('id'))) throw new Error(USAGE);
  if (!(limit > 0) || !(days > 0)) throw new Error(USAGE);

  // IST has no daylight saving: a fixed +05:30.
  const IST_MS = 330 * 60_000;
  const ist = (at) => new Date(new Date(at).getTime() + IST_MS).toISOString().replace('T', ' ').slice(0, 19) + ' IST';
  const parseDate = (text, endOfDay) => {
    if (!text) return undefined;
    const bare = text.match(/^(\d{4}-\d\d-\d\d)(?:[ T](\d\d:\d\d(?::\d\d)?))?$/);
    const at = bare
      ? new Date(`${bare[1]}T${bare[2] || (endOfDay ? '23:59:59.999' : '00:00')}+05:30`)
      : new Date(text);
    if (Number.isNaN(at.getTime())) throw new Error(`bad date: ${text}`);
    return at;
  };

  const env = fs.readFileSync(path.resolve(process.cwd(), process.env.ENV_FILE || '.env.development'), 'utf8');
  const envVar = (k) => (env.match(new RegExp(`^${k}=(.*)$`, 'm')) || [])[1]?.trim().replace(/^['"]|['"]$/g, '');

  const client = new MongoClient(envVar('MONGO_URI'), { serverSelectionTimeoutMS: 15000, readPreference: 'secondaryPreferred' });
  const db = client.db();
  if (db.databaseName !== 'vidyagramdb') throw new Error(`refusing: database is ${db.databaseName}`);
  await client.connect();

  const show = (v, max = 100) => {
    const text = v === undefined ? '(none)' : JSON.stringify(v);
    return text.length > max ? `${text.slice(0, max - 3)}...` : text;
  };
  const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date) && !(v instanceof ObjectId);
  // Field-level difference, dotted paths for nested objects; arrays compare whole. `kind`: added, removed, changed.
  const diff = (before, after, prefix = '') => {
    const out = [];
    const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
    for (const key of keys) {
      if (!prefix && (key === 'updatedAt' || key === '__v')) continue;
      const a = before?.[key];
      const b = after?.[key];
      const field = `${prefix}${key}`;
      if (isPlain(a) && isPlain(b)) out.push(...diff(a, b, `${field}.`));
      else if (a === undefined && b !== undefined) out.push({ field, kind: 'added', after: b });
      else if (a !== undefined && b === undefined) out.push({ field, kind: 'removed', before: a });
      else if (JSON.stringify(a) !== JSON.stringify(b)) out.push({ field, kind: 'changed', before: a, after: b });
    }
    return out;
  };
  const diffLine = (change) => (change.kind === 'added' ? `+ ${change.field}: ${show(change.after)}`
    : change.kind === 'removed' ? `- ${change.field}: ${show(change.before)}`
      : `~ ${change.field}: ${show(change.before)} -> ${show(change.after)}`);
  const who = (actor = {}) => {
    if (actor.type === 'admin') return `admin ${actor.name || '?'} <${actor.email || '?'}> ${actor.adminId}`;
    if (actor.type === 'student') return `student ${actor.userId}`;
    if (actor.type === 'job') return `job:${actor.job}`;
    if (actor.type === 'script') return `script:${actor.script}`;
    return actor.type || 'unknown';
  };
  // A record's own name, so a delete or insert line says what it was.
  const label = (doc) => {
    const name = doc && (doc.title ?? doc.name ?? doc.email ?? doc.mobile);
    return name === undefined || name === null ? '' : ` ${show(String(name), 60)}`;
  };
  const objectIdOrString = (id) => (ObjectId.isValid(id) && String(new ObjectId(id)) === id ? [new ObjectId(id), id] : [id]);

  const isBulk = (row) => Boolean(row.bulk) || Array.isArray(row.before) || Array.isArray(row.after);
  const sameId = (copy, ids) => copy && ids.some((id) => String(copy._id) === String(id));
  // One sampled record of a bulk row: its pair of copies, as a created / deleted / gone line or its field changes.
  const printPair = (before, after, op, pad) => {
    if (!before) console.log(`${pad}created${label(after)}`);
    else if (!after) console.log(`${pad}${op === 'delete' ? 'deleted' : 'gone after the write'}${label(before)}`);
    else for (const change of diff(before, after)) console.log(`${pad}${diffLine(change)}`);
  };
  // `focus`: the ids of the one record a timeline is about; only its pair of a bulk row is printed.
  const printChange = (row, indent, header = true, focus = null) => {
    const pad = ' '.repeat(indent);
    const bulk = isBulk(row);
    if (header) console.log(`${pad}${ist(row.at)}  ${row.op} ${row.target?.collection} ${bulk ? '(bulk)' : row.target?.id}  ${who(row.actor)}`);
    if (bulk) {
      const b = row.bulk || {};
      console.log(`${pad}    bulk: ${b.filter === null || b.filter === undefined ? 'no filter (an insert)' : `filter ${b.filter.length > 300 ? `${b.filter.slice(0, 297)}...` : b.filter}`}`
        + `  count ${b.count ?? '?'}  sampled ${b.sampled ?? '?'}`);
      const before = Array.isArray(row.before) ? row.before : [];
      const after = Array.isArray(row.after) ? row.after : [];
      const pairs = Math.max(before.length, after.length);
      const indexes = [...Array(pairs).keys()].filter((i) => !focus || sameId(before[i], focus) || sameId(after[i], focus));
      const shown = focus ? indexes : indexes.slice(0, 5);
      for (const i of shown) {
        if (!focus) console.log(`${pad}    copy ${before[i]?._id ?? after[i]?._id ?? i}`);
        printPair(before[i], after[i], row.op, `${pad}${focus ? '    ' : '      '}`);
      }
      if (indexes.length > shown.length) console.log(`${pad}    ... ${indexes.length - shown.length} more sampled copies (--json for all)`);
    } else if (row.op === 'insert') console.log(`${pad}    created${label(row.after)}`);
    else if (row.op === 'delete') console.log(`${pad}    deleted${label(row.before)}; the before copy holds ${Object.keys(row.before || {}).length} fields`);
    else for (const change of diff(row.before, row.after)) console.log(`${pad}    ${diffLine(change)}`);
    if (row.truncated) console.log(`${pad}    truncated: ${show(row.truncated, 200)}`);
  };
  const requestLine = (row) => [
    ist(row.at), 'REQUEST', `${row.method || ''} ${row.route || row.path || '-'}`.trim(),
    row.statusCode !== undefined ? `-> ${row.statusCode} ${row.outcome || ''}`.trim() : null,
    who(row.actor), `session=${row.sessionId || '-'}`, `ip=${row.ip || '-'}`,
    row.durationMs !== undefined ? `${row.durationMs} ms` : null, `request=${row.requestId}`,
  ].filter(Boolean).join('  ');
  const printRequestDetail = (row) => {
    if (row.refusal) console.log(`    refused admin token: ${row.refusal.code}${row.refusal.reason ? ` (${row.refusal.reason})` : ''}; the request ran with no login`);
    if (row.read) {
      const filter = row.read.filter || '{}';
      console.log(`    read ${row.read.what || '?'}: filter ${filter.length > 300 ? `${filter.slice(0, 297)}...` : filter}`
        + `  rows ${row.read.count === null || row.read.count === undefined ? 'unknown' : row.read.count}`);
    }
    if (row.body !== undefined && row.body !== null) console.log(`    body: ${show(row.body, 200)}`);
    if (row.truncated) console.log(`    truncated: ${show(row.truncated, 200)}`);
  };
  const printJob = (row) => {
    const changes = Object.entries(row.job?.changes || {}).map(([k, n]) => `${k}=${n}`).join(' ');
    console.log(`${ist(row.at)}  JOB-SUMMARY ${row.job?.name || who(row.actor)}  ${who(row.actor)}  changes: ${changes || '-'}`
      + `${row.durationMs !== undefined ? `  ${row.durationMs} ms` : ''}  request=${row.requestId}`);
  };
  // Rows grouped by request, oldest request first. Each group: its request row (or the first change's context when
  // the request row is missing, as for a job), then every change that request made. The whole request is fetched,
  // not just the rows the filter matched: a refused admin's request row names the admin, but its writes ran with
  // no login, so their change rows don't.
  const printGrouped = async (rows) => {
    const ids = [...new Set(rows.map((row) => row.requestId))];
    const all = await db.collection('auditlogs').find({ requestId: { $in: ids } }).sort({ at: 1, _id: 1 }).toArray();
    const requests = new Map(all.filter((row) => row.kind === 'request').map((row) => [row.requestId, row]));
    for (const id of ids) {
      const group = all.filter((row) => row.requestId === id && row.kind !== 'request');
      const request = requests.get(id);
      console.log('');
      if (request) {
        console.log(requestLine(request));
        printRequestDetail(request);
      } else if (group[0]?.kind !== 'job-summary') {
        const first = group[0];
        console.log(`${ist(first.at)}  ${`${first.method || ''} ${first.route || first.path || ''}`.trim() || '(no request row)'}`
          + `  ${who(first.actor)}  session=${first.sessionId || '-'}  ip=${first.ip || '-'}  request=${id}`);
      }
      for (const row of group) {
        if (row.kind === 'job-summary') printJob(row);
        else printChange(row, 2);
      }
    }
  };
  const find = async (filter) => (await db.collection('auditlogs').find(filter).sort({ at: -1 }).limit(limit).toArray()).reverse();
  const sinceDays = () => ({ $gte: new Date(Date.now() - days * 864e5) });

  try {
    const mode = modes[0];
    let rows;
    let title;
    if (mode === 'collection') {
      const id = arg('id');
      const ids = objectIdOrString(id);
      // Its own change rows, and the bulk rows whose sample holds a copy of it.
      rows = await find({ kind: 'change', 'target.collection': arg('collection'), $or: [
        { 'target.id': { $in: ids } },
        { 'target.id': null, $or: [{ 'before._id': { $in: ids } }, { 'after._id': { $in: ids } }] },
      ] });
      title = `${rows.length} change rows for ${arg('collection')} ${id} (a bulk write that matched it past its first 200 records is not here)`;
    } else if (mode === 'admin') {
      const admin = arg('admin');
      if (!admin) throw new Error(USAGE);
      const from = parseDate(arg('from')) || new Date(Date.now() - 7 * 864e5);
      const to = parseDate(arg('to'), true) || new Date();
      const actor = admin.includes('@')
        ? { 'actor.email': new RegExp(`^${admin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
        : { 'actor.adminId': { $in: objectIdOrString(admin) } };
      rows = await find({ ...actor, at: { $gte: from, $lte: to } });
      title = `${rows.length} rows by admin ${admin}, ${ist(from)} to ${ist(to)}`;
    } else if (mode === 'deletes') {
      rows = await find({ kind: 'change', op: 'delete', at: sinceDays() });
      title = `${rows.length} deletes in the last ${days} days, any actor`;
    } else if (mode === 'request') {
      const id = arg('request');
      if (!id) throw new Error(USAGE);
      rows = (await db.collection('auditlogs').find({ requestId: id }).sort({ at: 1, _id: 1 }).limit(limit).toArray());
      title = `${rows.length} rows for request ${id}`;
    } else {
      const spec = arg('actor') || '';
      const [type, ...rest] = spec.split(':');
      const name = rest.join(':');
      if (!['no-login', 'unknown', 'job', 'script'].includes(type) || (name && !['job', 'script'].includes(type))) throw new Error(USAGE);
      const filter = { 'actor.type': type, at: sinceDays() };
      if (name) filter[`actor.${type}`] = name;
      rows = await find(filter);
      title = `${rows.length} rows by ${spec} in the last ${days} days`;
    }

    if (asJson) {
      // A change row gets its field changes; a bulk row gets them per sampled record, index by index.
      const withChanges = (row) => {
        if (isPlain(row.before) || isPlain(row.after)) return { ...row, changes: diff(row.before, row.after) };
        if (!isBulk(row)) return row;
        const before = Array.isArray(row.before) ? row.before : [];
        const after = Array.isArray(row.after) ? row.after : [];
        const pairs = [...Array(Math.max(before.length, after.length)).keys()]
          .map((i) => ({ _id: before[i]?._id ?? after[i]?._id ?? null, changes: diff(before[i], after[i]) }));
        return { ...row, changes: pairs };
      };
      console.log(JSON.stringify(rows.map(withChanges), null, 2));
      console.error(GAPS);
      return;
    }
    console.log(`database ${db.databaseName}: ${title}${rows.length === limit ? ` (the newest ${limit}; --limit for more)` : ''}`);
    if (mode === 'collection') {
      // The request each change came from: its status and outcome.
      const requests = new Map((await db.collection('auditlogs')
        .find({ kind: 'request', requestId: { $in: [...new Set(rows.map((row) => row.requestId))] } })
        .toArray()).map((row) => [row.requestId, row]));
      for (const row of rows) {
        const request = requests.get(row.requestId);
        console.log([
          ist(row.at), row.op, who(row.actor),
          `session=${row.sessionId || '-'}`, `ip=${row.ip || '-'}`,
          `${row.method || ''} ${row.route || row.path || '-'}`.trim(),
          request ? `-> ${request.statusCode} ${request.outcome}` : null,
          `request=${row.requestId}`,
        ].filter(Boolean).join('  '));
        printChange(row, 0, false, isBulk(row) ? objectIdOrString(arg('id')) : null);
      }
    } else if (mode === 'deletes') {
      for (const row of rows) {
        console.log('');
        printChange(row, 0);
        console.log(`    ${`${row.method || ''} ${row.route || row.path || '-'}`.trim()}  session=${row.sessionId || '-'}  ip=${row.ip || '-'}  request=${row.requestId}`);
      }
    } else {
      await printGrouped(rows);
    }
    console.log('');
    console.log(GAPS);
  } finally {
    await client.close();
  }
})().catch((error) => { console.error(error.message); process.exit(1); });
