// Read-only. Lists the Vidyagram admins who cannot pass the admin login OTP: no mobile on the record, or one
// that does not normalise to 10 digits. Mirrors adminController.ts: the mobile is admin_mobile || Mobile ||
// mobile, digits only, last 10. With ADMIN_OTP_REQUIRED on (the default since admin-audit-trail task 06) these
// admins get 403 ADMIN_MOBILE_REQUIRED, so add their numbers before that deploy. Prints id, name, email,
// status, role (and admin_type, customer_id, the masked mobile and why it is unusable), active admins first.
// Every admin in the database is listed: login does not filter on customer_id.
// Refuses any database but vidyagramdb, before connecting. Run on the box from the Vidyagram backend checkout:
//   cd /var/www/backend.vidyagramar.com/vidyagram-backend && node ~/vidyagram-admins-without-mobile.js [--json]
// ENV_FILE (default .env.development) is read relative to the working directory.
// Dynamic imports only, so it runs as CommonJS on the box and as ESM inside system-brain ("type": "module").
(async () => {
  const { createRequire } = await import('module');
  const fs = await import('fs');
  const path = await import('path');
  const r = createRequire(`${process.cwd()}/package.json`);
  const { MongoClient } = r('mongoose').mongo;

  const env = fs.readFileSync(path.resolve(process.cwd(), process.env.ENV_FILE || '.env.development'), 'utf8');
  const envVar = (k) => (env.match(new RegExp(`^${k}=(.*)$`, 'm')) || [])[1]?.trim().replace(/^['"]|['"]$/g, '');
  const asJson = process.argv.includes('--json');

  const normalise = (v) => {
    const digits = String(v || '').replace(/\D/g, '');
    return digits.length > 10 ? digits.slice(-10) : digits;
  };
  const mask = (v) => (!v ? '' : v.length <= 4 ? '****' : `${v.slice(0, 2)}****${v.slice(-2)}`);

  const client = new MongoClient(envVar('MONGO_URI'), { serverSelectionTimeoutMS: 15000, readPreference: 'secondaryPreferred' });
  const db = client.db();
  if (db.databaseName !== 'vidyagramdb') throw new Error(`refusing: database is ${db.databaseName}`);
  await client.connect();
  try {
    const admins = await db.collection('admins')
      .find({}, { projection: { Name: 1, Email: 1, status: 1, role: 1, admin_type: 1, customer_id: 1, admin_mobile: 1, Mobile: 1, mobile: 1 } })
      .toArray();
    const rows = admins
      .map((a) => {
        const raw = a.admin_mobile || a.Mobile || a.mobile;
        const mobile = normalise(raw);
        const reason = !mobile ? 'no mobile' : mobile.length !== 10 ? `${mobile.length} digits` : null;
        return {
          id: String(a._id), name: a.Name ?? '', email: a.Email ?? '', status: a.status ?? null, role: a.role ?? '',
          admin_type: a.admin_type ?? '', customer_id: a.customer_id ?? null, mobile: mask(mobile), reason,
        };
      })
      .filter((row) => row.reason)
      .sort((x, y) => Number(y.status === 1) - Number(x.status === 1) || x.email.localeCompare(y.email));

    if (asJson) {
      console.log(JSON.stringify(rows, null, 2));
    } else {
      const active = rows.filter((row) => row.status === 1).length;
      console.log(`database ${db.databaseName}: ${admins.length} admins, ${rows.length} without a usable mobile (${active} active)`);
      for (const row of rows) {
        console.log([row.id, row.name, row.email, `status=${row.status}`, `role=${row.role}`, `type=${row.admin_type}`,
          `customer=${row.customer_id}`, row.reason + (row.mobile ? ` (${row.mobile})` : '')].join('\t'));
      }
    }
  } finally {
    await client.close();
  }
})().catch((error) => { console.error(error.message); process.exit(1); });
