# Container: reporter owns the contract; callback; MP4 skip

**Type:** AFK  
**Status:** `ready-for-agent`  
**ADR:** [0007](../../../adr/0007-shorts-readiness-via-transcode-callback.md) decisions 2, 3, 5

## Repo

`repos/video-transcoder`, branch `launch/quicktricks-v2`. Files: `container/apis.js` (today's three
exported reporters and the `SECURED` const), `container/reporter.js` (`sendSecuredReport`, retry +
`ReportError`), `container/index.js` (the `if (SECURED)` block after `uploadHlsDirectory`, the
unconditional `processMp4ToMp4Formats`, the `updateMp4UrlsApi` call, the outer catch),
`container/output-log.js`. Tests: `test/reporter.test.js`, `test/secured-report.test.js`,
`test/recordings-payload.test.js`, `test/output-log.test.js`, `test/video-worker-failure.test.js`.

## What to build

1. **Contract selection in one place.** `apis.js` computes
   `REPORTING = process.env.REPORTING || (process.env.SECURED === 'true' ? 'secured' : 'unsecure')`
   and exports two verbs instead of three contract-specific functions:
   - `reportHlsReady({ masterPlaylistKey, hlsUrl })`: `secured` ⇒ existing stream-status (fatal);
     `unsecure` ⇒ existing class-link (swallowed, as today, with its comment); `callback` ⇒ **no-op**
     (the callback fires once, at job end).
   - `reportJobComplete({ mp4Urls, body, durationSec, hlsKey })`: `secured` ⇒ existing secured
     recordings; `unsecure` ⇒ existing unsecure recordings; `callback` ⇒ one `POST` to
     `REPORT_CALLBACK_URL` via `sendSecuredReport` (header `X-Transcoder-Secret`, existing retry
     classes) with the ADR-0007 body, `status:'processed'`, `outputs.hls.key` = normalised
     bucket-relative key, **no `bucket`**, `durationSec` rounded via `roundDuration`.
   - `reportJobFailed({ error })`: `callback` only ⇒ `POST` with `status:'failed'`, `error: message`,
     best-effort (its own failure is logged, never thrown). Other contracts ⇒ no-op (unchanged
     behaviour).
   Keep the old three names exported as thin aliases if any test imports them; the container's
   `index.js` must call only the new verbs.
2. **`index.js`** stops reading `SECURED`. After `uploadHlsDirectory` ⇒ `await reportHlsReady(...)`.
   `processMp4ToMp4Formats` + `uploadProcessedMp4s` run only when `process.env.MP4_RENDITIONS !== 'false'`;
   otherwise `mp4Urls = []` and the log says why. Then `await reportJobComplete(...)`. The outer catch
   keeps `exitCode = 1` and `updateS3Status('failed')` and adds `await reportJobFailed({ error })`
   **before** the status write, so the LMS learns first even if S3 is the thing that is down.
3. **Fatality rule**: under `callback`, a `ReportError` from `reportJobComplete` propagates to the
   outer catch exactly like stream-status does today. Do not catch it.
4. **`buildLoggedOutputs`** takes `reporting` instead of `secured`; `callback` logs the url form
   (the objects are public) and an `hls` entry so the videos doc shows what was reported.

## Acceptance criteria

- [ ] With no `REPORTING`/`MP4_RENDITIONS` env, the sequence of outbound calls for a secured job and for
      an unsecure job is byte-identical to today (existing `secured-report` / worker tests unchanged).
- [ ] `REPORTING=callback`: `reportHlsReady` makes no request; `reportJobComplete` makes exactly one
      `POST` to `REPORT_CALLBACK_URL` with header `X-Transcoder-Secret`, body deep-equals the expected
      ADR body, `outputs.hls` has no `bucket`, key has no leading slash.
- [ ] Callback 404/401 ⇒ `ReportError` non-retryable propagates; 503 ⇒ retried per `reporter.js`, then
      propagates; 200 ⇒ resolves.
- [ ] Simulated pipeline failure under `callback` ⇒ one `POST` with `status:'failed'` and the error
      message, then `status.json: failed`, exit code 1; the POST failing does not change either.
- [ ] `MP4_RENDITIONS=false` ⇒ `processMp4ToMp4Formats` is never called; `mp4Urls` is `[]`; with the
      var absent it is called exactly as today.
- [ ] Secret never appears in any log line or thrown message (extend the existing redaction test).
- [ ] `npm test` green.

## Do not

- Wrap the secured or callback report in a blanket try/catch. Change the `unsecure` swallow semantics.
- Read a bucket name, queue name, `clientId` list, or the word "shorts" anywhere in the container.
- Rebuild or push an image from this task; task 05 owns the build.
