# 01 — video-transcoder `feat/vg-upload-lane` (detail)

Thermo-nuclear code-quality review, 2026-10-21. Review only: nothing was edited, committed or deployed.

- Repo: raghav-hranker/video-transcoder, worktree `~/Projects/worktrees/vt-vg-upload-lane`
- Range: `5524809..f721759` (base = integration/shorts-callback-on-apx, what production ran before)
- Paths below are relative to the worktree. Line numbers are at `f721759`.

## Scope and origin labels

```sh
git diff --stat 5524809..HEAD          # 31 files, +1652 / -96
git log --oneline 5524809..HEAD
```

| label | commits | what |
|---|---|---|
| **472 (merge)** | 58b0afa, cf24a63 (via a0aec97) | 472 → `critical`, cap 2, schedule dropped; client 168 night cap. Came in from launch/quicktricks-v2 through the 781 merge; already on the box as a hand edit. |
| **781 mirror** | fb7d5cd, 23fa3ec, 33db976, b8e9f79, c3e7769 (merged by 1780afd) | apx-ingest secured reporting, per-client output guard, MIRROR_MP4=off, MIRROR_ADD_LEVELS; 781 wired into listener tables + manager |
| **1080p rung** | 5a4cf9b, 0d47e96 | `container/hls-ladder.js`, `processVideoToHls`, profile field `hls.maxHeight`, manager `HLS_MAX_HEIGHT` |
| **output-target attempt** | 40fd792 | per-client output override on the secure lane; replaced by f721759 |
| **CF_VIDYAGRAM lane** | f721759 | dedicated secured lane, `visibilityTimeoutMs`, `intakeCredentials` |

File sizes (base → head), `git show 5524809:<f> | wc -l` vs `wc -l <f>`:

| file | base | head |
|---|---|---|
| container/index.js | 581 | 611 |
| src/index.ts | 896 | 905 |
| src/intake-routing.js | 386 | 453 |
| apx-ingest-container/mirror-deps.js | 331 | 464 |
| gpu-server/job-manager/manager.js | 636 | 639 |
| gpu-server/job-manager/client-config.js | 304 | 328 |

No file crosses 1,000 lines. Verification: `npm test` → 482 pass, 0 fail (run 2026-10-21 in the worktree).

---

## T1. The Vidyagram lane is a hand-built copy of the secure lane, with env vars that must equal constants (CF_VIDYAGRAM lane) — presumptive blocker

**Evidence.** `src/intake-routing.js:205-246` (CF_SECURE) and `:248-285` (CF_VIDYAGRAM) are the same procedure written twice: a local `required()` closure (`:206`, `:249`), the `STORAGE_PROVIDER=r2` check (`:214`, `:259`), the API origin normalisation (`replace(/\/+$/, '')`), and the same `queues.push({... account: {..., securedLane: true}})` shape. They already differ in ways nobody chose: CF_SECURE validates its origin with `new URL()` (https, no path, no credentials) while CF_VIDYAGRAM compares a string; CF_SECURE derives `storageEndpoint` from the account id while CF_VIDYAGRAM requires it in env and then checks it equals the derived value.

The Vidyagram block reads five env vars and then throws unless each equals a literal in the source: `CF_VIDYAGRAM_INTAKE_BUCKET`/`_OUTPUT_BUCKET` (`:256`), `SECURED_API_URL_781` (`:263`), `CF_VIDYAGRAM_ACCOUNT_ID` + `_OUTPUT_ENDPOINT` (`:265`), `CF_VIDYAGRAM_CDN_DOMAIN` (`:269`). A value that has exactly one legal setting is not configuration. It costs the deployer five lines of env that can only be right or a boot crash, and it hides the real contract (these are Vidyagram's resources) behind a validation layer. The commit's own CONTEXT.md entry has to list 11 required vars to explain it.

**Code-judo.** Make the lane a descriptor and have one builder for every secured lane. The pinned facts become code; env carries only the queue id and secrets:

```js
// intake-routing.js
const SECURED_LANES = [
  { prefix: 'CF_SECURE', name: 'secured-recorded-queue',
    clients: env => list(env.SECURED_R2_CLIENTS) },
  { prefix: 'CF_VIDYAGRAM', name: 'vidyagram-intake', clients: () => ['781'],
    visibilityTimeoutMs: 30000, separateIntakeKey: true,
    pinned: { accountId: '1ff6…092a', intakeBucket: 'tempvideos-vidyagram',
              uploadBucket: 'recordedvideos-vidyagram',
              cdnDomain: 'https://vidyagram-recorded.hranker.org',
              apiOrigins: { '781': 'https://backend.vidyagramar.com' } } },
];

function securedLane(e, d) {           // one required(), one r2 check, one origin check
  const req = name => e[name] || fail(`${name} is required for ${d.name}`);
  const pin = (key, envName) => d.pinned?.[key] ?? req(envName);
  ...
}
```

Result: the second lane is ~10 lines of data instead of ~40 lines of procedure; both lanes share the stricter `new URL()` origin check; the "env must equal X" pattern disappears; adding a third tenant lane is a table row. Behaviour is unchanged for both lanes (the existing `client-output.test.js` "every storage/queue fact is required" test shrinks to the facts that are still env).

## T2. A second ffprobe of the same file (1080p rung) — missed simplification

**Evidence.** `container/index.js:526` already probes the source once ("Probe the source once for its duration") through `probeSource` (`:140-183`) → `parseProbe` (`container/source-probe.js:20`), which already extracts `height`. The 1080p change adds `getSourceHeight` (`container/index.js:185-209`), a second hand-rolled `spawn('ffprobe')` with its own stdout/stderr plumbing, called again inside `processVideoToHls` (`:285-291`) behind `Number(HLS_MAX_HEIGHT) > BASE_MAX_HEIGHT`. Its only real addition is rotation (`displayedHeight`, `container/hls-ladder.js:50-57`). The repo now has four ffprobe spawn wrappers (`container/index.js` ×2, `apx-ingest-container/mirror-deps.js:208`, `gpu-server/hls-to-mp4-container/ffmpeg.js:48`).

**Code-judo.** Teach `parseProbe` the displayed height (move `displayedHeight` next to it; it is a pure read of the same JSON), and pass the probe into `processVideoToHls(filePath, { sourceHeight: probe.displayedHeight })`. Then `getSourceHeight`, the conditional probe, the try/catch, and the "not probed" state all disappear; `hlsVariants({ maxHeight, sourceHeight })` already treats an unknown height as "no rung above 720". Every job keeps one probe.

**Constraint.** `container/` is frozen at 5a4cf9b by user decision and the deployed image `video-processor:cf-20261021-hls1080` is built from it, so this lands with the next planned image build, together with T6.

## T3. Two copies of the client tables, already diverged, and the tests check the copy (781 mirror) — presumptive blocker

**Evidence.** `CLIENT_PRIORITIES` lives in `src/index.ts:88-99` and `src/intake-routing.js:20-32`; `callbackApiURls` in `src/index.ts:400-443` and `src/intake-routing.js:49-84`. The diff edits both copies by hand for 472 and 781, and the 781 entries already disagree: the runtime copy is `vidyagramApiUrl(process.env)` (`src/index.ts:442`, honours `CALLBACK_API_URL_781`), the module copy is the constant `VIDYAGRAM_API_URL` (`src/intake-routing.js:83`, ignores it).

```sh
grep -n "CLIENT_PRIORITIES\[\|callbackApiURls\[\|resolveIntakeRoute(" src/*.ts src/*.js
# src/index.ts:176, :640, :641, :752  (runtime)
# src/intake-routing.js:103, :104     (resolveIntakeRoute — no runtime caller)
```

`resolveIntakeRoute` has no caller outside tests, so `test/intake-routing.test.js` asserts the module's copy while the listener runs the other one. The comment at `src/index.ts:439-441` ("Mirrors callbackApiURls in ./intake-routing.js") is the smell in prose.

**Code-judo.** `src/index.ts` already `require('./intake-routing')`. Export the two tables (and `DEFAULT_API_URL`) from there, delete the index.ts copies, and the drift becomes impossible. If the `CALLBACK_API_URL_781` override survives T4 at all, it belongs in the one table.

## T4. 781 is still routable on the shared hranker lane, unsecured (781 mirror + CF_VIDYAGRAM lane) — presumptive blocker

**Evidence.** f721759 made the Vidyagram lane accept only 781 (`securedClients: ['781']`, enforced at `src/intake-message.js:47`). The reverse is not true: the legacy lanes have no `securedClients`, and the 781 entries from fb7d5cd are still wired: `callbackApiURls['781']` (`src/index.ts:442`, `src/intake-routing.js:83`), `vidyagramApiUrl` (`src/intake-routing.js:40-42`), and the hand list `['561', '472', '695', '781']` (`src/index.ts:756`). `test/listener-compatibility.test.js:134-144` pins the behaviour: a `781/…` object in `tempvideos-hranker` (queue index 3, the hranker lane) becomes an unsecured 781 job on `queue:critical`, reporting to the Vidyagram API.

So isolation is one-directional. A stray 781 key in the hranker intake bucket (the AppX remux fallback CONTEXT.md describes when `MIRROR_CLIENTS` omits 781, or a mis-set admin env) would transcode Vidyagram video into quicktricks storage and report it over the unsecured contract the Vidyagram backend rejects. That is the exact separation the dedicated lane exists to guarantee, and it contradicts the Vidyagram-separate rule.

**Code-judo.** Subtract first: delete `vidyagramApiUrl`, both `'781'` callback entries, `CALLBACK_API_URL_781`, the `'781'` in the line-756 list and the test at `listener-compatibility.test.js:134`. Then make client ownership a lane property: a client named by any lane's `securedClients` is refused (left unacked, like the existing rejection) on every other lane. That is one check in `processIntakeMessage`, derived from the assembled queues, instead of per-client lists. The line-756 list itself (`['561','472','695']` = "complete-nodejs LMS, use its own base") should become a field on the client table from T3 so it stops being a fourth hand-synced list.

Quicktricks impact: only 781-prefixed keys on the legacy lanes change behaviour (refused instead of transcoded). This is shared listener code, so it ships on the Vidyagram branch line and is noted to the quicktricks side; nothing merges into a quicktricks branch.

## T5. Each profile field is a new parse block with its own strictness (1080p rung)

**Evidence.** `resolveQueueProfile` (`src/intake-routing.js:392-421`) now has three hand-written blocks. `MP4_RENDITIONS` accepts anything and only acts on `'false'` (`:409`); `HLS_1080P` throws on anything but `true`/`false`/empty (`:414-418`). Boot validation is a regex that must be kept in step by hand (`:434`, `(?:REPORT_CALLBACK_URL|HLS_1080P)`) and does not include `MP4_RENDITIONS`, so `CF_VIDYAGRAM_MP4_RENDITIONS_781=flase` silently keeps MP4 on while a typo in the 1080p var kills boot.

**Code-judo.** One table drives both resolve and validate:

```js
const PROFILE_FIELDS = [
  { suffix: 'REPORT_CALLBACK_URL', apply: (p, v) => (p.reporting = { kind: 'callback', url: parseUrl(v) }) },
  { suffix: 'MP4_RENDITIONS',      apply: (p, v) => bool(v) === false && (p.mp4 = false) },
  { suffix: 'HLS_1080P',           apply: (p, v) => bool(v) && (p.hls = { maxHeight: 1080 }) },
];
// validate = build the regex from PROFILE_FIELDS; bool() throws on anything but true/false/''
```

The next per-client switch is one row, and every switch gets the same fail-closed posture. Changing `MP4_RENDITIONS` to strict is a behaviour change for malformed values only; check the box env has none before shipping.

## T6. "HLS-only" is not a job shape the container knows (1080p rung profile × pre-existing container flags)

**Evidence.** The 781 profile is the first secured job with MP4 off. `container/index.js:555` skips the MP4 pass on the string flag `MP4_RENDITIONS === 'false'`, but `:574` still calls `reportJobComplete({ mp4Urls: [] … })`, and `container/apis.js:284-286` sends the secured recordings report unconditionally. Production saw it: every HLS-only secured job ends FAILED on `recordings-prerecorded` 400 (`vidyagram/reports/vidyagram-1080p-recordings-400-2026-10-21.md`). The output set is inferred from three independent string flags (`MP4_Cleanup`, `MP4_Client`, `MP4_RENDITIONS`) at three places in `init()`.

The mirror got this right in the same branch: `apx-ingest-container/mirror-job.js` makes `mp4` a dependency and skips `postRecordings` when no MP4 exists. The same concept, two implementations, one of them wrong.

**Remedy.** Whatever the backend decides about `output.min(1)`, the container should compute its outputs once (`{ hls: bool, mp4: bool }` from the env at the top of `init()`), and the reporter should take that value rather than an empty array. Container change, so it rides with T2's image build.

## T7. `dist/` is tracked in half (all origins)

**Evidence.** `.gitignore:8` ignores `dist`, yet `git ls-files dist` lists `dist/index.js` and `dist/src/index.js`. `dist/src/index.js` has not changed since `94c06ba init commit` and is a different program (it requires `@aws-sdk/client-ecs`). The runtime siblings `dist/intake-routing.js` and `dist/intake-message.js` (copied by `npm run build`) are untracked, so the tracked artifact cannot run on its own. Every listener commit in this range edits the generated file a second time (4 of the last 5 `dist/index.js` commits are feature commits; the fifth, e3c5938, is a "refresh tracked dist" catch-up).

```sh
node_modules/.bin/tsc --outDir <scratch>; diff -q <scratch>/index.js dist/index.js   # identical today
```

**Remedy.** `git rm --cached dist/index.js dist/src/index.js`. The release directory on the box (`/root/releases/<name>/` + its manifest) is already the real artifact, built from source. This deletes the double edit from every future review.

## T8. Mirror instance modes are read piecemeal (781 mirror)

**Evidence.** A mirror instance's mode is now the product of `CLIENT_ID`, `MIRROR_REPORTING`, `MIRROR_MP4`, `MIRROR_ADD_LEVELS` and `STORAGE_PROVIDER`. `addLevelFromEnv` is called in three places (`apx-ingest-container/index.js:99`, `:217`, `mirror-deps.js:301`), `mp4` is derived as `env.MIRROR_MP4 !== 'off' && !addLevel` (`mirror-deps.js:306`), and `outputValue` (`mirror-deps.js:57-63`) branches on `CLIENT_ID === '472'` inside the shared output resolver to decide whether fallbacks apply. `securedReportUrl` (`mirror-deps.js:140`) is a re-implementation of `container/apis.js:33`, while its siblings `reporter.js`, `recordings-payload.js` and `class-callbacks.js` are vendored byte-for-byte and guarded by tests (`test/apx-mirror-secured-reporting.test.js:25-28`).

**Remedy.** Resolve one `instance` object at boot (`runLoop` already validates there): `{ clientId, reporting, mp4, addLevel, output }`, and pass it down. The 472 fallback becomes "472's deploy env names its buckets" or a single `defaults: client === '472' ? APX_DEFAULTS : {}` at that one site. Vendor `securedReportUrl` the same way as the other modules (or move it into `reporter.js`, already vendored). Lower priority than T1–T6: the mirror path is tested and the 781 mirror run is finished.

## Smaller notes

- `gpu-server/job-manager/client-config.js:133-172`: the `'781'` block is a copy of `'472'` (same image, resources, env, limits). A `...APX_TENANT` spread would say "same shape" in code rather than in a comment. Minor.
- `container/hls-ladder.js:34-47` and `:18-19`: the rate-control mode is chosen by the presence of `quality`. An explicit `rate: { mode: 'abr' | 'cappedQuality' }` reads better, but this is a 60-line module with tests; leave it unless it grows.
- `gpu-server/job-manager/manager.js:281-283` (`HLS_MAX_HEIGHT` from the profile) is the right size and in the right layer. No change.
- Docs drift: `CONTEXT.md:186` still says "(local, 2026-10-21)" and `:203` "Deployment blocked", both superseded by the deploy and the `vidyagram-transcode-job` key. `test/client-output.test.js` now tests the dedicated lane, not a "client output"; rename it with T1.
