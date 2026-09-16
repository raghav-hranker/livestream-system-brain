# Manager: profile → container env, guard rows

**Type:** AFK  
**Status:** `ready-for-agent`  
**ADR:** [0007](../../../adr/0007-shorts-readiness-via-transcode-callback.md) decisions 4, 5

## Repo

`repos/video-transcoder`, branch `launch/quicktricks-v2`. Files: `gpu-server/job-manager/secured-guard.js`
(`evaluateSecuredSpawn`, pure and total), `gpu-server/job-manager/manager.js` (standard spawn branch,
around the `evaluateSecuredSpawn(clientId, process.env, { required })` call). Tests:
`test/secured-guard.test.js`, `test/hls-manager-refusal.test.js` (pattern for a manager-level test).

## What to build

1. **Guard input**: `evaluateSecuredSpawn(clientId, env, { required, reporting })` where `reporting`
   is `job.config.profile?.reporting`. New rows, in this order, before the existing ones:
   - `reporting?.kind === 'callback'` and `required` ⇒ `{ allow:false, env:[], refusal:'…lane requires secured reporting but the profile declares a callback…' }`.
   - `callback` and the client has no secret (`resolveClient(clientId, env).hasSecret === false`) ⇒
     refuse, message names `TRANSCODER_SECRET_<clientId>` only, never a value.
   - `callback` with secret ⇒ `{ allow:true, env:['REPORTING=callback', `REPORT_CALLBACK_URL=${url}`, `TRANSCODER_SECRET=${secret}`], refusal:null }`.
     **Never** `SECURED=true` on this row, regardless of `SECURED_CLIENTS` membership.
   - Any other `reporting.kind` (unknown) ⇒ ignore it: fall through to today's rows. Absent ⇒ today.
2. **Manager**: pass `reporting: job.config?.profile?.reporting` at the standard-path call. The 1C
   path (`hls-to-mp4`) does not carry a profile; leave its call untouched.
3. **Processing env**, outside the guard, in the standard `containerEnv` build:
   `if (job.config?.profile?.mp4 === false) containerEnv.push('MP4_RENDITIONS=false')`.
4. **Log line**: `Callback reporting — injected transcoder secret (value redacted)` alongside the
   existing secured log, and log the callback URL host only.

## Acceptance criteria

- [ ] Guard tests: all six existing tests unchanged and green. New: callback + secret ⇒ exact env
      array, no `SECURED=true`; callback + client **in** `SECURED_CLIENTS` + secret ⇒ same, still no
      `SECURED=true`; callback + no secret ⇒ refuse, message contains the var name and no `=`;
      callback + `required` ⇒ refuse; `reporting: { kind: 'wat' }` ⇒ identical to absent for a secured
      and an unsecured client; the URL never appears in a refusal.
- [ ] Manager-level test (refusal-test pattern): a job with `profile.mp4 === false` spawns with
      `MP4_RENDITIONS=false` in env; a job without it has no `MP4_RENDITIONS` key; a job with a callback
      profile and a secret spawns with the three env entries and no `SECURED`.
- [ ] `npm test` green.

## Do not

- Match bucket names or queue names in the manager. Touch `secured-clients.js`. Change the 1C path.
- Wrap anything in try/catch to make a refused job "succeed".
