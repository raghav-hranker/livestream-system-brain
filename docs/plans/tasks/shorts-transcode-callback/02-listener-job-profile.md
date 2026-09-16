# Listener: per-(queue, client) job profile

**Type:** AFK  
**Status:** `ready-for-agent`  
**ADR:** [0007](../../../adr/0007-shorts-readiness-via-transcode-callback.md) decision 1

## Repo

`repos/video-transcoder`, branch `launch/quicktricks-v2`. Files: `src/intake-routing.js`
(`assembleCloudflareQueues`), `src/index.ts` (`IntakeQueue`, `processQueue.resolveJob`,
`submitJobToRedis`). Tests: `test/cloudflare-queues.test.js`, `test/intake-enqueue.test.js`,
`test/secure-intake-wiring.test.js` (pattern for a compiled-listener test).

## What to build

1. **`envPrefix` on every queue definition** in `assembleCloudflareQueues`: `CF` (the two primary
   queues), `CF_BACKUP`, `CF_HRANKER`, `CF_SECURE`. A config-lookup key only; no behaviour branches on
   it or on `queue.name`.
2. **Pure resolver** in `intake-routing.js`:
   `resolveQueueProfile(prefix, clientId, env) → { reporting?: { kind:'callback', url }, mp4?: false } | undefined`
   reading `${prefix}_REPORT_CALLBACK_URL_${clientId}` and `${prefix}_MP4_RENDITIONS_${clientId}`
   (`'false'` only; anything else ⇒ field absent). URL must parse and be `https:`; anything else
   throws with the env var **name** in the message.
3. **Boot validation** `validateQueueProfiles(queues, env)`: for every queue, every env key matching
   `^${prefix}_REPORT_CALLBACK_URL_(\w+)$` must resolve without throwing, so a typo kills the listener
   at start (same posture as the `CF_SECURE_*` required() checks). Called from `init()`.
4. **Stamp it**: `resolveJob(clientId)` returns `profile: resolveQueueProfile(queue.envPrefix, clientId, process.env)`
   for all queues; `submitJobToRedis` copies `profile: jobData.profile` into `config` next to
   `secured`. `undefined` is dropped by `JSON.stringify`, so unaffected jobs are byte-identical.

## Acceptance criteria

- [ ] `resolveQueueProfile` unit tests: no env ⇒ `undefined`; URL only; mp4 only; both; `http:` URL
      throws naming the var; `MP4_RENDITIONS_x=no` ⇒ no `mp4` field; client suffix isolation
      (`…_472` never leaks to `…_695`).
- [ ] `assembleCloudflareQueues` output for each queue carries the expected `envPrefix`; existing
      assertions unchanged.
- [ ] Compiled-listener test (secure-intake-wiring pattern): a `tempvideos-hranker` event for `472`
      with the two env vars set enqueues a job whose `config.profile` deep-equals the expected object
      **and** whose `config` otherwise deep-equals the pre-change job; the same event with no env
      enqueues a job with no `profile` key at all. A secure-lane job never carries `profile` unless its
      own `CF_SECURE_*_472` vars are set.
- [ ] `validateQueueProfiles` test: a bad URL under any prefix throws at boot.
- [ ] `npm test` green; `npx tsc --noEmit` clean.

## Do not

- Read `SECURED_CLIENTS` or any secret in the listener. Decide reporting here. Reference a bucket
  name in the resolver. Add a `lane` or `shorts` field anywhere.
