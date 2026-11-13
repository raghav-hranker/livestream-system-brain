// Replace Vidyagram's stored AppX admin cookie with one copied from a logged-in browser.
// Prompts for the ci_session value without echoing it, checks it against the CMS dashboard,
// and only then writes it to apxsessions (orgId 2177599) and marks the session active.
//
// Run from the tenant worktree so its .env.development and node_modules are used:
//   cd ~/Projects/worktrees/vg-backend && \
//   NODE_PATH=$PWD/node_modules DOTENV_CONFIG_PATH=.env.development \
//   node -r dotenv/config ~/Projects/system-brain/reference/scripts/vidyagram-set-apx-session.cjs
const mongoose = require('mongoose');
const axios = require('axios');

const ORG_ID = '2177599';
const CUSTOMER_ID = '781';
const DB_NAME = 'vidyagramdb';
const CMS = 'https://cms.appx.co.in';

function promptHidden(question) {
  return new Promise((resolve) => {
    process.stdout.write(question);
    const stdin = process.stdin;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let value = '';
    stdin.on('data', function onData(ch) {
      if (ch === '\r' || ch === '\n' || ch === '\u0004') {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener('data', onData);
        process.stdout.write('\n');
        resolve(value.trim());
      } else if (ch === '\u0003') {
        process.exit(130);
      } else if (ch === '\u007f') {
        value = value.slice(0, -1);
      } else {
        value += ch;
      }
    });
  });
}

(async () => {
  const sid = (await promptHidden('Paste the ci_session cookie value (hidden): ')).replace(/^ci_session=/, '');
  if (!/^[A-Za-z0-9,-]{16,}$/.test(sid)) throw new Error('that does not look like a ci_session value');

  const res = await axios.get(`${CMS}/dashboard`, {
    headers: { Cookie: `ci_session=${sid}`, 'User-Agent': 'Mozilla/5.0 Chrome/148.0.0.0' },
    family: 4,
    maxRedirects: 0,
    validateStatus: () => true,
    timeout: 30000,
  });
  const html = String(res.data);
  if (res.status !== 200 || /\/login/.test(String(res.headers.location || ''))) {
    throw new Error(`AppX rejected the cookie (HTTP ${res.status}); log in again and copy a fresh one`);
  }
  if (!/armaths/i.test(html)) throw new Error('the cookie works but the dashboard is not the Vidyagram (armaths) org; not saved');

  await mongoose.connect(process.env.MONGO_URI, { dbName: DB_NAME, readPreference: 'primary' });
  const col = mongoose.connection.db.collection('apxsessions');
  const r = await col.updateOne(
    { orgId: ORG_ID },
    {
      $set: {
        session_id: sid,
        customerId: CUSTOMER_ID,
        isActive: true,
        consecutiveLoginRedirects: 0,
        lastHttpStatus: 200,
        lastCheckedAt: new Date(),
        updatedAt: new Date(),
      },
      $unset: { lastError: '' },
    },
  );
  console.log(r.matchedCount === 1 ? 'Saved. Vidyagram AppX session is active again.' : 'No apxsessions doc for org 2177599; nothing saved.');
  await mongoose.disconnect();
})().catch((e) => {
  console.error('Not saved:', e.message);
  process.exit(1);
});
